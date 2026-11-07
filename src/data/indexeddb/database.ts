import { openDB } from "idb";
import type { IDBPTransaction, StoreNames } from "idb";

import { DataError } from "../errors";
import { SCHEMA_VERSION } from "../../model";
import { DB_NAME, upgrade } from "./schema";
import type { TrainingDb, TrainingDbSchema } from "./schema";

type StoreList = ArrayLike<StoreNames<TrainingDbSchema>>;

/** Übersetzt beliebige Fehler des Browsers in einen `DataError`. */
export function toDataError(error: unknown): DataError {
  if (error instanceof DataError) {
    return error;
  }
  if (error instanceof DOMException && error.name === "VersionError") {
    return new DataError(
      "version",
      "Die Datenbank stammt von einer neueren App-Version",
      { cause: error },
    );
  }
  const message = error instanceof Error ? error.message : String(error);
  return new DataError("storage", `Speicherfehler: ${message}`, {
    cause: error,
  });
}

/** Öffnet die Datenbank und legt sie bei Bedarf an oder migriert sie. */
export async function openTrainingDb(
  name: string = DB_NAME,
): Promise<TrainingDb> {
  let db: TrainingDb | undefined;
  try {
    db = await openDB<TrainingDbSchema>(name, SCHEMA_VERSION, {
      upgrade,
      // Ein anderer Tab will aktualisieren: Verbindung freigeben.
      blocking: () => db?.close(),
    });
    return db;
  } catch (error) {
    throw toDataError(error);
  }
}

/** Lesezugriff; Fehler des Browsers werden zu `DataError`. */
export async function read<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw toDataError(error);
  }
}

/**
 * Schreibt in einer Transaktion über die genannten Stores. Wirft `operation`,
 * wird die Transaktion ausdrücklich abgebrochen: Es bleibt nichts Halbes
 * zurück (Rollback). Innerhalb von `operation` nur auf IndexedDB warten, sonst
 * beendet der Browser die Transaktion vorzeitig.
 */
export async function write<Names extends StoreList, T>(
  db: TrainingDb,
  stores: Names,
  operation: (
    tx: IDBPTransaction<TrainingDbSchema, Names, "readwrite">,
  ) => Promise<T>,
): Promise<T> {
  const tx = db.transaction(stores, "readwrite");
  try {
    const result = await operation(tx);
    await tx.done;
    return result;
  } catch (error) {
    try {
      tx.abort();
    } catch {
      // Transaktion ist bereits beendet.
    }
    await tx.done.catch(() => undefined);
    throw toDataError(error);
  }
}
