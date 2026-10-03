# Interview zur Spezifikation des Modellierungstools

Dieses Dokument zeigt, wie aus einer groben Idee ([first_spec.md](first_spec.md)) im Dialog mit einem LLM eine implementierbare Spezifikation ([spec.md](spec.md)) entsteht.

## Ausgangslage

Prompt an das LLM:

> In @first_spec.md ist eine erste Idee für ein Modellierungstool.
> Führe mit mir ein Interview, damit du eine vollständige Spezifikation für die Implementierung hast.
> Frage dabei ab, was unklar ist bzw. stelle Fragen, die für die Implementierung relevant sind, aber hier nicht vorkommen.

Das LLM stellte 28 Fragen in 7 Runden zu je 4 Fragen. Zu jeder Frage gab es vorgegebene Antworten und die Möglichkeit einer freien Antwort. Bei manchen Fragen markierte das LLM eine Option als Empfehlung.

Legende: ✅ = gewählte Antwort, ☐ = nicht gewählt, *(Mehrfachauswahl)* = mehrere Antworten möglich.

---

## Runde 1: Grundsatzfragen

### 1.1 Wie hängen logisches und physisches Modell zusammen?

- ✅ **Transformation (empfohlen):** Der Student zeichnet das logische Modell, die App erzeugt daraus per Knopfdruck das physische Modell. Wie Generalisierungen aufgelöst werden (roll up/down), wählt man dabei selbst. Das physische Modell kann man danach weiter bearbeiten (Datentypen etc.).
- ☐ **Zwei getrennte Diagramme:** Beide Modelle werden unabhängig voneinander gezeichnet, denn die Studenten sollen die Transformation selbst üben. Die App prüft nur die Regeln der jeweiligen Ebene.
- ☐ **Beides wählbar:** Man kann transformieren lassen, aber auch ein physisches Modell von Grund auf zeichnen. Für Prüfungen lässt sich die automatische Transformation eventuell deaktivieren.

### 1.2 Wie soll eine Generalisierung im logischen Modell dargestellt werden?

- ☐ **Subtyp-Boxen im Supertyp:** Klassische Crow's-Foot- bzw. Barker-Notation: Die Subtypen liegen als Boxen innerhalb der Supertyp-Box.
- ✅ **Kategorie-Symbol (Kreis):** IE/IDEF1X-Stil: Ein Kreis mit Strich(en) verbindet den Supertyp mit den Subtypen. Exklusiv/inklusiv und vollständig/unvollständig sind darstellbar.
- ☐ **UML-Dreieck:** Hohler Pfeil bzw. Dreieck vom Subtyp zum Supertyp, wie in UML-Klassendiagrammen.

### 1.3 Wie entstehen Fremdschlüssel im logischen Modell?

- ✅ **Automatisch über Beziehung (empfohlen):** Zieht man eine 1:n-Beziehung, wird der FK im Kind automatisch angelegt (bei identifizierenden Beziehungen als Teil des PK). Ändert sich der PK im Eltern-Entity, wird der FK nachgezogen. Den FK-Namen kann man anpassen.
- ☐ **Manuell eintragen:** Der Student tippt FK-Attribute selbst und markiert sie als FK. Die Beziehungslinie wird separat gezeichnet und mit dem FK verknüpft. Die App prüft auf Konsistenz.
- ☐ **Im logischen Modell gar keine FKs:** FKs sind dort nur implizit durch die Beziehung gegeben und erscheinen erst im physischen Modell.

### 1.4 Gibt es für den Prüfungseinsatz besondere Anforderungen? *(Mehrfachauswahl)*

- ✅ **Autosave im Browser:** Laufendes Sichern in localStorage, damit nach Absturz oder versehentlichem Schließen nichts verloren geht.
- ☐ **Validierung abschaltbar:** Hinweise wie „Entity ohne PK“ oder „n:m im physischen Modell“ sollen sich in der Prüfung ausblenden lassen, weil sie sonst die Lösung verraten.
- ✅ **Name/Matrikelnr. im Modell:** Name des Studenten, Klasse und Datum werden in JSON und PDF eingetragen (Kopfzeile).
- ☐ **Läuft in Safe Exam Browser:** Die App muss in einer Prüfungsumgebung wie SEB funktionieren. Dateidownload bzw. -speicherung muss dort klappen.

