/* ============================================================
   exporter.js — Bauanleitung in Worten + Konfiguration als JSON
   Bei Widersprüchen gilt das JSON.
   ============================================================ */

import { APP_VERSION, SCHEMA_VERSION, fontById, ledById, modusById,
         DRUCKER, MONTAGE, PLATTEN_FORMEN } from './config.js';
import * as G from './geom2d.js';

const n1 = v => (Math.round(v * 10) / 10).toFixed(1);
const n2 = v => (Math.round(v * 100) / 100).toFixed(2);
const n3 = v => String(Math.round(v * 1000) / 1000);
const cm = v => (Math.round(v * 1000) / 10000).toFixed(4);   // mm -> cm, Fusion rechnet intern so

function jetzt(){
  const d = new Date();
  const p = x => String(x).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth()+1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const linie = (z = '=') => z.repeat(66);

/* ============================================================
   JSON
   ============================================================ */
export function baueJSON(cfg, model, lay){
  const k = cfg.koerper;
  const platteAn = k.bauart === 'platte';
  const s = 1 - k.verjuengung / 100;
  const a = k.fluchtRichtung * Math.PI / 180;
  const dx = Math.cos(a) * k.fluchtVersatz;
  const dy = Math.sin(a) * k.fluchtVersatz;
  const drucker = DRUCKER.find(d => d.id === cfg.druck.drucker);

  const buchstaben = model.gruppen.map((g, i) => {
    const bbA = G.bboxOf(g.konturen2d.aussen);
    const bbH = g.konturen2d.hohlraum.length ? G.bboxOf(g.konturen2d.hohlraum) : null;
    const bbF = g.konturen2d.front.length ? G.bboxOf(g.konturen2d.front) : null;
    const teil = model.teile.find(t => t.typ === 'koerper' && t.zeichen === g.zeichen && t.name === g.koerperName);
    return {
      nr: i + 1,
      zeichen: g.zeichen,
      komponenteKoerper: g.koerperName,
      komponenteFront: g.frontName,
      hohl: g.hohl,
      vorderkontur:  { x0:+n2(bbA.x0), y0:+n2(bbA.y0), x1:+n2(bbA.x1), y1:+n2(bbA.y1),
                       breite:+n2(bbA.w), hoehe:+n2(bbA.h), mitteX:+n2(bbA.cx), mitteY:+n2(bbA.cy) },
      hohlraumkontur: bbH ? { breite:+n2(bbH.w), hoehe:+n2(bbH.h) } : null,
      frontkontur:    bbF ? { breite:+n2(bbF.w), hoehe:+n2(bbF.h) } : null,
      rueckflaeche: {
        skalierung: +s.toFixed(4),
        skalierZentrumX: +n2(bbA.cx),
        skalierZentrumY: +n2(bbA.cy),
        versatzX: +n2(dx),
        versatzY: +n2(dy),
        hinweis: 'Rueckkontur = Vorderkontur, um das Zentrum mit "skalierung" skaliert, danach um versatzX/versatzY verschoben.'
      },
      strichstaerke: teil?.strichstaerke ?? null,
      kanalbreite:   teil?.kanalbreite ?? null,
      ledLaengeMm:   teil?.ledLaenge ?? 0
    };
  });

  return {
    erzeugtVon: `Namensschild-Konfigurator ${APP_VERSION}`,
    erzeugtAm: new Date().toISOString(),
    schema: SCHEMA_VERSION,

    fusionHinweise: {
      dokumentEinheit: 'mm',
      apiEinheit: 'cm',
      umrechnung: 'Alle Laengen in dieser Datei sind Millimeter. Die Fusion-API erwartet Zentimeter: durch 10 teilen.',
      reihenfolge: ['Skizzen', 'Extrusionen', 'Loft', 'Shell', 'Teilung', 'Verrundungen zuletzt'],
      verrundungRegel: 'Fillets ganz am Schluss, hoechstens 6 bis 8 Kanten je Operation.',
      pruefungNachExtrude: 'Nach jedem Extrude im Browser pruefen, ob unter Bodies ein neuer Koerper steht.'
    },

    konfiguration: {
      text: cfg.text,
      schrift: { ...cfg.schrift,
                 name: fontById(cfg.schrift.familie).name,
                 datei: fontById(cfg.schrift.familie).file },
      koerper: { ...cfg.koerper },
      platte: platteAn ? { ...cfg.platte,
                           formName: PLATTEN_FORMEN.find(f=>f.id===cfg.platte.form)?.name } : null,
      farben: { ...cfg.farben },
      led: { ...cfg.led,
             typName: ledById(cfg.led.typ).name,
             modusName: modusById(cfg.led.modus).name },
      montage: cfg.montage,
      montageName: MONTAGE.find(m=>m.id===cfg.montage)?.name,
      druck: { ...cfg.druck, druckerName: drucker?.name }
    },

    berechnet: {
      masse: model.masse,
      schrift: lay.schrift,
      bauart: k.bauart,
      buchstaben,
      teile: model.teile,
      led: model.led,
      teilung: model.teilung,
      stege: model.stege,
      warnungen: model.warnungen.map(w => `${w.art}: ${w.text}`)
    },

    komponentenbaum: platteAn
      ? ['Namensschild', ['Basis', 'Diffusor',
         ...model.gruppen.flatMap(g => [g.koerperName, g.frontName])]]
      : ['Namensschild', model.gruppen.flatMap(g => [g.koerperName, g.frontName])]
  };
}

/* ============================================================
   Bauanleitung in Worten
   ============================================================ */
export function baueAnleitung(cfg, model, lay, json){
  const k = cfg.koerper;
  const platteAn = k.bauart === 'platte';
  const f = fontById(cfg.schrift.familie);
  const led = ledById(cfg.led.typ);
  const modus = modusById(cfg.led.modus);
  const drucker = DRUCKER.find(d => d.id === cfg.druck.drucker);
  const montage = MONTAGE.find(m => m.id === cfg.montage);
  const s = 1 - k.verjuengung / 100;
  const a = k.fluchtRichtung * Math.PI / 180;
  const dx = Math.cos(a) * k.fluchtVersatz, dy = Math.sin(a) * k.fluchtVersatz;
  const L = [];
  const p = (...t) => L.push(...t);

  p(linie(), `NAMENSSCHILD  "${cfg.text}"  —  BAUANLEITUNG FÜR FUSION 360`,
    `Erzeugt am ${jetzt()} mit Namensschild-Konfigurator ${APP_VERSION}`, linie(), '');

  /* ---- 0 ---- */
  p('0. AUF EINEN BLICK', linie('-'),
    `Text                 ${cfg.text}   (${model.masse.buchstaben} Buchstaben)`,
    `Schrift              ${f.name}, Versalhöhe ${n1(cfg.schrift.hoehe)} mm`,
    `Bauart               ${platteAn ? 'Buchstaben auf gemeinsamer Grundplatte' : 'Einzelbuchstaben ohne Grundplatte'}`,
    `Außenmaß Schild      ${n1(model.masse.textBreite)} × ${n1(model.masse.textHoehe)} mm, Tiefe ${n1(model.masse.tiefe)} mm`,
    `Komponenten          ${model.teile.length}`,
    `Druckstücke          ${model.masse.druckstuecke}`,
    `LED                  ${led.name}, ${model.led.streifenLaenge} mm Streifen, ca. ${model.led.anzahl} LEDs, ${n1(model.led.watt)} W`,
    `Netzteil             ${led.volt} V / mindestens ${model.led.netzteil} W`, '');

  if (model.warnungen.length){
    p('   Hinweise aus der Prüfung:');
    for (const w of model.warnungen) p(`   [${w.art.toUpperCase()}] ${w.text}`);
    p('');
  }

  /* ---- 1 ---- */
  p('1. EINHEITEN UND VORBEREITUNG', linie('-'),
    '1.1  Neues Dokument. Document Settings → Units → Millimeter.',
    '1.2  Wichtig: Fusion rechnet intern in Zentimetern. Alle Maße unten sind',
    '     Millimeter. Wenn du das über die API/Skript baust, jeden Wert durch 10',
    '     teilen. In der JSON weiter unten steht zu jedem Maß der mm-Wert.',
    '1.3  Am Anfang eine Komponente "Namensschild" anlegen, alles Weitere',
    '     entsteht als Unterkomponente darin.',
    '1.4  Reihenfolge einhalten: erst alle Skizzen, dann Extrusionen und Lofts,',
    '     dann Shell, dann Teilung, und ganz zum Schluss die Verrundungen.', '');

  /* ---- 2 ---- */
  p('2. KONTUREN IN DIE SKIZZE BRINGEN', linie('-'),
    '2.1  Empfohlen: die mitgelieferte SVG-Datei benutzen (Knopf "SVG der',
    '     Konturen" im Export-Fenster). Insert → Insert SVG, Ebene XY.',
    '2.2  Die SVG ist 1:1 in Millimetern gezeichnet. Nach dem Einfügen eine',
    `     Kontrollmessung: das große H bzw. die Versalhöhe muss ${n1(cfg.schrift.hoehe)} mm sein.`,
    '     Stimmt es nicht, in der SVG-Einfügeoption den Maßstab korrigieren.',
    '2.3  Die SVG enthält getrennte Ebenen:',
    '       Kontur_aussen     — Außenkante des Buchstabenkörpers',
    '       Kontur_hohlraum   — Innenkante nach dem Shell (Kontrollkontur)',
    '       Kontur_front      — Frontfläche inkl. Passungsspiel',
    '       Kontur_rueckseite — verkleinerte, versetzte Rückfläche für den Loft',
    platteAn ? '       Kontur_platte     — Außenform der Grundplatte' : null,
    model.stege.length ? '       Stege             — Verbindungsstege für freistehende Inseln' : null,
    '2.4  Alternative ohne SVG: die Buchstaben mit dem Text-Werkzeug schreiben',
    `     (Schrift ${f.name}), dann Explode. Achtung: die Strichstärken-Korrektur`,
    `     von ${n1(cfg.schrift.strichstaerke)} mm ist dann NICHT enthalten und muss über Offset`,
    '     nachgeholt werden.', '');

  /* ---- 3 ---- */
  if (!platteAn){
    p('3. BUCHSTABENKÖRPER  (je Buchstabe eine Komponente)', linie('-'),
      'Für jeden Buchstaben identisch. Die Zahlen je Buchstabe stehen in der',
      'Tabelle unter 3.7.', '',
      '3.1  Neue Komponente anlegen, Name exakt wie in der Tabelle, z. B.',
      `     "${model.gruppen[0]?.koerperName ?? '01_M_Koerper'}".`,
      '3.2  Skizze auf der XY-Ebene: Außenkontur des Buchstabens (Kontur_aussen).',
      `3.3  Extrude Richtung -Z um ${n1(k.geradeTiefe)} mm, Operation "New Body".`,
      '     Das ist der gerade Auszug ohne Versatz.',
      '     >>> Jetzt prüfen: steht im Browser unter Bodies ein neuer Körper?',
      '         Wenn nicht, ist das Profil nicht geschlossen. Sketch öffnen,',
      '         Sketch Palette → Show Profile, offene Enden schließen.',
      `3.4  Konstruktionsebene "Offset Plane" von XY aus, Abstand -${n1(k.tiefe)} mm.`,
      '3.5  Skizze auf dieser Ebene: dieselbe Außenkontur, aber',
      `       a) um den Buchstabenmittelpunkt mit Faktor ${s.toFixed(4)} skaliert`,
      `          (Sketch → Modify → Scale, Punkt = Mitte laut Tabelle)`,
      `       b) danach verschoben um X ${dx >= 0 ? '+' : ''}${n2(dx)} mm, Y ${dy >= 0 ? '+' : ''}${n2(dy)} mm`,
      `     Das ergibt den Fluchtpunkt-Effekt (Richtung ${k.fluchtRichtung}°,`,
      `     Versatz ${n1(k.fluchtVersatz)} mm, Verjüngung ${k.verjuengung} %).`,
      `3.6  Loft von der Rückfläche des geraden Auszugs (bei Z = -${n1(k.geradeTiefe)} mm)`,
      '     zur Skizze aus 3.5. Operation "Join", damit ein Körper entsteht.',
      '     >>> Prüfen: immer noch genau EIN Körper in dieser Komponente?', '');
  } else {
    p('3. BUCHSTABEN ALS ÖFFNUNGEN IN DER PLATTE', linie('-'),
      'Bei dieser Bauart ist der Buchstabe kein eigener Körper, sondern ein',
      'Durchbruch in der Grundplatte. Er bekommt trotzdem einen Namen: die',
      'Skizze bzw. das Cut-Feature heißt wie in der Tabelle unter 3.7,',
      `z. B. "${model.gruppen[0]?.koerperName ?? '01_A_Koerper'}".`, '',
      '3.1  Zuerst die Grundplatte bauen — siehe Abschnitt 6. Erst danach',
      '     die Buchstaben herausschneiden.',
      '3.2  Skizze auf der Vorderseite der Platte (Z = 0): Außenkonturen aller',
      '     Buchstaben (Kontur_aussen).',
      model.stege.length
        ? '3.3  WICHTIG vor dem Schnitt: die Stege zur Kontur addieren, sonst\n' +
          `     fallen die Inseln von ${[...new Set(model.stege.map(x => x.zeichen))].join(', ')} heraus. Maße unter 6.5.`
        : '3.3  Diese Buchstaben haben keine freistehenden Inseln — keine Stege nötig.',
      `3.4  Konstruktionsebene "Offset Plane" von XY, Abstand -${n1(cfg.platte.dicke)} mm.`,
      '3.5  Skizze darauf: dieselben Konturen, aber',
      `       a) um den Buchstabenmittelpunkt mit Faktor ${s.toFixed(4)} skaliert`,
      `       b) verschoben um X ${dx >= 0 ? '+' : ''}${n2(dx)} mm, Y ${dy >= 0 ? '+' : ''}${n2(dy)} mm`,
      '3.6  Loft zwischen beiden Skizzen, Operation "Cut". Die Öffnung wird',
      '     nach hinten enger — das ist der Fluchtpunkt-Effekt.',
      '     >>> Prüfen: die Platte ist noch EIN Körper und die Inseln hängen',
      '         an ihren Stegen.', '');
  }

  p('3.7  Maße je Buchstabe (Millimeter):', '');
  p('     Nr  Zeichen  Komponente                Breite   Höhe   MitteX   MitteY   Kanal');
  p('     ' + '-'.repeat(88));
  for (const b of json.berechnet.buchstaben){
    p(`     ${String(b.nr).padStart(2)}  ${(' ' + b.zeichen).padEnd(7)}  ${b.komponenteKoerper.padEnd(24)} ` +
      `${n1(b.vorderkontur.breite).padStart(6)} ${n1(b.vorderkontur.hoehe).padStart(6)} ` +
      `${n1(b.vorderkontur.mitteX).padStart(8)} ${n1(b.vorderkontur.mitteY).padStart(8)} ` +
      `${(b.kanalbreite != null ? n1(b.kanalbreite) : '—').padStart(7)}`);
  }
  if (!platteAn){
    p('', `     "Kanal" ist die lichte Breite im Hohlraum. Der ${led.kurz} braucht`,
         `     mindestens ${led.minKanal} mm, sonst passt der Streifen nicht hinein.`, '');
  } else {
    p('', '     Bei der Grundplatte liegt der LED-Streifen nicht im Buchstaben,',
         '     sondern in Bahnen hinter dem Diffusor — die Spalte "Kanal"',
         '     entfällt deshalb.', '');
  }

  /* ---- 4 ---- */
  if (!platteAn){
    p('4. AUSHÖHLEN (Shell)', linie('-'),
      `4.1  Modify → Shell. Als zu entfernende Fläche die VORDERE Fläche wählen`,
      '     (die bei Z = 0). Die Rückwand bleibt geschlossen.',
      `4.2  Inside Thickness = ${n1(k.wandstaerke)} mm.`,
      `     Damit bleibt hinten eine Rückwand von ${n1(k.wandstaerke)} mm stehen und der`,
      `     Hohlraum ist ${n1(k.tiefe - k.wandstaerke)} mm tief.`,
      '4.3  Shell schlägt fehl, wenn der Buchstabe an einer Stelle dünner ist als',
      '     die doppelte Wandstärke. Dann Schrift größer, Wandstärke kleiner oder',
      '     Strichstärke erhöhen — die App warnt bereits vorher.',
      '     >>> Prüfen: von hinten reinschauen, ist der Hohlraum durchgehend?', '');
  } else {
    p('4. AUSHÖHLEN (Shell)', linie('-'),
      'Entfällt bei dieser Bauart. Die Platte ist massiv, die Buchstaben sind',
      'durchgeschnitten. Das Licht kommt von hinten durch den Diffusor.', '');
  }

  /* ---- 5 ---- */
  p('5. FRONTFLÄCHE  (je Buchstabe eine Komponente)', linie('-'),
    platteAn
      ? `Sitzt als Presspassung in der Buchstabenöffnung. Spiel gesamt ${n2(k.passung)} mm —`
      : `Sitzt als Presspassung im Hohlraum. Spiel gesamt ${n2(k.passung)} mm —`,
    'das ist der Wert, der sich bei dir bewährt hat.', '',
    '5.1  Neue Komponente, Name exakt wie in der Tabelle, z. B.',
    `     "${model.gruppen[0]?.frontName ?? '01_M_Front'}".`,
    platteAn
      ? '5.2  Skizze auf der Vorderseite der Platte (Z = 0). Die Kante der\n' +
        '     Buchstabenöffnung mit Project auf die Skizze projizieren.'
      : '5.2  Skizze auf der XY-Ebene (Z = 0). Die Innenkante des ausgehöhlten\n' +
        '     Körpers mit Project auf die Skizze projizieren.',
    `5.3  Offset dieser projizierten Kante nach INNEN um ${n3(k.passung / 2)} mm.`,
    `     Rundum ${n3(k.passung / 2)} mm Luft ergibt ${n3(k.passung)} mm Gesamtspiel.`,
    `5.4  Extrude Richtung ${k.ueberstand > 0 ? '+Z' : '-Z'} um ${n1(k.frontDicke)} mm, "New Body".`,
    k.ueberstand > 0
      ? `     Die Front steht ${n1(k.ueberstand)} mm über die Körperkante hinaus.`
      : '     Die Front schließt bündig mit der Körperkante ab (Z = 0 bis Z = -' + n1(k.frontDicke) + ' mm).',
    '     >>> Prüfen: ist ein Körper entstanden, und schwebt er nicht?',
    '5.5  Material: transluzent, damit das Licht durchkommt. Empfehlung',
    `     ${cfg.farben.frontName} bei 15 bis 25 % Infill und 3 Perimetern.`, '');

  /* ---- 6 ---- */
  if (platteAn){
    const pf = PLATTEN_FORMEN.find(x => x.id === cfg.platte.form)?.name ?? cfg.platte.form;
    const pbb = model.teile.find(t => t.typ === 'basis')?.bbox;
    p('6. GRUNDPLATTE UND DIFFUSOR', linie('-'),
      '6.1  Komponente "Basis".',
      `6.2  Skizze auf XY: Außenform ${pf}, ${pbb ? n1(pbb.w) + ' × ' + n1(pbb.h) : '—'} mm,` ,
      `     Randabstand zum Text ${n1(cfg.platte.rand)} mm` +
      (cfg.platte.form === 'abgerundet' ? `, Eckradius ${n1(cfg.platte.eckRadius)} mm.` : '.'),
      `6.3  Extrude -Z um ${n1(cfg.platte.dicke)} mm, "New Body".`,
      '6.4  Jetzt die Buchstaben herausschneiden — genau wie in Abschnitt 3',
      '     beschrieben (Loft-Cut von der vollen zur verkleinerten Kontur).',
      model.stege.length
        ? `6.5  STEGE: ${model.stege.length} Stück, ${n1(cfg.platte.stegBreite)} mm breit, Richtung ${cfg.platte.stegRichtung}.\n` +
          '     Ohne sie fallen die Inseln (Mitte von O, A, R …) heraus. Die Stege\n' +
          '     VOR dem Schnitt zur Kontur addieren, dann bleibt alles ein Teil.\n' +
          '     Positionen (mm):'
        : '6.5  Diese Buchstaben haben keine freistehenden Inseln — keine Stege nötig.',
      null);
    for (const st of model.stege){
      p(`       ${st.zeichen}: von (${n1(st.vonX)}, ${n1(st.vonY)}) nach (${n1(st.bisX)}, ${n1(st.bisY)}), ` +
        `Breite ${n1(st.breite)}, Länge ${n1(st.laenge)}`);
    }
    p('',
      '6.6  Komponente "Diffusor".',
      `6.7  Dieselbe Außenform, Extrude ${n1(cfg.platte.diffusorDicke)} mm, liegt hinten an der`,
      `     Basis an (Z = -${n1(cfg.platte.dicke)} bis -${n1(cfg.platte.dicke + cfg.platte.diffusorDicke)} mm).`,
      '     Durchgehende Platte in transluzentem Material — sie verteilt das Licht',
      '     gleichmäßig hinter allen Öffnungen.',
      '6.8  Die einzelnen Frontflächen aus Schritt 5 sitzen zusätzlich vorn in den',
      '     Öffnungen. Wer nur den Diffusor will, lässt sie weg.', '');
  } else {
    p('6. GRUNDPLATTE', linie('-'),
      'Entfällt. Die Buchstaben hängen einzeln nebeneinander an der Wand.',
      `Empfohlener Abstand zwischen den Buchstaben: ${n1(cfg.schrift.abstand)} mm`,
      '(so ist die Vorschau gerechnet). Zum Ausrichten eine Papierschablone im',
      'Maßstab 1:1 aus der SVG drucken und an die Wand kleben.', '');
  }

  /* ---- 7 ---- */
  p('7. MONTAGE UND KABEL', linie('-'),
    `7.1  Gewählt: ${montage?.name}. ${montage?.hinweis}`,
    cfg.montage === 'schluesselloch'
      ? '7.2  In die Rückwand eine Schlüssellochtasche: Kreis Ø 8 mm, davon nach\n' +
        '     unten ein Schlitz 4 mm breit, 12 mm lang, 2,5 mm tief. Nicht ganz\n' +
        '     durchbrechen — sonst scheint Licht nach hinten heraus.'
      : cfg.montage === 'klebepad'
      ? '7.2  In die Rückwand eine flache Tasche 20 × 20 mm, 1,2 mm tief für das\n' +
        '     Klebepad. Fläche mit 100 % Infill drucken, damit sie hält.'
      : '7.2  Zwei Taschen Ø 6,2 mm, 3,2 mm tief für 6 × 3 mm Magnete\n' +
        `     (0,2 mm Luft). Gegenstücke an der Wand mit gleicher Polung.`,
    `7.3  Kabeldurchführung: Loch Ø 6 mm in der Rückwand, am unteren Rand des`,
    '     Buchstabens, mit 0,5 mm Fase gegen scharfe Kanten.',
    platteAn
      ? '7.4  Bei der Plattenbauart die Kabel in einem 6 × 4 mm Kanal auf der\n' +
        '     Rückseite der Basis von Buchstabe zu Buchstabe führen.'
      : '7.4  Bei Einzelbuchstaben je Buchstabe ein Kabel nach hinten durch die\n' +
        '     Wand, oder alle Buchstaben hinter einer Leiste verbinden.', '');

  /* ---- 8 ---- */
  p('8. LED', linie('-'),
    `8.1  Typ ${led.name}, ${led.volt} V, ${led.breite} mm breit. ${led.hinweis}`,
    `8.2  Streifenlänge gesamt ca. ${model.led.streifenLaenge} mm, ca. ${model.led.anzahl} LEDs.`,
    `8.3  Leistung bei Vollweiß ca. ${n1(model.led.watt)} W. Netzteil mit Reserve:`,
    `     ${led.volt} V, mindestens ${model.led.netzteil} W.`,
    `8.4  Leuchtmodus: ${modus.name}. ${modus.hinweis}`,
    modus.braucht >= 1 ? `     Farbe 1: ${cfg.led.farbe}` : null,
    modus.braucht >= 2 ? `     Farbe 2: ${cfg.led.farbe2}` : null,
    platteAn
      ? `8.5  Der Streifen liegt hinter dem Diffusor in ${model.led.bahnen} waagerechten\n` +
        `     Bahnen à ${model.teile.find(t=>t.typ==='basis') ? n1(model.teile.find(t=>t.typ==='basis').bbox.w) : '—'} mm, Abstand 40 mm.\n` +
        '     Dahinter braucht es einen geschlossenen Rahmen als Lichtkasten.'
      : `8.5  Der Streifen wird im Hohlraum an der Rückwand entlanggeführt.\n` +
        `     Lichte Kanalbreite je Buchstabe siehe Tabelle 3.7 — überall ≥ ${led.minKanal} mm.`,
    platteAn
      ? `8.6  Abstand Streifen zum Diffusor: mindestens ${n1(Math.max(15, cfg.platte.dicke * 1.5))} mm,\n` +
        '     sonst zeichnen sich einzelne LED-Punkte auf der Fläche ab.'
      : `8.6  Abstand Streifen zur Frontfläche: mindestens ${n1(Math.max(8, k.tiefe * 0.35))} mm,\n` +
        '     sonst zeichnen sich einzelne LED-Punkte auf der Front ab.', '');

  /* ---- 9 ---- */
  p('9. TEILUNG FÜRS DRUCKBETT', linie('-'),
    `Drucker: ${drucker?.name ?? '—'}, Bett ${cfg.druck.bettX} × ${cfg.druck.bettY} × ${cfg.druck.bettZ} mm,`,
    `Sicherheitsabstand ${n1(cfg.druck.rand)} mm zur Kante.`, '');

  const geteilt = model.teilung.filter(t => t.geteilt);
  const passtNicht = model.teilung.filter(t => !t.passt && !t.geteilt);

  if (!geteilt.length && !passtNicht.length){
    p('Alle Teile passen einzeln aufs Bett. Nichts zu teilen.', '');
    for (const t of model.teilung){
      p(`   ${t.name.padEnd(26)} ${n1(t.bb.w).padStart(6)} × ${n1(t.bb.h).padStart(6)} × ${n1(t.bb.t).padStart(5)} mm` +
        (t.gedreht ? '   (um 90° gedreht aufs Bett legen)' : ''));
    }
    p('');
  } else {
    for (const t of model.teilung){
      if (t.passt){
        p(`   ${t.name.padEnd(26)} passt  (${n1(t.bb.w)} × ${n1(t.bb.h)} × ${n1(t.bb.t)} mm)` +
          (t.gedreht ? ', um 90° gedreht' : ''));
      } else if (t.geteilt){
        p(`   ${t.name.padEnd(26)} ZU GROSS (${n1(t.bb.w)} × ${n1(t.bb.h)} mm)` +
          ` → ${t.teile} Stücke à ca. ${n1(t.stueckMass.w)} × ${n1(t.stueckMass.h)} mm`);
      } else {
        p(`   ${t.name.padEnd(26)} PASST NICHT und Teilung ist abgeschaltet.`);
      }
    }
    p('');
    if (geteilt.length){
      p('   So wird geteilt:', '',
        '   9.1  Für jede Schnittebene eine Construction Plane anlegen',
        '        (Offset Plane von YZ für x-Schnitte, von XZ für y-Schnitte).',
        '   9.2  Modify → Split Body, Splitting Tool = diese Ebene.',
        '   9.3  Danach die Passstifte setzen — sie sorgen dafür, dass die Hälften',
        '        beim Kleben nicht verrutschen:',
        `        Zapfen  Ø ${n1(cfg.druck.stiftD)} mm, Länge ${n1(cfg.druck.stiftL / 2)} mm je Seite (Extrude "Join")`,
        `        Loch    Ø ${n1(cfg.druck.stiftD + cfg.koerper.passung)} mm, Tiefe ${n1(cfg.druck.stiftL / 2 + 0.5)} mm (Extrude "Cut")`,
        `        Spiel   ${n2(cfg.koerper.passung)} mm — derselbe Wert wie bei der Frontpassung.`,
        '   9.4  Klebefläche: Sekundenkleber oder 2K-Epoxid. Die Schnittfuge liegt',
        '        an der Seite und ist von vorn nicht sichtbar.', '');
      for (const t of geteilt){
        p(`   ${t.name} — ${t.nx} × ${t.ny} Raster, ${t.teile} Stücke:`);
        for (const sch of t.schnitte){
          p(`      Schnitt bei ${sch.achse.toUpperCase()} = ${n2(sch.pos)} mm, ` +
            `${sch.stifte.anzahl} Passstifte bei ${sch.achse === 'x' ? 'Y' : 'X'} = ` +
            sch.stifte.positionen.map(v => n1(v)).join(', ') + ' mm');
        }
        p('');
      }
    }
  }

  /* ---- 10 ---- */
  p('10. VERRUNDUNGEN — GANZ ZUM SCHLUSS', linie('-'));
  if (k.kanten === 'rund'){
    p(platteAn
        ? `10.1  Radius ${n1(k.kantenRadius)} mm auf die vorderen Kanten der\n` +
          '      Buchstabenöffnungen und auf die Außenkante der Grundplatte.'
        : `10.1  Radius ${n1(k.kantenRadius)} mm auf die vordere Außenkante jedes\n` +
          '      Buchstabenkörpers.',
      '10.2  WICHTIG: Fillets in kleinen Gruppen. Höchstens 6 bis 8 Kanten je',
      '      Operation. Bei einem großen Fillet über alle Kanten bricht Fusion',
      '      fast sicher ab.',
      '10.3  Wenn eine Gruppe fehlschlägt: die Gruppe halbieren und einzeln',
      '      wiederholen. Die störende Kante findet man so in wenigen Schritten.',
      '10.4  Reihenfolge je Buchstabe: erst die langen geraden Kanten, dann die',
      '      engen Rundungen (Innenkanten von a, e, o). Enge Innenradien zuletzt.',
      `10.5  Der Radius darf die Wandstärke nicht überschreiten: max ${n1(k.wandstaerke * 0.9)} mm`,
      `      bei ${n1(k.wandstaerke)} mm Wand.`,
      k.ueberstand > 0
        ? `10.6  Frontflächen: gleicher Radius ${n1(Math.min(k.kantenRadius, k.frontDicke * 0.4))} mm auf die vordere Kante.`
        : '10.6  Frontflächen bleiben scharfkantig, sie sitzen bündig im Körper.');
  } else {
    p('10.1  Kanten sind auf "eckig" gestellt — keine Fillets nötig.',
      '10.2  Falls du später doch verrunden willst: erst ganz am Schluss, in',
      '      Gruppen von höchstens 6 bis 8 Kanten.');
  }
  p('');

  /* ---- 11 ---- */
  p('11. PRÜFLISTE VOR DEM EXPORT', linie('-'),
    `[ ] ${model.teile.length} Komponenten vorhanden, Namen exakt wie in der Tabelle`,
    '[ ] jede Komponente enthält genau einen Körper',
    '[ ] keine Skizze ist noch unbestimmt (Sketch-Symbole im Browser prüfen)',
    '[ ] Hohlraum durchgehend, Rückwand geschlossen',
    `[ ] Frontfläche ist rundum ${n3(k.passung / 2)} mm kleiner als der Hohlraum`,
    '[ ] Kabelloch vorhanden',
    model.masse.druckstuecke > model.teile.length
      ? '[ ] Teilungen ausgeführt, Passstifte gesetzt'
      : '[ ] alle Teile passen aufs Bett',
    k.kanten === 'rund' ? '[ ] Verrundungen zuletzt und in kleinen Gruppen gesetzt' : null,
    '[ ] Export als STEP für das Archiv, als 3MF/STL für den Slicer', '');

  /* ---- 12 ---- */
  p('12. DRUCKEINSTELLUNGEN (Vorschlag)', linie('-'),
    `Körper    ${cfg.farben.koerperName}, 0,2 mm Schicht, 3 Perimeter, 15 % Infill,`,
    '          liegend mit der Vorderseite nach unten drucken — dann ist die',
    '          sichtbare Kante glatt und es braucht keine Stützen.',
    `Front     ${cfg.farben.frontName}, 0,2 mm Schicht, 3 Perimeter, 20 % Infill,`,
    '          liegend. Bei 100 % Infill wird das Licht zu stark geschluckt.',
    platteAn ? `Basis     ${cfg.farben.basisName}, 0,2 mm, 4 Perimeter, 15 % Infill` : null,
    platteAn ? `Diffusor  ${cfg.farben.diffusorName}, 0,2 mm, 3 Perimeter, 20 % Infill` : null,
    '', linie(), 'KONFIGURATION ALS JSON — bei Widersprüchen gilt das JSON', linie(), '');

  return L.filter(x => x !== null && x !== undefined).join('\n');
}

/* ============================================================
   Gesamter Exporttext
   ============================================================ */
export function baueExport(cfg, model, lay){
  const json = baueJSON(cfg, model, lay);
  const text = baueAnleitung(cfg, model, lay, json);
  return { text: text + '\n' + JSON.stringify(json, null, 2) + '\n', json };
}

/* ============================================================
   SVG der Konturen, 1:1 in Millimetern
   ============================================================ */
export function baueSVG(cfg, model, lay){
  const alle = [];
  for (const g of model.gruppen){
    alle.push(...g.konturen2d.aussen, ...g.konturen2d.hinten);
  }
  if (model.platte?.kontur) alle.push(model.platte.kontur);
  const bb = G.bboxOf(alle.length ? alle : [{ pts:[{x:0,y:0},{x:10,y:10}] }]);
  const rand = 10;
  const w = bb.w + rand * 2, h = bb.h + rand * 2;

  // SVG hat y nach unten, unsere Konturen y nach oben
  const P = pts => 'M ' + pts.map(p =>
      `${(p.x - bb.x0 + rand).toFixed(3)},${(bb.y1 - p.y + rand).toFixed(3)}`).join(' L ') + ' Z';

  const gruppe = (id, farbe, konturenListe, fuellung = 'none') => {
    if (!konturenListe.length) return '';
    const d = konturenListe.map(k => P(k.pts)).join(' ');
    return `  <g id="${id}" inkscape:label="${id}" inkscape:groupmode="layer">\n` +
           `    <path d="${d}" fill="${fuellung}" fill-rule="evenodd" stroke="${farbe}" stroke-width="0.25"/>\n` +
           `  </g>\n`;
  };

  let body = '';
  if (model.platte?.kontur) body += gruppe('Kontur_platte', '#888888', [model.platte.kontur]);
  body += gruppe('Kontur_aussen',     '#000000', model.gruppen.flatMap(g => g.konturen2d.aussen));
  body += gruppe('Kontur_rueckseite', '#cc0000', model.gruppen.flatMap(g => g.konturen2d.hinten));
  body += gruppe('Kontur_hohlraum',   '#0066cc', model.gruppen.flatMap(g => g.konturen2d.hohlraum));
  body += gruppe('Kontur_front',      '#00aa55', model.gruppen.flatMap(g => g.konturen2d.front));
  if (model.stegKonturen?.length) body += gruppe('Stege', '#ff8800', model.stegKonturen);

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Namensschild "${cfg.text}" — Konturen 1:1 in Millimetern
     Versalhöhe ${n1(cfg.schrift.hoehe)} mm, Schrift ${fontById(cfg.schrift.familie).name}
     Ebenen: Kontur_aussen | Kontur_rueckseite | Kontur_hohlraum | Kontur_front${model.stegKonturen?.length ? ' | Stege' : ''}
     Erzeugt mit Namensschild-Konfigurator ${APP_VERSION} -->
<svg xmlns="http://www.w3.org/2000/svg"
     xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
     width="${w.toFixed(3)}mm" height="${h.toFixed(3)}mm"
     viewBox="0 0 ${w.toFixed(3)} ${h.toFixed(3)}">
  <title>Namensschild ${cfg.text}</title>
${body}</svg>
`;
}

/* ============================================================
   Herunterladen
   ============================================================ */
export function download(name, inhalt, typ = 'text/plain'){
  const blob = new Blob([inhalt], { type: typ + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function dateiName(cfg, endung){
  const rein = (cfg.text || 'Namensschild').replace(/[^A-Za-z0-9äöüÄÖÜß _-]/g, '').trim().replace(/\s+/g, '_') || 'Namensschild';
  return `Namensschild_${rein}.${endung}`;
}
