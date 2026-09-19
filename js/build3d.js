/* ============================================================
   build3d.js — aus den 2D-Konturen wird das Modell
   Liefert sowohl die Three.js-Geometrie fuer die Vorschau
   als auch alle Zahlen, die der Fusion-Export braucht.

   Koordinaten: x rechts, y oben, z nach vorne (zum Betrachter).
   Die Wand liegt bei z = -tiefe, die Vorderseite bei z = 0.
   ============================================================ */

import * as THREE from 'three';
import * as G from './geom2d.js';
import { ledById, modusById, fontById, LEDS } from './config.js';

/* ============================================================
   Kleiner Sammler fuer Dreiecksnetze
   ============================================================ */
class Netz {
  constructor(){ this.pos = []; this.idx = []; this.n = 0; }
  v(x, y, z){ this.pos.push(x, y, z); return this.n++; }
  tri(a, b, c){ this.idx.push(a, b, c); }
  quad(a, b, c, d){ this.idx.push(a, b, c, a, c, d); }
  leer(){ return this.idx.length === 0; }
  geometry(){
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setIndex(this.idx);
    g.computeVertexNormals();
    return g;
  }
}

/* ============================================================
   Konturen gruppieren: welches Loch gehoert zu welcher Aussenkontur
   ============================================================ */
function gruppen(konturen){
  const aussen = konturen.filter(k => !k.loch);
  const loecher = konturen.filter(k => k.loch);
  return aussen.map(a => ({
    outer: a.pts,
    holes: loecher.filter(h => G.pointInPoly(h.pts[0], a.pts)).map(h => h.pts)
  }));
}

/* ============================================================
   Flaeche fuellen (Deckel, Boden)
   ============================================================ */
/* ShapeUtils.triangulateShape ruft .equals() auf den Punkten auf —
   schlichte {x,y}-Objekte reichen dafuer nicht, es muessen Vector2 sein. */
const v2 = pts => pts.map(p => new THREE.Vector2(p.x, p.y));

function fuelle(netz, konturen, z, nachVorne){
  for (const g of gruppen(konturen)){
    const outer = v2(g.outer), holes = g.holes.map(h => v2(h));
    let faces;
    try { faces = THREE.ShapeUtils.triangulateShape(outer, holes); }
    catch (e) { console.warn('Fläche konnte nicht gefüllt werden:', e.message); continue; }
    const alle = outer.concat(...holes);
    const base = netz.n;
    for (const p of alle) netz.v(p.x, p.y, z);
    for (const f of faces){
      if (nachVorne) netz.tri(base + f[0], base + f[1], base + f[2]);
      else           netz.tri(base + f[2], base + f[1], base + f[0]);
    }
  }
}

/**
 * Ringflaeche zwischen der Aussenkontur A und der nach innen versetzten
 * Kontur Ai fuellen — das ist der sichtbare Rand rund um die Frontflaeche.
 */
function fuelleRing(netz, A, Ai, z, nachVorne){
  const aussenA  = A.filter(k => !k.loch);
  const loecherA = A.filter(k =>  k.loch);
  const aussenI  = Ai.filter(k => !k.loch);
  const loecherI = Ai.filter(k =>  k.loch);

  // Ein Loch muss vollstaendig in seiner Aussenkontur liegen. Kreuzen sie
  // sich auch nur an einer Stelle, liefert die Triangulierung Unsinn —
  // dann lieber die Flaeche voll fuellen als kaputte Dreiecke zeichnen.
  const liegtDrin = (innen, aussen) => innen.every(p => G.pointInPoly(p, aussen));

  const regionen = [];
  for (const a of aussenA){
    regionen.push({ outer: a.pts, holes: aussenI.filter(i => liegtDrin(i.pts, a.pts)).map(i => i.pts) });
  }
  for (const h of loecherA){
    const umschliessend = loecherI.find(i => liegtDrin(h.pts, i.pts));
    if (umschliessend) regionen.push({ outer: umschliessend.pts, holes: [h.pts] });
  }

  for (const r of regionen){
    const outer = v2(r.outer), holes = r.holes.map(h => v2(h));
    let faces;
    try { faces = THREE.ShapeUtils.triangulateShape(outer, holes); }
    catch (e) { console.warn('Rand konnte nicht gefüllt werden:', e.message); continue; }
    const alle = outer.concat(...holes);
    const base = netz.n;
    for (const p of alle) netz.v(p.x, p.y, z);
    for (const f of faces){
      if (nachVorne) netz.tri(base + f[0], base + f[1], base + f[2]);
      else           netz.tri(base + f[2], base + f[1], base + f[0]);
    }
  }
}

