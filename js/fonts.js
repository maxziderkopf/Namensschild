/* ============================================================
   fonts.js — TTF laden, Glyphen in Konturen wandeln, Text setzen
   Arbeitet mit opentype.js aus dem vendor-Ordner, nichts wird
   zur Laufzeit aus dem Netz geholt.
   ============================================================ */

import opentype from '../vendor/opentype.module.js';
import { FONTS, fontById } from './config.js';
import * as G from './geom2d.js';

const cache = new Map();   // id -> { font, upm, capHeight, xHeight, name }

/* ---------------- Laden ---------------- */

export async function loadFont(id){
  if (cache.has(id)) return cache.get(id);
  const meta = fontById(id);
  const res = await fetch(`fonts/${meta.file}`);
  if (!res.ok) throw new Error(`Schrift ${meta.file} nicht gefunden (${res.status})`);
  const buf = await res.arrayBuffer();
  const font = opentype.parse(buf);

  const capBox = font.charToGlyph('H').getBoundingBox();
  const xBox   = font.charToGlyph('x').getBoundingBox();
  const entry = {
    id, meta, font,
    upm: font.unitsPerEm,
    capHeight: (capBox.y2 - capBox.y1) || font.unitsPerEm * 0.7,
    xHeight:   (xBox.y2 - xBox.y1)   || font.unitsPerEm * 0.5
  };
  cache.set(id, entry);
  return entry;
}

/** Alle Schriften im Hintergrund holen, damit das Umschalten sofort geht. */
export async function preloadAll(onProgress){
  let done = 0;
  for (const f of FONTS){
    try { await loadFont(f.id); } catch(e){ console.warn('Schrift übersprungen:', f.id, e.message); }
    onProgress?.(++done, FONTS.length);
  }
}

export const isLoaded = id => cache.has(id);

/* ---------------- Pfad in Polygone aufloesen ---------------- */

function bezierSegs(len, upm){
  const s = Math.round(len / (upm / 70));
  return Math.min(26, Math.max(4, s));
}

/**
 * Glyphenpfad in geschlossene Polygonzuege wandeln.
 * opentype liefert y nach unten, wir drehen auf y nach oben.
 */
function pathToContours(path, upm){
  const konturen = [];
  let cur = null, cx = 0, cy = 0;

  const push = (x, y) => cur && cur.push({ x, y: -y });

  for (const c of path.commands){
    switch (c.type){
      case 'M':
        if (cur && cur.length >= 3) konturen.push(cur);
        cur = []; push(c.x, c.y); cx = c.x; cy = c.y;
        break;
      case 'L':
        push(c.x, c.y); cx = c.x; cy = c.y;
        break;
      case 'C': {
        const n = bezierSegs(
          Math.hypot(c.x1-cx, c.y1-cy) + Math.hypot(c.x2-c.x1, c.y2-c.y1) + Math.hypot(c.x-c.x2, c.y-c.y2), upm);
        for (let i = 1; i <= n; i++){
          const t = i / n, u = 1 - t;
          const x = u*u*u*cx + 3*u*u*t*c.x1 + 3*u*t*t*c.x2 + t*t*t*c.x;
          const y = u*u*u*cy + 3*u*u*t*c.y1 + 3*u*t*t*c.y2 + t*t*t*c.y;
          push(x, y);
        }
        cx = c.x; cy = c.y;
        break;
      }
      case 'Q': {
        const n = bezierSegs(
          Math.hypot(c.x1-cx, c.y1-cy) + Math.hypot(c.x-c.x1, c.y-c.y1), upm);
        for (let i = 1; i <= n; i++){
          const t = i / n, u = 1 - t;
          const x = u*u*cx + 2*u*t*c.x1 + t*t*c.x;
          const y = u*u*cy + 2*u*t*c.y1 + t*t*c.y;
          push(x, y);
        }
        cx = c.x; cy = c.y;
        break;
      }
      case 'Z':
        if (cur && cur.length >= 3) konturen.push(cur);
        cur = null;
        break;
    }
  }
  if (cur && cur.length >= 3) konturen.push(cur);
  return konturen;
}

