/* ============================================================
   app.js — alles zusammenstecken
   ============================================================ */

import * as C from './config.js';
import * as F from './fonts.js';
import { buildModel } from './build3d.js';
import { Vorschau } from './scene.js';
import * as E from './exporter.js';
import * as U from './ui.js';

const $ = s => document.querySelector(s);

const cfg = C.load();
let vorschau = null;
let lay = null;
let model = null;
let aktiveSeite = 'text';
let syncListe = [];
let neuAufbauGeplant = false;
let speicherTimer = null;

/* ============================================================
   Schriften auch für die Vorschau-Knöpfe im Browser verfügbar machen
   ============================================================ */
function fontFaceRegeln(){
  const css = C.FONTS.map(f =>
    `@font-face{font-family:"${f.name}";src:url("fonts/${f.file}") format("truetype");font-display:swap}`
  ).join('\n');
  const s = document.createElement('style');
  s.textContent = css;
  document.head.append(s);
}

/* ============================================================
   Seitenaufbau
   ============================================================ */
const SEITEN = [
  { id:'text',   name:'Text' },
  { id:'form',   name:'Form' },
  { id:'farbe',  name:'Farbe' },
  { id:'led',    name:'LED' },
  { id:'druck',  name:'Druck' },
  { id:'fertig', name:'Übersicht' }
];

function aenderung(struktur = false){
  clearTimeout(speicherTimer);
  speicherTimer = setTimeout(() => C.save(cfg), 400);
  if (struktur){ panelBauen(); }
  if (neuAufbauGeplant) return;
  neuAufbauGeplant = true;

  // Beim Ziehen am Regler bündelt requestAnimationFrame die Aufrufe am
  // saubersten. Liegt der Tab aber im Hintergrund, ruft der Browser das
  // nie auf — deshalb zusätzlich ein Zeitgeber. Wer zuerst kommt, gewinnt.
  const einmal = () => {
    if (!neuAufbauGeplant) return;
    neuAufbauGeplant = false;
    neuBauen();
  };
  requestAnimationFrame(einmal);
  setTimeout(einmal, 120);
}

function ledInfo(){ return C.ledById(cfg.led.typ); }
const platteAn = () => cfg.koerper.bauart === 'platte';

function seiteText(){
  const f = C.fontById(cfg.schrift.familie);
  return [
    U.gruppe('Text', [
      U.feldText(cfg, 'text', 'Name', {
        gross:true, platzhalter:'z. B. Max', onChange:()=>aenderung(),
        hint:'Bis zu 24 Zeichen. Leerzeichen erzeugt eine Lücke, aber kein Bauteil.'
      }),
      U.feldChoices(cfg, 'schrift.schreibweise', 'Schreibweise', [
        { id:'wie-getippt', name:'Wie getippt' },
        { id:'gross', name:'GROSS' },
        { id:'klein', name:'klein' }
      ], { onChange:()=>aenderung(),
           dynHint:()=> f.nurGross ? `${f.name} hat nur Großbuchstaben — die Einstellung wirkt hier nicht.` : '' ,
           hint:'' })
    ]),
    U.gruppe('Schriftart', [
      U.feldFontpick(cfg, 'schrift.familie', 'Schrift', C.FONTS, { onChange:()=>aenderung(true) })
    ], C.fontById(cfg.schrift.familie).verbunden
       ? 'Achtung: Schreibschrift. Die Buchstaben berühren sich — als Einzelbuchstaben werden sie schwer zu montieren.'
       : null),
    U.gruppe('Maße und Form der Schrift', [
      U.feldRange(cfg, 'schrift.hoehe', 'Schrifthöhe', {
        onChange:()=>aenderung(), dez:0,
        hint:'Höhe eines großen H. Kleinbuchstaben sind entsprechend kleiner.'
      }),
      U.feldRange(cfg, 'schrift.abstand', 'Buchstabenabstand', {
        onChange:()=>aenderung(),
        hint:'Zusätzlicher Abstand über die normale Laufweite hinaus.'
      }),
      U.feldRange(cfg, 'schrift.kursiv', 'Kursiv', {
        onChange:()=>aenderung(), einheit:'°', dez:0,
        hint:'Neigung nach rechts. Die Buchstaben werden geschert, nicht ausgetauscht.'
      }),
      U.feldRange(cfg, 'schrift.strichstaerke', 'Strichstärke', {
        onChange:()=>aenderung(), dez:1,
        hint:'Macht die Striche dicker oder dünner. Dickere Striche geben mehr Platz für den LED-Streifen.'
      })
    ])
  ];
}