/* ============================================================
   Seitenwand als Loft zwischen mehreren Ringen
   Scharfe Ecken werden verdoppelt, damit sie scharf bleiben
   und die runden Stellen trotzdem weich schattiert sind.
   ============================================================ */
function eckenAufteilen(pts, grenzGrad = 34){
  const n = pts.length, map = [];
  const kante = i => {
    const a = pts[i], b = pts[(i + 1) % n];
    const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
    return { x: dy / l, y: -dx / l };            // Aussennormale bei CCW
  };
  const cosG = Math.cos(grenzGrad * Math.PI / 180);
  for (let i = 0; i < n; i++){
    const na = kante((i - 1 + n) % n), nb = kante(i);
    map.push(i);
    if (na.x * nb.x + na.y * nb.y < cosG) map.push(i);  // Knick: Punkt doppelt
  }
  return map;
}

/**
 * ringe = [{ konturen, z }] — alle Ringe muessen dieselbe Konturtopologie haben.
 * aussen = true -> Normalen zeigen nach aussen.
 */
function loft(netz, ringe, aussen){
  if (ringe.length < 2) return;
  const ref = ringe[0].konturen;

  // Alle Ringe muessen dieselbe Punktzahl je Kontur haben, sonst verbindet
  // der Loft die falschen Punkte. Passt es nicht, lieber gar nichts zeichnen.
  for (const r of ringe){
    if (r.konturen.length !== ref.length) return;
    for (let i = 0; i < ref.length; i++){
      if (r.konturen[i].pts.length !== ref[i].pts.length) return;
    }
  }

  for (let ci = 0; ci < ref.length; ci++){
    const map = eckenAufteilen(ref[ci].pts);
    const m = map.length;
    if (m < 3) continue;

    const start = netz.n;
    for (const ring of ringe){
      const pts = ring.konturen[ci]?.pts;
      if (!pts) return;
      for (const j of map) netz.v(pts[j].x, pts[j].y, ring.z);
    }

    // Loecher laufen CW, ihre Wandnormale zeigt genau andersherum
    const drehen = aussen === !ref[ci].loch;
    for (let r = 0; r < ringe.length - 1; r++){
      const a0 = start + r * m, a1 = start + (r + 1) * m;
      for (let j = 0; j < m; j++){
        const k = (j + 1) % m;
        if (drehen) netz.quad(a0 + j, a0 + k, a1 + k, a1 + j);
        else        netz.quad(a0 + j, a1 + j, a1 + k, a0 + k);
      }
    }
  }
}

/* ============================================================
   Fluchtpunkt-Umformung: Rueckflaeche verkleinert und versetzt
   ============================================================ */
function hinten(konturen, cfg, mitte){
  const s  = 1 - cfg.koerper.verjuengung / 100;
  const a  = cfg.koerper.fluchtRichtung * Math.PI / 180;
  const dx = Math.cos(a) * cfg.koerper.fluchtVersatz;
  const dy = Math.sin(a) * cfg.koerper.fluchtVersatz;
  return G.scaleShift(konturen, s, s, mitte.cx, mitte.cy, dx, dy);
}

/** Zwischenzustand auf dem Weg von vorne nach hinten, t von 0 bis 1. */
function zwischen(konturen, cfg, mitte, t){
  const s  = 1 - (cfg.koerper.verjuengung / 100) * t;
  const a  = cfg.koerper.fluchtRichtung * Math.PI / 180;
  const dx = Math.cos(a) * cfg.koerper.fluchtVersatz * t;
  const dy = Math.sin(a) * cfg.koerper.fluchtVersatz * t;
  return G.scaleShift(konturen, s, s, mitte.cx, mitte.cy, dx, dy);
}

