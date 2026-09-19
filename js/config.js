/* ============================================================
   config.js — Datenmodell, Kataloge, Speichern/Laden
   Alle Laengen in Millimetern, alle Winkel in Grad.
   ============================================================ */

export const APP_VERSION = '1.0.0';
export const SCHEMA_VERSION = 1;
const LS_KEY = 'namensschild.config.v1';

/* ---------------- Schriftenkatalog ---------------- */
/* capHeight/upm werden beim Laden aus der Datei gemessen, nicht hier. */
export const FONTS = [
  { id:'montserrat',  name:'Montserrat',      file:'Montserrat-Bold.ttf',      tag:'Groteske, kräftig',   probe:'Namen' },
  { id:'poppins',     name:'Poppins',         file:'Poppins-SemiBold.ttf',     tag:'geometrisch, rund',   probe:'Namen' },
  { id:'bebas',       name:'Bebas Neue',      file:'BebasNeue-Regular.ttf',    tag:'schmal, nur Versal',  probe:'NAMEN', nurGross:true },
  { id:'anton',       name:'Anton',           file:'Anton-Regular.ttf',        tag:'sehr fett, plakativ', probe:'Namen' },
  { id:'fredoka',     name:'Fredoka',         file:'Fredoka-SemiBold.ttf',     tag:'rund, verspielt',     probe:'Namen' },
  { id:'playfair',    name:'Playfair Display',file:'PlayfairDisplay-Bold.ttf', tag:'Serife, elegant',     probe:'Namen' },
  { id:'pacifico',    name:'Pacifico',        file:'Pacifico-Regular.ttf',     tag:'Schreibschrift',      probe:'Namen', verbunden:true },
  { id:'orbitron',    name:'Orbitron',        file:'Orbitron-Bold.ttf',        tag:'technisch, Gaming',   probe:'NAMEN' },
  { id:'righteous',   name:'Righteous',       file:'Righteous-Regular.ttf',    tag:'Retro-Display',       probe:'Namen' },
  { id:'pressstart',  name:'Press Start 2P',  file:'PressStart2P-Regular.ttf', tag:'Pixel, 8-Bit',        probe:'NAMEN' }
];

/* ---------------- LED-Katalog ----------------
   wattProM  = Verbrauch bei Vollweiss, Watt pro Meter
   breite    = Streifenbreite inkl. Silikon
   minKanal  = empfohlene lichte Kanalbreite im Buchstaben
------------------------------------------------- */
export const LEDS = [
  { id:'ws2812b-60',  name:'WS2812B 60 LED/m',   kurz:'WS2812B 60',  volt:5,  ledProM:60,  wattProM:18.0, breite:10, minKanal:12, adressierbar:true,
    hinweis:'Klassiker. Jede LED einzeln ansteuerbar, 3 Adern.' },
  { id:'ws2812b-30',  name:'WS2812B 30 LED/m',   kurz:'WS2812B 30',  volt:5,  ledProM:30,  wattProM:9.0,  breite:10, minKanal:12, adressierbar:true,
    hinweis:'Halbe Dichte, halber Strom. Für grosse Buchstaben ausreichend.' },
  { id:'sk6812-rgbw', name:'SK6812 RGBW 60/m',   kurz:'SK6812 RGBW', volt:5,  ledProM:60,  wattProM:19.2, breite:10, minKanal:12, adressierbar:true,
    hinweis:'Zusätzliche weisse LED — sauberes Weiss ohne Farbstich.' },
  { id:'cob-24v',     name:'COB RGB 24 V',       kurz:'COB 24 V',    volt:24, ledProM:480, wattProM:12.0, breite:8,  minKanal:10, adressierbar:false,
    hinweis:'Durchgehende Leuchtlinie, keine sichtbaren Punkte. Nicht einzeln ansteuerbar.' },
  { id:'mono-12v',    name:'Einfarbig weiss 12 V', kurz:'Weiss 12 V',volt:12, ledProM:60,  wattProM:4.8,  breite:8,  minKanal:10, adressierbar:false,
    hinweis:'Günstig und hell. Nur eine Farbe, keine Effekte.' }
];

export const MODI = [
  { id:'statisch',  name:'Statisch',     animiert:false, braucht:1, hinweis:'Eine Farbe, konstant.' },
  { id:'atmen',     name:'Atmen',        animiert:true,  braucht:1, hinweis:'Helligkeit pulsiert langsam.' },
  { id:'verlauf',   name:'Farbverlauf',  animiert:false, braucht:2, hinweis:'Farbe wandert von Buchstabe 1 bis zum letzten.' },
  { id:'regenbogen',name:'Regenbogen',   animiert:true,  braucht:0, hinweis:'Farbkreis läuft durch. Braucht adressierbare LEDs.' },
  { id:'lauflicht', name:'Lauflicht',    animiert:true,  braucht:1, hinweis:'Ein heller Punkt wandert. Braucht adressierbare LEDs.' }
];

