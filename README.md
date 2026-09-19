# Namensschild-Konfigurator

Web-App zum Zusammenklicken beleuchteter, 3D-gedruckter Namensschilder.
Am Ende drückst du auf **Export** und bekommst eine Bauanleitung in Worten
plus die vollständige Konfiguration als JSON — genau das, was Claude braucht,
um daraus das Modell in Fusion 360 zu bauen.

Läuft im Browser, lässt sich aufs Handy installieren und funktioniert nach
dem ersten Laden komplett ohne Internet.

---

## 1. Auf GitHub Pages stellen

1. Auf GitHub ein **neues, leeres Repository** anlegen, zum Beispiel
   `namensschild-konfigurator`. Kein README, kein .gitignore anhaken —
   das Repository soll wirklich leer sein.
2. Den Inhalt dieses Ordners hochladen. Am einfachsten über die Weboberfläche:
   **Add file → Upload files**, dann alle Dateien und Ordner reinziehen.
   Wichtig: der Inhalt kommt in die Wurzel des Repositorys, nicht in einen
   Unterordner. `index.html` muss ganz oben liegen.
3. Im Repository auf **Settings → Pages** gehen.
4. Bei *Source* **Deploy from a branch** wählen, als Branch `main` und als
   Ordner `/ (root)`. Auf **Save**.
5. Ein bis zwei Minuten warten. Oben auf der Pages-Seite steht dann die
   Adresse, etwa:
   `https://DEINNAME.github.io/namensschild-konfigurator/`

Mit Git auf der Kommandozeile geht es auch:

```bash
git init
git add .
git commit -m "Namensschild-Konfigurator"
git branch -M main
git remote add origin https://github.com/DEINNAME/namensschild-konfigurator.git
git push -u origin main
```

Danach trotzdem noch Schritt 3 bis 5 machen.

---

## 2. Aufs Handy installieren

1. Die Pages-Adresse im Handy-Browser öffnen.
2. **Android / Chrome:** Menü (drei Punkte) → *Zum Startbildschirm hinzufügen*.
   **iPhone / Safari:** Teilen-Symbol → *Zum Home-Bildschirm*.
3. Beim ersten Öffnen einmal alles laden lassen. Danach läuft die App auch
   im Flugmodus — Schriften und 3D-Bibliothek liegen mit im Repository und
   werden lokal zwischengespeichert.

---

## 3. Vor Ort testen, ohne GitHub

Im Ordner einen kleinen Webserver starten (nur mit `file://` läuft es nicht,
weil der Browser dann die JavaScript-Module blockiert):

```bash
python -m http.server 8731
```

Dann `http://localhost:8731` im Browser öffnen.

---

## 4. So arbeitest du damit

1. Text eintippen, Schrift und Größe wählen.
2. Unter **Form** die Bauart festlegen — Einzelbuchstaben oder Grundplatte —
   und Tiefe, Fluchtpunkt und Kanten einstellen.
3. Unter **Farbe** und **LED** das Aussehen festlegen. Die 3D-Ansicht zeigt
   sofort, wie es leuchtet. Ansicht drehen: ziehen. Zoomen: scrollen oder
   zwei Finger.
4. Unter **Druck** siehst du, was aufs Druckbett kommt. Ist ein Teil zu groß,
   teilt die App es automatisch auf und plant Passstifte ein.
5. Unter **Übersicht** stehen alle Einstellungen auf einen Blick.
6. Oben rechts auf **Export**:
   * **Text kopieren** — den ganzen Block bei Claude einfügen. Er enthält
     die Bauanleitung und darunter das JSON.
   * **JSON laden** — dieselbe Konfiguration als Datei.
   * **SVG der Konturen** — die Buchstabenumrisse 1:1 in Millimetern, mit
     getrennten Ebenen für Außenkontur, Rückfläche, Hohlraum und Frontfläche.
     Diese Datei kommt in Fusion über *Insert → Insert SVG* hinein und ist
     der schnellste Weg zur fertigen Skizze.
   * **Anleitung .txt** — der Text allein, zum Ausdrucken.

Deine Einstellungen bleiben im Browser gespeichert und sind beim nächsten
Öffnen wieder da.

---

## 5. Was im Ordner liegt