---

## Runde 2: Transformation und physisches Modell

### 2.1 Was passiert, wenn man das logische Modell nach der Transformation noch ändert?

- ✅ **Neu erzeugen mit Warnung (empfohlen):** Transformiert man erneut, wird das physische Modell überschrieben, vorher kommt eine Warnung. Manuelle Datentypen und Positionen werden übernommen, soweit Tabelle und Spalte gleich heißen.
- ☐ **Live-Synchronisation:** Änderungen im logischen Modell fließen sofort ins physische. Das ist deutlich aufwändiger und hat Konfliktpotenzial.
- ☐ **Einmalig, danach unabhängig:** Die Transformation läuft einmal, danach leben beide Modelle getrennt weiter.

### 2.2 Welches Datenbanksystem bestimmt die Datentypen im physischen Modell? *(Mehrfachauswahl)*

- ✅ **Standard-SQL (generisch):** INTEGER, VARCHAR(n), DECIMAL(p,s), DATE, TIMESTAMP, BOOLEAN usw.
- ☐ **PostgreSQL:** Dialekt mit SERIAL/IDENTITY, TEXT, BOOLEAN usw.
- ☐ **SQL Server:** Dialekt mit NVARCHAR, DATETIME2, BIT, IDENTITY usw.
- ☐ **Oracle:** Dialekt mit VARCHAR2, NUMBER, DATE usw.

### 2.3 Soll das physische Modell als SQL-Skript (CREATE TABLE) exportiert werden können?

- ✅ **Ja:** Export als .sql mit CREATE TABLE inkl. PK, FK, NOT NULL und UNIQUE.
- ☐ **Nein:** Es reichen JSON und PDF.
- ☐ **Ja, aber in Prüfung abschaltbar:** Der Export ist vorhanden, kann aber per Einstellung oder URL-Parameter deaktiviert werden.

### 2.4 Welche Spalteneigenschaften soll man im physischen Modell setzen können? *(Mehrfachauswahl)*

- ✅ **NOT NULL / NULL:** Pflichtfeld oder optional. Wird bei FKs aus der Kardinalität abgeleitet (1 bzw. 0..1).
- ✅ **UNIQUE:** Eindeutigkeit, auch über mehrere Spalten kombiniert.
- ✅ **Auto-Increment / Identity:** Automatisch generierter Schlüsselwert.
- ☐ **DEFAULT und CHECK:** Standardwerte und einfache Prüfbedingungen als Freitext.

---

## Runde 3: Logisches Modell und schnelle Eingabe

### 3.1 Wie sollen Attribute schnell eingegeben werden?

- ✅ **Tastatur-Zeilen (empfohlen):** Ein Doppelklick aufs Entity öffnet einen Inline-Editor. Enter legt ein neues Attribut an, Tab springt zur nächsten Eigenschaft, Pfeiltasten wechseln die Zeile. Mit einem Kurzpräfix wie „#id“ wird das Attribut zum PK, mit „?name“ optional.
- ☐ **Textsyntax pro Entity:** Ein Textfeld für das ganze Entity, z. B. „Student: #id, name, ?email“. Das Entity aktualisiert sich live.
- ☐ **Formular / Tabelle:** Ein Seitenpanel mit Tabelle (Name, PK, optional). Das ist klassisch, aber langsamer.

### 3.2 Welche Eigenschaften hat ein Attribut im logischen Modell? *(Mehrfachauswahl)*

- ✅ **Pflicht/optional:** Kennzeichnung von Muss- und Kann-Attributen (z. B. mit * oder o).
- ☐ **Unique (Alternativschlüssel):** Kennzeichnung als Schlüsselkandidat bzw. AK.
- ☐ **Mehrwertig/zusammengesetzt:** Mehrwertige oder zusammengesetzte Attribute, die bei der Transformation aufgelöst werden.
- ☐ **Kommentar/Beschreibung:** Freitext pro Attribut, im Diagramm ausblendbar.

### 3.3 Welche Beziehungsfeatures werden gebraucht? *(Mehrfachauswahl)*