export const PLATTEN_FORMEN = [
  { id:'rechteck',   name:'Rechteck' },
  { id:'abgerundet', name:'Abgerundet' },
  { id:'ellipse',    name:'Ellipse' },
  { id:'pill',       name:'Kapsel' }
];

export const MONTAGE = [
  { id:'schluesselloch', name:'Schlüsselloch', hinweis:'Vertiefung in der Rückwand, Schraube in der Wand. Abnehmbar, kein Kleber.' },
  { id:'klebepad',       name:'Klebepad',      hinweis:'Flache Tasche für 3M-VHB-Pad. Schnell, aber dauerhaft.' },
  { id:'magnete',        name:'Magnete',       hinweis:'Taschen für 6 × 3 mm Magnete, Gegenstück an der Wand.' }
];

/* Typische Filamentfarben – Name ist wichtig, er landet im Export */
export const PALETTE_KOERPER = [
  { hex:'#101014', name:'Schwarz' },
  { hex:'#3a3a40', name:'Dunkelgrau' },
  { hex:'#8a8a92', name:'Grau' },
  { hex:'#f2f2ef', name:'Weiss' },
  { hex:'#b8bcc2', name:'Silber' },
  { hex:'#c9a227', name:'Gold' },
  { hex:'#8b2f38', name:'Dunkelrot' },
  { hex:'#1d3f6e', name:'Dunkelblau' },
  { hex:'#1f5a3d', name:'Dunkelgrün' }
];
export const PALETTE_FRONT = [
  { hex:'#f4f4f0', name:'Weiss (transluzent)' },
  { hex:'#efe6d2', name:'Natur' },
  { hex:'#e8e8ea', name:'Kaltweiss' },
  { hex:'#ffe9c2', name:'Warmweiss' },
  { hex:'#d8f0ff', name:'Eisblau transluzent' },
  { hex:'#ffd9e2', name:'Rosé transluzent' }
];
export const PALETTE_LED = [
  '#ffffff','#ffd9a0','#ff9d3c','#ff4d5e','#ff3ca8',
  '#8b7bff','#3c7bff','#3cc8ff','#3cffd1','#7cff3c','#ffe83c'
];

/* Druckerprofile */
export const DRUCKER = [
  { id:'bambu-p1s',  name:'Bambu Lab P1S / X1C / A1', x:256, y:256, z:256 },
  { id:'bambu-mini', name:'Bambu Lab A1 mini',        x:180, y:180, z:180 },
  { id:'prusa-mk4',  name:'Prusa MK4 / MK3S',         x:250, y:210, z:220 },
  { id:'ender3',     name:'Creality Ender 3 / V2',    x:220, y:220, z:250 }
];

/* ---------------- Werkseinstellung ---------------- */
export function defaultConfig(){
  return {
    schema: SCHEMA_VERSION,
    text: 'Max',

    schrift: {
      familie: 'montserrat',
      hoehe: 80,            // Versalhoehe in mm (Hoehe eines grossen H)
      schreibweise: 'wie-getippt', // wie-getippt | gross | klein
      abstand: 4,           // zusaetzlicher Buchstabenabstand in mm
      kursiv: 0,            // Scherwinkel in Grad
      strichstaerke: 0      // Konturversatz in mm (+ fetter, - duenner)
    },

    koerper: {
      bauart: 'einzeln',    // einzeln | platte
      tiefe: 25,            // Gesamttiefe in mm
      geradeTiefe: 6,       // gerader Auszug vorne, ohne Versatz
      fluchtRichtung: 250,  // Grad, 0 = rechts, 90 = oben
      fluchtVersatz: 9,     // Versatz der Rueckflaeche in mm
      verjuengung: 16,      // Verkleinerung der Rueckflaeche in %
      kanten: 'rund',       // eckig | rund
      kantenRadius: 1.5,
      wandstaerke: 2.0,
      frontDicke: 2.0,
      passung: 0.07,        // Spiel der Presspassung, bewaehrter Wert
      ueberstand: 0         // 0 = buendig, >0 = Front steht vor
    },

    platte: {
      form: 'abgerundet',
      rand: 18,             // Abstand Text zu Plattenkante
      eckRadius: 12,
      dicke: 8,
      diffusorDicke: 2,
      stege: true,
      stegBreite: 2.0,
      stegRichtung: 'senkrecht'
    },

    farben: {
      koerper: '#101014', koerperName: 'Schwarz',
      front:   '#f4f4f0', frontName:   'Weiss (transluzent)',
      basis:   '#101014', basisName:   'Schwarz',
      diffusor:'#f4f4f0', diffusorName:'Weiss (transluzent)'
    },

    led: {
      typ: 'ws2812b-60',
      modus: 'statisch',
      farbe: '#ff9d3c',
      farbe2: '#3cc8ff',
      helligkeit: 0.85,
      tempo: 1.0
    },

    montage: 'schluesselloch',

    druck: {
      drucker: 'bambu-p1s',
      bettX: 256, bettY: 256, bettZ: 256,
      rand: 5,              // Sicherheitsabstand zur Bettkante
      teilen: true,
      stiftD: 4,            // Passstift-Durchmesser
      stiftL: 8             // Passstift-Laenge (je Haelfte die Haelfte davon)
    },

    ansicht: { led: true, wand: true, teilung: false }
  };
}

