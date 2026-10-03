# Spezifikation: Modellierungstool für den Datenbankunterricht

## 1. Zweck und Zielgruppe

Studierende erstellen im Datenbankunterricht und in Prüfungen ER-Modelle.
Das Tool unterstützt zwei Ebenen:

- **Logisches Modell**: datenbankunabhängig, ohne Datentypen, mit n:m-Beziehungen und Generalisierungen.
- **Physisches Modell**: grafische Repräsentation der `CREATE TABLE`-Anweisungen einer relationalen Datenbank.

Das logische Modell wird gezeichnet, das physische Modell per Knopfdruck daraus erzeugt (Transformation) und danach weiter bearbeitet.

Wichtigstes Qualitätsmerkmal: **flüssige Eingabe**, vor allem der Attribute per Tastatur.

## 2. Notation (Crow's Foot)

### 2.1 Kardinalitäten

Jedes Ende einer Beziehung hat genau eines der vier Symbole:

| Symbol             | Bedeutung | Min | Max |
|--------------------|-----------|-----|-----|
| Zero or One        | 0..1      | 0   | 1   |
| One and only One   | 1         | 1   | 1   |
| Zero or Many       | 0..n      | 0   | n   |
| One or Many        | 1..n      | 1   | n   |

### 2.2 Identifizierende und nicht identifizierende Beziehungen

- **Identifizierend** (durchgezogene Linie): Der PK des Eltern-Entities wird Teil des PK des Kind-Entities.
- **Nicht identifizierend** (strichlierte Linie): Der PK des Eltern-Entities wird normales Attribut (FK) des Kind-Entities.
- Bei identifizierenden Beziehungen muss das Eltern-Ende `1` sein (sonst Validierungsfehler).

### 2.3 Darstellung eines Entities bzw. einer Tabelle

Box mit Titelzeile (Name) und einer Zeile pro Attribut bzw. Spalte:

- Spalte für Schlüsselmarker: `PK`, `FK`, oder `PK, FK`.
- Attributname.
- Logisch: Pflicht-/Optional-Marker (`*` Pflicht, `o` optional).
- Physisch: Datentyp, `NOT NULL`/`NULL`, `UNIQUE`, `IDENTITY` (kompakt, z. B. als Kürzel/Icons).
- PK-Attribute stehen oben, durch eine Trennlinie von den übrigen getrennt.

### 2.4 Generalisierung (nur logisches Modell)

IE/IDEF1X-Stil mit Kategorie-Symbol:

- Linie vom Supertyp zu einem Kreis, vom Kreis je eine Linie zu jedem Subtyp.
- **Vollständig** (total): doppelter Strich unter dem Kreis.
- **Unvollständig** (partiell): einfacher Strich unter dem Kreis.
- Subtypen haben keinen eigenen PK, sie erben den PK des Supertyps (im Subtyp ausgegraut angezeigt).
- Nur **eine Stufe**: Ein Subtyp kann nicht selbst Supertyp sein. Ein Entity kann nur Subtyp einer Generalisierung sein.

## 3. Logisches Modell

### 3.1 Entities und Attribute

- Entity: Name (eindeutig im Modell), Position, Liste von Attributen.
- Attribut: Name (eindeutig im Entity), `isPrimaryKey`, `isOptional`.
- Kombinierte Primärschlüssel: mehrere Attribute mit `isPrimaryKey`.
- PK-Attribute sind immer Pflicht.

### 3.2 Schnelle Eingabe (Tastatur-Zeilen)

- Neues Entity: Doppelklick auf freie Fläche (oder Taste `E`) legt ein Entity an der Position an, der Namens-Editor ist sofort aktiv.
- Doppelklick auf ein Entity öffnet den Inline-Editor.
- Im Inline-Editor:
  - `Enter`: neues Attribut unter der aktuellen Zeile.
  - `Tab` / `Shift+Tab`: nächste/vorige Eigenschaft der Zeile (Name → PK → optional).
  - `↑` / `↓`: Zeile wechseln.
  - `Alt+↑` / `Alt+↓`: Attribut verschieben.
  - `Strg+Backspace` auf leerer Zeile bzw. `Strg+Entf`: Attribut löschen.
  - `Esc`: Editor schließen.
- Präfixe beim Tippen des Namens: `#id` → PK, `?email` → optional. Das Präfix wird entfernt und als Eigenschaft gesetzt.
- Automatisch erzeugte FK-Attribute (siehe 3.3) erscheinen im Editor, sind aber nur umbenennbar, nicht löschbar (Löschen erfolgt über die Beziehung).