- ☐ **Beziehungsname (Verbphrase):** Beschriftung an der Linie, z. B. „besucht“, eventuell für jede Leserichtung eine eigene.
- ✅ **Rekursive Beziehungen:** Ein Entity, das auf sich selbst verweist, z. B. Mitarbeiter → Vorgesetzter.
- ✅ **Mehrere Beziehungen A↔B:** Zwei oder mehr Beziehungen zwischen demselben Paar, z. B. Flug → Abflughafen/Zielflughafen. Dabei sind Rollennamen für die FKs nötig.
- ☐ **Attribute an n:m:** Attribute direkt an einer n:m-Beziehung (z. B. „Note“ bei Student–Kurs), die bei der Auflösung in die Zwischentabelle wandern.

### 3.4 Welche Eigenschaften hat eine Generalisierung? *(Mehrfachauswahl)*

- ☐ **Exklusiv/inklusiv:** Disjoint oder overlapping, im Kreissymbol z. B. mit X oder ohne.
- ✅ **Vollständig/unvollständig:** Total oder partiell, dargestellt als doppelter oder einfacher Strich unter dem Kreis.
- ☐ **Diskriminator-Attribut:** Typattribut im Supertyp, das beim Roll-up zur Typspalte wird.
- ☐ **Mehrstufig:** Ein Subtyp kann selbst wieder Supertyp sein.

---

## Runde 4: Transformationsregeln im Detail

### 4.1 Welche Auflösungsstrategien für Generalisierungen soll es geben?

- ✅ **Roll up + Roll down:** Roll up: Subtypen gehen in der Supertyp-Tabelle auf, mit Typspalte und nullable Subtyp-Spalten. Roll down: Die Attribute des Supertyps werden in jede Subtyp-Tabelle kopiert, der Supertyp entfällt. Bei Roll down muss die Generalisierung vollständig sein.
- ☐ **+ Tabelle pro Typ (1:1):** Zusätzlich als dritte Strategie: Supertyp und Subtypen bleiben eigene Tabellen, verbunden über eine identifizierende 1:1-Beziehung (PK = FK).

### 4.2 Wie soll beim Roll up die Typspalte entstehen?

- ☐ **Automatisch (empfohlen):** Es wird eine Spalte wie „Type“ bzw. „&lt;Supertyp&gt;Type“ mit NOT NULL angelegt. Bei unvollständiger Generalisierung darf der Wert auch den Supertyp bezeichnen. Name und Typ lassen sich anpassen.
- ✅ **Keine Typspalte:** Der Student legt sie bei Bedarf selbst an.
- ☐ **Pro Subtyp eine Bool-Spalte:** Flags wie IsStudent oder IsTeacher. Damit ließe sich auch Überlappung abbilden.

### 4.3 Welche Namenskonvention gilt für automatisch erzeugte Fremdschlüssel und Zwischentabellen?

- ☐ **PascalCase: StudentId:** FK = Entityname + PK-Attribut (Student.Id → StudentId). Zwischentabelle = StudentCourse.
- ☐ **snake_case: student_id:** FK = entity_pk (student_id). Zwischentabelle = student_course.
- ✅ **Konfigurierbar:** Eine Modelleinstellung legt die Konvention fest, Standard ist PascalCase.

### 4.4 Wo landet bei 1:1-Beziehungen der Fremdschlüssel?

- ✅ **Auf der optionalen Seite (empfohlen):** Bei 1 : 0..1 bekommt die 0..1-Seite den FK (mit UNIQUE). Bei 1:1 bzw. 0..1:0..1 entscheidet die Zeichenrichtung (von → nach), und man kann die Seite umschalten.
- ☐ **Immer wählbar:** Bei der Transformation fragt ein Dialog nach der Seite.

---

## Runde 5: Bedienung und Zeichenfläche

### 5.1 Was soll „automatisch ausrichten“ leisten? *(Mehrfachauswahl)*

