# ER-Modellierungstool: Entwickler- und Agent-Dokumentation

Referenz für das gesamte Repository, damit sich Erweiterungen ohne vorheriges Lesen aller rund 100 Quelldateien umsetzen lassen. Die fachliche Anforderung steht in [spec.md](spec.md), die Bedienung in [README.md](README.md).

## 1. Zweck

- Browser-App (React + TypeScript strict, Vite) zum Zeichnen von ER-Modellen in Crow's-Foot-Notation, gedacht für Unterricht und Prüfungen.
- **Logisches Modell:** Entities, Attribute, 1:n/1:1/n:m-Beziehungen, einstufige Generalisierungen, Notizen. Fremdschlüssel werden automatisch abgeleitet.
- **Physisches Modell:** wird per Knopfdruck aus dem logischen erzeugt und danach frei bearbeitet (Datentypen, NOT NULL, UNIQUE, IDENTITY).
- **Ausgaben:** JSON-Datei (beide Modelle), SQL-DDL (Standard-SQL), Vektor-PDF. Autosave in localStorage.
- **Vollständig offline:** keine Netzwerkzugriffe zur Laufzeit. Zwei Build-Ziele: GitHub Pages und eine einzelne HTML-Datei für `file://`.

## 2. Modulüberblick

Zwei Schichten. `src/domain` ist reines TypeScript ohne React und ohne DOM; `src/ui` baut darauf auf. **Domain importiert nie aus ui.**

| Ordner | Zeilen | Verantwortung |
| --- | --- | --- |
| [src/domain/model/](src/domain/model/) | 218 | Typen: `common` (Relationship, Note, Anchor, ForeignKeyOrigin), `logical`, `physical`, `document` |
| [src/domain/](src/domain/) (Wurzel) | 160 | [cardinality.ts](src/domain/cardinality.ts) (Eltern/Kind-Ableitung), [naming.ts](src/domain/naming.ts) (Konventionen, Kollisionen), [dataTypes.ts](src/domain/dataTypes.ts), [ids.ts](src/domain/ids.ts) |
| [src/domain/foreignKeys/](src/domain/foreignKeys/) | 594 | FK-Synchronisation logisch und physisch, Schlüssel-Abhängigkeitsgraph |
| [src/domain/graph/](src/domain/graph/) | 72 | generisches Tarjan-SCC und topologische Sortierung (physische FKs, DDL) |
| [src/domain/operations/](src/domain/operations/) | 492 | reine Modelloperationen, die der Store aufruft (Entity anlegen, Attribut verschieben, …) |
| [src/domain/transform/](src/domain/transform/) | 419 | logisch → physisch: Tabellenplan, Beziehungen, Zwischentabellen, Spalten, Erhalt, 1:1-UNIQUE |
| [src/domain/validation/](src/domain/validation/) | 215 | Blocker-Prüfungen, Issue-Codes |
| [src/domain/ddl/](src/domain/ddl/) | 120 | SQL-Generierung |
| [src/domain/serialization/](src/domain/serialization/) | 366 | JSON lesen/schreiben, Schema-Prüfung, Migrationsrahmen |
| [src/domain/routing/](src/domain/routing/) | 822 | Andockpunkte und orthogonales Kanten-Routing (A*) |
| [src/domain/testing/](src/domain/testing/) | 119 | Test-Builder (nur von Tests benutzt) |
| [src/ui/store/](src/ui/store/) | 251 | zustand-Stores: Dokument mit Undo/Redo, UI-Zustand |
| [src/ui/commands/](src/ui/commands/) | 294 | Aktionen der Oberfläche: Datei, Export, Transformation, Layout, Bearbeiten |
| [src/ui/diagram/](src/ui/diagram/) | 1.729 | React-Flow-Zeichenfläche, Nodes, Kanten, Inline-Editor, gemeinsame Geometrie |
| [src/ui/services/](src/ui/services/) | 482 | Dateizugriff, Autosave, ELK-Layout, PDF-Export |
| [src/ui/app/](src/ui/app/) | 573 | App-Shell, Toolbar, Dialoge, Shortcuts, Autosave-Hook |
| [src/ui/i18n/](src/ui/i18n/) | 346 | Sprachdateien de/en, Übersetzungsfunktionen |

Größte Dateien: [documentSchemaV1.ts](src/domain/serialization/documentSchemaV1.ts) (243), [logicalForeignKeys.ts](src/domain/foreignKeys/logicalForeignKeys.ts) (229), [InlineEditor.tsx](src/ui/diagram/editor/InlineEditor.tsx) (226), [DiagramCanvas.tsx](src/ui/diagram/DiagramCanvas.tsx) (221). Keine Datei hat mehr als 250 Zeilen.

**Externe Abhängigkeiten** ([package.json](package.json)): `@xyflow/react` (Zeichenfläche, Zoom, Pan, Minimap), `zustand` (Stores), `elkjs` (Auto-Layout), `jspdf` + `svg2pdf.js` (PDF). Dev: `vite`, `vite-plugin-singlefile`, `vitest`, `@playwright/test`, TypeScript 7.

**Tests:** Unit-Tests liegen als `*.test.ts` neben dem Domain-Code (124 Tests, `npm test`). E2E-Tests liegen in [e2e/](e2e/) (8 Tests, `npm run e2e`). Für die UI-Schicht gibt es keine Unit-Tests.

## 3. Schnittstelle

### npm-Skripte

| Skript | Wirkung |
| --- | --- |
| `dev` | Vite-Dev-Server, Port 5173 |
| `build` | `tsc -b` + Build nach `dist/`, Basis-Pfad aus Umgebungsvariable `BASE_PATH` (Default `./`) |
| `build:single` | Mode `singlefile` ([vite.config.ts](vite.config.ts)): alles inline in `dist-single/index.html` |
| `test` / `e2e` | Vitest (nur `src/**/*.test.ts`) / Playwright (startet eigenen Dev-Server auf Port 4174, [playwright.config.ts](playwright.config.ts)) |