### 3.3 Beziehungen

- Zeichnen: Vom Andockpunkt eines Entities zum anderen ziehen. Ziehen zum selben Entity erzeugt eine rekursive Beziehung.
- Standard beim Anlegen: Eltern-Ende `1`, Kind-Ende `0..n`, nicht identifizierend. Das Startentity ist das Eltern-Entity.
- Bei ausgewählter Linie erscheint eine **Kontextleiste**: die 4 Kardinalitätssymbole je Ende, Schalter identifizierend/nicht identifizierend, Richtung tauschen, Löschen.
- Klick auf ein Linienende schaltet die Kardinalität zyklisch durch.
- Mehrere Beziehungen zwischen demselben Entity-Paar sind erlaubt (z. B. Flug → Abflughafen/Zielflughafen).
- n:m-Beziehungen (beide Enden „many“) sind im logischen Modell erlaubt. Attribute an Beziehungen gibt es nicht. Braucht man sie, modelliert der Student selbst ein Entity.

### 3.4 Automatische Fremdschlüssel

Für jede 1:n- und 1:1-Beziehung legt die App im Kind-Entity FK-Attribute an:

- Ein FK-Attribut je PK-Attribut des Eltern-Entities (kombinierte PKs ergeben mehrere FK-Attribute).
- Name nach der eingestellten Konvention (siehe 6). Bei Namenskollision wird eine Zahl angehängt (`AirportId2`). Der Student kann FK-Attribute umbenennen (Rollennamen, z. B. `DepartureAirportId`). Umbenannte Namen werden bei späteren Änderungen nicht mehr überschrieben.
- Identifizierend: FK-Attribute sind Teil des PK.
- Optionalität: Eltern-Ende `1` → Pflicht, `0..1` → optional.
- Ändert sich der PK des Eltern-Entities (hinzufügen, umbenennen, entfernen), werden die FKs in allen Kind-Entities nachgezogen, auch transitiv über Ketten identifizierender Beziehungen.
- **1:1**: Der FK kommt auf die optionale Seite (bei `1 : 0..1` auf die `0..1`-Seite). Bei symmetrischen Kardinalitäten entscheidet die Zeichenrichtung (Kind = Ziel), umschaltbar über „Richtung tauschen“.
- **n:m**: keine FKs im logischen Modell, die Auflösung erfolgt erst bei der Transformation.

### 3.5 Textnotizen

Freie Notiz-Boxen auf der Zeichenfläche (z. B. für Annahmen in der Prüfung). Gibt es in beiden Modellen. Bei der Transformation werden Notizen nicht übernommen, Notizen im physischen Modell bleiben bei erneuter Transformation erhalten.

## 4. Transformation logisch → physisch

### 4.1 Ablauf

1. Der Student klickt „Physisches Modell erzeugen“.
2. Die Validierung (siehe 7) läuft. Bei Blockern Abbruch mit Fehlerliste, ein Klick auf einen Fehler springt zum Element.
3. Gibt es Generalisierungen, fragt ein Dialog pro Generalisierung die Strategie ab: **Roll up** oder **Roll down**. Die letzte Wahl wird im Modell gespeichert und vorausgewählt.
4. Existiert bereits ein physisches Modell: Warnung „Wird überschrieben“ mit Bestätigung.
5. Das physische Modell wird erzeugt und angezeigt. Tabellen übernehmen die Position ihres Entities aus dem logischen Modell. Zwischentabellen liegen mittig zwischen ihren beiden Eltern-Tabellen, Subtyp-Tabellen beim Roll down an der Position ihres Subtyps.

### 4.2 Abbildungsregeln

| Logisch | Physisch |
|---|---|
| Entity | Tabelle gleichen Namens |
| Attribut | Spalte, Datentyp **leer**, `NOT NULL` wenn Pflicht |
| PK | PK-Constraint |
| 1:n / 1:1 | FK-Constraint mit Beziehungslinie, Kardinalitäten übernommen |
| 1:1 | zusätzlich `UNIQUE` auf den FK-Spalten (sofern nicht ohnehin PK) |
| n:m | Zwischentabelle (siehe 4.3) |
| Generalisierung | Roll up oder Roll down (siehe 4.4) |

