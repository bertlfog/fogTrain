# SPEC – TrainingApp

Status: Entwurf v2 (Entscheidungen des Auftraggebers vom 25.10.2026 eingearbeitet). Grundlage: ADR-001 (abgenommen) und Projektbeschreibung des Auftraggebers.
Kennzeichnung: **[Annahme]** = nicht explizit vorgegeben, bitte prüfen. **[Offen]** = siehe Abschnitt 8.

---

## 1. Ziel und Abgrenzung

### Ziel
Persönliche Fitness-/Workout-App für **genau einen Nutzer** (den Auftraggeber) auf einem **Android-Smartphone**. Der Nutzer verwaltet Übungen (Physiotherapie und Kräftigung), stellt daraus Trainingspläne zusammen, loggt Workouts schnell und sieht seinen Verlauf. Daten liegen lokal auf dem Gerät und sind exportierbar.

### Kann (MVP)
- Übungen verwalten: Name, Kurzbeschreibung, Standard-Wiederholungen, optional Bilder (aus Projektbeschreibung).
- Trainingsplan anlegen: geordnete Auswahl von Übungen mit Soll-Werten.
- Workout loggen: Sätze mit Wiederholungen, Gewicht, Dauer.
- Verlauf und Fortschritt anzeigen.
- Export aller Daten als JSON (Backup). Ein Import ist vorerst nicht Teil des MVP.
- Installierbar als PWA, vollständig offline nutzbar.

### Kann bewusst nicht
- Kein Backend, kein Server-Speicher, kein Login, keine Konten.
- Keine weiteren Nutzer, kein Teilen, keine Veröffentlichung (kein App-Store, keine SEO, keine Mehrbenutzer-Logik).
- Keine Health-Daten (Puls, Schritte, Schlaf), keine Uhr-/Wearable-Anbindung, kein Health Connect.
- Keine automatische Cloud-Synchronisation (Backup nur manuell über Export).
- Kein Import von Backups vorerst (Entscheidung des Auftraggebers); das Export-Format bleibt versioniert, damit ein Import später möglich ist.
- Keine Push-Erinnerungen (Entscheidung des Auftraggebers).
- Keine Funktionen über das MVP hinaus, bis der Auftraggeber sie benennt (**[Offen]** F2).

---

## 2. Nutzerflüsse (MVP)

Allgemeines Offline-Verhalten: Nach der ersten Installation/dem ersten Laden funktionieren **alle** Flüsse ohne Netz. Es gibt keine Netzwerkaufrufe der App-Logik. Nur das Laden/Aktualisieren der App-Dateien selbst braucht Netz (Service Worker, siehe T2).

### F-A: Übung anlegen/bearbeiten
1. Nutzer öffnet „Übungen" und tippt „Neue Übung".
2. Nutzer gibt Namen (Pflicht) und Kurzbeschreibung ein; optional Standard-Wiederholungen, Standard-Gewicht, Standard-Dauer.
3. Optional: Bild(er) hinzufügen (Kamera oder Galerie). Bilder werden lokal gespeichert, verkleinert (**[Annahme]** längste Kante max. 1280 px).
4. Nutzer tippt „Speichern"; Übung erscheint in der Liste.
5. Bearbeiten: Übung antippen, ändern, speichern. Löschen: mit Rückfrage; Übung wird archiviert (`archivedAt`), wenn sie in Plänen oder Verlauf vorkommt, sonst hart gelöscht (siehe 3).
- Offline: identisch, keine Einschränkung.

### F-B: Trainingsplan anlegen
1. Nutzer öffnet „Pläne" und tippt „Neuer Plan".
2. Nutzer vergibt Namen.
3. Nutzer fügt Übungen aus der Übungsliste hinzu (Mehrfachauswahl, Suche nach Name).
4. Je Planeintrag: Soll-Sätze, Soll-Wiederholungen, optional Soll-Gewicht, optional Soll-Dauer; Vorbelegung aus den Übungs-Standards.
5. Reihenfolge per Auf/Ab-Buttons ändern (**[Annahme]** keine Drag-and-drop-Pflicht), Einträge entfernen.
6. Speichern. Plan erscheint in der Liste.
- Offline: identisch.

