# Modellierungstool für den Datenbankunterricht

Im Unterricht für Datenbanken müssen Studenten Datenmodelle erstellen.
Dafür brauchen sie eine Software, mit dessen Hilfe sie auch bei Prüfungen das Datenmodell erstellen können.

## Notation: Crow's Foot Notation

- One or Zero
- One and only One
- Zero or Many
- One or Many

Identifizierende und nicht identifizierende Beziehungen werden durch den Strich unterschieden (durchgezogen oder strichliert).
Bei identifizierenden Beziehungen ist - physisch gesehen - der Primärschlüssel von Entity A Teil des PKs von Entity B.
Bei nicht identifizierenden Beziehungen ist - physisch gesehen - der Primärschlüssel von Entity A ein normales Attribut von Entity B.

## Unterschied logische und physische Modelle

Im Unterricht wird auf die Unterscheidung zwischen logischen und physischen Modellen unterschieden.
Das logische Modell ist datenbankenunabhängig.
Es kennt daher keine Datentypen und beinhaltet auch n:m Beziehungen sowie Generalisierungen.


## Erstellung logischer Modelle

Auf einer Zeichenfläche sollen logische ER Modelle nach der Crow's Foot Notation erstellt werden können.
Wichtig ist die flüssige Eingabe der Entities, es sollen die Spalten schnell eingegeben werden können.

Auf logischer Ebene sollen folgende Konzepte umgesetzt werden:
- Primärschlüssel (auch kombiniert)
- Fremdschlüssel
- Identifizierende und nicht identifizierende Beziehungen
- Generalisierung

## Erstellung physischer Modelle

Die Physische Sicht ist eine grafische Repräsentation der CREATE TABLE Anweisung.
Sie wird durch die Möglichkeiten einer relationalen Datenbank determiniert.

- Generalisierungen müssen durch roll up oder roll down aufgelöst werden.
- n:m Beziehungen werden durch Auflösungstabellen realisiert.

## Speicherung und Export der Modelle

Die Modelle sollen als JSON Dateien auf der Festplatte gespeichert werden können, damit die Studenten sie abgeben und übermitteln können.
Das Modell soll auch als PDF exportiert werden können.

## GUI

Die Entities sollen bei Bedarf automatisch ausgerichtet werden können.
Eine Zeichenfläche mit klassischem Raster und Snap in soll beim Zeichnen helfen.


## Technologische Randbedingungen

Die App muss ohne Internet benutzbar sein, d. h. alle externen Libraries müssen enthalten sein.
Die App soll sowohl auf github Pages als auch als statisches HTML File bereitgestellt werden können.

Verwende React als SPA Framework, mit dessen Hilfe die App erzeugt werden kann.
