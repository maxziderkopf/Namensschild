/* ============================================================
   ui.js — Bausteine für das Bedienfeld
   Jedes Feld liefert sein Element und eine sync()-Funktion,
   damit sich Anzeige und Aktiv-Zustand ohne Neuaufbau nachziehen.
   ============================================================ */

import { LIMITS, get, set } from './config.js';

export function el(tag, cls, txt){
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  return e;
}

function huelle(label, wertText, hint){
  const f = el('div', 'field');
  const l = el('div', 'flabel');
  l.append(el('span', null, label));
  const v = wertText != null ? el('em', 'fval', wertText) : null;
  if (v) l.append(v);
  f.append(l);
  return { f, v, hintAnhaengen: () => { if (hint) f.append(el('p', 'fhint', hint)); } };
}

/* ---------------- Schieberegler ---------------- */
export function feldRange(cfg, pfad, label, opt = {}){
  const lim = LIMITS[pfad] || { min:0, max:100, step:1 };
  const einheit = opt.einheit ?? ' mm';
  const zeige = opt.zeige || (v => `${opt.dez === 0 ? Math.round(v) : v.toFixed(opt.dez ?? 1)}${einheit}`);

  const { f, v, hintAnhaengen } = huelle(label, zeige(get(cfg, pfad)), opt.hint);
  const i = el('input');
  i.type = 'range';
  i.min = lim.min; i.max = lim.max; i.step = lim.step;
  i.value = get(cfg, pfad);
  f.append(i);
  hintAnhaengen();

  const fortschritt = () => {
    const p = (i.value - lim.min) / (lim.max - lim.min) * 100;
    i.style.setProperty('--p', `${p}%`);
  };
  fortschritt();

  i.addEventListener('input', () => {
    set(cfg, pfad, parseFloat(i.value));
    v.textContent = zeige(parseFloat(i.value));
    fortschritt();
    opt.onChange?.();
  });

  return { element:f, sync(){
    const wert = get(cfg, pfad);
    if (parseFloat(i.value) !== wert){ i.value = wert; fortschritt(); }
    v.textContent = zeige(wert);
    if (opt.aktiv) f.classList.toggle('off', !opt.aktiv());
  }};
}

/* ---------------- Knopfreihe ---------------- */
export function feldChoices(cfg, pfad, label, optionen, opt = {}){
  const { f, hintAnhaengen } = huelle(label, null, opt.hint);
  const box = el('div', 'choices' + (opt.stil ? ' ' + opt.stil : ''));
  const knoepfe = [];
  for (const o of optionen){
    const b = el('button', null, o.name);
    b.type = 'button';
    b.addEventListener('click', () => {
      set(cfg, pfad, o.id);
      opt.onChange?.();
    });
    box.append(b);
    knoepfe.push({ b, id:o.id });
  }
  f.append(box);
  hintAnhaengen();
  const hintEl = f.querySelector('.fhint');

  return { element:f, sync(){
    const wert = get(cfg, pfad);
    for (const k of knoepfe) k.b.classList.toggle('on', k.id === wert);
    if (opt.dynHint && hintEl) hintEl.textContent = opt.dynHint();
    if (opt.aktiv) f.classList.toggle('off', !opt.aktiv());
  }};
}

/* ---------------- Auswahlliste ---------------- */
export function feldSelect(cfg, pfad, label, optionen, opt = {}){
  const { f, hintAnhaengen } = huelle(label, null, opt.hint);
  const s = el('select');
  for (const o of optionen){
    const op = el('option', null, o.name);
    op.value = o.id;
    s.append(op);
  }
  s.value = get(cfg, pfad);
  s.addEventListener('change', () => { set(cfg, pfad, s.value); opt.onChange?.(); });
  f.append(s);
  hintAnhaengen();
  const hintEl = f.querySelector('.fhint');

  return { element:f, sync(){
    s.value = get(cfg, pfad);
    if (opt.dynHint && hintEl) hintEl.textContent = opt.dynHint();
    if (opt.aktiv) f.classList.toggle('off', !opt.aktiv());
  }};
}

/* ---------------- Texteingabe ---------------- */
export function feldText(cfg, pfad, label, opt = {}){
  const { f, hintAnhaengen } = huelle(label, null, opt.hint);
  const i = el('input');
  i.type = 'text';
  i.className = opt.gross ? 'textbig' : '';
  i.value = get(cfg, pfad);
  i.maxLength = opt.maxLength ?? 24;
  i.placeholder = opt.platzhalter ?? '';
  i.autocomplete = 'off';
  i.spellcheck = false;
  i.addEventListener('input', () => { set(cfg, pfad, i.value); opt.onChange?.(); });
  f.append(i);
  hintAnhaengen();
  return { element:f, sync(){ if (document.activeElement !== i) i.value = get(cfg, pfad); } };
}