FK-Spalten übernehmen den Datentyp der referenzierten PK-Spalte, sobald dieser gesetzt ist (auch später im physischen Modell, solange der FK-Typ nicht manuell abweichend gesetzt wurde).

### 4.3 n:m-Auflösung

- Neue Tabelle, Name nach Konvention aus beiden Entity-Namen (`StudentCourse` bzw. `student_course`).
- PK = FK-Spalten zu beiden Seiten (zwei identifizierende Beziehungen).
- Eltern-Ende jeweils `1`, Kind-Ende (Zwischentabelle) `0..n` oder `1..n`, je nach Minimum am ursprünglichen Ende.
- Rekursive n:m-Beziehung: FK-Namen kollidieren, deshalb wird eine Zahl angehängt (`PersonId`, `PersonId2`).

### 4.4 Generalisierung

**Roll up** (Subtypen gehen im Supertyp auf):

- Es entsteht nur die Supertyp-Tabelle.
- Attribute aller Subtypen werden Spalten der Supertyp-Tabelle, immer `NULL`-fähig.
- Es wird **keine** Typspalte erzeugt (bei Bedarf legt der Student sie selbst an).
- Beziehungen der Subtypen werden auf die Supertyp-Tabelle umgehängt. FKs, die dadurch in der Supertyp-Tabelle landen, werden `NULL`-fähig.

**Roll down** (Supertyp geht in den Subtypen auf):

- Nur bei **vollständiger** Generalisierung erlaubt (sonst Blocker).
- Je Subtyp eine Tabelle mit PK und allen Attributen des Supertyps plus eigenen Attributen. Die Supertyp-Tabelle entfällt.
- Beziehungen, in denen der Supertyp **Kind** ist: Jede Subtyp-Tabelle bekommt den FK.
- Beziehungen, in denen der Supertyp **Eltern** ist: Die referenzierende Tabelle bekommt je Subtyp einen FK (`StudentId`, `TeacherId`), alle `NULL`-fähig.
- Ist der Supertyp Eltern einer **identifizierenden** Beziehung, ist Roll down nicht möglich (PK-Teile dürfen nicht `NULL` sein) → Blocker.

### 4.5 Erneute Transformation

Das physische Modell wird komplett neu erzeugt. Erhalten bleiben bei gleichem Tabellen- bzw. Spaltennamen:

- Position der Tabelle.
- Datentyp, `UNIQUE`, `IDENTITY` der Spalte.
- Notizen.

Strukturänderungen am physischen Modell (zusätzliche Tabellen/Spalten) gehen verloren, das sagt die Warnung explizit.

## 5. Physisches Modell

### 5.1 Bearbeitung

Alles ist bearbeitbar: Tabellen und Spalten anlegen, löschen, umbenennen, Beziehungen (nur 1:n und 1:1) zeichnen, Datentypen und Constraints setzen. Die Eingabe funktioniert wie im logischen Modell (Inline-Editor), mit zusätzlichen Feldern pro Zeile.

Nicht erlaubt (Werkzeuge fehlen bzw. Validierungsfehler): n:m-Beziehungen, Generalisierungen.

### 5.2 Spalteneigenschaften

- Datentyp: Combobox mit Vorschlägen, freie Eingabe der Parameter.
- `NOT NULL` / `NULL`.
- `UNIQUE`: einzeln pro Spalte und als benannter Constraint über mehrere Spalten (tabellenweit verwaltet).
- `IDENTITY` (Auto-Increment): nur bei ganzzahligen Typen.
- FKs: `NOT NULL` wird beim Zeichnen aus der Kardinalität des Eltern-Endes abgeleitet und bleibt manuell änderbar.

### 5.3 Datentypen (Standard-SQL)

`SMALLINT`, `INTEGER`, `BIGINT`, `DECIMAL(p,s)`, `NUMERIC(p,s)`, `REAL`, `DOUBLE PRECISION`, `CHAR(n)`, `VARCHAR(n)`, `CLOB`, `BOOLEAN`, `DATE`, `TIME`, `TIMESTAMP`, `BLOB`.

Spalten ohne Datentyp sind optisch hervorgehoben (z. B. rot „?“).

### 5.4 SQL-Export (DDL)

