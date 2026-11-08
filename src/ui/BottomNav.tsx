import { NavLink } from "react-router";

import { NavIcon } from "./icons";
import { navItems } from "./navigation";
import { texts } from "./texts";

/** Untere Navigation mit den fünf Hauptbereichen (Daumen-erreichbar). */
export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label={texts.nav.label}>
      <ul>
        {navItems.map((item) => (
          <li key={item.id}>
            <NavLink to={item.path} end={item.path === "/"}>
              <NavIcon id={item.id} />
              <span>{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
