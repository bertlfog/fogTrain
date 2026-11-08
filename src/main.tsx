import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { Root } from "./app";
import "./ui/styles.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Wurzelelement #root nicht gefunden");
}

createRoot(container).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