- Export als `.sql` mit Standard-SQL.
- Pro Tabelle `CREATE TABLE` mit Spalten, `NOT NULL`, `GENERATED ALWAYS AS IDENTITY`, `PRIMARY KEY`, `UNIQUE` und `FOREIGN KEY ... REFERENCES` als benannte Constraints (`PK_<Table>`, `FK_<Child>_<Parent>`, `UQ_<Table>_<Cols>`).
- Reihenfolge topologisch (Eltern vor Kindern). Bei Zyklen werden die betroffenen FKs per `ALTER TABLE ... ADD CONSTRAINT` am Ende angelegt.
- Fehlende Datentypen verhindern den Export (Fehlerliste wie bei der Validierung).

## 6. Modelleinstellungen

- **Namenskonvention** für generierte Namen (FKs, Zwischentabellen): `PascalCase` (Standard: `StudentId`, `StudentCourse`) oder `snake_case` (`student_id`, `student_course`). Der FK-Name entsteht aus Eltern-Entity und PK-Attribut.
- **Metadaten**: Modellname, Name des Studierenden, Klasse, Matrikelnummer (optional). Das Datum wird beim Speichern automatisch gesetzt.

## 7. Validierung

Nur Blocker, also was Transformation oder Export verhindert. Keine fachlichen Hinweise (die würden in der Prüfung Lösungen verraten). Die Validierung läuft beim Transformieren und Exportieren, nicht permanent.

Logisches Modell:

- Entity ohne PK (außer Subtypen und Kinder identifizierender Beziehungen, die ihren PK darüber erhalten).
- Leere oder doppelte Entity-Namen, leere oder doppelte Attributnamen innerhalb eines Entities (inklusive FK-Attribute).
- Identifizierende Beziehung mit Eltern-Ende ≠ `1`.
- Zyklus aus identifizierenden Beziehungen.
- Roll down bei unvollständiger Generalisierung.
- Roll down, wenn der Supertyp Eltern einer identifizierenden Beziehung ist.

Physisches Modell (vor dem DDL-Export):

- Spalte ohne Datentyp.
- Tabelle ohne PK.
- n:m-Beziehung.
- Doppelte Tabellen- oder Spaltennamen.
- `IDENTITY` auf nicht ganzzahligem Typ.
- FK-Spalte mit anderem Typ als die referenzierte PK-Spalte.

## 8. Zeichenfläche und Bedienung

### 8.1 Allgemein

- Zwei Ansichten im selben Dokument, umschaltbar per Tabs: **Logisch** und **Physisch**.
- Raster (sichtbar, ein-/ausblendbar) mit Snap beim Verschieben von Entities und Notizen.
- Zoom per Mausrad, Pan mit Leertaste+Ziehen oder mittlerer Maustaste, „Alles einpassen“.
- Minimap.
- Undo/Redo (`Strg+Z` / `Strg+Y`), mindestens 50 Schritte, getrennt pro Ansicht. Die Transformation ist im physischen Verlauf ein einzelner Schritt.
- `Entf` löscht das ausgewählte Element (Entity samt Beziehungen, Beziehung samt generierter FKs).

### 8.2 Linienführung

Orthogonale Linien, automatisch um Entities herumgeführt. Die Andockpunkte wählt die App selbst, sie lassen sich aber manuell verschieben (das ist dann fixiert, bis man es zurücksetzt). Kardinalitätssymbole sitzen immer senkrecht am Entity-Rand.

### 8.3 Automatisches Layout

- Knopf „Automatisch anordnen“: ordnet alle Entities der aktuellen Ansicht neu an (Layered-Algorithmus, möglichst wenige Kreuzungen) und ist per Undo umkehrbar.
- Das Layout läuft nur auf Knopfdruck, nie automatisch (auch nicht nach der Transformation).

### 8.4 Sprache

Oberfläche auf Deutsch und Englisch (i18n, Sprachdateien). Standard ist die Browsersprache, umschaltbar, die Wahl wird in localStorage gespeichert.

## 9. Speichern, Laden, Export

### 9.1 JSON-Datei

- Eine Datei (`.json`) enthält beide Modelle, Einstellungen und Metadaten.
- Format mit Kennung und Versionsnummer für spätere Migrationen:

```json
{
  "format": "er-modeltool",
  "version": 1,
  "meta": { "modelName": "", "studentName": "", "className": "", "studentId": "", "savedAt": "" },
  "settings": { "namingConvention": "PascalCase" },
  "logical": { "entities": [], "relationships": [], "generalizations": [], "notes": [] },
  "physical": { "tables": [], "relationships": [], "notes": [] }
}
```

