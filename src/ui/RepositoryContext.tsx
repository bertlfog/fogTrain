import { createContext, useContext } from "react";
import type { ReactNode } from "react";

import type { Repositories } from "../data/repositories";

const RepositoryContext = createContext<Repositories | undefined>(undefined);

/** Stellt der UI die Repositories bereit (Dependency Injection, SPEC Abschnitt 4). */
export function RepositoryProvider({
  repositories,
  children,
}: {
  repositories: Repositories;
  children: ReactNode;
}) {
  return (
    <RepositoryContext.Provider value={repositories}>
      {children}
    </RepositoryContext.Provider>
  );
}

/** Zugriff auf die Repositories; nur innerhalb von `RepositoryProvider` nutzbar. */
export function useRepositories(): Repositories {
  const repositories = useContext(RepositoryContext);
  if (!repositories) {
    throw new Error("useRepositories braucht einen RepositoryProvider");
  }
  return repositories;
}