- ✅ **Komplett-Layout (Graph):** Ein Knopf ordnet alle Entities neu an, mit möglichst wenigen Kreuzungen (z. B. per ELK/dagre-Layered-Algorithmus).
- ☐ **Auswahl ausrichten:** Markierte Entities links, oben oder mittig ausrichten bzw. gleichmäßig verteilen, wie in PowerPoint.
- ☐ **Nach Transformation:** Das physische Modell wird nach der Transformation automatisch angeordnet und orientiert sich dabei an den Positionen im logischen Modell.

### 5.2 Wie sollen Beziehungslinien geführt werden?

- ✅ **Orthogonal, automatisch (empfohlen):** Rechtwinklige Linien, die automatisch um Entities herumgeführt werden. Die Andockpunkte wählt die App selbst, man kann sie aber verschieben.
- ☐ **Orthogonal mit Knickpunkten:** Rechtwinklig, Knickpunkte lassen sich manuell ziehen.
- ☐ **Gerade Linien:** Direkte Verbindung von Rand zu Rand. Das ist einfach, wird bei vielen Entities aber unübersichtlich.

### 5.3 Welche Grundfunktionen braucht der Editor? *(Mehrfachauswahl)*

- ✅ **Undo/Redo:** Mit Strg+Z und Strg+Y, Verlauf mindestens 50 Schritte.
- ☐ **Mehrfachauswahl + Kopieren:** Rahmen aufziehen, Strg+Klick, Strg+C/V auch für Entities samt Attributen.
- ✅ **Zoom/Pan + Minimap:** Mausrad-Zoom, Verschieben mit Leertaste oder mittlerer Maustaste, Übersichtskarte.
- ✅ **Textnotizen:** Freie Notiz-Boxen auf der Zeichenfläche, z. B. für Annahmen in der Prüfung.

### 5.4 Wie soll der PDF-Export aussehen?

- ✅ **Auf eine Seite skaliert (empfohlen):** Vektor-PDF, wahlweise A4 oder A3, Hoch- oder Querformat. Das Diagramm wird auf eine Seite skaliert, Kopfzeile mit Name, Klasse, Datum und Modellname. Logisches und physisches Modell kommen jeweils auf eine eigene Seite.
- ☐ **Mehrseitig gekachelt:** Bei großen Modellen in Originalgröße auf mehrere Seiten verteilt.
- ☐ **Browser-Druckdialog:** Druck-CSS + window.print(). Das ist am einfachsten, das Ergebnis hängt aber vom Browser ab.

---

## Runde 6: Technik, Dateien, Qualitätssicherung

### 6.1 Soll die App das Modell prüfen und Fehler anzeigen?

- ✅ **Ja, nur Blocker (empfohlen):** Geprüft wird nur, was die Transformation verhindert: Entity ohne PK, doppelte Namen, Zyklus aus identifizierenden Beziehungen, Roll down bei unvollständiger Generalisierung. Fachliche Hinweise gibt es keine.
- ☐ **Ja, mit fachlichen Hinweisen:** Zusätzlich Warnungen wie „Entity ohne Beziehung“, „Attributname wie Entityname“ usw.
- ☐ **Keine Validierung:** Ist die Transformation nicht möglich, schlägt sie einfach mit einer Fehlermeldung fehl.

### 6.2 In welcher Sprache soll die Benutzeroberfläche sein?

- ☐ **Deutsch:** Nur Deutsch.
- ✅ **Deutsch + Englisch (i18n):** Umschaltbar, Texte stehen in Sprachdateien.
- ☐ **Englisch:** Nur Englisch, passend zu den Fachbegriffen.

### 6.3 Wie sollen JSON-Dateien gespeichert und geöffnet werden?

- ☐ **Download/Upload (empfohlen):** „Speichern“ lädt eine .json-Datei herunter, „Öffnen“ nutzt einen Dateidialog oder Drag & Drop. Das klappt in allen Browsern, auch unter file://.
- ✅ **File System Access API:** Echtes „Speichern“ in dieselbe Datei. Das gibt es nur in Chromium (Edge/Chrome), mit Fallback auf Download.

### 6.4 Wie soll die Codebasis aufgebaut sein? *(Mehrfachauswahl)*