function seiteForm(){
  return [
    U.gruppe('Bauart', [
      U.feldChoices(cfg, 'koerper.bauart', 'Aufbau', [
        { id:'einzeln', name:'Einzelbuchstaben' },
        { id:'platte', name:'Auf Grundplatte' }
      ], { stil:'grid2', onChange:()=>aenderung(true),
           dynHint:()=> platteAn()
             ? 'Buchstaben sind durch eine gemeinsame Platte geschnitten, dahinter eine durchgehende Diffusorplatte.'
             : 'Jeder Buchstabe ist ein eigenes Teil mit eigener Frontfläche und hängt einzeln an der Wand.',
           hint:'' })
    ]),
    U.gruppe('Tiefe und Fluchtpunkt', [
      U.feldRange(cfg, 'koerper.tiefe', 'Tiefe', {
        onChange:()=>aenderung(), aktiv:()=>!platteAn(),
        hint:'Wie weit der Buchstabe von der Wand absteht.'
      }),
      U.feldRange(cfg, 'koerper.geradeTiefe', 'Gerader Auszug', {
        onChange:()=>aenderung(),
        hint:'Der vordere Teil läuft senkrecht nach hinten. Erst dahinter beginnt die Schräge.'
      }),
      U.feldDial(cfg, 'koerper.fluchtRichtung', 'Richtung des Versatzes', {
        onChange:()=>aenderung(), raster:45,
        hint:'Wohin die Rückfläche wandert. Nach unten wirkt es, als stünde man unter dem Schild.'
      }),
      U.feldRange(cfg, 'koerper.fluchtVersatz', 'Stärke des Versatzes', {
        onChange:()=>aenderung(),
        hint:'0 mm = gerade Extrusion ohne Fluchtpunkt.'
      }),
      U.feldRange(cfg, 'koerper.verjuengung', 'Verjüngung', {
        onChange:()=>aenderung(), einheit:' %', dez:0,
        hint:'Wie stark die Rückfläche gegenüber der Front verkleinert wird.'
      })
    ]),
    U.gruppe('Kanten und Wandstärken', [
      U.feldChoices(cfg, 'koerper.kanten', 'Kanten', [
        { id:'eckig', name:'Eckig' },
        { id:'rund', name:'Abgerundet' }
      ], { stil:'grid2', onChange:()=>aenderung(true) }),
      cfg.koerper.kanten === 'rund'
        ? U.feldRange(cfg, 'koerper.kantenRadius', 'Kantenradius', {
            onChange:()=>aenderung(), dez:1,
            hint:'Wird in Fusion ganz zum Schluss gesetzt, in kleinen Gruppen.'
          })
        : null,
      U.feldRange(cfg, 'koerper.wandstaerke', 'Wandstärke', {
        onChange:()=>aenderung(), dez:1,
        hint:'Wand der Schale. Bestimmt zusammen mit der Strichstärke, wie breit der Kanal für die LEDs wird.'
      }),
      U.feldRange(cfg, 'koerper.frontDicke', 'Dicke der Frontfläche', {
        onChange:()=>aenderung(), dez:1,
        hint:'Dicker streut mehr, schluckt aber Licht. 2 mm sind ein guter Start.'
      }),
      U.feldRange(cfg, 'koerper.passung', 'Passungsspiel', {
        onChange:()=>aenderung(), dez:2,
        hint:'Gesamtspiel der Presspassung. 0,07 mm hat sich bei dir bewährt.'
      }),
      U.feldRange(cfg, 'koerper.ueberstand', 'Überstand der Front', {
        onChange:()=>aenderung(), dez:1,
        hint:'0 mm = bündig. Größer lässt die Frontfläche vorstehen.'
      })
    ]),
    platteAn() ? U.gruppe('Grundplatte', [
      U.feldChoices(cfg, 'platte.form', 'Grundform', C.PLATTEN_FORMEN, { stil:'grid2', onChange:()=>aenderung(true) }),
      U.feldRange(cfg, 'platte.rand', 'Rand um den Text', { onChange:()=>aenderung(), dez:0 }),
      cfg.platte.form === 'abgerundet'
        ? U.feldRange(cfg, 'platte.eckRadius', 'Eckradius', { onChange:()=>aenderung(), dez:0 })
        : null,
      U.feldRange(cfg, 'platte.dicke', 'Plattendicke', { onChange:()=>aenderung(), dez:1 }),
      U.feldRange(cfg, 'platte.diffusorDicke', 'Diffusorplatte', { onChange:()=>aenderung(), dez:1 }),
      U.feldToggle(cfg, 'platte.stege', 'Stege für freistehende Inseln', {
        onChange:()=>aenderung(true),
        hint:'Bei A, O, R, B fällt die Mitte sonst aus der Platte. Die App setzt die Stege automatisch.'
      }),
      cfg.platte.stege ? U.feldRange(cfg, 'platte.stegBreite', 'Stegbreite', { onChange:()=>aenderung(), dez:1 }) : null,
      cfg.platte.stege ? U.feldChoices(cfg, 'platte.stegRichtung', 'Stegrichtung', [
        { id:'senkrecht', name:'Senkrecht' },
        { id:'waagerecht', name:'Waagerecht' }
      ], { stil:'grid2', onChange:()=>aenderung() }) : null
    ]) : null
  ].filter(Boolean);
}