CI: [.github/workflows/deploy.yml](.github/workflows/deploy.yml) läuft bei Push auf `main` mit `npm test`, beiden Builds und dem Deploy auf Pages. Die Einzeldatei wird dort als `modeltool-offline.html` mit veröffentlicht. Die E2E-Tests laufen in der CI **nicht**.

### Domain-API (die Funktionen, die die UI aufruft)

| Funktion | Ort | Vertrag |
| --- | --- | --- |
| `resolveRoles(rel)` | [cardinality.ts:42](src/domain/cardinality.ts#L42) | liefert `kind` sowie Eltern/Kind und deren Kardinalitäten (Abschnitt 5.1) |
| `syncLogicalForeignKeys(model, conv)` | [logicalForeignKeys.ts:71](src/domain/foreignKeys/logicalForeignKeys.ts#L71) | idempotent, nach **jeder** Änderung; unveränderte Entities behalten die Objektidentität |
| `effectivePrimaryKey(model, id)` | [logicalForeignKeys.ts:13](src/domain/foreignKeys/logicalForeignKeys.ts#L13) | PK inklusive identifizierender FKs; ein Subtyp liefert den PK des Supertyps |
| `syncPhysicalForeignKeys(model, conv)` | [physicalForeignKeys.ts:29](src/domain/foreignKeys/physicalForeignKeys.ts#L29) | idempotent, nach jeder Änderung |
| `applyParentCardinalityToForeignKeys` | [physicalForeignKeys.ts:66](src/domain/foreignKeys/physicalForeignKeys.ts#L66) | setzt NOT NULL der FK-Spalten einer Beziehung neu aus dem Eltern-Ende |
| `transformToPhysical(logical, settings, strategies, previous?)` | [transformToPhysical.ts:21](src/domain/transform/transformToPhysical.ts#L21) | erwartet ein FK-synchronisiertes, gültiges logisches Modell; ohne Strategie gilt Roll up |
| `validateLogical(model, strategies?)` | [logicalValidation.ts:15](src/domain/validation/logicalValidation.ts#L15) | Roll-down-Regeln nur für Generalisierungen, die in `strategies` auf `rollDown` stehen |
| `validatePhysical(model)` | [physicalValidation.ts:11](src/domain/validation/physicalValidation.ts#L11) | Blocker vor dem DDL-Export |
| `generateDdl(model)` | [generateDdl.ts:21](src/domain/ddl/generateDdl.ts#L21) | deterministisch; setzt ein gültiges Modell voraus |
| `serializeDocument` / `parseDocument` | [documentSerializer.ts:24](src/domain/serialization/documentSerializer.ts#L24) / [:29](src/domain/serialization/documentSerializer.ts#L29) | `parseDocument` wirft nie und liefert `{ok:false, error, detail?}` |
| `computeRoutes(nodes, edges)` | [computeRoutes.ts:42](src/domain/routing/computeRoutes.ts#L42) | Ports und Polylinien aller Kanten; Kanten zu unbekannten Knoten bekommen keine Route |
| `anchorFromPoint` / `portFromAnchor` | [anchors.ts:29](src/domain/routing/anchors.ts#L29) / [:10](src/domain/routing/anchors.ts#L10) | Umrechnung zwischen Punkt auf dem Rand und Anker (Seite + Offset 0..1) |

Die Operationen in [src/domain/operations/](src/domain/operations/) sind reine Funktionen `(model, …) → model`. Funktionen, die ein Element anlegen, geben `[model, neueId]` zurück. Die generischen Varianten (`relationshipOperations`, `noteOperations`) arbeiten auf beiden Modellen über die Typen `WithRelationships` / `WithNotes`.

### Tastatur und Maus

Die Belegung steht in [README.md](README.md#bedienung). Umgesetzt ist sie an drei Stellen:

- **Global:** [useKeyboardShortcuts.ts:23](src/ui/app/useKeyboardShortcuts.ts#L23)
- **Inline-Editor:** [InlineEditor.tsx:109-151](src/ui/diagram/editor/InlineEditor.tsx#L109-L151)
- **Combobox:** [DataTypeInput.tsx:42](src/ui/diagram/editor/DataTypeInput.tsx#L42)

## 4. Datenfluss

### Jede Bearbeitung

```
UI-Ereignis (Editor, Kontextleiste, Drag)
 └─ useDocumentStore.commit(view, recipe, {mergeKey?})      documentStore.ts:83
     └─ apply(view, recipe, historyKey)                     documentStore.ts:55
         ├─ changed = recipe(doc[view])        reine Operation aus domain/operations
         ├─ [changed === current] → Abbruch, kein Undo-Schritt
         ├─ synchronize(view, changed)                      documentStore.ts:46
         │    └─ syncLogicalForeignKeys | syncPhysicalForeignKeys
         └─ set({doc, history: record(...), dirty: true})   history.ts:17
React-Render
 └─ DiagramCanvas: buildScene(doc, view, editingId)         buildScene.ts:46
     ├─ Größen: entitySize / tableSize (Textmessung)        nodeGeometry.ts:44/60
     ├─ Generalisierungs-Kanten mit festen Ankern (unten raus, oben rein)
     └─ computeRoutes(nodes ohne Notizen, edges)            computeRoutes.ts:42
          ├─ assignPorts → routeEdge (A*) → separateOverlaps
     └─ React-Flow-Nodes mit fester width/height + SceneContext für die Kanten
```

Reihenfolge-Invarianten:

1. **Der FK-Sync läuft im Store, nicht in den Operationen.** Operationen dürfen FK-Attribute in einem inkonsistenten Zustand hinterlassen (z. B. nach dem Löschen einer Beziehung); erst `synchronize` räumt auf. Wer den Store umgeht, muss den Sync selbst aufrufen.
2. **Eine Recipe muss dieselbe Referenz zurückgeben, wenn sich nichts ändert.** Sonst entsteht ein leerer Undo-Schritt, und `dirty` wird gesetzt.
3. **Ziehen erzeugt genau einen Undo-Schritt:** `beginGesture` ([documentStore.ts:86](src/ui/store/documentStore.ts#L86)) merkt sich den Ausgangszustand, Zwischenschritte laufen über `commitTransient`, und `endGesture` legt den Undo-Schritt an. So funktionieren Node-Drag, Notiz-Resize und das Ziehen eines Andockpunkts.
4. **Tippen wird über `mergeKey` zusammengefasst** (z. B. `attr-name:<id>`). Aufeinanderfolgende Commits mit gleichem Schlüssel ergeben einen Undo-Schritt.

### Transformation

```
Toolbar „Physisches Modell erzeugen“
 └─ startTransformation()                                   transformCommands.ts:18
     ├─ validateLogical(logical)   [Blocker] → IssuePanel, Ende
     └─ TransformDialog: Strategie je Generalisierung, Überschreib-Warnung
         └─ runTransformation(strategies)                   transformCommands.ts:33
             ├─ validateLogical(logical, strategies)   [Roll-down-Blocker] → IssuePanel
             ├─ Strategien in Generalization.strategy speichern (logischer Undo-Schritt)
             ├─ transformToPhysical(logical, settings, strategies, doc.physical)
             │    planTables → mapForeignKeyRelationships → resolveJunctionTables
             │    → buildColumns → syncPhysical → preservePrevious → addOneToOneUniques → syncPhysical
             └─ commit('physical', () => physical)    = ein physischer Undo-Schritt; Wechsel in die physische Ansicht
```

Invarianten von `transformToPhysical` ([transformToPhysical.ts:28-54](src/domain/transform/transformToPhysical.ts#L28-L54)):

1. **Spalten-IDs werden vorab vergeben** ([columnMapping.ts:20-22](src/domain/transform/columnMapping.ts#L20-L22)), weil FK-Spalten auf Schlüsselspalten anderer Tabellen verweisen.
2. **Logische FK-Attribute werden zu FK-Spalten mit übernommenem Namen und `isRenamed`.** Nur so überleben Rollennamen wie `DepartureAirportId`. Lässt sich ein FK nicht 1:1 abbilden (Roll-down-Elternteil), fällt das Attribut weg, und der Sync erzeugt neue FKs.
3. **Erhalt vor UNIQUE:** `preservePrevious` übernimmt `isUnique` aus dem alten Modell; erst danach setzt `addOneToOneUniques` die 1:1-UNIQUEs. Ein altes `isUnique=false` entfernt also kein neues 1:1-UNIQUE.
4. **Der zweite Sync** gibt die übernommenen PK-Typen an nicht überschriebene FKs weiter.

### Speichern, Laden, Export

- **Speichern** ([fileCommands.ts:59](src/ui/commands/fileCommands.ts#L59)): `savedAt` setzen → `serializeDocument` → `saveJsonFile` ([fileService.ts:75](src/ui/services/fileService.ts#L75)). Mit File System Access API (Chromium) wird in den gemerkten Handle geschrieben, sonst als Download.
- **Laden** ([fileCommands.ts:30](src/ui/commands/fileCommands.ts#L30)): `parseDocument` → bei Fehler ein Toast mit `file.error.<code>` → `loadDocument` ([documentStore.ts:120](src/ui/store/documentStore.ts#L120)). Das synchronisiert beide Modelle und leert beide Undo-Verläufe.
- **SQL** ([exportCommands.ts:11](src/ui/commands/exportCommands.ts#L11)): `validatePhysical` → bei Blockern IssuePanel, sonst `generateDdl` als Download.
- **PDF** ([pdfExport.ts:29](src/ui/services/pdf/pdfExport.ts#L29)): pro Ansicht `buildScene(…, null)` → `buildDiagramSvg` → `pdf.svg`. Das SVG wird dafür kurz außerhalb des Bildschirms ins DOM gehängt ([pdfExport.ts:42](src/ui/services/pdf/pdfExport.ts#L42)). jsPDF und ELK werden per dynamischem `import()` erst bei Bedarf geladen.

## 5. Kernkonzepte

### 5.1 Beziehungen speichern die Zeichenrichtung, nicht die Rollen

`Relationship` ([common.ts:36](src/domain/model/common.ts#L36)) hat `sourceId/targetId` und eine Kardinalität je Ende. Wer Eltern und wer Kind ist, berechnet **ausschließlich** `resolveRoles` ([cardinality.ts:42](src/domain/cardinality.ts#L42)):

| Ende source | Ende target | kind | Eltern | Kind (bekommt FK) |
| --- | --- | --- | --- | --- |
| max 1 | max n | oneToMany | source | target |
| max n | max 1 | oneToMany | target | source (`isReversed`) |
| `1` | `0..1` | oneToOne | source | target (die `0..1`-Seite) |
| `0..1` | `1` | oneToOne | target | source |
| gleich, max 1 | gleich, max 1 | oneToOne | source | target (Zeichenrichtung) |
| max n | max n | manyToMany | – | – (FKs erst bei der Transformation) |

Folgerungen:

- „Richtung tauschen“ ([relationshipOperations.ts:51](src/domain/operations/relationshipOperations.ts#L51)) tauscht nur die IDs und Anker; die Kardinalitäten bleiben an ihren Enden.
- Ein Kardinalitätswechsel kann die Rollen umdrehen, und der FK springt dann in die andere Tabelle.
- Der Default beim Zeichnen ist source=`one`, target=`zeroOrMany` ([relationshipOperations.ts:13](src/domain/operations/relationshipOperations.ts#L13)). Das Startentity ist damit Eltern.
- Die Symbolkonvention: Das Symbol an einem Ende gibt an, wie viele Instanzen *dieses* Entities zu einer Instanz der Gegenseite gehören. Deshalb ist das Eltern-Ende das, an dem das Symbol des Elternteils steht, und `parentCardinality === 'zeroOrOne'` heißt: FK optional.

### 5.2 FK-Synchronisation

Ein generiertes Attribut bzw. eine generierte Spalte trägt `fk: {relationshipId, referencedId, isRenamed}` ([common.ts:62](src/domain/model/common.ts#L62)), physisch zusätzlich `isTypeOverridden` ([physical.ts:4](src/domain/model/physical.ts#L4)). **Identität ist das Paar (relationshipId, referencedId), nie der Name.**

Logisch ([logicalForeignKeys.ts:71-117](src/domain/foreignKeys/logicalForeignKeys.ts#L71-L117)), in vier Phasen:

1. **Schlüsselstruktur** in Abhängigkeitsreihenfolge: identifizierender Elternteil vor Kind, Supertyp vor Subtyp. Die Reihenfolge berechnet `analyzeKeyGraph` ([keyGraph.ts:56](src/domain/foreignKeys/keyGraph.ts#L56)).
2. **Nicht identifizierende FKs.**
3. **Namen der Schlüssel-FKs** in Abhängigkeitsreihenfolge.
4. **Übrige Namen.**

Danach werden die Attributlisten zusammengebaut: Bestehende behalten ihre Position, neue werden angehängt.

| Regel | Umsetzung |
| --- | --- |
| Name | weitergereichter Schlüssel (Referenz ist selbst FK) behält seinen Namen, sonst `foreignKeyName(Eltern, PK)` ([naming.ts:24](src/domain/naming.ts#L24)). Beginnt der PK schon mit dem Elternnamen, wird dieser nicht verdoppelt |
| Kollision | `uniqueName` hängt 2, 3, … an, ohne Groß-/Kleinschreibung zu beachten ([naming.ts:43](src/domain/naming.ts#L43)). Vergabereihenfolge: Nutzernamen, dann Schlüssel-FKs, dann übrige, je in Beziehungs- und Schlüsselreihenfolge |
| Umbenennen | `updateAttribute` setzt `isRenamed` ([logicalOperations.ts:51](src/domain/operations/logicalOperations.ts#L51)); der Sync überschreibt den Namen dann nie mehr |
| PK / optional | `isPrimaryKey = identifizierend`; optional nur wenn nicht identifizierend und Eltern-Ende `0..1` |
| Subtyp | eigene PK-Flags werden auf false gezwungen; auch identifizierende FKs in einen Subtyp werden kein PK |
| Zyklus identifizierender Beziehungen | Beziehungen auf dem Zyklus erzeugen FKs **ohne** PK-Flag, damit nichts endlos wächst; die Validierung meldet den Zyklus |

Physisch ([physicalForeignKeys.ts:29](src/domain/foreignKeys/physicalForeignKeys.ts#L29)) gilt dasselbe Prinzip mit diesen Unterschieden:

- `isNotNull` neuer FK-Spalten kommt aus dem Eltern-Ende und bleibt danach editierbar. Nur identifizierende FKs werden immer auf NOT NULL gezwungen.
- `dataType` folgt der referenzierten PK-Spalte, solange nicht `isTypeOverridden` gesetzt ist. `updateColumn` setzt das Flag, sobald der Nutzer einen abweichenden Typ eingibt ([physicalOperations.ts:73](src/domain/operations/physicalOperations.ts#L73)).
- Namen vergibt [physicalForeignKeyNaming.ts:14](src/domain/foreignKeys/physicalForeignKeyNaming.ts#L14), und zwar aus dem Namen der *physischen* Elterntabelle. Nach einem Roll up heißt ein nicht umbenannter FK auf den Subtyp `Teacher` deshalb `PersonId`.
- In einem identifizierenden Zyklus werden die aus dem Zyklus stammenden PK-Spalten nicht referenziert ([physicalForeignKeys.ts:51-54](src/domain/foreignKeys/physicalForeignKeys.ts#L51-L54)).

### 5.3 Generalisierung und Transformationsstrategie

- Ein Subtyp ist Subtyp genau einer Generalisierung und nie selbst Supertyp. `addSubtype` erzwingt das ([logicalOperations.ts:106](src/domain/operations/logicalOperations.ts#L106)) und legt pro Supertyp höchstens eine Generalisierung an. Ziehen im Verbindungsmodus „Generalisierung“ von A nach B fügt B zu As Generalisierung hinzu.
- `planTables` ([tablePlan.ts:36](src/domain/transform/tablePlan.ts#L36)) setzt die Strategien um:
  - **Roll up:** Subtyp-Attribute werden NULL-fähige, nicht schlüsselbildende Spalten der Supertyp-Tabelle.
  - **Roll down:** Die Supertyp-Attribute stehen in jeder Subtyp-Tabelle vor den eigenen.
- `tablesOf(entityId)` liefert die Zieltabellen: bei Roll up die des Supertyps, bei Roll down mehrere.
- `mapForeignKeyRelationships` ([foreignKeyRelationships.ts:29](src/domain/transform/foreignKeyRelationships.ts#L29)) legt pro Paar (Kindtabelle × Elterntabelle) eine Beziehung an. Hat sie mehrere Elterntabellen (Roll down) oder ist das Kind aufgerollt, wird die Beziehung über `withOptionalParent` zu Eltern-Ende `0..1` und nicht identifizierend; bei 1:1 bekommen beide Enden `0..1`.
- **n:m** ([junctionTables.ts:24](src/domain/transform/junctionTables.ts#L24)):
  - Zwischentabelle ohne eigene Spalten, ihre FKs erzeugt der Sync.
  - Das Kind-Ende einer Seite richtet sich nach dem Minimum am *gegenüberliegenden* ursprünglichen Ende.
  - Bei einem Roll-down-Ende entsteht eine Zwischentabelle je Subtyp-Tabelle.

### 5.4 Eine Geometrie für Canvas, Routing und PDF

- **Knotengrößen werden berechnet, nicht im DOM gemessen** ([nodeGeometry.ts](src/ui/diagram/geometry/nodeGeometry.ts)): Die Breite kommt aus der Textmessung über Canvas `measureText` ([textMeasure.ts:7](src/ui/diagram/geometry/textMeasure.ts#L7)), die Höhe aus Zeilenzahl × `ROW_HEIGHT`.
- React-Flow-Nodes bekommen diese Größe als feste `width/height` ([DiagramCanvas.tsx:86](src/ui/diagram/DiagramCanvas.tsx#L86)). Deshalb kann `buildScene` auch für die gerade nicht sichtbare Ansicht routen, was der PDF-Export braucht.
- Die CSS-Regeln in [app.css](src/ui/styles/app.css) (`.node-row`, `.node-title`, `.editor-header`) müssen zu [diagramMetrics.ts](src/ui/diagram/geometry/diagramMetrics.ts) passen.
- Diagrammschrift ist Arial, metrisch identisch mit Helvetica im PDF. Die PDF-Zeichnung [diagramSvg.ts](src/ui/services/pdf/diagramSvg.ts) verwendet dieselben Konstanten und dieselben Symbolformen ([crowFootShapes.ts:23](src/ui/diagram/symbols/crowFootShapes.ts#L23)).

Routing ([computeRoutes.ts:42](src/domain/routing/computeRoutes.ts#L42)):

1. **Ports:** Manuelle Anker gelten unverändert. Automatische Enden bekommen die Seite nach der dominanten Lücke zwischen den Knoten; ist sie kleiner als `2·STUB_LENGTH`, docken beide Enden an derselben Außenseite an ([assignPorts.ts:107](src/domain/routing/assignPorts.ts#L107)). Pro Knotenseite werden die Enden auf (i+1)/(k+1) verteilt, sortiert nach der Lage der Gegenseite. Rekursive Beziehungen gehen rechts raus und oben rein.
2. **Weg:** senkrechter Stummel `STUB_LENGTH`, danach A* über ein dünnes Sichtbarkeitsraster mit Kosten = Länge + `BEND_PENALTY` pro Knick. Zuerst wird mit `OBSTACLE_MARGIN` gesucht, dann ohne, zuletzt bleibt ein Z-Pfad ([routeEdge.ts:18](src/domain/routing/routeEdge.ts#L18)).
3. **Überlappungen:** Deckungsgleiche Innensegmente werden im Abstand `LANE_SPACING` auf Spuren gelegt ([separateOverlaps.ts:28](src/domain/routing/separateOverlaps.ts#L28)).

Notizen sind keine Hindernisse. Die Kanten einer Generalisierung haben feste Anker: Sie verlassen Supertyp und Kreis unten und treten oben in Kreis und Subtyp ein ([buildScene.ts:35-36](src/ui/diagram/scene/buildScene.ts#L35-L36)). Ihre Kanten-IDs sind `<genId>:super` bzw. `<genId>:sub:<subtypeId>` ([buildScene.ts:39](src/ui/diagram/scene/buildScene.ts#L39)); `deleteSelection` und die Kontextleiste zerlegen diese IDs per `split(':')`.

## 6. Konstanten-Referenz

### Domain

| Konstante | Ort | Wert / Bedeutung |
| --- | --- | --- |
| `DOCUMENT_FORMAT` / `DOCUMENT_VERSION` | [document.ts:5-6](src/domain/model/document.ts#L5-L6) | `'er-modeltool'` / `1`, von der Spec vorgegeben; Kennung im JSON |
| `CARDINALITIES` | [common.ts:13](src/domain/model/common.ts#L13) | Reihenfolge = Klickzyklus am Linienende (`nextCardinality`) und Reihenfolge der Buttons in der Kontextleiste |
| `DATA_TYPE_SUGGESTIONS` | [dataTypes.ts:2](src/domain/dataTypes.ts#L2) | Combobox-Vorschläge laut Spec 5.3; Platzhalter `n`, `p,s` werden nach der Auswahl markiert |
| `INTEGER_TYPES` | [dataTypes.ts:20](src/domain/dataTypes.ts#L20) | erlaubte IDENTITY-Typen: SMALLINT, INTEGER, INT, BIGINT |
| `STUB_LENGTH` | [routingConstants.ts:2](src/domain/routing/routingConstants.ts#L2) | 28 px; Platz für das Symbol. **Invariante:** ≥ äußerste Symbolkoordinate (Kreis bei x=19, r=4,5 → 23,5) |
| `OBSTACLE_MARGIN` / `BEND_PENALTY` / `LANE_SPACING` | [routingConstants.ts:5-11](src/domain/routing/routingConstants.ts#L5-L11) | 12 / 30 / 8 px, Erfahrungswerte |
| `RECURSIVE_OFFSET_X` | [junctionTables.ts:10](src/domain/transform/junctionTables.ts#L10) | 320 px; Position der Zwischentabelle einer rekursiven n:m-Beziehung |
| `MIGRATIONS` | [documentSerializer.ts:21](src/domain/serialization/documentSerializer.ts#L21) | leer; Eintrag `n` hebt ein rohes Dokument von Version n auf n+1 |

### UI

| Konstante | Ort | Wert / Bedeutung |
| --- | --- | --- |
| `HEADER_HEIGHT`, `ROW_HEIGHT`, `BODY_PADDING` | [diagramMetrics.ts:10-12](src/ui/diagram/geometry/diagramMetrics.ts#L10-L12) | 28 / 22 / 4 px. **Müssen zu den CSS-Höhen in app.css passen**, sonst verschieben sich Andockpunkte und PDF-Text |
| `KEY_COLUMN_WIDTH`, `FLAG_COLUMN_WIDTH`, `PHYSICAL_FLAGS_WIDTH` | [diagramMetrics.ts:14-16](src/ui/diagram/geometry/diagramMetrics.ts#L14-L16) | 44 / 18 / 64 px, gespiegelt in `grid-template-columns` von `.node-row` |
| `EDITOR_HEADER_HEIGHT` | [diagramMetrics.ts:19](src/ui/diagram/geometry/diagramMetrics.ts#L19) | 16 px, Zusatzhöhe bei geöffnetem Editor (Spaltenlabels) |
| `LOGICAL_EDITOR_WIDTH` / `PHYSICAL_EDITOR_WIDTH` | [diagramMetrics.ts:20-21](src/ui/diagram/geometry/diagramMetrics.ts#L20-L21) | 340 / 620 px Mindestbreite bei geöffnetem Editor |
| `GENERALIZATION_SIZE`, `GENERALIZATION_RADIUS` | [diagramMetrics.ts:24-25](src/ui/diagram/geometry/diagramMetrics.ts#L24-L25) | 24×32 px Kreis inkl. Striche, r = 11 |
| `GRID_SIZE` | [diagramMetrics.ts:27](src/ui/diagram/geometry/diagramMetrics.ts#L27) | 16 px Raster und Snap |
| `MIN_CONNECT_DISTANCE` | [DiagramCanvas.tsx:43](src/ui/diagram/DiagramCanvas.tsx#L43) | 12 px Mindestweg, damit ein Klick auf einen Andockpunkt keine rekursive Beziehung erzeugt |
| `HISTORY_LIMIT` | [history.ts:10](src/ui/store/history.ts#L10) | 100 Undo-Schritte pro Ansicht (Spec: mindestens 50) |
| `AUTOSAVE_DELAY_MS` | [usePersistenceGuards.ts:5](src/ui/app/usePersistenceGuards.ts#L5) | 1000 ms Debounce (Spec 9.3) |
| `PAGE_MARGIN` / `HEADER_HEIGHT` (PDF) | [pdfExport.ts:22-23](src/ui/services/pdf/pdfExport.ts#L22-L23) | 10 / 12 mm |
| ELK-Optionen | [autoLayout.ts:17-26](src/ui/services/autoLayout.ts#L17-L26) | layered, DOWN, Abstände 64/80 px; danach Snap auf `GRID_SIZE` |
| Crow's-Foot-Geometrie | [crowFootShapes.ts:11-34](src/ui/diagram/symbols/crowFootShapes.ts#L11-L34) | Strich bei x=8/14 (`1`), Kreis bei x=19, Krähenfuß 0..12; das randnahe Symbol zeigt das Maximum |

localStorage-Schlüssel: `er-modeltool.autosave` ([autosave.ts:4](src/ui/services/autosave.ts#L4)) und `er-modeltool.language` ([language.ts:8](src/ui/i18n/language.ts#L8)).

## 7. Externe Systeme (Browser-APIs)

Es gibt keine Netzwerkzugriffe. Alles läuft über Browser-APIs:

| API | Ort | Verhalten |
| --- | --- | --- |
| File System Access (`showOpenFilePicker`, `showSaveFilePicker`) | [fileService.ts:25](src/ui/services/fileService.ts#L25) | nur Chromium. Der Handle der geöffneten/gespeicherten Datei wird modulweit gemerkt ([fileCommands.ts:9](src/ui/commands/fileCommands.ts#L9)); `Strg+S` schreibt hinein. Abbruch (`AbortError`) → `undefined`, kein Fehler |
| `<input type="file">` / Download-Link | [fileService.ts:56](src/ui/services/fileService.ts#L56), [:93](src/ui/services/fileService.ts#L93) | Fallback ohne die API; SQL und PDF werden immer heruntergeladen |
| localStorage | [autosave.ts](src/ui/services/autosave.ts), [language.ts](src/ui/i18n/language.ts) | alle Zugriffe in try/catch, Fehler werden ignoriert |
| `beforeunload` | [usePersistenceGuards.ts:27](src/ui/app/usePersistenceGuards.ts#L27) | Warnung bei `dirty` |
| Canvas 2D `measureText` | [textMeasure.ts:7](src/ui/diagram/geometry/textMeasure.ts#L7) | ohne DOM (Vitest) Schätzung 7 px pro Zeichen |

## 8. Details

- **JSON:** `serializeDocument` ist `JSON.stringify(doc, null, 2)`. `parseDocument` baut das Ergebnis nur aus bekannten Feldern auf und verwirft unbekannte, damit Roundtrip und Vergleich mit `toStrictEqual` stabil sind. Optionale Felder (`sourceAnchor`, `fk`, `strategy`) dürfen fehlen, aber nicht `null` sein. Geprüft werden Referenzen von Beziehungen und Generalisierungen ([documentSchemaV1.ts:155](src/domain/serialization/documentSchemaV1.ts#L155)), nicht aber `fk.relationshipId/referencedId`: Der Sync beim Laden räumt verwaiste FKs auf.
- **Autosave** speichert `{savedAt, document: <serialisiertes JSON als String>}`. Der Wiederherstellen-Dialog erscheint nur, wenn das gesicherte Dokument nicht leer ist ([App.tsx:16](src/ui/app/App.tsx#L16)). Solange er offen ist, ist der Autosave aus, damit der Stand nicht überschrieben wird.
- **i18n:** [de.ts](src/ui/i18n/de.ts) ist der Referenzkatalog; `MessageKey = keyof typeof de` ([messages.ts:4](src/ui/i18n/messages.ts#L4)). [en.ts](src/ui/i18n/en.ts) ist als `Record<MessageKey, string>` typisiert, ein fehlender Schlüssel ist also ein Compilerfehler. Platzhalter heißen `{name}`. Validierungsmeldungen ergeben sich aus `issue.<code>` und den `params` der Issues; deren Schlüssel stehen in den Validierungsdateien.
- **Inline-Editor:** generisch über Felddefinitionen ([InlineEditor.tsx:48](src/ui/diagram/editor/InlineEditor.tsx#L48)), konkret in `LogicalEditor` und `PhysicalEditor`.
  - Der Fokus liegt als `{rowId, field}` im UI-Store, nicht im DOM. Ein Effekt setzt ihn bei jeder Änderung auf das passende Input.
  - Deaktivierte Felder überspringt Tab, z. B. NN bei PK-Spalten und IDENTITY bei nicht ganzzahligem Typ.
  - Präfixe parst [namePrefix.ts:12](src/ui/diagram/editor/namePrefix.ts#L12).
  - Wird ein Entity ohne Name und Attribute geschlossen, löscht `onClose` es ([LogicalEditor.tsx:76](src/ui/diagram/editor/LogicalEditor.tsx#L76)).
- **React Flow:** Die Zeichenfläche ist vollständig kontrolliert. Auswahl, Löschen und Mehrfachauswahl übernimmt nicht React Flow selbst (`deleteKeyCode={null}`, `selected` kommt aus dem UI-Store). Jeder Node hat vier sichtbare Andockpunkte und zwei unsichtbare Handles `in`/`out`, an denen die Kanten hängen ([NodeHandles.tsx:14](src/ui/diagram/nodes/NodeHandles.tsx#L14)); die Linienführung kommt trotzdem aus dem eigenen Router. Eine Verbindung entsteht in `onConnectEnd` per `elementFromPoint`, ein Drop irgendwo auf dem Ziel-Node genügt ([DiagramCanvas.tsx:142](src/ui/diagram/DiagramCanvas.tsx#L142)).
- **DDL** ([generateDdl.ts](src/domain/ddl/generateDdl.ts)):
  - PK-Spalten stehen zuerst.
  - Constraint-Namen `PK_<T>`, `UQ_<T>_<Spalten>`, `FK_<Kind>_<Eltern>` sind im ganzen Skript eindeutig (Nummernsuffix).
  - Reihenfolge: Eltern zuerst. Einen Zyklus bricht die erste verbleibende Tabelle auf; FKs zu später erzeugten Tabellen folgen am Ende als `ALTER TABLE … ADD CONSTRAINT`. Selbstreferenzen bleiben inline.

## 9. Fehlerbehandlung

| Situation | Verhalten |
| --- | --- |
| Ungültige JSON-Datei (Syntax, Format, Version, Schema) | Toast `file.error.*`, bei Schemafehlern mit Pfad (`logical.entities[2].name`); das aktuelle Dokument bleibt |
| Lesen/Schreiben einer Datei scheitert | Toast `file.error.read` / `file.error.write` |
| Dateidialog abgebrochen | stillschweigend nichts |
| Blocker bei Transformation oder SQL-Export | IssuePanel; ein Klick wechselt die Ansicht, wählt das Element aus und zentriert es |
| PDF-Erzeugung wirft | Toast `export.pdfFailed`, Ursache wird nicht geloggt |
| Ungültige Generalisierung beim Ziehen | Toast `generalization.error.*`, keine Änderung |
| FK-Attribut löschen (`Strg+Entf`) | Toast `editor.fkNotDeletable`; `deleteAttribute`/`deleteColumn` ignorieren FKs ohnehin |
| Ausnahme in Sync, Transformation, Routing oder Rendering | **nicht** abgefangen; es gibt keine Error Boundary, die Oberfläche wird weiß |
| ELK-Layout scheitert | **nicht** abgefangen (abgelehntes Promise in `autoArrange`) |
| localStorage nicht verfügbar | ignoriert; Autosave und Sprachwahl werden nicht gespeichert |

Benutzermeldungen kommen nur aus den i18n-Katalogen. Eine Konsolen-Ausgabe oder ein Logging gibt es nicht.

## 10. Erweiterungspunkte

**Neuer Validierungs-Blocker:**
1. Code in `LogicalIssueCode`/`PhysicalIssueCode` eintragen ([issues.ts:5](src/domain/validation/issues.ts#L5)).
2. Die Prüfung in [logicalValidation.ts](src/domain/validation/logicalValidation.ts) bzw. [physicalValidation.ts](src/domain/validation/physicalValidation.ts) ergänzen.
3. Den Text `issue.<code>` in **beiden** Katalogen anlegen; der Compiler erzwingt das über das Template `issue.${code}`.
4. Ist `elementId` eine Beziehung, zentriert das IssuePanel auf deren Ziel-Node.

**Neue Spalteneigenschaft (z. B. DEFAULT, CHECK):**
1. Feld in `Column` ([physical.ts:13](src/domain/model/physical.ts#L13)) ergänzen.
2. Default in `addColumn`, in `newForeignKeyColumn` ([physicalForeignKeys.ts:138](src/domain/foreignKeys/physicalForeignKeys.ts#L138)) und in `buildColumns` ([columnMapping.ts:40](src/domain/transform/columnMapping.ts#L40)) setzen.
3. Schema-Reader `readColumn` ([documentSchemaV1.ts:185](src/domain/serialization/documentSchemaV1.ts#L185)) anpassen. Als Pflichtfeld bricht das alte Dateien, also optional lesen oder `DOCUMENT_VERSION` erhöhen und eine Migration eintragen.
4. Ausgabe in `columnDefinition` ([generateDdl.ts:61](src/domain/ddl/generateDdl.ts#L61)).
5. Erhalt bei erneuter Transformation in `preservePrevious` ([preservation.ts:24](src/domain/transform/preservation.ts#L24)).
6. Editorfeld in `fields` und `FIELD_PATCH` von [PhysicalEditor.tsx](src/ui/diagram/editor/PhysicalEditor.tsx#L21), Anzeige in `TableNode` und `diagramSvg`. Reicht `PHYSICAL_FLAGS_WIDTH` nicht mehr, Konstante und CSS gemeinsam ändern.

**Neues logisches Attribut-Flag:**
1. Feld in `LogicalAttribute` und `readAttribute` ergänzen.
2. Behandlung in `updateAttribute` ([logicalOperations.ts:51](src/domain/operations/logicalOperations.ts#L51)): Bei FK-Attributen ist dort nur `name` erlaubt.
3. Feld in [LogicalEditor.tsx](src/ui/diagram/editor/LogicalEditor.tsx) samt Feldindex-Konstanten (Zeilen 18-20) und in `EntityRow` ([displayRows.ts:15](src/ui/diagram/geometry/displayRows.ts#L15)).
4. Mapping auf Spalten in `buildColumns`.

**Dateiformat ändern:**
1. `DOCUMENT_VERSION` erhöhen.
2. Eine Funktion `MIGRATIONS[alteVersion]` eintragen ([documentSerializer.ts:21](src/domain/serialization/documentSerializer.ts#L21)).
3. Neue Version lesen, als neue `readDocumentV2` oder durch Anpassen von [documentSchemaV1.ts](src/domain/serialization/documentSchemaV1.ts). Der Roundtrip-Test in `documentSerializer.test.ts` muss weiter grün sein.

**Weitere Sprache:**
1. `xx.ts` als `Messages` anlegen.
2. `Language` und `catalogs` in [language.ts](src/ui/i18n/language.ts#L6-L9) erweitern, ebenso die Browsersprach-Erkennung in `initialLanguage`.
3. Option im Sprach-`select` der [Toolbar.tsx](src/ui/app/Toolbar.tsx) ergänzen.

**SQL-Dialekt:** `generateDdl` ist auf Standard-SQL fest verdrahtet: `GENERATED ALWAYS AS IDENTITY` in `columnDefinition`, keine Quotes um Bezeichner. Für Dialekte eine Dialekt-Strategie als Parameter einführen. Betroffen wären auch `DATA_TYPE_SUGGESTIONS` und `isIntegerType`.

**Neues Diagramm-Element (z. B. Kommentar-Pfeil):**
1. Typ im Modell ergänzen, dazu Operationen und Schema.
2. `SceneNode`/`SceneEdge` und `buildScene` erweitern ([buildScene.ts:9-28](src/ui/diagram/scene/buildScene.ts#L9-L28)).
3. Node-Komponente in `nodeTypes` ([DiagramCanvas.tsx:39](src/ui/diagram/DiagramCanvas.tsx#L39)) und `nodeData` eintragen.
4. Positionen in `movePositions` und Löschen in `deleteSelection` ([editCommands.ts:69](src/ui/commands/editCommands.ts#L69)) ergänzen, Zeichnung in `drawNode` ([diagramSvg.ts:109](src/ui/services/pdf/diagramSvg.ts#L109)) ergänzen.

**Neuer Tastatur-Shortcut:** global in [useKeyboardShortcuts.ts](src/ui/app/useKeyboardShortcuts.ts), im Editor im `switch` von [InlineEditor.tsx](src/ui/diagram/editor/InlineEditor.tsx#L109). Globale Shortcuts ohne Strg greifen bewusst nicht, solange der Fokus im Editor oder in einem Textfeld liegt.

**FK-Namensregel ändern:** `foreignKeyName` ([naming.ts:24](src/domain/naming.ts#L24)) wirkt in beiden Modellen. Die Sonderregel für weitergereichte Schlüssel steht doppelt: `baseName` in [logicalForeignKeys.ts:166](src/domain/foreignKeys/logicalForeignKeys.ts#L166) und in [physicalForeignKeyNaming.ts:34](src/domain/foreignKeys/physicalForeignKeyNaming.ts#L34).

## 11. Fallstricke

- **Den Store umgehen** (Modell direkt mutieren oder ein `set` ohne `apply`) überspringt den FK-Sync und das Undo. Alle Modelle sind immutable; Operationen müssen neue Objekte liefern.
- **Die Namenskonvention ist nicht rückgängig zu machen:** `setSettings` ([documentStore.ts:105](src/ui/store/documentStore.ts#L105)) synchronisiert beide Modelle ohne Undo-Schritt. Ein späteres Undo stellt Zustände mit FK-Namen der alten Konvention wieder her, bis zur nächsten Änderung. `setMeta` hat ebenfalls kein Undo.
- **Undo schließt den Inline-Editor** ([editCommands.ts:99](src/ui/commands/editCommands.ts#L99)); `Strg+Z` im Editor ist Modell-Undo, kein Text-Undo.
- **Die Transformation überschreibt das physische Modell vollständig.** Erhalten bleiben nur Position, Datentyp, UNIQUE und IDENTITY bei exakt gleichem Tabellen- und Spaltennamen (Groß-/Kleinschreibung zählt) sowie die Notizen. **Benannte mehrspaltige UNIQUE-Constraints und manuelle Andockpunkte gehen verloren.**
- **Tabellen überlappen nach der Transformation oft,** weil sie breiter als Entities sind, aber deren Position übernehmen (Spec 4.1). Abhilfe schafft „Automatisch anordnen“; automatisch läuft es laut Spec nie.
- **Physische Validierung prüft keine identifizierenden Beziehungen** mit Eltern-Ende ≠ `1`; nur die logische Validierung tut das.
- **Doppelter Graph-Code:** [keyGraph.ts](src/domain/foreignKeys/keyGraph.ts) bringt eigenes Tarjan und Kahn mit, obwohl [graph/](src/domain/graph/) generische Varianten enthält. Wer einen Graph-Fehler behebt, muss beide Stellen prüfen.
- **Ungenutzt im Code:** `MARKER_FONT` und `DIAGRAM_FONT_FAMILY` (nur intern) in [diagramMetrics.ts](src/ui/diagram/geometry/diagramMetrics.ts), `clearAutosave` in [autosave.ts:35](src/ui/services/autosave.ts#L35), der Typ `RelationshipKind` in [cardinality.ts:19](src/domain/cardinality.ts#L19).
- **Performance:** `buildScene` und damit das komplette Routing laufen bei jeder Modelländerung, auch bei jedem Drag-Frame. Laut Routing-Test dauert das bei 50 Knoten / 80 Kanten etwa 3–7 ms. Für sehr große Modelle fehlt eine inkrementelle Berechnung.
- **Bundle-Größe:** ELK macht rund 1,4 MB aus (dynamisch geladen), die Einzeldatei hat etwa 2,8 MB. Die Schriften sind Systemschriften; auf Systemen ohne Arial weicht die Textmessung leicht von Helvetica im PDF ab.
- **E2E-Tests entfernen die File System Access API** per Init-Script ([e2e/helpers.ts](e2e/helpers.ts)), damit Speichern und Öffnen ohne native Dialoge laufen. Der Pfad mit der echten API ist deshalb nicht automatisiert getestet.
- **Kein Unit-Test für die UI-Schicht,** keine Error Boundary, kein Logging.