- ✅ **TypeScript strict:** React + TypeScript, Build mit Vite, Single-File-Build per vite-plugin-singlefile für die statische HTML-Datei.
- ✅ **Unit-Tests (Vitest):** Vor allem für die Transformationslogik (log → phys) und den DDL-Export.
- ✅ **E2E-Tests (Playwright):** Kernabläufe im Browser: Entity anlegen, Beziehung ziehen, transformieren, exportieren.
- ✅ **GitHub Action für Pages:** Automatischer Build und Deploy auf GitHub Pages bei Push auf main.

---

## Runde 7: Restliche Detailfragen

### 7.1 Was passiert beim Roll down mit Beziehungen, die am Supertyp hängen?

- ✅ **Pro Subtyp duplizieren (empfohlen):** Ist der Supertyp das Kind (er hat einen FK), bekommt jede Subtyp-Tabelle den FK. Ist er das Eltern-Entity, bekommt die referenzierende Tabelle pro Subtyp einen FK, und die werden alle nullable.
- ☐ **Transformation verweigern:** Roll down ist nur möglich, wenn am Supertyp keine Beziehungen hängen, sonst kommt eine Fehlermeldung. Der Student muss dann Roll up wählen.

### 7.2 Wie viel darf man im physischen Modell bearbeiten?

- ✅ **Alles (empfohlen):** Tabellen und Spalten hinzufügen, löschen und umbenennen, Datentypen und Constraints setzen, FKs anlegen. Erneutes Transformieren überschreibt Strukturänderungen, behält aber Datentypen, Constraints und Positionen bei Namensgleichheit.
- ☐ **Nur Datentypen/Constraints/Layout:** Die Struktur kommt ausschließlich aus dem logischen Modell. Im physischen Modell setzt man nur Typen, NOT NULL, UNIQUE, Identity und Positionen.

### 7.3 Welcher Datentyp wird bei der Transformation vergeben?

- ✅ **Leer, muss gesetzt werden:** Spalten haben zunächst keinen Typ. Der DDL-Export markiert fehlende Typen als Fehler. Das ist didaktisch sinnvoll: Der Student muss jeden Typ bewusst wählen.
- ☐ **Heuristik nach Name:** Endet ein Name auf „Id“ → INTEGER, enthält er „Date“/„Datum“ → DATE, sonst VARCHAR(255). FKs übernehmen den Typ des referenzierten PK.
- ☐ **Immer VARCHAR(255):** Einheitlicher Platzhalter, nur FKs übernehmen den PK-Typ.

### 7.4 Wie werden Beziehungen gezeichnet und ihre Kardinalitäten gesetzt?

- ✅ **Ziehen + Kontextleiste (empfohlen):** Vom Andockpunkt eines Entities zum anderen ziehen, Standard ist 1 : 0..n nicht identifizierend. Bei ausgewählter Linie erscheint eine kleine Leiste mit den 4 Symbolen pro Ende und dem Schalter identifizierend/nicht identifizierend. Ein Klick aufs Linienende schaltet zyklisch durch.
- ☐ **Werkzeugpalette:** Wie bei MySQL Workbench: Zuerst den Beziehungstyp in der Toolbar wählen (1:1, 1:n, n:m, jeweils identifizierend oder nicht), dann Quelle und Ziel anklicken.

---

## Annahmen des LLM nach dem Interview

Einige Punkte ergaben sich aus keiner Antwort direkt. Das LLM hat sie in der Spezifikation festgelegt und dem Nutzer zur Prüfung offengelegt:

- Beim Roll up werden Subtyp-Attribute und die von Subtypen stammenden FKs immer `NULL`-fähig.
- Ist der Supertyp Eltern einer identifizierenden Beziehung, ist Roll down ein Blocker, weil `NULL`-fähige FKs nicht Teil eines PK sein dürfen.
- Generalisierungen haben nur eine Stufe, und ein Entity kann nur Subtyp einer Generalisierung sein.
- Mehrfachauswahl und Kopieren/Einfügen sind nicht im Umfang, weil die kombinierte Option abgewählt wurde.
- Bei kollidierenden FK-Namen wird eine Zahl angehängt. Manuell umbenannte FK-Namen bleiben erhalten.
- Der SQL-Export bricht ab, wenn Datentypen fehlen.
- Für Browser ohne File System Access API ist Download/Upload als Fallback vorgesehen.