### F-C: Workout loggen
1. Startseite zeigt Pläne; Nutzer tippt „Start" bei einem Plan (Tap 1). Alternativ „Freies Workout" ohne Plan, Übungen werden während des Workouts hinzugefügt.
2. App legt sofort ein Workout mit Startzeit an und zeigt die erste Übung mit vorbefüllten Sätzen (Soll-Werte, bzw. Werte des letzten Mals **[Annahme]**: letzte geloggte Werte dieser Übung haben Vorrang vor Plan-Sollwerten).
3. Je Satz: Wiederholungen, Gewicht, Dauer sind vorbefüllt und per +/- oder Zahlenfeld änderbar; Tippen auf „Satz erledigt" (Tap 2) speichert den Satz sofort in IndexedDB.
4. Weitere Sätze hinzufügen oder entfernen; zur nächsten Übung wechseln; Übung überspringen.
5. „Workout beenden" setzt Endzeit; Zusammenfassung wird angezeigt.
6. Bei App-Abbruch/Neustart mitten im Workout: App bietet an, das offene Workout fortzusetzen oder zu beenden. Bereits geloggte Sätze gehen nicht verloren.
- Offline: identisch; jeder Satz wird einzeln persistiert, nicht erst am Ende.

### F-D: Verlauf und Fortschritt
1. Nutzer öffnet „Verlauf": Liste vergangener Workouts, neueste zuerst (Datum, Plan, Dauer, Anzahl Sätze).
2. Antippen eines Workouts zeigt alle Übungen und Sätze (Wiederholungen, Gewicht, Dauer); nachträgliches Korrigieren/Löschen von Sätzen ist möglich.
3. „Fortschritt": Nutzer wählt eine Übung; App zeigt je Workout-Datum den besten Satz (höchstes Gewicht, bei Gleichstand meiste Wiederholungen) als Tabelle und einfaches Liniendiagramm, plus Gesamtvolumen (Summe Wiederholungen × Gewicht) je Workout.
- Offline: identisch; Berechnung rein lokal.

### F-E: Export
1. Nutzer öffnet „Einstellungen" und tippt „Daten exportieren".
2. App erzeugt eine JSON-Datei `trainingapp-backup-YYYY-MM-DD.json` mit allen Daten inkl. Schema-Version und Bildern (Base64).
3. Android-Download-/Teilen-Dialog öffnet sich; Nutzer speichert die Datei.
- Offline: funktioniert (rein lokal).

### F-F: Import (zurückgestellt, vorerst nicht umsetzen)
Hinweis: Der Auftraggeber hat entschieden, den Import vorerst wegzulassen. Der Fluss bleibt als Vorlage für später erhalten und wird in den Aufgaben T1 bis T11 nicht gebaut.
1. Nutzer öffnet „Einstellungen" und tippt „Daten importieren", wählt eine JSON-Datei.
2. App validiert Datei (Format, Schema-Version, Pflichtfelder) **vor** jeder Änderung. Bei Fehler: verständliche Meldung, Daten bleiben unverändert.
3. App zeigt Zusammenfassung (Anzahl Übungen, Pläne, Workouts) und fragt: „Alle vorhandenen Daten ersetzen?" (**[Annahme]** MVP kennt nur Ersetzen, kein Zusammenführen; **[Offen]** F3).
4. Bei Bestätigung wird in **einer Transaktion** ersetzt. Bei Fehler: vollständiger Rollback.
5. Ältere Schema-Versionen werden per Migration hochgezogen; neuere als die App kennt werden abgelehnt.
- Offline: funktioniert.

---

## 3. Datenmodell

Gemeinsame Regeln:
- **IDs:** `string`, UUID v4 (`crypto.randomUUID()`), clientseitig erzeugt. Beziehungen nur über IDs.
- **Zeitstempel:** ISO-8601-Strings in UTC (`"2026-10-25T18:30:00.000Z"`). Anzeige in lokaler Zeit.
- **Einheiten:** Gewicht ausschließlich in kg (bestätigt; `number`, Schritte 0,25 zulässig **[Annahme]**), Dauer in Sekunden (`number`, ganzzahlig).
- **Schema-Version:** Konstante `SCHEMA_VERSION` (aktuell `1`). Sie bestimmt die IndexedDB-Version (Migrationen in `onupgradeneeded`) und steht im Export.