- Alle Elemente haben stabile IDs, Referenzen laufen über IDs, nicht über Namen.
- Beim Laden wird das Schema geprüft. Ungültige Dateien führen zu einer verständlichen Fehlermeldung, nicht zu einem Absturz.

### 9.2 Speichern und Öffnen

- **File System Access API** (Chromium): `Strg+S` speichert in die geöffnete Datei, „Speichern unter“ wählt eine neue. „Öffnen“ verwendet den Dateidialog.
- **Fallback** (Firefox, Safari oder wenn die API fehlt): „Speichern“ lädt die Datei herunter, „Öffnen“ verwendet `<input type="file">`.
- Drag & Drop einer `.json`-Datei auf die Zeichenfläche öffnet sie.
- Ungespeicherte Änderungen: Warnung beim Schließen des Tabs (`beforeunload`) und beim Öffnen einer anderen Datei.

### 9.3 Autosave

- Der aktuelle Stand wird laufend in localStorage gesichert (debounced, ca. 1 s nach der letzten Änderung).
- Beim Start mit vorhandenem Autosave: Dialog „Letzten Stand wiederherstellen?“ mit Modellname und Zeitpunkt.

### 9.4 PDF-Export

- Vektor-PDF, Format A4 oder A3, Hoch- oder Querformat wählbar.
- Logisches und physisches Modell (sofern vorhanden) auf je einer eigenen Seite, jeweils auf die Seite skaliert.
- Kopfzeile: Modellname, Name, Klasse, Matrikelnummer, Datum, Ansicht (logisch/physisch).
- Raster, Auswahlmarkierungen und UI-Elemente werden nicht exportiert.

## 10. Technische Randbedingungen

- React + TypeScript (`strict`), Build mit Vite.
- **Vollständig offline**: Alle Libraries und Schriften sind gebündelt, keine CDN-Zugriffe zur Laufzeit.
- Zwei Build-Ziele:
  - **GitHub Pages** (normaler Vite-Build mit passendem `base`), Deploy per GitHub Action bei Push auf `main`.
  - **Eine einzelne HTML-Datei** (z. B. `vite-plugin-singlefile`), die per `file://` lauffähig ist.
- Zielbrowser: aktuelle Versionen von Edge, Chrome und Firefox.
- Architektur: Domänenlogik (Modelltypen, FK-Ableitung, Transformation, Validierung, DDL-Generierung, JSON-Serialisierung) in reinem TypeScript ohne React-Abhängigkeit, damit sie isoliert testbar ist. UI-Schicht darüber.
- Empfehlungen (nicht bindend): React Flow (`@xyflow/react`) für die Zeichenfläche inkl. Zoom, Pan und Minimap, ELK.js für Layout und orthogonales Routing, jsPDF + svg2pdf.js für den Vektor-PDF-Export.

## 11. Tests

- **Unit-Tests (Vitest)** für die Domänenlogik, mindestens:
  - FK-Ableitung inklusive kombinierter PKs, transitiver Propagation, Umbenennung und Kollisionen.
  - Transformation: 1:n, 1:1, n:m (auch rekursiv), Roll up, Roll down mit Beziehungen am Supertyp und an Subtypen.
  - Erhalt von Datentypen und Positionen bei erneuter Transformation.
  - Validierungsregeln.
  - DDL-Generierung inklusive topologischer Reihenfolge und Zyklen.
  - JSON-Roundtrip (speichern → laden → identisch).
- **E2E-Tests (Playwright)**: Entity per Tastatur anlegen, Beziehung ziehen und Kardinalität ändern, transformieren, Datentypen setzen, JSON speichern/laden, SQL- und PDF-Export auslösen.

## 12. Nicht im Umfang (Version 1)

- Exklusive/überlappende Generalisierung, Diskriminator-Attribut, mehrstufige Generalisierung.
- Beziehungsnamen (Verbphrasen), Attribute an Beziehungen.
- Alternativschlüssel, mehrwertige und zusammengesetzte Attribute, Attributkommentare im logischen Modell.
- Mehrere SQL-Dialekte, `DEFAULT`, `CHECK`.
- Live-Synchronisation zwischen logischem und physischem Modell.
- Mehrfachauswahl, Kopieren/Einfügen, Ausrichten/Verteilen der Auswahl.
- Prüfungsmodus (z. B. Funktionen sperren), Lauffähigkeit im Safe Exam Browser.
- Import aus SQL oder anderen Tools.