/* ---------------- Text setzen ---------------- */

export function schreibweiseAnwenden(text, modus, nurGross){
  if (nurGross) return text.toLocaleUpperCase('de-DE');
  if (modus === 'gross') return text.toLocaleUpperCase('de-DE');
  if (modus === 'klein') return text.toLocaleLowerCase('de-DE');
  return text;
}

/**
 * Setzt den Text und liefert je Zeichen die fertigen Konturen in Millimetern.
 * Grundlinie liegt auf y = 0, das Ganze ist waagerecht auf x = 0 zentriert.
 *
 * Rueckgabe: {
 *   letters: [{ zeichen, index, konturen, x, breite, bbox, leer }],
 *   bbox, fehlend: [Zeichen], schrift: {...}
 * }
 */
export function layout(cfg){
  const entry = cache.get(cfg.schrift.familie);
  if (!entry) return { letters: [], bbox: G.bboxOf([]), fehlend: [], bereit: false };

  const { font, upm, capHeight, meta } = entry;
  const text  = schreibweiseAnwenden(cfg.text, cfg.schrift.schreibweise, meta.nurGross);
  const mm    = cfg.schrift.hoehe / capHeight;      // Fonteinheit -> Millimeter
  const spur  = cfg.schrift.abstand;                // zusaetzlicher Abstand in mm
  const dick  = cfg.schrift.strichstaerke;          // Konturversatz in mm

  const fehlend = [];
  const letters = [];
  let x = 0, prevGlyph = null;

  for (let i = 0; i < text.length; i++){
    const zeichen = text[i];
    const glyph = font.charToGlyph(zeichen);

    if (glyph.index === 0 && zeichen.trim() !== ''){
      if (!fehlend.includes(zeichen)) fehlend.push(zeichen);
    }

    // Unterschneidung des Schriftentwerfers mitnehmen
    if (prevGlyph) x += (font.getKerningValue(prevGlyph, glyph) || 0) * mm;

    const advance = (glyph.advanceWidth || upm * 0.5) * mm;
    const leer = zeichen.trim() === '' || glyph.index === 0;

    if (!leer){
      const roh = pathToContours(glyph.getPath(0, 0, upm), upm);
      let konturen = G.classify(roh);
      // 1. auf Millimeter skalieren
      konturen = G.mapGlyph(konturen, p => ({ x: p.x * mm, y: p.y * mm }));
      // 2. kursiv scheren (um die Grundlinie)
      konturen = G.shear(konturen, cfg.schrift.kursiv);
      // 3. Strichstaerke aendern
      if (Math.abs(dick) > 0.005) konturen = G.offsetGlyph(konturen, dick);
      // 3b. sich ueberlappende Teilkonturen zu einer Form verschmelzen
      konturen = G.vereinigen(konturen);
      // 4. an die Setzposition schieben
      konturen = G.mapGlyph(konturen, p => ({ x: p.x + x, y: p.y }));

      if (konturen.length){
        letters.push({
          zeichen, index: letters.length, konturen,
          x, breite: advance, bbox: G.bboxOf(konturen), leer:false
        });
      }
    }

    x += advance + (leer ? spur * 0.6 : spur);
    prevGlyph = glyph;
  }

  // Ganzes Wort waagerecht zentrieren
  const alle = letters.flatMap(l => l.konturen);
  const bb = G.bboxOf(alle);
  const dx = -bb.cx;
  for (const l of letters){
    l.konturen = G.mapGlyph(l.konturen, p => ({ x: p.x + dx, y: p.y }));
    l.x += dx;
    l.bbox = G.bboxOf(l.konturen);
  }

  return {
    letters,
    bbox: G.bboxOf(letters.flatMap(l => l.konturen)),
    fehlend,
    bereit: true,
    schrift: { id: entry.id, name: meta.name, datei: meta.file, upm, capHeight, mmProEinheit: mm }
  };
}