```ts
export const SCHEMA_VERSION = 1;

export type Id = string;          // UUID v4
export type IsoDateTime = string; // ISO-8601, UTC

export interface Timestamps {
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

/** Bild einer Übung; Binärdaten getrennt von der Übung gespeichert. */
export interface ExerciseImage {
  id: Id;
  exerciseId: Id;
  mimeType: string;       // z. B. "image/jpeg"
  data: Blob;             // im Export als Base64-String (siehe ExportFile)
  sortOrder: number;      // 0-basiert
  createdAt: IsoDateTime;
}

export interface Exercise extends Timestamps {
  id: Id;
  name: string;                 // Pflicht, nicht leer, max. 100 Zeichen
  description: string;          // Kurzbeschreibung, darf leer sein, max. 2000 Zeichen
  defaultReps?: number;         // Standard-Wiederholungen
  defaultWeightKg?: number;
  defaultDurationSec?: number;
  archivedAt?: IsoDateTime;     // gesetzt = in Auswahllisten ausgeblendet, im Verlauf weiter sichtbar
}

export interface Plan extends Timestamps {
  id: Id;
  name: string;                 // Pflicht, max. 100 Zeichen
  archivedAt?: IsoDateTime;
}

export interface PlanItem {
  id: Id;
  planId: Id;
  exerciseId: Id;
  position: number;             // 0-basiert, lückenlos je Plan
  targetSets: number;           // >= 1
  targetReps?: number;
  targetWeightKg?: number;
  targetDurationSec?: number;
}

export interface Workout {
  id: Id;
  planId?: Id;                  // fehlt bei freiem Workout
  planNameSnapshot?: string;    // Name zum Startzeitpunkt (Verlauf bleibt stabil)
  startedAt: IsoDateTime;
  endedAt?: IsoDateTime;        // fehlt = Workout offen
  note?: string;
}

/** Ein geloggter Satz. exerciseNameSnapshot hält den Verlauf lesbar, auch nach Löschen/Umbenennen. */
export interface LoggedSet {
  id: Id;
  workoutId: Id;
  exerciseId: Id;
  exerciseNameSnapshot: string;
  exerciseOrder: number;        // Reihenfolge der Übung im Workout
  setNumber: number;            // 1-basiert je Übung im Workout
  reps?: number;
  weightKg?: number;
  durationSec?: number;
  loggedAt: IsoDateTime;
}
// Regel: mindestens eines von reps, weightKg, durationSec muss gesetzt sein.

export interface ExportFile {
  app: "TrainingApp";
  schemaVersion: number;
  exportedAt: IsoDateTime;
  data: {
    exercises: Exercise[];
    exerciseImages: Array<Omit<ExerciseImage, "data"> & { dataBase64: string }>;
    plans: Plan[];
    planItems: PlanItem[];
    workouts: Workout[];
    loggedSets: LoggedSet[];
  };
}
```

### Erläuterung
- **Beziehungen:** Exercise 1–n ExerciseImage; Plan 1–n PlanItem n–1 Exercise; Workout n–1 Plan (optional); Workout 1–n LoggedSet n–1 Exercise.
- **Sätze statt Aggregat:** Jeder Satz ist ein eigener Datensatz, damit Loggen schnell (ein Schreibvorgang pro Tap) und Auswertung flexibel ist.
- **Snapshots** (`planNameSnapshot`, `exerciseNameSnapshot`): Verlauf bleibt korrekt, wenn Pläne/Übungen später umbenannt werden.
- **Löschen:** Übung/Plan mit vorhandenen Verweisen (Plan-Einträge, Verlauf) wird nur archiviert. Ohne Verweise hart gelöscht (inkl. Bilder bzw. Plan-Einträge). Workouts und Sätze werden nur vom Nutzer explizit gelöscht.
- **IndexedDB-Stores:** `exercises`, `exerciseImages`, `plans`, `planItems`, `workouts`, `loggedSets`. Indizes: `planItems.planId`, `exerciseImages.exerciseId`, `loggedSets.workoutId`, `loggedSets.exerciseId`, `workouts.startedAt`.
- **Migrationen:** Jede Version N→N+1 ist eine reine, getestete Funktion (`migrations/vN-to-vN+1.ts`); der Import nutzt dieselben Funktionen auf dem JSON.