/* ============================================================
   Ein Buchstabenkoerper
   ============================================================ */
function buchstabenKoerper(cfg, A, mitte){
  const k = cfg.koerper;
  const tiefe = k.tiefe;
  const gerade = Math.min(k.geradeTiefe, tiefe);
  const wand = k.wandstaerke;
  const rund = k.kanten === 'rund';
  const r = rund ? Math.min(k.kantenRadius, wand * 0.9, tiefe * 0.4) : 0;

  const Ai = G.offsetGlyph(A, -wand);              // Kontur des Hohlraums
  const hohl = Ai.length > 0;

  const netz = new Netz();
  const ringe = [];

  // 1) Verrundung der vorderen Aussenkante
  if (rund && r > 0.05){
    const N = 4;
    for (let i = 0; i <= N; i++){
      const a = (i / N) * Math.PI / 2;             // 0 = Stirnflaeche, 90 = Wand
      const inset = r * (1 - Math.sin(a));
      const z = -r * (1 - Math.cos(a));
      // Punktzahl muss erhalten bleiben, sonst passt der Loft nicht zusammen
      const kont = inset > 0.005 ? G.offsetGlyphGleich(A, -inset) : A;
      ringe.push({ konturen: kont, z });
    }
  }
  if (!ringe.length) ringe.push({ konturen: A, z: 0 });

  // 2) gerader Auszug
  if (gerade > r + 0.05) ringe.push({ konturen: A, z: -gerade });

  // 3) Loft nach hinten
  const restTiefe = tiefe - gerade;
  if (restTiefe > 0.05){
    const stufen = 6;                              // Zwischenringe = weiche Schraege
    for (let i = 1; i <= stufen; i++){
      const t = i / stufen;
      ringe.push({ konturen: zwischen(A, cfg, mitte, t), z: -gerade - restTiefe * t });
    }
  } else if (ringe[ringe.length - 1].z > -tiefe + 0.01){
    ringe.push({ konturen: A, z: -tiefe });
  }

  loft(netz, ringe, true);

  // 4) Rueckwand
  const B = ringe[ringe.length - 1].konturen;
  fuelle(netz, B, -tiefe, false);

  // 5) Stirnflaeche: Ring zwischen Aussenkante und Hohlraum
  const vorderRing = ringe[0].konturen;
  if (hohl) fuelleRing(netz, vorderRing, Ai, ringe[0].z, true);
  else      fuelle(netz, vorderRing, ringe[0].z, true);

  // 6) Innenwand und Boden des Hohlraums
  let hohlraumTiefe = 0;
  if (hohl){
    const bodenZ = -(tiefe - wand);
    hohlraumTiefe = tiefe - wand;
    const iRinge = [{ konturen: Ai, z: ringe[0].z }];
    if (gerade > 0.05) iRinge.push({ konturen: Ai, z: -gerade });
    const iRest = hohlraumTiefe - gerade;
    if (iRest > 0.05){
      const stufen = 6;
      for (let i = 1; i <= stufen; i++){
        const t = (gerade + iRest * (i / stufen)) / tiefe;
        iRinge.push({ konturen: zwischen(Ai, cfg, mitte, t), z: -gerade - iRest * (i / stufen) });
      }
    }
    loft(netz, iRinge, false);
    fuelle(netz, iRinge[iRinge.length - 1].konturen, bodenZ, true);
  }

  return { geometry: netz.leer() ? null : netz.geometry(), Ai, hohl, hohlraumTiefe, rueckKonturen: B };
}

/* ============================================================
   Frontflaeche (Diffusor eines Buchstabens)
   Presspassung: rundum halbes Spiel kleiner als der Hohlraum.
   ============================================================ */
