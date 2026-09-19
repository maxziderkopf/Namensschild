/* ============================================================
   scene.js — Three.js-Vorschau mit LED-Simulation
   ============================================================ */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { modusById, ledById } from './config.js';

const V = THREE.MathUtils;

export class Vorschau {
  constructor(canvas){
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true, powerPreference:'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    // Kein Szenen-Hintergrund: der helle Farbverlauf wie in Fusion kommt
    // per CSS vom Viewport und scheint durch den transparenten Canvas.
    this.scene.background = null;
    this.renderer.setClearColor(0x000000, 0);

    this.camera = new THREE.PerspectiveCamera(38, 1, 1, 8000);
    this.camera.position.set(0, 0, 400);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.075;
    this.controls.rotateSpeed = 0.85;
    this.controls.panSpeed = 0.7;
    this.controls.minDistance = 30;
    this.controls.maxDistance = 3000;

    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.lichter();
    this.wandBauen();

    this.letterMeshes = [];   // { front, koerper, licht, index }
    this.ledLichter = [];
    this.teilungsGruppe = new THREE.Group();
    this.scene.add(this.teilungsGruppe);

    this.zeigeLed = true;
    this.zeigeWand = true;
    this.zeigeTeilung = false;
    this.uhr = new THREE.Clock();
    this.cfg = null;
    this.radius = 100;

    this.resize();
    addEventListener('resize', () => this.resize());
    this.loop();
  }

  /* ---------------- Beleuchtung der Szene (nicht die LEDs) ---------------- */
  lichter(){
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#8a8f98', 0.9));
    const key = new THREE.DirectionalLight('#ffffff', 1.5);
    key.position.set(120, 180, 240);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight('#7aa8ff', 0.45);
    fill.position.set(-200, -60, 120);
    this.scene.add(fill);
    const rim = new THREE.DirectionalLight('#ffd9a0', 0.5);
    rim.position.set(-80, 120, -220);
    this.scene.add(rim);
  }

  wandBauen(){
    const geo = new THREE.PlaneGeometry(1, 1);
    this.wandMat = new THREE.MeshStandardMaterial({ color:'#e2e5ea', roughness:0.95, metalness:0 });
    this.wand = new THREE.Mesh(geo, this.wandMat);
    this.scene.add(this.wand);

    // Bodenraster wie in Fusion: 10-mm-Kaestchen, jede 10. Linie kraeftiger
    this.boden = new THREE.Group();
    this.scene.add(this.boden);
  }

