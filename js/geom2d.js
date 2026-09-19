/* ============================================================
   geom2d.js — Konturmathematik in der Ebene
   Eine Kontur ist ein Array aus {x,y}, implizit geschlossen.
   Eine Glyphe ist { konturen: [{pts, loch}] }.
   Aussenkonturen laufen gegen den Uhrzeigersinn (CCW), Loecher im Uhrzeigersinn.
   ============================================================ */

const EPS = 1e-9;

/* ---------------- Grundrechnen ---------------- */

export function signedArea(pts){
  let a = 0;
  for (let i = 0, n = pts.length; i < n; i++){
    const p = pts[i], q = pts[(i+1) % n];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

export function perimeter(pts){
  let s = 0;
  for (let i = 0, n = pts.length; i < n; i++){
    const p = pts[i], q = pts[(i+1) % n];
    s += Math.hypot(q.x - p.x, q.y - p.y);
  }
  return s;
}

export function centroid(pts){
  let cx = 0, cy = 0, a = 0;
  for (let i = 0, n = pts.length; i < n; i++){
    const p = pts[i], q = pts[(i+1) % n];
    const f = p.x * q.y - q.x * p.y;
    a += f; cx += (p.x + q.x) * f; cy += (p.y + q.y) * f;
  }
  a *= 0.5;
  if (Math.abs(a) < EPS){ // entartet: einfacher Mittelwert
    let sx = 0, sy = 0;
    for (const p of pts){ sx += p.x; sy += p.y; }
    return { x: sx / pts.length, y: sy / pts.length };
  }
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

export function bboxOf(konturen){
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const k of konturen) for (const p of k.pts){
    if (p.x < x0) x0 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.x > x1) x1 = p.x;
    if (p.y > y1) y1 = p.y;
  }
  if (!isFinite(x0)) return { x0:0, y0:0, x1:0, y1:0, w:0, h:0, cx:0, cy:0 };
  return { x0, y0, x1, y1, w: x1-x0, h: y1-y0, cx:(x0+x1)/2, cy:(y0+y1)/2 };
}

export function pointInPoly(pt, pts){
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++){
    const a = pts[i], b = pts[j];
    if ((a.y > pt.y) !== (b.y > pt.y) &&
        pt.x < (b.x - a.x) * (pt.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/* ---------------- Aufbereiten ---------------- */

/** Doppelte und fast gleiche Punkte entfernen. */
export function dedupe(pts, tol = 1e-4){
  const out = [];
  for (const p of pts){
    const last = out[out.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > tol) out.push(p);
  }
  while (out.length > 1){
    const a = out[0], b = out[out.length - 1];
    if (Math.hypot(a.x - b.x, a.y - b.y) <= tol) out.pop(); else break;
  }
  return out;
}

/** Kontur so drehen, dass sie CCW (ccw=true) oder CW laeuft. */
export function orient(pts, ccw){
  return (signedArea(pts) < 0) === ccw ? pts.slice().reverse() : pts;
}

/**
 * Rohkonturen einer Glyphe einordnen: was ist Aussenkontur, was ist Loch.
 * Verschachtelungstiefe gerade -> Material, ungerade -> Loch.
 */
export function classify(rohKonturen){
  const konturen = rohKonturen
    .map(pts => dedupe(pts))
    .filter(pts => pts.length >= 3 && Math.abs(signedArea(pts)) > 1e-6);

  return konturen.map((pts, i) => {
    let tiefe = 0;
    for (let j = 0; j < konturen.length; j++){
      if (i === j) continue;
      if (pointInPoly(pts[0], konturen[j])) tiefe++;
    }
    const loch = (tiefe % 2) === 1;
    return { pts: orient(pts, !loch), loch };
  });
}

/* ---------------- Versetzen (Offset) ---------------- */

/**
 * Kontur nach aussen versetzen. Erwartet CCW.
 * d > 0 vergroessert die eingeschlossene Flaeche, d < 0 verkleinert sie.
 * Gehrung (Miter) mit Begrenzung, damit spitze Ecken keine Nadeln werfen.
 */
export function offsetCCW(pts, d, miterLimit = 3.0){
  const n = pts.length;
  if (n < 3) return [];
  if (Math.abs(d) < 1e-6) return pts.slice();

  const out = [];
  for (let i = 0; i < n; i++){
    const prev = pts[(i - 1 + n) % n], cur = pts[i], next = pts[(i + 1) % n];

    let ax = cur.x - prev.x, ay = cur.y - prev.y;
    let bx = next.x - cur.x, by = next.y - cur.y;
    const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
    if (la < EPS || lb < EPS) continue;
    ax /= la; ay /= la; bx /= lb; by /= lb;

    // Aussennormale bei CCW: rechts der Laufrichtung
    const nax =  ay, nay = -ax;
    const nbx =  by, nby = -bx;

    let mx = nax + nbx, my = nay + nby;
    const lm = Math.hypot(mx, my);
    if (lm < 1e-6){ // Kehrtwende, keine sinnvolle Gehrung
      out.push({ x: cur.x + nax * d, y: cur.y + nay * d });
      continue;
    }
    mx /= lm; my /= lm;
    let scale = 1 / Math.max(mx * nax + my * nay, 1e-6);
    if (scale > miterLimit) scale = miterLimit;
    out.push({ x: cur.x + mx * d * scale, y: cur.y + my * d * scale });
  }
  return out;
}

/**
 * Nach dem Versetzen koennen sich Kanten umdrehen und Schlaufen bilden
 * (typisch, wenn eine duenne Stelle zusammenlaeuft). Solche Punkte entfernen.
 */
export function cleanup(offsetPts, origPts){
  const n = offsetPts.length;
  if (n < 3 || origPts.length !== n) return dedupe(offsetPts);
  const keep = new Array(n).fill(true);
  for (let i = 0; i < n; i++){
    const j = (i + 1) % n;
    const ox = origPts[j].x - origPts[i].x, oy = origPts[j].y - origPts[i].y;
    const nx = offsetPts[j].x - offsetPts[i].x, ny = offsetPts[j].y - offsetPts[i].y;
    if (ox * nx + oy * ny < 0){ keep[i] = false; keep[j] = false; } // Kante hat sich umgedreht
  }
  const out = offsetPts.filter((_, i) => keep[i]);
  return dedupe(out.length >= 3 ? out : []);
}

/* ============================================================
   Versetzen ueber ein Abstandsfeld

   Ein naiver Kantenversatz bricht bei Buchstaben wie x, M oder k
   zusammen: an spitzen Innenecken klappen Kanten um und es entstehen
   Schlaufen, die man nur mit echtem Polygon-Clipping wieder loswird.
   Stattdessen: Glyphe in ein Raster zeichnen, den Abstand zum Rand
   ausrechnen und die Linie gleichen Abstands wieder herausziehen.
   Das ueberlebt auch, wenn eine Form sich teilt oder verschwindet.
   ============================================================ */

/** Glyphe in eine Maske rastern (Nonzero-Regel). */
function rastern(konturen, x0, y0, res, nx, ny){
  const maske = new Uint8Array(nx * ny);
  const kanten = [];
  for (const k of konturen){
    const pts = k.pts;
    for (let i = 0, n = pts.length; i < n; i++){
      const a = pts[i], b = pts[(i + 1) % n];
      if (a.y !== b.y) kanten.push([a.x, a.y, b.x, b.y]);
    }
  }
  const kreuz = [];
  for (let j = 0; j < ny; j++){
    const sy = y0 + (j + 0.5) * res;
    kreuz.length = 0;
    for (const [ax, ay, bx, by] of kanten){
      if ((ay <= sy && by > sy) || (by <= sy && ay > sy)){
        kreuz.push([ax + (sy - ay) / (by - ay) * (bx - ax), by > ay ? 1 : -1]);
      }
    }
    if (!kreuz.length) continue;
    kreuz.sort((p, q) => p[0] - q[0]);
    let wind = 0;
    for (let i = 0; i < kreuz.length - 1; i++){
      wind += kreuz[i][1];
      if (wind === 0) continue;
      const a = Math.max(0, Math.ceil((kreuz[i][0]     - x0) / res - 0.5));
      const b = Math.min(nx - 1, Math.floor((kreuz[i+1][0] - x0) / res - 0.5));
      for (let x = a; x <= b; x++) maske[j * nx + x] = 1;
    }
  }
  return maske;
}

/** Exakte quadratische Abstandstransformation, eine Zeile (Felzenszwalb). */
function dt1d(f, n, d, v, z){
  let k = 0; v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
  for (let q = 1; q < n; q++){
    let s = ((f[q] + q*q) - (f[v[k]] + v[k]*v[k])) / (2*q - 2*v[k]);
    while (s <= z[k]){
      k--;
      s = ((f[q] + q*q) - (f[v[k]] + v[k]*v[k])) / (2*q - 2*v[k]);
    }
    k++; v[k] = q; z[k] = s; z[k+1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++){
    while (z[k+1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}

function edt(quelle, nx, ny){
  const INF = 1e12;
  const f = new Float64Array(Math.max(nx, ny));
  const d = new Float64Array(Math.max(nx, ny));
  const v = new Int32Array(Math.max(nx, ny));
  const z = new Float64Array(Math.max(nx, ny) + 1);
  const feld = new Float64Array(nx * ny);

  for (let x = 0; x < nx; x++){
    for (let y = 0; y < ny; y++) f[y] = quelle[y * nx + x] ? 0 : INF;
    dt1d(f, ny, d, v, z);
    for (let y = 0; y < ny; y++) feld[y * nx + x] = d[y];
  }
  for (let y = 0; y < ny; y++){
    for (let x = 0; x < nx; x++) f[x] = feld[y * nx + x];
    dt1d(f, nx, d, v, z);
    for (let x = 0; x < nx; x++) feld[y * nx + x] = d[x];
  }
  return feld;
}

/** Vorzeichenbehaftetes Abstandsfeld in Millimetern, positiv im Material. */
function abstandsfeld(konturen, d, res){
  const bb = bboxOf(konturen);
  const luft = Math.abs(d) + res * 6;
  const x0 = bb.x0 - luft, y0 = bb.y0 - luft;
  const nx = Math.ceil((bb.w + luft * 2) / res) + 2;
  const ny = Math.ceil((bb.h + luft * 2) / res) + 2;

  const drin = rastern(konturen, x0, y0, res, nx, ny);
  const draussen = new Uint8Array(nx * ny);
  for (let i = 0; i < drin.length; i++) draussen[i] = drin[i] ? 0 : 1;

  const dAussen = edt(draussen, nx, ny);   // fuer Zellen im Material
  const dInnen  = edt(drin, nx, ny);       // fuer Zellen ausserhalb
  const feld = new Float32Array(nx * ny);
  for (let i = 0; i < feld.length; i++){
    feld[i] = (Math.sqrt(dAussen[i]) - Math.sqrt(dInnen[i]) - 0.5) * res;
  }
  return { feld, nx, ny, x0, y0, res };
}

/** Marching Squares: Linie gleichen Abstands herausziehen. */
function isolinie(fd, pegel){
  const { feld, nx, ny, x0, y0, res } = fd;
  const segmente = [];
  const punktAuf = (xa, ya, va, xb, yb, vb) => {
    const t = (pegel - va) / (vb - va || 1e-9);
    return { x: xa + (xb - xa) * t, y: ya + (yb - ya) * t };
  };

  for (let j = 0; j < ny - 1; j++){
    for (let i = 0; i < nx - 1; i++){
      const v0 = feld[j * nx + i],           v1 = feld[j * nx + i + 1];
      const v2 = feld[(j + 1) * nx + i + 1], v3 = feld[(j + 1) * nx + i];
      let code = 0;
      if (v0 > pegel) code |= 1;
      if (v1 > pegel) code |= 2;
      if (v2 > pegel) code |= 4;
      if (v3 > pegel) code |= 8;
      if (code === 0 || code === 15) continue;

      const X = i * res + x0, Y = j * res + y0;
      const u = () => punktAuf(X, Y, v0, X + res, Y, v1);              // unten
      const r = () => punktAuf(X + res, Y, v1, X + res, Y + res, v2);  // rechts
      const o = () => punktAuf(X + res, Y + res, v2, X, Y + res, v3);  // oben
      const l = () => punktAuf(X, Y + res, v3, X, Y, v0);              // links

      // Material liegt links der Laufrichtung
      switch (code){
        case 1:  segmente.push([l(), u()]); break;
        case 2:  segmente.push([u(), r()]); break;
        case 3:  segmente.push([l(), r()]); break;
        case 4:  segmente.push([r(), o()]); break;
        case 6:  segmente.push([u(), o()]); break;
        case 7:  segmente.push([l(), o()]); break;
        case 8:  segmente.push([o(), l()]); break;
        case 9:  segmente.push([o(), u()]); break;
        case 11: segmente.push([o(), r()]); break;
        case 12: segmente.push([r(), l()]); break;
        case 13: segmente.push([r(), u()]); break;
        case 14: segmente.push([u(), l()]); break;
        case 5: {  // Sattel, ueber den Mittelwert aufloesen
          const m = (v0 + v1 + v2 + v3) / 4;
          if (m > pegel){ segmente.push([l(), u()], [r(), o()]); }
          else          { segmente.push([l(), o()], [r(), u()]); }
          break;
        }
        case 10: {
          const m = (v0 + v1 + v2 + v3) / 4;
          if (m > pegel){ segmente.push([u(), r()], [o(), l()]); }
          else          { segmente.push([u(), l()], [o(), r()]); }
          break;
        }
      }
    }
  }

  // Segmente zu geschlossenen Ringen verketten
  const key = p => `${Math.round(p.x / res * 512)},${Math.round(p.y / res * 512)}`;
  const nachStart = new Map();
  for (const s of segmente){
    const k = key(s[0]);
    if (!nachStart.has(k)) nachStart.set(k, []);
    nachStart.get(k).push(s);
  }

  const ringe = [];
  const benutzt = new Set();
  for (const s of segmente){
    if (benutzt.has(s)) continue;
    const ring = [s[0]];
    let akt = s;
    let sicher = segmente.length + 8;
    while (akt && !benutzt.has(akt) && sicher-- > 0){
      benutzt.add(akt);
      ring.push(akt[1]);
      const kandidaten = nachStart.get(key(akt[1]));
      akt = kandidaten?.find(c => !benutzt.has(c));
    }
    const r = dedupe(ring, res * 0.05);
    if (r.length >= 3) ringe.push(r);
  }
  return ringe;
}

/** Douglas-Peucker: Punkte ausduennen, ohne die Form zu verfaelschen. */
export function vereinfachen(pts, tol){
  if (pts.length < 5) return pts;
  const behalten = new Uint8Array(pts.length);
  behalten[0] = 1; behalten[pts.length - 1] = 1;
  const stapel = [[0, pts.length - 1]];
  while (stapel.length){
    const [a, b] = stapel.pop();
    if (b - a < 2) continue;
    const pa = pts[a], pb = pts[b];
    const dx = pb.x - pa.x, dy = pb.y - pa.y;
    const len = Math.hypot(dx, dy) || 1e-9;
    let maxD = -1, maxI = -1;
    for (let i = a + 1; i < b; i++){
      const d = Math.abs((pts[i].x - pa.x) * dy - (pts[i].y - pa.y) * dx) / len;
      if (d > maxD){ maxD = d; maxI = i; }
    }
    if (maxD > tol){
      behalten[maxI] = 1;
      stapel.push([a, maxI], [maxI, b]);
    }
  }
  const out = [];
  for (let i = 0; i < pts.length; i++) if (behalten[i]) out.push(pts[i]);
  return out;
}

/**
 * Manche Schriften bauen einen Buchstaben aus mehreren sich ueberlappenden
 * Konturen — Montserrat zeichnet das kleine a so. Die Punze in der Mitte
 * entsteht dann erst durch die Vereinigung der Teile. Ohne diesen Schritt
 * wuerde das Loch beim Fuellen zulaufen.
 * Ueberlappen sich keine Konturen, bleiben die Originalpunkte unangetastet.
 */
export function vereinigen(konturen){
  const aussen = konturen.filter(k => !k.loch);
  if (aussen.length < 2) return konturen;

  let ueberlappt = false;
  suche:
  for (let i = 0; i < aussen.length; i++){
    const a = bboxOf([aussen[i]]);
    for (let j = i + 1; j < aussen.length; j++){
      const b = bboxOf([aussen[j]]);
      if (a.x1 < b.x0 || b.x1 < a.x0 || a.y1 < b.y0 || b.y1 < a.y0) continue;
      if (aussen[i].pts.some(p => pointInPoly(p, aussen[j].pts)) ||
          aussen[j].pts.some(p => pointInPoly(p, aussen[i].pts))){
        ueberlappt = true; break suche;
      }
    }
  }
  if (!ueberlappt) return konturen;

  const bb = bboxOf(konturen);
  const res = Math.min(0.4, Math.max(0.1, Math.max(bb.w, bb.h) / 400));
  const fd = abstandsfeld(konturen, 0, res);
  const ringe = isolinie(fd, 0).map(r => vereinfachen(r, res * 0.5)).filter(r => r.length >= 3);
  if (!ringe.length) return konturen;
  const neu = classify(ringe);
  return neu.some(k => !k.loch) ? neu : konturen;
}

/**
 * Ganze Glyphe versetzen. d > 0 laesst das Material wachsen
 * (Aussenkonturen groesser, Loecher kleiner), d < 0 schrumpft es.
 * Formen, die dabei verschwinden, fallen raus; Formen, die sich teilen,
 * kommen korrekt als mehrere Konturen zurueck.
 */
export function offsetGlyph(konturen, d, opt = {}){
  if (!konturen.length) return [];
  if (Math.abs(d) < 1e-6) return konturen.map(k => ({ pts: k.pts.slice(), loch: k.loch }));

  // Sehr kleine Betraege loest das Raster nicht mehr auf — dafuer ist der
  // Kantenversatz genauer und bei so wenig Weg auch gutmuetig.
  if (Math.abs(d) < 0.4) return offsetGlyphGleich(konturen, d);

  const bb = bboxOf(konturen);
  const res = opt.res ?? Math.min(0.5, Math.max(0.12, Math.max(bb.w, bb.h) / 320));
  const tol = opt.tol ?? res * 0.5;

  const fd = abstandsfeld(konturen, d, res);
  const ringe = isolinie(fd, -d).map(r => vereinfachen(r, tol)).filter(r => r.length >= 3);
  if (!ringe.length) return [];

  const eingeordnet = classify(ringe);
  return eingeordnet.some(k => !k.loch) ? eingeordnet : [];
}

/**
 * Wie offsetGlyph, aber die Punktzahl je Kontur bleibt exakt gleich.
 * Das ist Pflicht fuer alle Konturen, die spaeter miteinander verloftet
 * werden — sonst verbindet der Loft die falschen Punkte miteinander.
 * Nur fuer kleine Betraege gedacht (Verrundungsradien, Passungsspiel).
 */
export function offsetGlyphGleich(konturen, d){
  const kopie = () => konturen.map(k => ({ pts: k.pts.slice(), loch: k.loch }));
  if (Math.abs(d) < 1e-6) return kopie();
  const out = [];
  for (const k of konturen){
    const ccw = k.loch ? k.pts.slice().reverse() : k.pts;
    // Gehrung auf 1 begrenzen: jeder Punkt wandert genau d weit, nie weiter.
    // An spitzen Innenecken (Kreuzung des x, Kerbe des M) würde eine echte
    // Gehrung viel weiter laufen als der Abstand d — dann überholt diese
    // Kontur die mit dem Abstandsfeld gerechnete Hohlraumkontur, die beiden
    // kreuzen sich und die Stirnfläche lässt sich nicht mehr füllen.
    const raw = offsetCCW(ccw, k.loch ? -d : d, 1);
    if (raw.length !== ccw.length) return kopie();      // Punktzahl muss stimmen
    if (signedArea(raw) <= 1e-6) return kopie();        // umgestuelpt
    // Hat sich irgendwo eine Kante umgedreht, ist eine Schlaufe entstanden.
    // Dann lieber unveraendert lassen als eine kaputte Form liefern.
    for (let i = 0, n = raw.length; i < n; i++){
      const j = (i + 1) % n;
      const ox = ccw[j].x - ccw[i].x, oy = ccw[j].y - ccw[i].y;
      const nx = raw[j].x - raw[i].x, ny = raw[j].y - raw[i].y;
      if (ox * nx + oy * ny < 0) return kopie();
    }
    out.push({ pts: k.loch ? raw.slice().reverse() : raw, loch: k.loch });
  }
  return out;
}

/* ---------------- Umformen ---------------- */

export function mapGlyph(konturen, fn){
  return konturen.map(k => ({ pts: k.pts.map(fn), loch: k.loch }));
}

/** Skalieren um einen Punkt, danach verschieben. Das ist der Fluchtpunkt-Versatz. */
export function scaleShift(konturen, sx, sy, cx, cy, dx, dy){
  return mapGlyph(konturen, p => ({
    x: cx + (p.x - cx) * sx + dx,
    y: cy + (p.y - cy) * sy + dy
  }));
}

/** Kursiv: Scherung um die Grundlinie y=0. */
export function shear(konturen, grad){
  if (!grad) return konturen;
  const t = Math.tan(grad * Math.PI / 180);
  return mapGlyph(konturen, p => ({ x: p.x + p.y * t, y: p.y }));
}

/* ---------------- Kennzahlen ---------------- */

export function glyphArea(konturen){
  let a = 0;
  for (const k of konturen) a += Math.abs(signedArea(k.pts)) * (k.loch ? -1 : 1);
  return a;
}
export function glyphPerimeter(konturen){
  let p = 0;
  for (const k of konturen) p += perimeter(k.pts);
  return p;
}

/**
 * Grobe Strichstaerke: 2 * Flaeche / Umfang.
 * Bei einem langen Rechteck der Breite w kommt genau w heraus,
 * bei Buchstaben ein brauchbarer Mittelwert.
 */
export function strichstaerke(konturen){
  const a = glyphArea(konturen), p = glyphPerimeter(konturen);
  return p > EPS ? (2 * a / p) : 0;
}

/* ---------------- Stege fuer freistehende Inseln ---------------- */

/** Alle Schnittpunkte eines Strahls mit einer Kontur, aufsteigend nach t. */
function rayHits(pts, ox, oy, dx, dy){
  const ts = [];
  for (let i = 0, n = pts.length; i < n; i++){
    const a = pts[i], b = pts[(i + 1) % n];
    const ex = b.x - a.x, ey = b.y - a.y;
    const den = dx * ey - dy * ex;
    if (Math.abs(den) < EPS) continue;
    const t = ((a.x - ox) * ey - (a.y - oy) * ex) / den;   // entlang des Strahls
    const u = ((a.x - ox) * dy - (a.y - oy) * dx) / den;   // entlang der Kante
    if (t > 1e-6 && u >= -1e-9 && u <= 1 + 1e-9) ts.push(t);
  }
  return ts.sort((p, q) => p - q);
}

/**
 * Stege bauen: verbindet jede Insel (Loch-Kontur) mit dem Material aussen herum.
 * Nur noetig, wenn die Buchstaben durch eine Platte geschnitten werden —
 * bei Einzelbuchstaben haelt die Rueckplatte die Insel ohnehin fest.
 * Liefert Rechtecke als Punktlisten (CCW), die spaeter dazuaddiert werden.
 */
export function stege(konturen, breite, richtung = 'senkrecht', anzahl = 2){
  const loecher = konturen.filter(k => k.loch);
  const aussen  = konturen.filter(k => !k.loch);
  if (!loecher.length || !aussen.length) return [];

  const richtungen = richtung === 'waagerecht'
    ? [[1, 0], [-1, 0]]
    : [[0, 1], [0, -1]];

  const out = [];
  for (const loch of loecher){
    const c = centroid(loch.pts);
    if (!pointInPoly(c, loch.pts)) continue;  // C-artige Form, Mittelpunkt liegt draussen

    for (const [dx, dy] of richtungen.slice(0, anzahl)){
      const tIn = rayHits(loch.pts, c.x, c.y, dx, dy)[0];
      if (tIn == null) continue;

      // erste Aussenkante hinter dem Lochrand suchen
      let tOut = null;
      for (const a of aussen){
        for (const t of rayHits(a.pts, c.x, c.y, dx, dy)){
          if (t > tIn + 1e-6 && (tOut == null || t < tOut)) tOut = t;
        }
      }
      if (tOut == null) continue;

      // beidseitig etwas ueberlappen, damit in Fusion sauber verschmolzen wird
      const ue = 0.3;
      const x0 = c.x + dx * (tIn - ue), y0 = c.y + dy * (tIn - ue);
      const x1 = c.x + dx * (tOut + ue), y1 = c.y + dy * (tOut + ue);
      const px = -dy * breite / 2, py = dx * breite / 2;

      const rect = [
        { x: x0 - px, y: y0 - py },
        { x: x1 - px, y: y1 - py },
        { x: x1 + px, y: y1 + py },
        { x: x0 + px, y: y0 + py }
      ];
      out.push({
        pts: orient(rect, true),
        loch: false,
        steg: true,
        info: {
          vonX: +x0.toFixed(2), vonY: +y0.toFixed(2),
          bisX: +x1.toFixed(2), bisY: +y1.toFixed(2),
          breite: +breite.toFixed(2),
          laenge: +Math.hypot(x1 - x0, y1 - y0).toFixed(2)
        }
      });
    }
  }
  return out;
}
