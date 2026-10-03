# ER-Modellierungstool

Browser-Tool für den Datenbankunterricht: logische ER-Modelle in Crow's-Foot-Notation zeichnen, per Knopfdruck in ein physisches Modell transformieren, Datentypen setzen und als SQL-DDL, JSON oder Vektor-PDF exportieren. Läuft vollständig offline. Die Spezifikation steht in [spec.md](spec.md).

## Starten

```bash
npm install
npm run dev          # Entwicklungsserver, http://localhost:5173
npm test             # Unit-Tests (Vitest, Domänenlogik)
npm run e2e          # E2E-Tests (Playwright, startet den Dev-Server selbst)
npm run build        # Build für GitHub Pages nach dist/ (BASE_PATH=/repo-name/ setzen)
npm run build:single # eine einzelne HTML-Datei nach dist-single/, per file:// lauffähig
```

Bei jedem Push auf `main` baut die GitHub Action [.github/workflows/deploy.yml](.github/workflows/deploy.yml) die Seite und veröffentlicht sie auf GitHub Pages. Die Offline-Einzeldatei liegt dort zusätzlich als `modeltool-offline.html`. Unter *Settings → Pages* muss dafür die Quelle „GitHub Actions“ eingestellt sein.

Ein Beispielmodell mit Generalisierung, n:m- und identifizierender Beziehung liegt in [examples/university.json](examples/university.json). Zum Öffnen einfach auf die Zeichenfläche ziehen.

## Bedienung

| Aktion | Eingabe |
|---|---|
| Entity bzw. Tabelle anlegen | Doppelklick auf freie Fläche oder Taste `E` (an der Mausposition) |
| Editor öffnen | Doppelklick auf Entity/Tabelle |
| Neues Attribut unter der Zeile | `Enter` |
| Nächste/vorige Eigenschaft | `Tab` / `Shift+Tab` (Name → PK → optional bzw. Datentyp, NN, U, ID) |
| Zeile wechseln / verschieben | `↑` `↓` / `Alt+↑` `Alt+↓` |
| Attribut löschen | `Strg+Backspace` auf leerer Zeile, `Strg+Entf` |
| Editor schließen | `Esc` |
| Präfixe beim Tippen | `#id` → Primärschlüssel, `?email` → optional (physisch: NULL) |
| Beziehung zeichnen | vom Andockpunkt (blauer Punkt beim Hover) auf ein anderes oder dasselbe Entity ziehen |
| Generalisierung | in der Toolbar „Generalisierung“ wählen, dann vom Supertyp zum Subtyp ziehen |
| Kardinalität ändern | Klick auf das Linienende (zyklisch) oder Kontextleiste der ausgewählten Linie |
| Andockpunkt fixieren / lösen | Griff am Linienende der ausgewählten Linie ziehen / doppelklicken |
| Löschen | `Entf` (Entity samt Beziehungen, Beziehung samt FKs) |
| Rückgängig / Wiederholen | `Strg+Z` / `Strg+Y`, getrennt pro Ansicht |
| Speichern / Speichern unter / Öffnen | `Strg+S` / `Strg+Shift+S` / `Strg+O`, Drag & Drop einer `.json` |
| Zoom / Verschieben | Mausrad / Leertaste+Ziehen oder mittlere Maustaste |

## Architektur

Die ausführliche Referenz für Erweiterungen (Datenfluss, Invarianten, Erweiterungspunkte, Fallstricke) steht in [modeltool.md](modeltool.md).