function seiteFarbe(){
  return [
    U.gruppe('Buchstaben', [
      U.feldFarbe(cfg, 'farben.koerper', 'Farbe des Körpers', C.PALETTE_KOERPER, {
        namePfad:'farben.koerperName', onChange:()=>aenderung()
      }),
      U.feldFarbe(cfg, 'farben.front', 'Farbe der Frontfläche', C.PALETTE_FRONT, {
        namePfad:'farben.frontName', onChange:()=>aenderung()
      })
    ], 'Die Frontfläche muss transluzent sein, sonst leuchtet nichts durch.'),
    platteAn() ? U.gruppe('Platte', [
      U.feldFarbe(cfg, 'farben.basis', 'Farbe der Grundplatte', C.PALETTE_KOERPER, {
        namePfad:'farben.basisName', onChange:()=>aenderung()
      }),
      U.feldFarbe(cfg, 'farben.diffusor', 'Farbe der Diffusorplatte', C.PALETTE_FRONT, {
        namePfad:'farben.diffusorName', onChange:()=>aenderung()
      })
    ]) : null
  ].filter(Boolean);
}

function seiteLed(){
  return [
    U.gruppe('LED-Streifen', [
      U.feldSelect(cfg, 'led.typ', 'Typ', C.LEDS.map(l => ({ id:l.id, name:l.name })), {
        onChange:()=>aenderung(true), dynHint:()=>ledInfo().hinweis
      })
    ]),
    U.gruppe('Leuchtmodus', [
      U.feldSelect(cfg, 'led.modus', 'Modus', C.MODI.map(m => ({ id:m.id, name:m.name })), {
        onChange:()=>aenderung(true), dynHint:()=>C.modusById(cfg.led.modus).hinweis
      }),
      U.feldFarbe(cfg, 'led.farbe', 'Farbe', C.PALETTE_LED.map(h => ({ hex:h, name:h })), {
        onChange:()=>aenderung(), aktiv:()=>C.modusById(cfg.led.modus).braucht >= 1
      }),
      C.modusById(cfg.led.modus).braucht >= 2
        ? U.feldFarbe(cfg, 'led.farbe2', 'Zweite Farbe', C.PALETTE_LED.map(h => ({ hex:h, name:h })), {
            onChange:()=>aenderung()
          })
        : null,
      U.feldRange(cfg, 'led.helligkeit', 'Helligkeit', {
        onChange:()=>aenderung(), einheit:' %', zeige:v=>`${Math.round(v*100)} %`,
        hint:'Nur die Vorschau. Am fertigen Schild stellst du das über den Controller.'
      }),
      C.modusById(cfg.led.modus).animiert
        ? U.feldRange(cfg, 'led.tempo', 'Tempo', { onChange:()=>aenderung(), einheit:'×', dez:1 })
        : null
    ].filter(Boolean)),
    U.gruppe('Rechnung', [
      U.readout(null, () => {
        const l = model?.led; if (!l) return [];
        return [
          ['Streifenlänge gesamt', `${l.streifenLaenge} mm`],
          ['LEDs', `ca. ${l.anzahl}`],
          ['Leistung bei Vollweiß', `${l.watt} W`],
          ['Netzteil', `${l.volt} V / ${l.netzteil} W`],
          ['Ansteuerung', l.adressierbar ? 'einzeln adressierbar' : 'nur gesamt', l.adressierbar ? 'good' : 'mid']
        ];
      })
    ])
  ];
}