function buchstabenFront(cfg, Ai){
  const k = cfg.koerper;
  const F = G.offsetGlyph(Ai, -k.passung / 2);
  if (!F.length) return { geometry: null, konturen: [] };

  const zVorn = k.ueberstand;
  const zHint = k.ueberstand - k.frontDicke;
  const netz = new Netz();
  const rund = k.kanten === 'rund' && k.ueberstand > 0.05;
  const r = rund ? Math.min(k.kantenRadius, k.frontDicke * 0.4) : 0;

  const ringe = [];
  if (r > 0.05){
    const N = 3;
    for (let i = 0; i <= N; i++){
      const a = (i / N) * Math.PI / 2;
      const kont = G.offsetGlyphGleich(F, -r * (1 - Math.sin(a)));
      ringe.push({ konturen: kont, z: zVorn - r * (1 - Math.cos(a)) });
    }
  }
  if (!ringe.length) ringe.push({ konturen: F, z: zVorn });
  ringe.push({ konturen: F, z: zHint });

  loft(netz, ringe, true);
  fuelle(netz, ringe[0].konturen, ringe[0].z, true);
  fuelle(netz, F, zHint, false);

  return { geometry: netz.leer() ? null : netz.geometry(), konturen: F, zVorn, zHint };
}

/* ============================================================
   Grundplatte und durchgehender Diffusor
   ============================================================ */
function plattenKontur(cfg, bb){
  const p = cfg.platte;
  const x0 = bb.x0 - p.rand, x1 = bb.x1 + p.rand;
  const y0 = bb.y0 - p.rand, y1 = bb.y1 + p.rand;
  const w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const pts = [];

  const bogen = (mx, my, rx, ry, a0, a1, n) => {
    for (let i = 0; i <= n; i++){
      const a = a0 + (a1 - a0) * (i / n);
      pts.push({ x: mx + Math.cos(a) * rx, y: my + Math.sin(a) * ry });
    }
  };

  if (p.form === 'ellipse'){
    bogen(cx, cy, w / 2 * 1.06, h / 2 * 1.12, 0, Math.PI * 2, 96);
    pts.pop();
  } else if (p.form === 'pill'){
    const r = h / 2;
    bogen(x1 - r, cy, r, r, -Math.PI / 2, Math.PI / 2, 32);
    bogen(x0 + r, cy, r, r, Math.PI / 2, Math.PI * 1.5, 32);
  } else {
    const r = p.form === 'abgerundet' ? Math.min(p.eckRadius, w / 2 - 0.1, h / 2 - 0.1) : 0;
    if (r > 0.2){
      bogen(x1 - r, y0 + r, r, r, -Math.PI / 2, 0, 12);
      bogen(x1 - r, y1 - r, r, r, 0, Math.PI / 2, 12);
      bogen(x0 + r, y1 - r, r, r, Math.PI / 2, Math.PI, 12);
      bogen(x0 + r, y0 + r, r, r, Math.PI, Math.PI * 1.5, 12);
    } else {
      pts.push({ x:x1, y:y0 }, { x:x1, y:y1 }, { x:x0, y:y1 }, { x:x0, y:y0 });
    }
  }
  return { pts: G.orient(G.dedupe(pts), true), loch: false };
}

/**
 * Basisplatte: Aussenform mit durchgeschnittenen, sich nach hinten
 * verjuengenden Buchstabenoeffnungen. Freistehende Inseln haengen an Stegen.
 */
/** Buchstabenkontur in eine Oeffnung umdrehen: aus Material wird Loch. */
function alsOeffnung(konturen){
  return konturen.map(k => ({ pts: k.pts.slice().reverse(), loch: !k.loch }));
}