---

## 4. Architekturregeln

### Schichten (Abhängigkeit nur nach unten)
1. **UI** (`src/ui`): React-Komponenten, Seiten, Routing. Rein darstellend: rendert Zustand, ruft Hooks/Services auf.
2. **Services/Domäne** (`src/domain`): Fachlogik als reine TypeScript-Funktionen/Klassen ohne React und ohne direkten IndexedDB-Zugriff (z. B. Vorbefüllung von Sätzen, Fortschrittsberechnung, Validierung, Reihenfolge, Volumenberechnung).
3. **Datenschicht** (`src/data`): Repository-Schnittstellen und IndexedDB-Implementierung. Einzige Stelle, die IndexedDB kennt.
4. **Modelle** (`src/model`): Typen aus Abschnitt 3, keine Abhängigkeiten.

### Regeln
- **Keine Logik in UI-Komponenten:** Berechnungen, Validierung, Sortierung, Vorbefüllung, Formatierung von Domänenwerten liegen in `src/domain`. Komponenten enthalten nur Darstellung, lokalen UI-Zustand (z. B. offen/zu) und Aufrufe.
- **UI importiert niemals `idb`/`indexedDB`** oder `src/data/indexeddb`; sie erhält Repositories per Dependency Injection (React Context).
- Domäne hängt nur von **Interfaces** der Datenschicht ab, nicht von der Implementierung. Dadurch Unit-Tests mit In-Memory-Implementierung.
- Alle Datenänderungen laufen über Repositories; mehrstufige Änderungen (Import, Löschen mit Abhängigkeiten) in **einer Transaktion**.
- TypeScript `strict: true`, kein `any` (ESLint-Regel), keine ungenutzten Exporte-Schleifen; Abhängigkeitsrichtung wird per ESLint-Regel (z. B. `no-restricted-imports`) geprüft.
- Neue Funktionen = neuer Ordner unter `src/features/<name>` bzw. neue Repository-Methoden; bestehende Schichten werden nicht umgebaut.

### Ordnerstruktur
```
/
├─ SPEC.md
├─ package.json, tsconfig.json, vite.config.ts, eslint.config.js
├─ .github/workflows/ci.yml
├─ e2e/                      # Playwright-Tests
├─ public/                   # Icons, manifest-Quellen
└─ src/
   ├─ model/                 # Typen, SCHEMA_VERSION
   ├─ data/
   │  ├─ repositories.ts     # Interfaces (siehe unten)
   │  ├─ indexeddb/          # Implementierung, Schema, Migrationen
   │  ├─ memory/             # In-Memory-Implementierung für Tests
   │  └─ backup/             # Export (Import später)
   ├─ domain/                # reine Fachlogik
   ├─ ui/                    # Komponenten, Seiten, Routing, Hooks
   ├─ app/                   # Composition Root (verdrahtet Repos, Provider)
   └─ main.tsx
```