function seiteDruck(){
  return [
    U.gruppe('Drucker', [
      U.feldSelect(cfg, 'druck.drucker', 'Modell', C.DRUCKER.map(d => ({ id:d.id, name:d.name })), {
        onChange:()=>{
          const d = C.DRUCKER.find(x => x.id === cfg.druck.drucker);
          if (d){ cfg.druck.bettX = d.x; cfg.druck.bettY = d.y; cfg.druck.bettZ = d.z; }
          aenderung(true);
        },
        dynHint:()=>{
          const d = C.DRUCKER.find(x => x.id === cfg.druck.drucker);
          return d ? `Druckraum ${d.x} × ${d.y} × ${d.z} mm` : '';
        }
      }),
      U.feldRange(cfg, 'druck.rand', 'Sicherheitsabstand', {
        onChange:()=>aenderung(), dez:0,
        hint:'Abstand zur Bettkante, den die App freilässt.'
      })
    ]),
    U.gruppe('Teilung', [
      U.feldToggle(cfg, 'druck.teilen', 'Zu große Teile automatisch aufteilen', {
        onChange:()=>aenderung(true),
        hint:'Teilt zu große Teile in ein Raster und plant Passstifte ein. Maße stehen im Export.'
      }),
      cfg.druck.teilen ? U.feldRange(cfg, 'druck.stiftD', 'Passstift Ø', { onChange:()=>aenderung(), dez:1 }) : null,
      cfg.druck.teilen ? U.feldRange(cfg, 'druck.stiftL', 'Passstift Länge', {
        onChange:()=>aenderung(), dez:0, hint:'Je Hälfte die Hälfte davon.'
      }) : null,
      U.readout('Was aufs Bett kommt', () => {
        if (!model?.teilung) return [];
        return model.teilung.map(t => [
          t.name,
          t.passt ? `${t.bb.w} × ${t.bb.h} mm` : (t.geteilt ? `${t.teile} Stücke` : 'passt nicht'),
          t.passt ? 'good' : (t.geteilt ? 'mid' : 'bad')
        ]);
      })
    ].filter(Boolean)),
    U.gruppe('Montage an der Wand', [
      U.feldChoices(cfg, 'montage', 'Art', C.MONTAGE.map(m => ({ id:m.id, name:m.name })), {
        stil:'grid2', onChange:()=>aenderung(true),
        dynHint:()=>C.MONTAGE.find(m=>m.id===cfg.montage)?.hinweis ?? ''
      })
    ])
  ];
}

