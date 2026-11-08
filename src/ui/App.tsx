import { HashRouter, Navigate, Route, Routes } from "react-router";

import { AppShell } from "./AppShell";
import { paths } from "./navigation";
import { ExercisesPage } from "./pages/ExercisesPage";
import { HistoryPage } from "./pages/HistoryPage";
import { PlansPage } from "./pages/PlansPage";
import { SettingsPage } from "./pages/SettingsPage";
import { StartPage } from "./pages/StartPage";
import { StoragePersistenceProvider } from "./StoragePersistence";

/**
 * Hash-Routing: funktioniert auf GitHub Pages unter einem Unterpfad und im
 * Offline-Betrieb ohne Server-Umleitungen.
 */
export function App() {
  return (
    <StoragePersistenceProvider>
      <HashRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<StartPage />} />
            <Route path={paths.exercises} element={<ExercisesPage />} />
            <Route path={paths.plans} element={<PlansPage />} />
            <Route path={paths.history} element={<HistoryPage />} />
            <Route path={paths.settings} element={<SettingsPage />} />
            <Route path="*" element={<Navigate to={paths.start} replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </StoragePersistenceProvider>
  );
}