### Datenschicht-Schnittstelle (Mindestumfang)
```ts
export interface ExerciseRepository {
  list(opts?: { includeArchived?: boolean }): Promise<Exercise[]>;
  get(id: Id): Promise<Exercise | undefined>;
  save(exercise: Exercise): Promise<void>;                 // Insert oder Update
  remove(id: Id): Promise<"deleted" | "archived">;
  listImages(exerciseId: Id): Promise<ExerciseImage[]>;
  saveImage(image: ExerciseImage): Promise<void>;
  removeImage(id: Id): Promise<void>;
}

export interface PlanRepository {
  list(opts?: { includeArchived?: boolean }): Promise<Plan[]>;
  get(id: Id): Promise<{ plan: Plan; items: PlanItem[] } | undefined>;
  save(plan: Plan, items: PlanItem[]): Promise<void>;      // atomar
  remove(id: Id): Promise<"deleted" | "archived">;
}

export interface WorkoutRepository {
  start(workout: Workout): Promise<void>;
  finish(id: Id, endedAt: IsoDateTime): Promise<void>;
  getOpen(): Promise<Workout | undefined>;
  get(id: Id): Promise<{ workout: Workout; sets: LoggedSet[] } | undefined>;
  list(opts?: { limit?: number; before?: IsoDateTime }): Promise<Workout[]>;
  saveSet(set: LoggedSet): Promise<void>;
  removeSet(id: Id): Promise<void>;
  listSetsByExercise(exerciseId: Id): Promise<LoggedSet[]>;
  remove(id: Id): Promise<void>;                           // inkl. Sätze
}

export interface BackupService {
  exportAll(): Promise<ExportFile>;
  // Zurückgestellt (Import vorerst nicht im Umfang):
  // validate(raw: unknown): ImportValidationResult;       // ohne Seiteneffekt
  // importReplaceAll(file: ExportFile): Promise<void>;    // eine Transaktion
}
```
Alle Methoden sind asynchron, werfen typisierte Fehler (`DataError` mit `code`), und liefern bei Nicht-Vorhandensein `undefined` statt zu werfen.

---

## 5. Nicht-funktionale Anforderungen (messbar)

Messgerät/Referenz: **[Annahme]** mittelklassiges Android-Smartphone mit aktuellem Chrome; automatisiert gemessen im Playwright-Lauf mit Mobile-Emulation (Pixel-7-Profil), manuell einmal auf dem echten Gerät vor Abnahme.

