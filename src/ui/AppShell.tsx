import { Outlet } from "react-router";

import { BottomNav } from "./BottomNav";
import { UpdatePrompt } from "./UpdatePrompt";

/** Rahmen aller Seiten: Update-Hinweis, Inhalt, untere Navigation. */
export function AppShell() {
  return (
    <div className="app">
      <UpdatePrompt />
      <main className="content">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
