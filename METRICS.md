# Aufwand der Implementierung

Gemessen wurde die Umsetzung von [spec.md](spec.md) in **einer Claude-Code-Session** mit dem Modell Claude Opus 5.5. Erfasst ist der Zeitraum vom Absenden des Prompts bis zur fertigen, getesteten App. Das vorangegangene Spezifikations-Interview ([questions.md](questions.md)) ist nicht enthalten.

Prompt: *„Führe die Implementierung in @spec.md durch. Zeichne dabei die Zeit und den Tokenverbrauch auf …“*

## Ergebnis

| Kennzahl | Wert |
|---|---|
| Dauer (Wall-Clock) | **36 min 27 s** (07:31:24 – 08:07:51 UTC, 3. 10. 2026) |
| API-Aufrufe | 150 (77 Hauptagent, 73 Subagenten) |
| Input-Tokens (ungecacht) | 300 |
| Output-Tokens | **263.087** |
| Cache-Read-Tokens | **23.355.757** |
| Cache-Write-Tokens | 696.306 |
| Produktivcode | 7.178 Zeilen in 102 Dateien (TypeScript/TSX) |
| Testcode | 1.835 Zeilen Unit-Tests, 244 Zeilen E2E-Tests |
| Tests | 124 Unit-Tests, 8 E2E-Tests, alle grün |

### Aufschlüsselung

|  | API-Aufrufe | Input | Output | Cache Read | Cache Write | Summe |
|---|---:|---:|---:|---:|---:|---:|
| **Gesamt** | 150 | 300 | 263.087 | 23.355.757 | 696.306 | 24.315.450 |
| Hauptagent (Architektur, UI, Integration, Tests) | 77 | 154 | 195.425 | 16.644.193 | 289.588 | 17.129.360 |
| Subagent: logische FKs, Validierung, JSON | 22 | 44 | 22.681 | 1.938.378 | 124.599 | 2.085.702 |
| Subagent: orthogonales Kanten-Routing | 17 | 34 | 15.408 | 1.377.134 | 134.519 | 1.527.095 |
| Subagent: Transformation, physische FKs, DDL | 34 | 68 | 29.573 | 3.396.052 | 147.600 | 3.573.293 |

Die drei Subagenten liefen **parallel** zum Hauptagenten, jeweils etwa 10–13 Minuten.

## Ablauf

| Zeit (UTC) | Schritt |
|---|---|
| 07:31 | Prompt, Messskript, Projekt-Scaffold (Vite, React, TS strict, Vitest, Playwright) |
| 07:37 | Domänentypen und Schnittstellen (Stubs) festgelegt |
| 07:40 | 3 Subagenten gestartet: FK-Ableitung/Validierung/JSON, Transformation/DDL, Routing |
| 07:40–07:56 | Hauptagent parallel: Modelloperationen, Stores mit Undo/Redo, Zeichenfläche, Inline-Editor, Dialoge, PDF, i18n |
| 07:50–07:53 | Subagenten fertig (55 + 53 + 16 Unit-Tests) |
| 07:56 | Erster Typecheck ohne Fehler, alle 124 Unit-Tests grün |
| 07:57–08:04 | Test im Browser: 5 Fehler gefunden und behoben (Editorhöhe, Stacking der Kanten, Fettdruck im PDF, Shortcut-Fokus, Anker-Griffe) |
| 08:00–08:06 | E2E-Tests geschrieben, Builds geprüft (GitHub Pages und Einzeldatei offline per `file://`) |
| 08:07 | Dokumentation, Messung |

## So liest man die Token-Zahlen

- **Input** sind neue Tokens, die nicht aus dem Cache kommen. Der Wert ist winzig, weil praktisch der gesamte Kontext gecacht ist.
- **Cache Read**: Bei jedem API-Aufruf wird der bisherige Gesprächsverlauf (Spec, geschriebener Code, Tool-Ergebnisse) erneut gelesen, aber aus dem Prompt-Cache. Deshalb ist diese Zahl so groß. Sie wächst ungefähr mit *Anzahl Aufrufe × Kontextlänge*. Gecachte Tokens kosten nur einen Bruchteil normaler Input-Tokens.
- **Cache Write** sind Tokens, die neu in den Cache geschrieben werden, also jeder neue Abschnitt des Verlaufs.
- **Output** ist alles, was das Modell erzeugt: Code, Tool-Aufrufe, Erklärungen und Denkschritte.

## Messung reproduzieren

Claude Code protokolliert jede Session als JSONL unter `~/.claude/projects/<projekt>/<session-id>.jsonl` und die Subagenten unter `<session-id>/subagents/`. Jeder Modellaufruf enthält dort seine `usage`. Das Skript [tools/session_metrics.py](tools/session_metrics.py) summiert diese Werte. Es zählt jede API-Antwort nur einmal, auch wenn sie gestreamt über mehrere Zeilen geschrieben wurde.

```bash
python tools/session_metrics.py c7870bb3-8f7a-4e59-a6e7-f132b5dcd9dc --since 2026-10-03T07:31:24Z --markdown
```

Die Werte oben stammen vom Zeitpunkt, an dem diese Datei erstellt wurde. Die abschließende Antwort im Chat ist nicht mehr enthalten. Sie macht nur wenige tausend Tokens aus.
