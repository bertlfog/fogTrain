/**
 * Fehlercodes der Datenschicht (SPEC Abschnitt 4):
 * - not_found: referenzierter Datensatz existiert nicht
 * - invalid:   Eingabe verletzt eine Integritätsregel
 * - conflict:  Zustand erlaubt die Operation nicht (z. B. zweites offenes Workout)
 * - version:   Datenbank hat eine neuere Version als die App kennt
 * - storage:   Fehler des Speichers (z. B. Kontingent erschöpft, Zugriff verweigert)
 */
export type DataErrorCode =
  "not_found" | "invalid" | "conflict" | "version" | "storage";

export class DataError extends Error {
  readonly code: DataErrorCode;

  constructor(code: DataErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "DataError";
    this.code = code;
  }
}