```
src/
  domain/            reines TypeScript, ohne React, isoliert testbar
    model/           Typen: logisches/physisches Modell, Dokument
    cardinality.ts   Eltern/Kind-Ableitung aus Zeichenrichtung + Kardinalitäten
    naming.ts        Namenskonventionen (PascalCase / snake_case), Kollisionen
    foreignKeys/     automatische FKs (logisch + physisch), transitive Propagation
    operations/      reine Modelloperationen (Entity anlegen, Attribut verschieben, ...)
    transform/       logisch → physisch (n:m, Roll up/down, Erhalt bei erneuter Transformation)
    validation/      Blocker-Prüfungen beider Modelle
    ddl/             SQL-Generierung, topologische Reihenfolge, Zyklen
    serialization/   JSON mit Format-/Versionskennung und Schema-Prüfung
    routing/         orthogonales Kanten-Routing (A* über Sichtbarkeitsraster)
  ui/
    store/           zustand-Stores: Dokument mit Undo/Redo pro Ansicht, UI-Zustand
    commands/        Aktionen der Oberfläche (Datei, Export, Transformation, Layout)
    diagram/         React-Flow-Zeichenfläche, Nodes, Kanten, Inline-Editor, Geometrie
    services/        Dateizugriff, Autosave, ELK-Layout, PDF-Export
    app/             Toolbar, Dialoge, Shortcuts
    i18n/            Sprachdateien de/en (typsicher: fehlende Übersetzungen sind Compilerfehler)
```

Wichtige Entscheidungen:

- **Beziehungen speichern die Zeichenrichtung** (`source`/`target`). Welches Ende Eltern und welches Kind ist, leitet `resolveRoles` aus den Kardinalitäten ab. „Richtung tauschen“ ist damit ein einfacher Tausch der Enden.
- **FKs werden nach jeder Änderung synchronisiert** (`syncLogicalForeignKeys` / `syncPhysicalForeignKeys`, idempotent). Generierte Attribute werden über (Beziehung, referenzierter Schlüssel) identifiziert, nicht über den Namen. Deshalb überleben Umbenennungen.
- **Eine gemeinsame Geometrie** (`ui/diagram/geometry`, `buildScene`) für Zeichenfläche, Routing und PDF-Export. Das PDF wird als eigenes SVG ohne UI-Elemente erzeugt und mit svg2pdf in Vektor-PDF umgewandelt. Die Diagrammschrift Arial ist metrisch identisch mit der PDF-Schrift Helvetica.
- **Offline:** nur Systemschriften, alle Bibliotheken gebündelt. ELK und jsPDF werden erst bei Bedarf nachgeladen; in der Einzeldatei sind sie inline.

## Annahmen, wo die Spezifikation offen war

- **1:1-Platzierung:** Der FK kommt auf die Seite, deren Linienende `0..1` zeigt. Bei symmetrischen Kardinalitäten ist das Ziel der Zeichnung das Kind.
- **n:m-Auflösung:** Das Kind-Ende zur Zwischentabelle richtet sich nach dem Minimum am *gegenüberliegenden* ursprünglichen Ende (Zeilen pro Elternzeile).
- **Roll up:** Für FKs, die durch das Umhängen NULL-fähig werden, wird auch das Eltern-Ende auf `0..1` gesetzt, damit Diagramm und DDL übereinstimmen. Nicht umbenannte FK-Namen werden aus dem neuen Tabellennamen gebildet (z. B. `PersonId`).
- **Subtypen** verlieren beim Hinzufügen zur Generalisierung ihre eigenen PK-Markierungen.
- **FK-Namen entlang identifizierender Ketten** übernehmen den Namen des weitergereichten Schlüssels (`OrderId` bleibt `OrderId`). Beginnt der PK-Name schon mit dem Entity-Namen, wird dieser nicht verdoppelt (`StudentNr` statt `StudentStudentNr`).
- **Physische FKs:** `NOT NULL` wird beim Zeichnen und bei jeder Änderung der Eltern-Kardinalität neu abgeleitet und bleibt dazwischen manuell änderbar.
- **Leer verlassene Entities** (kein Name, keine Attribute) werden beim Schließen des Editors verworfen.
- **Neue physische Spalten** sind standardmäßig `NOT NULL`, analog zu „Pflicht“ im logischen Modell.

## Tests

- 124 Unit-Tests (Vitest) für FK-Ableitung, Transformation, Validierung, DDL, JSON-Roundtrip und Routing.
- 8 E2E-Tests (Playwright): Entity per Tastatur, Beziehung und Kardinalitäten, Generalisierung, Transformation mit Datentypen und SQL-Export, JSON speichern/laden, ungültige Datei, PDF-Export, Autosave-Wiederherstellung.

Wie lange die Implementierung gedauert hat und wie viele Tokens sie gebraucht hat, steht in [METRICS.md](METRICS.md).