  /* ---------------- Modell aufbauen ---------------- */
  setModel(model, cfg){
    this.cfg = cfg;
    this.leeren();

    const matKoerper = new THREE.MeshStandardMaterial({
      color: new THREE.Color(cfg.farben.koerper),
      roughness: 0.62, metalness: 0.06
    });
    const matBasis = new THREE.MeshStandardMaterial({
      color: new THREE.Color(cfg.farben.basis),
      roughness: 0.62, metalness: 0.06
    });

    // Die Frontflaeche sitzt mit nur einem Hundertstel Millimeter Spiel in der
    // Schale. Der Tiefenpuffer kann das nicht trennen, deshalb bekommt die
    // Front einen kleinen Vorrang — sonst flimmern die beiden Flaechen.
    const machFrontMat = () => new THREE.MeshStandardMaterial({
      color: new THREE.Color(cfg.farben.front),
      roughness: 0.42, metalness: 0,
      emissive: new THREE.Color(cfg.led.farbe),
      emissiveIntensity: 0,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    });

    for (const g of model.gruppen){
      const eintrag = { index:this.letterMeshes.length, koerper:null, front:null, mat:null, mitte:new THREE.Vector3() };

      if (g.geoKoerper){
        const m = new THREE.Mesh(g.geoKoerper, matKoerper);
        this.root.add(m); eintrag.koerper = m;
      }
      if (g.geoFront){
        const mat = machFrontMat();
        const m = new THREE.Mesh(g.geoFront, mat);
        this.root.add(m); eintrag.front = m; eintrag.mat = mat;
      }
      eintrag.mitte.set(g.bbox.cx, g.bbox.cy, 0);
      this.letterMeshes.push(eintrag);
    }

    if (model.platte){
      if (model.platte.geoBasis) this.root.add(new THREE.Mesh(model.platte.geoBasis, matBasis));
      if (model.platte.geoDiffusor){
        const mat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(cfg.farben.diffusor), roughness:0.5, metalness:0,
          emissive: new THREE.Color(cfg.led.farbe), emissiveIntensity:0,
          transparent:true, opacity:0.96
        });
        this.root.add(new THREE.Mesh(model.platte.geoDiffusor, mat));
        this.plattenMat = mat;
      }
    } else {
      this.plattenMat = null;
    }

    this.ledLichterBauen(cfg);
    this.teilungZeichnen(model, cfg);
    this.rahmen(model, cfg);
    this.aktualisiereSichtbarkeit();

    // Sofort einmal zeichnen. Sonst bleibt das Bild leer, solange der
    // Tab im Hintergrund liegt und requestAnimationFrame pausiert.
    this.ledAktualisieren(this.uhr.getElapsedTime());
    this.renderer.render(this.scene, this.camera);
  }

  ledLichterBauen(cfg){
    const n = Math.min(8, Math.max(1, this.letterMeshes.length));
    for (let i = 0; i < n; i++){
      const l = new THREE.PointLight(new THREE.Color(cfg.led.farbe), 0, 0, 2);
      const ziel = this.letterMeshes[Math.floor(i * this.letterMeshes.length / n)];
      l.position.copy(ziel ? ziel.mitte : new THREE.Vector3());
      l.position.z = 8;
      this.scene.add(l);
      this.ledLichter.push({ licht:l, letterIndex: ziel ? ziel.index : 0 });
    }
  }

  teilungZeichnen(model, cfg){
    const mat = new THREE.LineBasicMaterial({ color:'#ff5c6b' });
    const bb = this.gesamtBB(model, cfg);
    for (const t of model.teilung){
      if (!t.schnitte?.length) continue;
      for (const s of t.schnitte){
        const pts = [];
        const zA = 12, zB = -(cfg.koerper.bauart === 'platte' ? cfg.platte.dicke : cfg.koerper.tiefe) - 12;
        if (s.achse === 'x'){
          pts.push(new THREE.Vector3(s.pos, bb.y0 - 10, zA), new THREE.Vector3(s.pos, bb.y1 + 10, zA),
                   new THREE.Vector3(s.pos, bb.y1 + 10, zB), new THREE.Vector3(s.pos, bb.y0 - 10, zB),
                   new THREE.Vector3(s.pos, bb.y0 - 10, zA));
        } else {
          pts.push(new THREE.Vector3(bb.x0 - 10, s.pos, zA), new THREE.Vector3(bb.x1 + 10, s.pos, zA),
                   new THREE.Vector3(bb.x1 + 10, s.pos, zB), new THREE.Vector3(bb.x0 - 10, s.pos, zB),
                   new THREE.Vector3(bb.x0 - 10, s.pos, zA));
        }
        this.teilungsGruppe.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
      }
    }
  }

  gesamtBB(model, cfg){
    const box = new THREE.Box3().setFromObject(this.root);
    if (box.isEmpty()) return { x0:-50, x1:50, y0:-50, y1:50 };
    return { x0:box.min.x, x1:box.max.x, y0:box.min.y, y1:box.max.y };
  }

  /* ---------------- Kamera einpassen ---------------- */
  rahmen(model, cfg){
    const box = new THREE.Box3().setFromObject(this.root);
    if (box.isEmpty()) return;
    const mitte = box.getCenter(new THREE.Vector3());
    const groesse = box.getSize(new THREE.Vector3());
    this.radius = Math.max(groesse.x, groesse.y, groesse.z) * 0.62 + 20;

    // Wand hinter das Schild legen
    const tiefe = cfg.koerper.bauart === 'platte' ? cfg.platte.dicke + cfg.platte.diffusorDicke : cfg.koerper.tiefe;
    const s = Math.max(groesse.x, groesse.y) * 3.4 + 200;
    this.wand.scale.set(s, s, 1);
    this.wand.position.set(mitte.x, mitte.y, -tiefe - 1.2);

    // Boden 60 mm unter dem Schild, beginnt an der Wand und laeuft nach vorn
    this.boden.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
    this.boden.clear();
    const feld = Math.ceil(s / 100) * 100;
    const fein = new THREE.GridHelper(feld, feld / 10, '#c4c8cf', '#c4c8cf');
    const grob = new THREE.GridHelper(feld, feld / 100, '#9ba1aa', '#9ba1aa');
    for (const g of [fein, grob]){
      g.material.transparent = true;
      g.material.opacity = g === fein ? 0.55 : 0.9;
      g.position.set(mitte.x, box.min.y - 60, -tiefe - 1.2 + feld / 2);
      this.boden.add(g);
    }

    // Nah- und Fernebene eng an das Modell legen — je kleiner der Abstand
    // zwischen beiden, desto feiner loest der Tiefenpuffer auf.
    this.camera.near = Math.max(0.5, this.radius / 60);
    this.camera.far  = this.radius * 60;
    this.camera.updateProjectionMatrix();

    this.controls.target.copy(mitte);
    if (!this._eingepasst){ this.ansicht('iso', true); this._eingepasst = true; }
    else this.abstandAnpassen();
  }

  abstandAnpassen(){
    const dist = this.radius / Math.tan(V.degToRad(this.camera.fov) / 2) * 1.05;
    const richtung = this.camera.position.clone().sub(this.controls.target).normalize();
    this.camera.position.copy(this.controls.target).addScaledVector(richtung, dist);
    this.controls.update();
  }

  ansicht(name, sofort = false){
    const d = this.radius / Math.tan(V.degToRad(this.camera.fov) / 2) * 1.05;
    const richtungen = {
      front: new THREE.Vector3(0, 0, 1),
      iso:   new THREE.Vector3(0.52, 0.36, 1).normalize(),
      side:  new THREE.Vector3(0.96, 0.12, 0.26).normalize(),
      back:  new THREE.Vector3(-0.35, 0.28, -1).normalize()
    };
    const r = richtungen[name] || richtungen.iso;
    const ziel = this.controls.target.clone().addScaledVector(r, d);
    if (sofort){ this.camera.position.copy(ziel); this.controls.update(); }
    else { this._flug = { von:this.camera.position.clone(), nach:ziel, t:0 }; }
  }

  /* ---------------- Sichtbarkeit ---------------- */
  aktualisiereSichtbarkeit(){
    this.wand.visible = this.zeigeWand;
    this.boden.visible = this.zeigeWand;
    this.teilungsGruppe.visible = this.zeigeTeilung;
  }

  /* ---------------- LED-Animation ---------------- */
  ledAktualisieren(zeit){
    if (!this.cfg) return;
    const cfg = this.cfg;
    const modus = modusById(cfg.led.modus);
    const led = ledById(cfg.led.typ);
    const an = this.zeigeLed;
    const n = Math.max(1, this.letterMeshes.length);
    const tempo = cfg.led.tempo;
    const basis = cfg.led.helligkeit;

    const c1 = new THREE.Color(cfg.led.farbe);
    const c2 = new THREE.Color(cfg.led.farbe2);
    const tmp = new THREE.Color();

    const farbeFuer = (i) => {
      if (!an) return { c: tmp.setRGB(0,0,0), s: 0 };
      switch (modus.id){
        case 'atmen': {
          const p = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(zeit * 1.5 * tempo));
          return { c: tmp.copy(c1), s: basis * p };
        }
        case 'verlauf': {
          const t = n === 1 ? 0 : i / (n - 1);
          return { c: tmp.copy(c1).lerp(c2, t), s: basis };
        }
        case 'regenbogen': {
          if (!led.adressierbar){
            tmp.setHSL((zeit * 0.12 * tempo) % 1, 0.85, 0.55);
            return { c: tmp, s: basis };
          }
          tmp.setHSL(((zeit * 0.16 * tempo) + i * 0.13) % 1, 0.85, 0.55);
          return { c: tmp, s: basis };
        }
        case 'lauflicht': {
          const pos = (zeit * 1.6 * tempo) % (n + 1.5);
          let d = Math.abs(i - pos);
          d = Math.min(d, Math.abs(i - pos + (n + 1.5)));
          const p = Math.max(0.18, 1 - d * 0.75);
          return { c: tmp.copy(c1), s: basis * p };
        }
        default:
          return { c: tmp.copy(c1), s: basis };
      }
    };

    for (const e of this.letterMeshes){
      if (!e.mat) continue;
      const { c, s } = farbeFuer(e.index);
      e.mat.emissive.copy(c);
      e.mat.emissiveIntensity = s * 1.35;
    }
    if (this.plattenMat){
      const { c, s } = farbeFuer(0);
      this.plattenMat.emissive.copy(c);
      this.plattenMat.emissiveIntensity = s * 0.9;
    }
    for (const l of this.ledLichter){
      const { c, s } = farbeFuer(l.letterIndex);
      l.licht.color.copy(c);
      l.licht.intensity = s * this.radius * 12;
      l.licht.distance = this.radius * 4.5;
    }
  }

  /* ---------------- Loop ---------------- */
  loop(){
    requestAnimationFrame(() => this.loop());
    const zeit = this.uhr.getElapsedTime();

    if (this._flug){
      this._flug.t = Math.min(1, this._flug.t + 0.08);
      const e = 1 - Math.pow(1 - this._flug.t, 3);
      this.camera.position.lerpVectors(this._flug.von, this._flug.nach, e);
      if (this._flug.t >= 1) this._flug = null;
    }

    this.ledAktualisieren(zeit);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  resize(){
    const w = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1;
    if (this.canvas.width === w && this.canvas.height === h) { /* Groesse passt */ }
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /* ---------------- Aufraeumen ---------------- */
  leeren(){
    const weg = (obj) => {
      obj.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material){ (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); }
      });
      obj.clear();
    };
    weg(this.root);
    weg(this.teilungsGruppe);
    for (const l of this.ledLichter) this.scene.remove(l.licht);
    this.ledLichter = [];
    this.letterMeshes = [];
    this.plattenMat = null;
  }

  /** Bildschirmfoto der Vorschau als Data-URL. */
  bild(){
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }
}