/* ---------------- Farbfelder ---------------- */
export function feldFarbe(cfg, pfad, label, palette, opt = {}){
  const namePfad = opt.namePfad;
  const { f, hintAnhaengen } = huelle(label, null, opt.hint);
  const box = el('div', 'swatches');
  const felder = [];

  for (const p of palette){
    const b = el('button', 'sw');
    b.type = 'button';
    b.style.background = p.hex;
    b.title = p.name;
    b.addEventListener('click', () => {
      set(cfg, pfad, p.hex);
      if (namePfad) set(cfg, namePfad, p.name);
      opt.onChange?.();
    });
    box.append(b);
    felder.push({ b, hex:p.hex });
  }

  // freie Farbwahl
  const eigen = el('button', 'sw custom');
  eigen.type = 'button';
  eigen.title = 'Eigene Farbe';
  const inp = el('input');
  inp.type = 'color';
  inp.value = get(cfg, pfad);
  inp.addEventListener('input', () => {
    set(cfg, pfad, inp.value);
    if (namePfad) set(cfg, namePfad, `Eigene Farbe ${inp.value}`);
    opt.onChange?.();
  });
  eigen.append(inp);
  box.append(eigen);

  f.append(box);
  hintAnhaengen();
  const hintEl = f.querySelector('.fhint');

  return { element:f, sync(){
    const wert = (get(cfg, pfad) || '').toLowerCase();
    let treffer = false;
    for (const s of felder){
      const on = s.hex.toLowerCase() === wert;
      s.b.classList.toggle('on', on);
      if (on) treffer = true;
    }
    eigen.classList.toggle('on', !treffer);
    eigen.style.background = treffer ? 'transparent' : wert;
    if (inp.value.toLowerCase() !== wert) inp.value = wert;
    if (hintEl && namePfad) hintEl.textContent = get(cfg, namePfad) || '';
    if (opt.aktiv) f.classList.toggle('off', !opt.aktiv());
  }};
}

/* ---------------- Ein/Aus ---------------- */
export function feldToggle(cfg, pfad, label, opt = {}){
  const f = el('div', 'field');
  const t = el('label', 'toggle');
  t.append(el('span', null, label));
  t.append(el('i', 'tg'));
  t.addEventListener('click', (e) => {
    e.preventDefault();
    set(cfg, pfad, !get(cfg, pfad));
    opt.onChange?.();
  });
  f.append(t);
  if (opt.hint) f.append(el('p', 'fhint', opt.hint));
  return { element:f, sync(){
    t.classList.toggle('on', !!get(cfg, pfad));
    if (opt.aktiv) f.classList.toggle('off', !opt.aktiv());
  }};
}

/* ---------------- Richtungsrad ---------------- */
export function feldDial(cfg, pfad, label, opt = {}){
  const { f } = huelle(label, `${Math.round(get(cfg, pfad))}°`, null);
  const wrap = el('div', 'dial');
  const pad = el('div', 'dialpad');
  const nadel = el('i', 'dialneedle');
  pad.append(nadel);
  const seite = el('div', 'dialside');
  wrap.append(pad, seite);
  f.append(wrap);
  if (opt.hint) f.append(el('p', 'fhint', opt.hint));

  const wertEl = f.querySelector('.fval');
  const setzen = (grad) => {
    let g = ((Math.round(grad) % 360) + 360) % 360;
    if (opt.raster){
      const r = opt.raster;
      const nah = Math.round(g / r) * r;
      if (Math.abs(g - nah) < r * 0.25) g = nah % 360;
    }
    set(cfg, pfad, g);
    opt.onChange?.();
  };

  const ausZeiger = (ev) => {
    const r = pad.getBoundingClientRect();
    const x = ev.clientX - (r.left + r.width / 2);
    const y = ev.clientY - (r.top + r.height / 2);
    setzen(Math.atan2(-y, x) * 180 / Math.PI);
  };
  let zieht = false;
  pad.addEventListener('pointerdown', (e) => { zieht = true; pad.setPointerCapture(e.pointerId); ausZeiger(e); });
  pad.addEventListener('pointermove', (e) => { if (zieht) ausZeiger(e); });
  pad.addEventListener('pointerup',   (e) => { zieht = false; try { pad.releasePointerCapture(e.pointerId); } catch {} });

  return { element:f, seite, sync(){
    const g = get(cfg, pfad);
    wertEl.textContent = `${Math.round(g)}°`;
    nadel.style.transform = `rotate(${-g}deg)`;
    if (opt.aktiv) f.classList.toggle('off', !opt.aktiv());
  }};
}

/* ---------------- Schriftauswahl mit Vorschau ---------------- */
export function feldFontpick(cfg, pfad, label, fonts, opt = {}){
  const { f } = huelle(label, null, null);
  const box = el('div', 'fontpick');
  const knoepfe = [];
  for (const s of fonts){
    const b = el('button');
    b.type = 'button';
    const name = el('span', 'fp-name', s.probe || s.name);
    name.style.fontFamily = `"${s.name}", sans-serif`;
    b.append(name, el('span', 'fp-tag', s.tag));
    b.addEventListener('click', () => { set(cfg, pfad, s.id); opt.onChange?.(); });
    box.append(b);
    knoepfe.push({ b, id:s.id });
  }
  f.append(box);
  return { element:f, sync(){
    const wert = get(cfg, pfad);
    for (const k of knoepfe) k.b.classList.toggle('on', k.id === wert);
  }};
}

/* ---------------- Werteanzeige ---------------- */
export function readout(titel, zeilenFn){
  const box = el('div', 'readout');
  if (titel) box.append(el('h4', null, titel));
  const dl = el('dl');
  box.append(dl);
  const f = el('div', 'field');
  f.append(box);
  return { element:f, sync(){
    dl.textContent = '';
    for (const z of zeilenFn()){
      if (!z) continue;
      dl.append(el('dt', null, z[0]));
      dl.append(el('dd', z[2] || null, z[1]));
    }
  }};
}

/* ---------------- Gruppe ---------------- */
export function gruppe(titel, felder, notiz){
  const g = el('section', 'group');
  if (titel) g.append(el('h3', 'group-title', titel));
  if (notiz) g.append(el('p', 'group-note', notiz));
  for (const f of felder) if (f) g.append(f.element);
  return { element:g, felder: felder.filter(Boolean) };
}

/* ---------------- Reiter ---------------- */
export function tabs(container, scrollBox, seiten, aktiv, onWechsel){
  container.textContent = '';
  for (const s of seiten){
    const b = el('button', s.id === aktiv ? 'on' : '', s.name);
    b.type = 'button';
    b.addEventListener('click', () => onWechsel(s.id));
    container.append(b);
  }
}