```
index.html              Gerüst der Seite
manifest.webmanifest    macht sie auf dem Handy installierbar
sw.js                   Service Worker — sorgt für den Offline-Betrieb
css/style.css           Gestaltung
icons/                  App-Symbole
fonts/                  zehn Schriften als TTF
vendor/                 three.js, OrbitControls, opentype.js
js/
  app.js                verbindet alles miteinander
  config.js             Datenmodell, Kataloge (Schriften, LED, Drucker)
  geom2d.js             Konturmathematik: versetzen, Löcher finden, Stege
  fonts.js              TTF laden, Glyphen in Konturen wandeln, Text setzen
  build3d.js            aus den Konturen wird das 3D-Modell
  scene.js              3D-Vorschau und LED-Simulation
  exporter.js           Bauanleitung, JSON und SVG
  ui.js                 Bausteine für das Bedienfeld
```

---

## 6. Wenn du etwas änderst

Der Service Worker speichert alle Dateien fest zwischen. Nach einer Änderung
also in `sw.js` ganz oben die Versionsnummer hochzählen:

```js
const CACHE = 'namensschild-v1.0.1';
```

Sonst zeigt der Browser weiter die alte Fassung. Beim nächsten Öffnen räumt
die App den alten Speicher dann von selbst auf.

Zum Debuggen liegt das aktuelle Modell in der Browser-Konsole unter `NSK`:
`NSK.cfg`, `NSK.model`, `NSK.lay`, `NSK.vorschau`.

---

## 7. Feste Werte

Diese Maße stellt man bewusst nicht in der App ein. Sie stehen in
`js/config.js` im Block `FEST` und lassen sich dort ändern:

| Wert | Maß | Warum |
|---|---|---|
| Wandstärke der Buchstaben | 2 mm | stabil, druckt sauber |
| Frontfläche und Diffusorplatte | 0,8 mm | lässt genug Licht durch und streut trotzdem |
| Grundplatte | 20 mm | 3 mm Streifen + 15 mm Abstand zum Diffusor + 2 mm Boden |
| Drucker | Bambu Lab P1S | 256 × 256 × 256 mm, 5 mm Rand |
| Passstifte | Ø 4 mm, 8 mm lang | beim Teilen zu großer Teile |

## 8. Grenzen der Vorschau

* Die 3D-Ansicht rechnet die Konturen über ein feines Raster. An sehr spitzen
  Innenecken kann die Hohlraumkontur um bis zu etwa 0,2 mm abweichen. Für die
  Anzeige ist das unsichtbar. In Fusion entsteht der Hohlraum ohnehin sauber
  über **Shell**, nicht über diese Kontur — die SVG-Ebene `Kontur_hohlraum`
  ist nur zum Vergleichen gedacht.
* Kursiv wird durch Scheren erzeugt, nicht durch einen echten Kursivschnitt.
  Der Scherwinkel steht im Export und lässt sich in Fusion genauso nachbauen.
* Die Strichstärke verändert die Kontur durch Versetzen. Bei sehr großen
  Werten laufen enge Stellen zu — die App wirft dann eine Warnung.
* Bebas Neue hat nur Großbuchstaben. Die Einstellung *Schreibweise* wirkt
  dort nicht.

---

## 9. Was noch nicht drin ist

Fertig ist P1 aus der Aufgabenstellung. Noch offen sind unter anderem:
Rand am Buchstaben, verbundene Buchstaben, Symbole, mehrere Zeilen, Bogen-
und Kreistext, Farbverläufe, unterschiedliche Farbe je Buchstabe, Auswahl der
Montageart über die Grundformen hinaus, Kabelführung, eigene Design-Bibliothek,
Wandvorschau mit einstellbarem Buchstabenabstand — sowie die Design-Vorlagen,
der Zufallsgenerator und der Verlegevorschlag für den LED-Streifen aus P3.

---

## 10. Schriften

Alle mitgelieferten Schriften stehen unter der SIL Open Font License 1.1:
Montserrat, Poppins, Bebas Neue, Anton, Fredoka, Playfair Display, Pacifico,
Orbitron, Righteous, Press Start 2P. Sie dürfen mitgeliefert und weitergegeben
werden. Die Copyright-Vermerke und der vollständige Lizenztext liegen in
`fonts/LIZENZEN.txt` — die Datei muss beim Weitergeben mitkommen.

three.js und opentype.js stehen unter der MIT-Lizenz.