function basisPlatte(cfg, kontur, letters, stegListe){
  const p = cfg.platte;
  const dicke = p.dicke;
  const netz = new Netz();

  // Platte mit durchgeschnittenen Buchstaben. Die Punzen von A, O, B
  // bleiben dabei als Inseln stehen — die haengen nachher an den Stegen.
  const platte = [kontur, ...letters.flatMap(l => alsOeffnung(l.konturen))];

  fuelle(netz, platte, 0, true);
  fuelle(netz, platte, -dicke, false);

  // Aussenwand
  loft(netz, [{ konturen: [kontur], z: 0 }, { konturen: [kontur], z: -dicke }], true);

  // Innenwaende der Oeffnungen, nach hinten verjuengt — das ist der 3D-Effekt
  for (const l of letters){
    const auf = alsOeffnung(l.konturen);
    loft(netz, [{ konturen: auf, z: 0 }, { konturen: hinten(auf, cfg, l.bbox), z: -dicke }], false);
  }

  // Stege als kleine Querbalken durch die Oeffnung. In Fusion werden sie
  // vor dem Schnitt zur Kontur addiert, hier reicht der aufgesetzte Balken.
  for (const s of stegListe){
    const balken = [{ pts: s.pts, loch: false }];
    // Hauchdünn vor die Plattenebene legen. In Wirklichkeit ist der Steg
    // bündig, aber so streiten sich Steg und Frontfläche nicht um dieselbe
    // Tiefe und die Vorschau flimmert nicht.
    const zv = 0.06;
    fuelle(netz, balken, zv, true);
    fuelle(netz, balken, -dicke, false);
    loft(netz, [{ konturen: balken, z: zv }, { konturen: balken, z: -dicke }], true);
  }

  return netz.leer() ? null : netz.geometry();
}

function diffusorPlatte(cfg, kontur){
  const netz = new Netz();
  const d = cfg.platte.diffusorDicke;
  const z0 = -cfg.platte.dicke;
  fuelle(netz, [kontur], z0, true);
  fuelle(netz, [kontur], z0 - d, false);
  loft(netz, [{ konturen: [kontur], z: z0 }, { konturen: [kontur], z: z0 - d }], true);
  return netz.geometry();
}

/* ============================================================
   Teilung fuer das Druckbett
   ============================================================ */
function teilungFuer(name, bb, hoehe, cfg){
  const d = cfg.druck;
  const maxX = d.bettX - 2 * d.rand;
  const maxY = d.bettY - 2 * d.rand;
  const maxZ = d.bettZ - d.rand;

  const passtNormal  = bb.w <= maxX && bb.h <= maxY;
  const passtGedreht = bb.w <= maxY && bb.h <= maxX;
  const zPasst = hoehe <= maxZ;

  if ((passtNormal || passtGedreht) && zPasst){
    return { name, passt:true, gedreht: !passtNormal && passtGedreht, teile:1,
             bb:{ w:+bb.w.toFixed(1), h:+bb.h.toFixed(1), t:+hoehe.toFixed(1) }, schnitte:[] };
  }
  if (!cfg.druck.teilen){
    return { name, passt:false, teile:1, zuHoch: !zPasst,
             bb:{ w:+bb.w.toFixed(1), h:+bb.h.toFixed(1), t:+hoehe.toFixed(1) }, schnitte:[] };
  }

  const nx = Math.max(1, Math.ceil(bb.w / maxX - 1e-6));
  const ny = Math.max(1, Math.ceil(bb.h / maxY - 1e-6));
  const schnitte = [];
  for (let i = 1; i < nx; i++){
    const x = bb.x0 + (bb.w / nx) * i;
    schnitte.push({ achse:'x', pos:+x.toFixed(2), stifte: stiftePlan(bb.y0, bb.y1, cfg) });
  }
  for (let i = 1; i < ny; i++){
    const y = bb.y0 + (bb.h / ny) * i;
    schnitte.push({ achse:'y', pos:+y.toFixed(2), stifte: stiftePlan(bb.x0, bb.x1, cfg) });
  }
  return {
    name, passt:false, geteilt:true, teile: nx * ny, nx, ny, zuHoch: !zPasst,
    bb:{ w:+bb.w.toFixed(1), h:+bb.h.toFixed(1), t:+hoehe.toFixed(1) },
    stueckMass:{ w:+(bb.w/nx).toFixed(1), h:+(bb.h/ny).toFixed(1) },
    schnitte
  };
}

function stiftePlan(a, b, cfg){
  const laenge = b - a;
  const anzahl = Math.max(2, Math.round(laenge / 45));
  const out = [];
  for (let i = 0; i < anzahl; i++){
    out.push(+(a + laenge * (i + 1) / (anzahl + 1)).toFixed(2));
  }
  return { anzahl, positionen: out, durchmesser: cfg.druck.stiftD,
           tiefeJeSeite: +(cfg.druck.stiftL / 2).toFixed(1), spiel: cfg.koerper.passung };
}

