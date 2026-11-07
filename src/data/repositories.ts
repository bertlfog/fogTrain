import type {
  Exercise,
  ExerciseImage,
  Id,
  IsoDateTime,
  LoggedSet,
  Plan,
  PlanItem,
  Workout,
} from "../model";

/**
 * Repository-Schnittstellen (SPEC Abschnitt 4).
 * Alle Methoden sind asynchron, werfen `DataError` und liefern bei
 * Nicht-Vorhandensein `undefined` statt zu werfen (Lesezugriffe).
 */

export interface ExerciseRepository {
  /** Sortiert nach Name; archivierte Übungen nur mit `includeArchived`. */
  list(opts?: { includeArchived?: boolean }): Promise<Exercise[]>;
  get(id: Id): Promise<Exercise | undefined>;
  /** Insert oder Update. */
  save(exercise: Exercise): Promise<void>;
  /**
   * Hart löschen (inkl. Bilder), wenn nichts auf die Übung verweist;
   * sonst archivieren (`archivedAt` setzen). Wirft `not_found`, wenn sie fehlt.
   */
  remove(id: Id): Promise<"deleted" | "archived">;
  /** Sortiert nach `sortOrder`. */
  listImages(exerciseId: Id): Promise<ExerciseImage[]>;
  /** Wirft `not_found`, wenn die Übung fehlt. */
  saveImage(image: ExerciseImage): Promise<void>;
  removeImage(id: Id): Promise<void>;
}

export interface PlanRepository {
  /** Sortiert nach Name; archivierte Pläne nur mit `includeArchived`. */
  list(opts?: { includeArchived?: boolean }): Promise<Plan[]>;
  /** Einträge sortiert nach `position`. */
  get(id: Id): Promise<{ plan: Plan; items: PlanItem[] } | undefined>;
  /**
   * Speichert Plan und Einträge atomar: Die bisherigen Einträge werden
   * ersetzt. Bei Fehler bleibt der Altzustand unverändert.
   * Wirft `invalid` bei fremder `planId` und `not_found` bei unbekannter Übung.
   */
  save(plan: Plan, items: PlanItem[]): Promise<void>;
  /**
   * Hart löschen (inkl. Einträge), wenn kein Workout auf den Plan verweist;
   * sonst archivieren. Wirft `not_found`, wenn er fehlt.
   */
  remove(id: Id): Promise<"deleted" | "archived">;
}

export interface WorkoutRepository {
  /** Wirft `conflict`, wenn bereits ein anderes Workout offen ist. */
  start(workout: Workout): Promise<void>;
  /** Wirft `not_found`, wenn das Workout fehlt. */
  finish(id: Id, endedAt: IsoDateTime): Promise<void>;
  getOpen(): Promise<Workout | undefined>;
  /** Sätze sortiert nach `exerciseOrder`, dann `setNumber`. */
  get(id: Id): Promise<{ workout: Workout; sets: LoggedSet[] } | undefined>;
  /** Neueste zuerst; `before` schließt Workouts ab diesem Start aus. */
  list(opts?: { limit?: number; before?: IsoDateTime }): Promise<Workout[]>;
  /** Wirft `not_found`, wenn das Workout fehlt. */
  saveSet(set: LoggedSet): Promise<void>;
  removeSet(id: Id): Promise<void>;
  /** Sortiert nach `loggedAt`. */
  listSetsByExercise(exerciseId: Id): Promise<LoggedSet[]>;
  /** Entfernt das Workout inkl. Sätze. Wirft `not_found`, wenn es fehlt. */
  remove(id: Id): Promise<void>;
}

/** Alle Repositories, wie sie die Composition Root bereitstellt. */
export interface Repositories {
  exercises: ExerciseRepository;
  plans: PlanRepository;
  workouts: WorkoutRepository;
}
