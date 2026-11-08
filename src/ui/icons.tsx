import type { ReactNode } from "react";

import type { NavId } from "./navigation";

/** Schlichte Linien-Icons für die untere Navigation (rein dekorativ). */
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      className="nav-icon"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function NavIcon({ id }: { id: NavId }) {
  switch (id) {
    case "start":
      return (
        <Icon>
          <path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
        </Icon>
      );
    case "exercises":
      return (
        <Icon>
          <path d="M6 7v10M3 10v4M18 7v10M21 10v4M6 12h12" />
        </Icon>
      );
    case "plans":
      return (
        <Icon>
          <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />
        </Icon>
      );
    case "history":
      return (
        <Icon>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </Icon>
      );
    case "settings":
      return (
        <Icon>
          <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
          <circle cx="15" cy="7" r="2" />
          <circle cx="9" cy="17" r="2" />
        </Icon>
      );
  }
}