/* ============================================================
   Hauptfunktion
   ============================================================ */
export function buildModel(cfg, lay){
  const warnungen = [];
  const teile = [];
  const gruppenListe = [];
  const stegInfos = [];

  if (!lay.bereit || !lay.letters.length){
    return { teile:[], gruppen:[], warnungen:[{ art:'info', text:'Kein Text — gib oben einen Namen ein.' }],
             masse:{}, led:{}, teilung:[], stege:[] };
  }
  if (lay.fehlend.length){
    warnungen.push({ art:'err', text:`Die gewählte Schrift kennt diese Zeichen nicht: ${lay.fehlend.join(' ')}` });
  }

  const k = cfg.koerper;
  const platteAn = k.bauart === 'platte';
  const gesamtBB = lay.bbox;

  /* -------- Stege (nur bei durchgeschnittener Platte noetig) -------- */
  let alleStege = [];
  if (platteAn && cfg.platte.stege){
    for (const l of lay.letters){
      const s = G.stege(l.konturen, cfg.platte.stegBreite, cfg.platte.stegRichtung);
      for (const st of s) stegInfos.push({ zeichen: l.zeichen, ...st.info });
      alleStege = alleStege.concat(s);
    }
  }

  /* -------- Buchstaben -------- */
  let ledLaengeGesamt = 0;
  let engsteStelle = Infinity;
  let ledBahnen = 0;

  for (const l of lay.letters){
    const mitte = l.bbox;

    // Einzelbuchstaben: echte Schale mit Hohlraum.
    // Grundplatte: der Buchstabe ist eine Oeffnung in der Platte, es gibt
    // keine eigene Schale — nur die Frontflaeche, die in der Oeffnung sitzt.
    const koerper = platteAn
      ? { geometry:null, Ai:l.konturen, hohl:true, hohlraumTiefe:cfg.platte.dicke, rueckKonturen:hinten(l.konturen, cfg, mitte) }
      : buchstabenKoerper(cfg, l.konturen, mitte);
    const front = koerper.hohl ? buchstabenFront(cfg, koerper.Ai) : { geometry:null, konturen:[] };

    const strich = G.strichstaerke(l.konturen);
    const kanal = strich - 2 * k.wandstaerke;
    if (!platteAn){
      if (koerper.hohl) engsteStelle = Math.min(engsteStelle, kanal);
      // Der Streifen laeuft im Hohlraum an der Rueckwand entlang
      ledLaengeGesamt += koerper.hohl ? G.glyphPerimeter(koerper.Ai) * 0.5 : 0;
    }

    const name = safeName(l.zeichen, l.index);
    const bbGesamt = G.bboxOf([...l.konturen, ...koerper.rueckKonturen]);

    gruppenListe.push({
      id: `L${l.index}`,
      zeichen: l.zeichen,
      koerperName: `${name}_Koerper`,
      frontName: `${name}_Front`,
      geoKoerper: koerper.geometry,
      geoFront: front.geometry,
      hohl: koerper.hohl,
      bbox: bbGesamt,
      // Konturen im Klartext — daraus baut der Export die SVG und die Maßangaben
      konturen2d: {
        aussen:   l.konturen,
        hohlraum: koerper.Ai,
        front:    front.konturen,
        hinten:   koerper.rueckKonturen
      }
    });

    teile.push({
      typ:'koerper', name:`${name}_Koerper`, zeichen:l.zeichen,
      // Bei der Grundplatte ist der "Koerper" kein eigener Solid, sondern
      // die verjuengte Oeffnung in der Basis. Der Name bleibt trotzdem.
      art: platteAn ? 'oeffnung-in-basis' : 'eigene-schale',
      bbox:{ x0:+mitte.x0.toFixed(2), y0:+mitte.y0.toFixed(2), x1:+mitte.x1.toFixed(2), y1:+mitte.y1.toFixed(2),
             w:+mitte.w.toFixed(2), h:+mitte.h.toFixed(2) },
      bboxMitVersatz:{ w:+bbGesamt.w.toFixed(2), h:+bbGesamt.h.toFixed(2) },
      tiefe: platteAn ? cfg.platte.dicke : k.tiefe,
      wandstaerke: platteAn ? null : k.wandstaerke,
      hohlraumTiefe:+koerper.hohlraumTiefe.toFixed(2),
      strichstaerke:+strich.toFixed(2),
      kanalbreite: platteAn ? null : +kanal.toFixed(2),
      ledLaenge: platteAn ? 0 : Math.round(G.glyphPerimeter(koerper.Ai) * 0.5),
      hohl:koerper.hohl
    });

    if (koerper.hohl && front.konturen.length){
      teile.push({
        typ:'front', name:`${name}_Front`, zeichen:l.zeichen,
        dicke:k.frontDicke, ueberstand:k.ueberstand, passung:k.passung,
        bbox:{ w:+G.bboxOf(front.konturen).w.toFixed(2), h:+G.bboxOf(front.konturen).h.toFixed(2) }
      });
    }
  }

  /* -------- Platte -------- */
  let plattenGeo = null, diffusorGeo = null, pKontur = null;
  if (platteAn){
    pKontur = plattenKontur(cfg, gesamtBB);
    plattenGeo = basisPlatte(cfg, pKontur, lay.letters, alleStege);
    diffusorGeo = diffusorPlatte(cfg, pKontur);
    const pbb = G.bboxOf([pKontur]);
    teile.push({ typ:'basis', name:'Basis', form:cfg.platte.form, dicke:cfg.platte.dicke,
                 bbox:{ w:+pbb.w.toFixed(1), h:+pbb.h.toFixed(1) },
                 oeffnungen:lay.letters.length, stege:stegInfos.length });
    teile.push({ typ:'diffusor', name:'Diffusor', dicke:cfg.platte.diffusorDicke,
                 bbox:{ w:+pbb.w.toFixed(1), h:+pbb.h.toFixed(1) } });

    // Bei der Platte liegt der Streifen nicht im Buchstaben, sondern in
    // Bahnen hinter dem Diffusor. Abstand der Bahnen: 40 mm.
    const bahnen = Math.max(1, Math.round(pbb.h / 40));
    ledLaengeGesamt = bahnen * pbb.w;
    ledBahnen = bahnen;
  }

  /* -------- Teilung fuers Druckbett --------
     Jedes Teil, das wirklich gedruckt wird, kommt auf den Pruefstand:
     bei der Platte Basis und Diffusor, sonst jede Buchstabenschale —
     und in beiden Faellen zusaetzlich jede Frontflaeche.              */
  const teilung = [];
  if (platteAn && pKontur){
    const pbb = G.bboxOf([pKontur]);
    teilung.push(teilungFuer('Basis', pbb, cfg.platte.dicke, cfg));
    teilung.push(teilungFuer('Diffusor', pbb, cfg.platte.diffusorDicke, cfg));
  } else {
    for (const g of gruppenListe){
      teilung.push(teilungFuer(g.koerperName, g.bbox, k.tiefe, cfg));
    }
  }
  for (const g of gruppenListe){
    if (!g.konturen2d.front.length) continue;
    teilung.push(teilungFuer(g.frontName, G.bboxOf(g.konturen2d.front),
                             k.frontDicke + k.ueberstand, cfg));
  }
  const zuTeilen = teilung.filter(t => t.geteilt);
  const passtNicht = teilung.filter(t => !t.passt && !t.geteilt);

  /* -------- Warnungen -------- */
  const led = ledById(cfg.led.typ);
  const modus = modusById(cfg.led.modus);

  if (isFinite(engsteStelle) && engsteStelle < led.minKanal){
    warnungen.push({ art:'warn', text:
      `Der Hohlraum ist an der engsten Stelle nur etwa ${engsteStelle.toFixed(1)} mm breit. ` +
      `Der ${led.kurz}-Streifen braucht ${led.minKanal} mm. Schrift größer, Wand dünner oder Strichstärke erhöhen.` });
  }
  if (gruppenListe.some(g => !g.hohl)){
    warnungen.push({ art:'err', text:
      `Bei dieser Größe bleibt kein Hohlraum übrig — die Wandstärke von ${k.wandstaerke} mm frisst den Buchstaben auf. Schrift vergrößern oder Wand dünner machen.` });
  }
  if (!modus.animiert && modus.id !== 'statisch' && !led.adressierbar){
    // nur Hinweis, kein Fehler
  }
  if ((cfg.led.modus === 'regenbogen' || cfg.led.modus === 'lauflicht') && !led.adressierbar){
    warnungen.push({ art:'warn', text:
      `${modus.name} braucht adressierbare LEDs. Der ${led.kurz} kann nur eine Farbe für den ganzen Streifen.` });
  }
  if (zuTeilen.length){
    const stk = zuTeilen.reduce((s,t)=>s+t.teile, 0);
    warnungen.push({ art:'info', text:
      `Zu groß fürs Druckbett: ${zuTeilen.map(t=>t.name).join(', ')}. ` +
      `Die App teilt automatisch in ${stk} Stücke mit Passstiften — Maße stehen im Export.` });
  }
  if (passtNicht.length){
    warnungen.push({ art:'err', text:
      `${passtNicht.map(t=>t.name).join(', ')} passt nicht aufs Bett und die automatische Teilung ist aus.` });
  }
  if (k.geradeTiefe >= k.tiefe - 0.05 && k.fluchtVersatz > 0){
    warnungen.push({ art:'info', text:
      'Der gerade Auszug ist so tief wie das ganze Teil — der Fluchtpunkt-Effekt ist dadurch abgeschaltet.' });
  }

  /* -------- LED-Rechnung -------- */
  const laengeM = ledLaengeGesamt / 1000;
  const anzahlLeds = Math.round(laengeM * led.ledProM);
  const watt = laengeM * led.wattProM;
  const netzteil = naechstesNetzteil(watt * 1.3);

  return {
    teile, gruppen: gruppenListe, warnungen, teilung, stege: stegInfos,
    stegKonturen: alleStege,
    platte: platteAn ? { geoBasis: plattenGeo, geoDiffusor: diffusorGeo, kontur: pKontur } : null,
    masse: {
      textBreite: +gesamtBB.w.toFixed(1),
      textHoehe: +gesamtBB.h.toFixed(1),
      tiefe: platteAn ? +(cfg.platte.dicke + cfg.platte.diffusorDicke).toFixed(1) : k.tiefe,
      buchstaben: lay.letters.length,
      teileGesamt: teile.length,
      druckstuecke: teilung.reduce((s,t)=>s+t.teile, 0)
    },
    led: {
      typ: led.id, name: led.name, kurz: led.kurz, volt: led.volt,
      streifenLaenge: Math.round(ledLaengeGesamt),
      anzahl: anzahlLeds,
      watt: +watt.toFixed(1),
      netzteil,
      bahnen: ledBahnen,
      modus: modus.id, modusName: modus.name,
      adressierbar: led.adressierbar,
      breite: led.breite
    }
  };
}

function naechstesNetzteil(watt){
  for (const w of [10, 18, 24, 36, 60, 100, 150, 200, 350]) if (watt <= w) return w;
  return Math.ceil(watt / 100) * 100;
}

/** Aus einem Zeichen einen Namen machen, den Fusion als Komponente akzeptiert. */
export function safeName(zeichen, index){
  const map = { 'Ä':'Ae','Ö':'Oe','Ü':'Ue','ä':'ae','ö':'oe','ü':'ue','ß':'ss','&':'und','-':'Strich','.':'Punkt','!':'Ruf','?':'Frage' };
  let s = map[zeichen] ?? zeichen;
  if (!/^[A-Za-z0-9_]+$/.test(s)) s = 'Z' + zeichen.codePointAt(0).toString(16).toUpperCase();
  const gross = /[A-Z]/.test(zeichen) ? '' : (/[a-z]/.test(zeichen) ? '_klein' : '');
  return `${String(index + 1).padStart(2, '0')}_${s}${gross}`;
}

export { plattenKontur };
