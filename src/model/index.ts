/**
 * Datenmodell der TrainingApp (SPEC Abschnitt 3).
 * Keine Abhängigkeiten; alle anderen Schichten dürfen dieses Modul importieren.
 */

export const SCHEMA_VERSION = 1;

export type Id = string; // UUID v4
export type IsoDateTime = string; // ISO-8601, UTC

export interface Timestamps {
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

/** Bild einer Übung; Binärdaten getrennt von der Übung gespeichert. */
export interface ExerciseImage {
  id: Id;
  exerciseId: Id;
  mimeType: string; // z. B. "image/jpeg"
  data: Blob; // im Export als Base64-String (siehe ExportFile)
  sortOrder: number; // 0-basiert
  createdAt: IsoDateTime;
}

export interface Exercise extends Timestamps {
  id: Id;
  name: string; // Pflicht, nicht leer, max. 100 Zeichen
  description: string; // Kurzbeschreibung, darf leer sein, max. 2000 Zeichen
  defaultReps?: number; // Standard-Wiederholungen
  defaultWeightKg?: number;
  defaultDurationSec?: number;
  archivedAt?: IsoDateTime; // gesetzt = in Auswahllisten ausgeblendet, im Verlauf weiter sichtbar
}

export interface Plan extends Timestamps {
  id: Id;
  name: string; // Pflicht, max. 100 Zeichen
  archivedAt?: IsoDateTime;
}

export interface PlanItem {
  id: Id;
  planId: Id;
  exerciseId: Id;
  position: number; // 0-basiert, lückenlos je Plan
  targetSets: number; // >= 1
  targetReps?: number;
  targetWeightKg?: number;
  targetDurationSec?: number;
}

export interface Workout {
  id: Id;
  planId?: Id; // fehlt bei freiem Workout
  planNameSnapshot?: string; // Name zum Startzeitpunkt (Verlauf bleibt stabil)
  startedAt: IsoDateTime;
  endedAt?: IsoDateTime; // fehlt = Workout offen
  note?: string;
}

/**
 * Ein geloggter Satz. exerciseNameSnapshot hält den Verlauf lesbar,
 * auch nach Löschen/Umbenennen.
 * Regel: mindestens eines von reps, weightKg, durationSec muss gesetzt sein.
 */
export interface LoggedSet {
  id: Id;
  workoutId: Id;
  exerciseId: Id;
  exerciseNameSnapshot: string;
  exerciseOrder: number; // Reihenfolge der Übung im Workout
  setNumber: number; // 1-basiert je Übung im Workout
  reps?: number;
  weightKg?: number;
  durationSec?: number;
  loggedAt: IsoDateTime;
}

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