| Nr. | Anforderung | Ziel |
|---|---|---|
| N1 | Satz loggen (Plan gewählt, Workout läuft, Werte vorbefüllt) | höchstens **3 Taps** pro Satz; im Normalfall 1 Tap („Satz erledigt") |
| N2 | Workout starten von der Startseite | höchstens **2 Taps** (Plan wählen/Start) |
| N3 | Start der App offline (Service Worker aktiv, kalter Start) bis interaktive Startseite | unter **2 s** (Playwright, gedrosselte CPU 4×) |
| N4 | Vollständig offline: alle Flüsse F-A bis F-E | E2E-Test mit `context.setOffline(true)` besteht |
| N5 | Satz speichern: Tap bis Persistenz bestätigt | unter **100 ms** (Domäne+IndexedDB, Test mit 5000 Sätzen im Bestand) |
| N6 | Verlaufsliste und Fortschritt öffnen mit 2 Jahren Daten (**[Annahme]** 500 Workouts, 10 000 Sätze) | unter **500 ms** bis erste Darstellung |
| N7 | Export von 500 Workouts ohne Bilder | unter **3 s** |
| N8 | Datenverlust | Kein Verlust bereits bestätigter Sätze bei App-Abbruch (E2E: Seite mitten im Workout neu laden) |
| N9 | Bedienbarkeit | Tap-Ziele mindestens **48×48 dp**; Zahleneingabe öffnet numerische Tastatur (`inputmode="decimal"`); Kontrast mindestens WCAG AA |
| N10 | Installierbarkeit | Lighthouse-PWA-Prüfung „installierbar" besteht; Manifest, Icons, Service Worker vorhanden |
| N11 | Datenhoheit | Keine Netzwerkanfragen zur Laufzeit außer Laden der App-Dateien; keine Tracker/Analytics (E2E prüft Request-Liste) |
| N12 | Bundle-Größe | Initiales JS höchstens **250 kB gzip** **[Annahme]** |
| N13 | Qualitäts-Gate | `tsc --noEmit`, ESLint, Vitest und Playwright laufen grün; CI bei **jedem Commit** |
| N14 | Sprache der UI | Deutsch (bestätigt); keine Mehrsprachigkeit |
| N15 | Speicher-Persistenz | App ruft `navigator.storage.persist()` auf, damit Android die Daten nicht automatisch räumt; Status in Einstellungen sichtbar |

---

## 6. Teststrategie

### Unit-Tests (Vitest)
- **Ort:** neben dem Code (`*.test.ts`), Ausführung `npm test`.
- **Domäne:** Vorbefüllung (Plan-Soll vs. letzte Werte), Fortschritt (bester Satz, Volumen), Validierung (Pflichtfelder, Grenzen, „mindestens ein Wert"), Positionsumsortierung, Archivieren-vs-Löschen-Entscheidung.
- **Datenschicht:** dieselbe Contract-Testsuite läuft gegen **In-Memory** und **IndexedDB** (mit `fake-indexeddb`): CRUD, Transaktionen/Rollback, Indizes, Löschregeln.
- **Backup:** Export erzeugt gültiges JSON gemäß `ExportFile` (Schema-Version, Bilder als Base64, alle Stores enthalten); eine eingefrorene Fixture der Version 1 sichert das Format. Import-Tests entfallen vorerst.
- **Ziel Abdeckung:** mindestens 90 % Zeilen in `src/domain` und `src/data`; UI nicht per Quote gesteuert.

### End-to-End (Playwright, Headless Chromium, Mobile-Viewport Pixel 7)
Läuft gegen den Produktions-Build (`vite preview`), jeder Test mit frischem Browser-Kontext.
- **Flüsse F-A bis F-E** je als Happy-Path-Test inkl. Neuladen der Seite zur Prüfung der Persistenz.
- **Offline:** Seite einmal laden, Service Worker abwarten, `setOffline(true)`, Neuladen, dann F-A bis F-E ausführen.
- **N1/N2:** Test zählt Taps beim Loggen eines Satzes und Workout-Starts und schlägt bei Überschreitung fehl.
- **N3:** Kaltstart-Messung offline mit Schwellwert.
- **N8:** Mitten im Workout Seite neu laden; geloggte Sätze und Fortsetzen-Angebot vorhanden.
- **N11:** Alle Requests protokollieren; nur Same-Origin-App-Dateien erlaubt.
- Screenshots/Traces bei Fehlschlag werden als CI-Artefakt hochgeladen.

### Statische Prüfungen
`tsc --noEmit`, ESLint (inkl. Schichtregel aus Abschnitt 4), Format-Prüfung.

### Zuständigkeiten
- **Umsetzungs-Agent:** liefert je Aufgabe Code und die zugehörigen Unit-/E2E-Tests; alle Gates grün.
- **Prüf-Agent:** prüft Ergebnis gegen die Abnahmekriterien der Aufgabe und gegen Abschnitte 2–5; meldet Abweichungen mit Verweis auf die Nummer.

---

## 7. Aufgabenschnitt

Konvention: Jede Aufgabe wird einzeln umgesetzt, auf einem eigenen Commit/Branch, mit Tests. Abhängigkeiten stehen in „Voraus". Gates (N13) müssen vor Abschluss jeder Aufgabe grün sein.

### T1 – Projektgerüst
- **Voraus:** keine.
- **Ergebnis:** Vite + React + TypeScript (strict), Ordnerstruktur aus Abschnitt 4 (leere Module mit Platzhalter), ESLint inkl. Schichtregel, Prettier, Vitest, Playwright installiert, Skripte `dev`, `build`, `preview`, `typecheck`, `lint`, `test`, `e2e`. Startseite zeigt „TrainingApp". `src/model` enthält alle Typen aus Abschnitt 3.
- **Abnahme:** `npm run typecheck`, `lint`, `test` (mindestens ein Beispieltest), `e2e` (ein Test: Startseite zeigt Titel) laufen lokal grün; ESLint schlägt an, wenn `src/ui` aus `src/data/indexeddb` importiert (Negativtest als Fixture).

### T2 – CI und PWA-Grundlage
- **Voraus:** T1.
- **Ergebnis:** GitHub-Actions-Workflow `ci.yml` bei jedem Push/PR: Install, typecheck, lint, Vitest, Build, Playwright (Browser-Cache, Traces als Artefakt). PWA: Web-App-Manifest (Name, Icons 192/512 inkl. maskable, `display: standalone`, Sprache `de`), Service Worker (Precache aller Build-Dateien, z. B. `vite-plugin-pwa`), Update-Hinweis bei neuer Version. Deployment auf GitHub Pages als eigener, vom Test getrennter Job (Vite `base` auf den Repository-Unterpfad, `actions/deploy-pages`, nur bei grünem Hauptzweig). Voraussetzung: ein GitHub-Repository mit aktiviertem Pages (Quelle: GitHub Actions).
- **Abnahme:** CI läuft auf einem Test-Commit grün; E2E: Seite laden, Service Worker aktiv, `setOffline(true)`, Neuladen zeigt die Startseite; Lighthouse-PWA „installierbar" besteht.

### T3 – Datenschicht: Repositories und IndexedDB
- **Voraus:** T1.
- **Ergebnis:** Interfaces `ExerciseRepository`, `PlanRepository`, `WorkoutRepository` (Abschnitt 4), In-Memory- und IndexedDB-Implementierung (Stores, Indizes, `SCHEMA_VERSION`-Mechanismus mit leerem Migrationsrahmen), `DataError`, Löschregeln (archivieren vs. löschen), Composition Root `src/app` mit React-Context.
- **Abnahme:** Gemeinsame Contract-Testsuite läuft grün gegen beide Implementierungen; Transaktions-Rollback-Test (`PlanRepository.save` bei Fehler lässt Altzustand); Performance-Test N5 (5000 Sätze, unter 100 ms pro `saveSet`); Datenbank wird mit korrekter Version angelegt.

### T4 – Export
- **Voraus:** T3.
- **Ergebnis:** `BackupService.exportAll`, Migrationsrahmen `migrations/` mit Registry und Test-Fixture für Version 1 (Format-Versionierung bleibt, damit ein späterer Import möglich ist), Base64-Kodierung der Bilder, Dateiname-Konvention. Noch ohne UI.
- **Abnahme:** Export enthält alle Stores und entspricht `ExportFile` (Test gegen Fixture); Bild-Bytes sind aus dem Base64-Wert unverändert rekonstruierbar; Performance N7.

### T5 – App-Rahmen und Navigation
- **Voraus:** T2, T3.
- **Ergebnis:** Layout für Smartphone (untere Navigation: Start, Übungen, Pläne, Verlauf, Einstellungen), Routing, Grundstile (Tap-Ziele 48 dp, Kontrast AA, Hell/Dunkel nach Systemeinstellung **[Annahme]**), deutsche Texte zentral, `navigator.storage.persist()` mit Statusanzeige (N15).
- **Abnahme:** E2E: alle fünf Bereiche per Tap erreichbar, auch offline; Leerzustände mit Hinweistext; Axe-Prüfung (`@axe-core/playwright`) ohne kritische Verstöße.

### T6 – Übungen verwalten (F-A)
- **Voraus:** T5.
- **Ergebnis:** Liste, Anlegen, Bearbeiten, Löschen/Archivieren, Suche nach Name; Bild hinzufügen/entfernen mit Verkleinerung in `src/domain` (Skalierungsberechnung) und Canvas-Umsetzung in dünner Hilfsfunktion; Validierung in Domäne.
- **Abnahme:** Unit: Validierung (leerer Name, Längen), Skalierung; E2E: Übung mit Bild anlegen, Neuladen, Übung erscheint mit Bild, bearbeiten, löschen (mit Rückfrage), archivierte Übung nicht in Auswahl aber im Verlauf sichtbar (nach T8 ergänzt).

### T7 – Trainingspläne (F-B)
- **Voraus:** T6.
- **Ergebnis:** Plan-Liste, Editor (Name, Übungen hinzufügen per Mehrfachauswahl, Soll-Werte, Auf/Ab, Entfernen), Archivieren/Löschen, Vorbefüllung der Soll-Werte aus Übungs-Standards.
- **Abnahme:** Unit: Positions-Normalisierung lückenlos, Vorbefüllung; E2E: Plan mit 3 Übungen anlegen, Reihenfolge ändern, Neuladen, Reihenfolge und Werte bleiben.

### T8 – Workout loggen (F-C)
- **Voraus:** T7.
- **Ergebnis:** Start aus Plan und freies Workout, Satz-Eingabe mit Vorbefüllung (letzte Werte vor Plan-Soll), „Satz erledigt" speichert sofort, Sätze hinzufügen/entfernen, Übung wechseln/überspringen, Beenden mit Zusammenfassung, Fortsetzen eines offenen Workouts nach Neustart.
- **Abnahme:** Unit: Vorbefüllungsregel, Satznummerierung; E2E: N1 (höchstens 3 Taps, im Normalfall 1) und N2 (höchstens 2 Taps) automatisch geprüft; N8 (Neuladen mitten im Workout, Fortsetzen-Angebot); komplett offen durchgespielt.

### T9 – Verlauf und Fortschritt (F-D)
- **Voraus:** T8.
- **Ergebnis:** Workout-Liste (paginiert/limitiert), Detailansicht mit Korrigieren/Löschen von Sätzen, Fortschrittsansicht je Übung (Tabelle, Liniendiagramm als schlankes SVG ohne schwere Bibliothek **[Annahme]**, Volumen).
- **Abnahme:** Unit: bester Satz, Volumen, Gleichstandsregel, leere Daten; E2E: nach drei geloggten Workouts stimmen Liste, Details und Fortschrittswerte mit Erwartung überein; Performance N6 mit Seed-Daten (500 Workouts).

### T10 – Export in der UI (F-E)
- **Voraus:** T4, T5.
- **Ergebnis:** Einstellungen: „Daten exportieren" (Download/Teilen), Anzeige, wann zuletzt exportiert wurde, Hinweisbanner in der App, wenn der letzte Export älter als 14 Tage ist (**[Annahme]**; kein Push).
- **Abnahme:** E2E: Daten anlegen, exportieren, die Datei ist gültiges JSON mit den erwarteten Anzahlen; Banner erscheint nach Fristablauf (Zeit im Test simuliert); funktioniert offline.

### T11 – Abschluss und Gesamtprüfung
- **Voraus:** T1 bis T10.
- **Ergebnis:** Prüfung aller Nicht-funktionalen Ziele N1 bis N15 mit Mess-Tests, Request-Liste-Test (N11), Bundle-Größe-Prüfung (N12) in CI, kurze `README.md` (Start, Skripte, Backup-Hinweis, Installation auf Android).
- **Abnahme:** Prüf-Agent hakt N1 bis N15 und F-A bis F-E gegen diese Spezifikation ab; alle Gates grün; manueller Check auf echtem Android-Gerät durch Auftraggeber (Installation, Offline-Start unter 2 s, ein Workout loggen).

---

## 8. Entscheidungen und offene Fragen

### Entschieden (Auftraggeber, 25.10.2026)
- F1 Push-Erinnerungen: nein.
- F3 Import: vorerst weglassen, Export bleibt (Zusammenführen entfällt damit ebenfalls).
- F4 Hosting: GitHub Pages.
- F6 Einheit: nur kg.
- UI-Sprache: Deutsch.

### Noch offen

| Nr. | Frage | Auswirkung |
|---|---|---|
| F2 | Welche Wunschfunktionen über das MVP hinaus (z. B. Satzpause-Timer, Notizen je Satz, Statistik-Auswertungen, Plan-Vorlagen)? | Neue Aufgaben nach T11; Architektur ist erweiterbar ausgelegt |
| F5 | Soll die App ein Passwort/eine Sperre haben? Aus ADR nicht ableitbar, daher nicht enthalten. | Würde Aufgabe T-neu erfordern |
| F7 | Reichen Bilder pro Übung wie angenommen (verkleinert auf 1280 px, in IndexedDB), oder sind auch Videos gewünscht? | Speicherbedarf, Export-Größe |
| F8 | Weitere Annahmen zur Bestätigung: Hell/Dunkel nach System (T5), Messprofil Pixel 7 (Abschnitt 5), Bundle-Grenze 250 kB (N12), Datenumfang 500 Workouts (N6), Export-Hinweisbanner nach 14 Tagen (T10). | Schwellwerte in Tests anpassen |