/* ---------------- Grenzen ---------------- */
export const LIMITS = {
  'schrift.hoehe':          { min:20,  max:400, step:1 },
  'schrift.abstand':        { min:-6,  max:40,  step:0.5 },
  'schrift.kursiv':         { min:-20, max:20,  step:1 },
  'schrift.strichstaerke':  { min:-2,  max:4,   step:0.1 },
  'koerper.tiefe':          { min:6,   max:80,  step:0.5 },
  'koerper.geradeTiefe':    { min:0,   max:80,  step:0.5 },
  'koerper.fluchtRichtung': { min:0,   max:359, step:1 },
  'koerper.fluchtVersatz':  { min:0,   max:50,  step:0.5 },
  'koerper.verjuengung':    { min:0,   max:45,  step:1 },
  'koerper.kantenRadius':   { min:0.2, max:6,   step:0.1 },
  'koerper.wandstaerke':    { min:0.8, max:8,   step:0.1 },
  'koerper.frontDicke':     { min:0.6, max:8,   step:0.1 },
  'koerper.passung':        { min:0,   max:0.4, step:0.01 },
  'koerper.ueberstand':     { min:0,   max:6,   step:0.1 },
  'platte.rand':            { min:4,   max:80,  step:1 },
  'platte.eckRadius':       { min:0,   max:60,  step:1 },
  'platte.dicke':           { min:3,   max:40,  step:0.5 },
  'platte.diffusorDicke':   { min:0.8, max:8,   step:0.1 },
  'platte.stegBreite':      { min:0.8, max:8,   step:0.1 },
  'led.helligkeit':         { min:0.1, max:1,   step:0.01 },
  'led.tempo':              { min:0.2, max:3,   step:0.1 },
  'druck.rand':             { min:0,   max:30,  step:1 },
  'druck.stiftD':           { min:2,   max:8,   step:0.5 },
  'druck.stiftL':           { min:4,   max:30,  step:1 }
};

/* ---------------- Pfad-Zugriff ---------------- */
export function get(obj, path){
  return path.split('.').reduce((o,k)=> (o==null ? undefined : o[k]), obj);
}
export function set(obj, path, value){
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((o,k)=> (o[k] ??= {}), obj);
  target[last] = value;
  return obj;
}

/* Tiefes Zusammenfuehren: nur bekannte Schluessel uebernehmen,
   damit eine alte Speicherung kein Feld verschluckt. */
function mergeDeep(base, patch){
  if (!patch || typeof patch !== 'object') return base;
  for (const k of Object.keys(base)){
    if (!(k in patch)) continue;
    const b = base[k], p = patch[k];
    if (b && typeof b === 'object' && !Array.isArray(b)) mergeDeep(b, p);
    else if (p !== undefined && p !== null && typeof p !== 'object') base[k] = p;
  }
  return base;
}

export function clampConfig(cfg){
  for (const [path, lim] of Object.entries(LIMITS)){
    const v = get(cfg, path);
    if (typeof v === 'number' && isFinite(v)) set(cfg, path, Math.min(lim.max, Math.max(lim.min, v)));
    else set(cfg, path, get(defaultConfig(), path));
  }
  // gerader Auszug kann nie tiefer sein als das ganze Teil
  if (cfg.koerper.geradeTiefe > cfg.koerper.tiefe) cfg.koerper.geradeTiefe = cfg.koerper.tiefe;
  // Kantenradius kann die Wand nicht uebersteigen
  cfg.koerper.kantenRadius = Math.min(cfg.koerper.kantenRadius, cfg.koerper.wandstaerke * 0.9);
  if (!FONTS.some(f=>f.id===cfg.schrift.familie)) cfg.schrift.familie = 'montserrat';
  if (!LEDS.some(l=>l.id===cfg.led.typ)) cfg.led.typ = 'ws2812b-60';
  if (!MODI.some(m=>m.id===cfg.led.modus)) cfg.led.modus = 'statisch';
  if (typeof cfg.text !== 'string') cfg.text = 'Max';
  cfg.text = cfg.text.slice(0, 24);
  return cfg;
}

/* ---------------- Speichern / Laden ---------------- */
export function save(cfg){
  try { localStorage.setItem(LS_KEY, JSON.stringify(cfg)); return true; }
  catch { return false; }
}
export function load(){
  const cfg = defaultConfig();
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) mergeDeep(cfg, JSON.parse(raw));
  } catch { /* kaputter Speicher: Werkseinstellung */ }
  return clampConfig(cfg);
}
export function clear(){
  try { localStorage.removeItem(LS_KEY); } catch { /* egal */ }
}

/* ---------------- Nachschlagen ---------------- */
export const fontById  = id => FONTS.find(f=>f.id===id) || FONTS[0];
export const ledById   = id => LEDS.find(l=>l.id===id)  || LEDS[0];
export const modusById = id => MODI.find(m=>m.id===id)  || MODI[0];