function seiteFertig(){
  const f = () => C.fontById(cfg.schrift.familie);
  const l = () => ledInfo();
  return [
    U.gruppe('Zusammenfassung', [
      U.readout('Text und Schrift', () => [
        ['Text', cfg.text || '—'],
        ['Schrift', f().name],
        ['Schrifthöhe', `${cfg.schrift.hoehe} mm`],
        ['Schreibweise', { 'wie-getippt':'wie getippt', gross:'GROSS', klein:'klein' }[cfg.schrift.schreibweise]],
        ['Buchstabenabstand', `${cfg.schrift.abstand} mm`],
        ['Kursiv', `${cfg.schrift.kursiv}°`],
        ['Strichstärke', `${cfg.schrift.strichstaerke > 0 ? '+' : ''}${cfg.schrift.strichstaerke} mm`]
      ]),
      U.readout('Körper', () => [
        ['Bauart', platteAn() ? 'auf Grundplatte' : 'Einzelbuchstaben'],
        ['Tiefe', `${cfg.koerper.tiefe} mm`],
        ['Gerader Auszug', `${cfg.koerper.geradeTiefe} mm`],
        ['Fluchtpunkt', `${cfg.koerper.fluchtVersatz} mm bei ${cfg.koerper.fluchtRichtung}°`],
        ['Verjüngung', `${cfg.koerper.verjuengung} %`],
        ['Kanten', cfg.koerper.kanten === 'rund' ? `rund, r ${cfg.koerper.kantenRadius} mm` : 'eckig'],
        ['Wandstärke', `${cfg.koerper.wandstaerke} mm`],
        ['Frontdicke', `${cfg.koerper.frontDicke} mm`],
        ['Passungsspiel', `${cfg.koerper.passung} mm`]
      ]),
      platteAn() ? U.readout('Grundplatte', () => [
        ['Form', C.PLATTEN_FORMEN.find(x=>x.id===cfg.platte.form)?.name],
        ['Rand', `${cfg.platte.rand} mm`],
        ['Dicke', `${cfg.platte.dicke} mm`],
        ['Diffusor', `${cfg.platte.diffusorDicke} mm`],
        ['Stege', cfg.platte.stege ? `${model?.stege?.length ?? 0} Stück, ${cfg.platte.stegBreite} mm` : 'aus']
      ]) : null,
      U.readout('Farben', () => [
        ['Körper', cfg.farben.koerperName],
        ['Frontfläche', cfg.farben.frontName],
        platteAn() ? ['Grundplatte', cfg.farben.basisName] : null,
        platteAn() ? ['Diffusor', cfg.farben.diffusorName] : null
      ].filter(Boolean)),
      U.readout('LED', () => [
        ['Typ', l().name],
        ['Modus', C.modusById(cfg.led.modus).name],
        ['Farbe', cfg.led.farbe],
        ['Streifen', `${model?.led?.streifenLaenge ?? 0} mm`],
        ['Leistung', `${model?.led?.watt ?? 0} W`],
        ['Netzteil', `${l().volt} V / ${model?.led?.netzteil ?? 0} W`]
      ]),
      U.readout('Ergebnis', () => [
        ['Außenmaß', `${model?.masse?.textBreite ?? 0} × ${model?.masse?.textHoehe ?? 0} mm`],
        ['Tiefe gesamt', `${model?.masse?.tiefe ?? 0} mm`],
        ['Komponenten', `${model?.teile?.length ?? 0}`],
        ['Druckstücke', `${model?.masse?.druckstuecke ?? 0}`],
        ['Montage', C.MONTAGE.find(m=>m.id===cfg.montage)?.name]
      ])
    ].filter(Boolean), 'Alles, was im Export landet. Für Details den Export-Knopf oben rechts.')
  ];
}

const SEITENBAU = { text:seiteText, form:seiteForm, farbe:seiteFarbe, led:seiteLed, druck:seiteDruck, fertig:seiteFertig };

function panelBauen(){
  const box = $('#panel-scroll');
  const scroll = box.scrollTop;
  box.textContent = '';
  syncListe = [];
  const gruppen = SEITENBAU[aktiveSeite]();
  for (const g of gruppen){
    box.append(g.element);
    syncListe.push(...g.felder);
  }
  U.tabs($('#tabs'), box, SEITEN, aktiveSeite, id => {
    aktiveSeite = id;
    panelBauen();
    $('#panel-scroll').scrollTop = 0;
  });
  box.scrollTop = scroll;
  syncAlle();
}

function syncAlle(){ for (const f of syncListe) f.sync?.(); }

/* ============================================================
   Neu berechnen
   ============================================================ */
function neuBauen(){
  C.clampConfig(cfg);
  lay = F.layout(cfg);
  model = buildModel(cfg, lay);
  vorschau.setModel(model, cfg);
  // Debug-Zugriff aus der Browser-Konsole: NSK.model, NSK.cfg, NSK.lay
  globalThis.NSK = { cfg, lay, model, vorschau };
  chipsSchreiben();
  warnungenSchreiben();
  syncAlle();
}

function chipsSchreiben(){
  const box = $('#measure-chips');
  box.textContent = '';
  if (!model?.masse?.buchstaben) return;
  const m = model.masse;
  const chip = (label, wert, hl) => {
    const c = U.el('span', 'chip' + (hl ? ' hl' : ''));
    c.append(document.createTextNode(label + ' '), U.el('b', null, wert));
    box.append(c);
  };
  chip('Breite', `${m.textBreite} mm`);
  chip('Höhe', `${m.textHoehe} mm`);
  chip('Tiefe', `${m.tiefe} mm`);
  chip('Teile', `${model.teile.length}`);
  if (m.druckstuecke !== model.teile.length) chip('Druckstücke', `${m.druckstuecke}`, true);
  chip('Leistung', `${model.led.watt} W`);
}

function warnungenSchreiben(){
  const box = $('#warnbar');
  box.textContent = '';
  for (const w of model?.warnungen ?? []){
    const d = U.el('div', 'warn ' + (w.art === 'err' ? 'err' : w.art === 'info' ? 'info' : ''));
    d.append(U.el('i', 'warn-ico', w.art === 'info' ? 'i' : '!'), U.el('span', null, w.text));
    // Auf dem Handy stehen nur zwei Zeilen; Antippen zeigt den ganzen Text.
    d.addEventListener('click', () => d.classList.toggle('offen'));
    box.append(d);
  }
}

/* ============================================================
   Ansichtsknöpfe
   ============================================================ */
function ansichtVerdrahten(){
  for (const b of document.querySelectorAll('[data-view]')){
    b.addEventListener('click', () => {
      document.querySelectorAll('[data-view]').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      vorschau.ansicht(b.dataset.view);
    });
  }
  const schalter = (id, feld, sceneFeld) => {
    const b = $(id);
    b.addEventListener('click', () => {
      cfg.ansicht[feld] = !cfg.ansicht[feld];
      b.classList.toggle('on', cfg.ansicht[feld]);
      vorschau[sceneFeld] = cfg.ansicht[feld];
      vorschau.aktualisiereSichtbarkeit();
      C.save(cfg);
    });
    b.classList.toggle('on', cfg.ansicht[feld]);
    vorschau[sceneFeld] = cfg.ansicht[feld];
  };
  schalter('#btn-light', 'led', 'zeigeLed');
  schalter('#btn-wall', 'wand', 'zeigeWand');
  schalter('#btn-split', 'teilung', 'zeigeTeilung');
  vorschau.aktualisiereSichtbarkeit();
}

/* ============================================================
   Export
   ============================================================ */
function exportVerdrahten(){
  const dlg = $('#export-modal');
  const feld = $('#export-text');
  let letzter = null;

  $('#btn-export').addEventListener('click', () => {
    letzter = E.baueExport(cfg, model, lay);
    feld.value = letzter.text;
    dlg.showModal();
    feld.scrollTop = 0;
  });
  $('#btn-close-export').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });

  const hinweis = (t) => {
    const h = $('#copyhint');
    h.textContent = t;
    h.classList.add('show');
    setTimeout(() => h.classList.remove('show'), 2200);
  };

  $('#btn-copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(feld.value);
      hinweis('Kopiert — bei Claude einfügen.');
    } catch {
      feld.select();
      document.execCommand?.('copy');
      hinweis('Kopiert.');
    }
  });
  $('#btn-dl-json').addEventListener('click', () => {
    E.download(E.dateiName(cfg, 'json'), JSON.stringify(letzter.json, null, 2), 'application/json');
  });
  $('#btn-dl-txt').addEventListener('click', () => {
    E.download(E.dateiName(cfg, 'txt'), letzter.text, 'text/plain');
  });
  $('#btn-dl-svg').addEventListener('click', () => {
    E.download(E.dateiName(cfg, 'svg'), E.baueSVG(cfg, model, lay), 'image/svg+xml');
  });
}

/* ============================================================
   Start
   ============================================================ */
async function start(){
  fontFaceRegeln();
  vorschau = new Vorschau($('#scene'));

  await F.preloadAll();

  $('#loader').classList.add('done');
  setTimeout(() => $('#loader').remove(), 400);

  panelBauen();
  neuBauen();
  ansichtVerdrahten();
  exportVerdrahten();

  $('#btn-reset').addEventListener('click', () => {
    if (!confirm('Alle Einstellungen auf Werkseinstellung zurücksetzen?')) return;
    C.clear();
    Object.assign(cfg, C.defaultConfig());
    vorschau._eingepasst = false;
    panelBauen();
    neuBauen();
  });

  // Größe des Bedienfelds ändern -> Canvas anpassen
  new ResizeObserver(() => vorschau.resize()).observe($('#viewport'));

  if ('serviceWorker' in navigator){
    try { await navigator.serviceWorker.register('sw.js'); } catch { /* offline egal */ }
  }
}

start().catch(err => {
  console.error(err);
  const l = $('#loader');
  if (l) l.innerHTML = `<div style="max-width:400px;text-align:center;color:#ff8b96">
    <b>Start fehlgeschlagen</b><br><br>${err.message}</div>`;
});
