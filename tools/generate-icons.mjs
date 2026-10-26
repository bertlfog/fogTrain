// Erzeugt die PWA-Icons (public/icons/*.png) ohne externe Abhängigkeiten.
// Aufruf: node tools/generate-icons.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { crc32, deflateSync } from "node:zlib";

const OUT_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "icons",
);

const BACKGROUND = [15, 118, 110]; // Teal
const FOREGROUND = [255, 255, 255];
const SAMPLES = 4; // 4x4 Supersampling für glatte Kanten

/** Hantel in normierten Koordinaten (-1..1). */
function insideDumbbell(u, v) {
  const x = Math.abs(u);
  const y = Math.abs(v);
  if (x <= 0.55 && y <= 0.09) return true; // Stange
  if (x >= 0.55 && x <= 0.72 && y <= 0.45) return true; // innere Scheibe
  if (x >= 0.76 && x <= 0.9 && y <= 0.3) return true; // äußere Scheibe
  return false;
}

/** Abgerundetes Quadrat; Radius als Anteil der Kantenlänge. */
function insideRoundedSquare(px, py, size, radiusFraction) {
  const r = size * radiusFraction;
  const dx = Math.max(r - px, 0, px - (size - r));
  const dy = Math.max(r - py, 0, py - (size - r));
  return dx * dx + dy * dy <= r * r;
}

function render(size, { maskable }) {
  const contentHalf = (size / 2) * (maskable ? 0.55 : 0.7);
  const pixels = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let bgHits = 0;
      let fgHits = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const x = px + (sx + 0.5) / SAMPLES;
          const y = py + (sy + 0.5) / SAMPLES;
          const bg = maskable || insideRoundedSquare(x, y, size, 0.22);
          if (!bg) continue;
          bgHits++;
          const u = (x - size / 2) / contentHalf;
          const v = (y - size / 2) / contentHalf;
          if (insideDumbbell(u, v)) fgHits++;
        }
      }
      const total = SAMPLES * SAMPLES;
      const offset = (py * size + px) * 4;
      if (bgHits === 0) continue; // transparent
      const fgShare = fgHits / bgHits;
      for (let c = 0; c < 3; c++) {
        pixels[offset + c] = Math.round(
          BACKGROUND[c] * (1 - fgShare) + FOREGROUND[c] * fgShare,
        );
      }
      pixels[offset + 3] = Math.round((bgHits / total) * 255);
    }
  }
  return pixels;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // Bit-Tiefe
  header[9] = 6; // RGBA
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // Filter: keiner
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT_DIR, { recursive: true });
const targets = [
  { file: "icon-192.png", size: 192, maskable: false },
  { file: "icon-512.png", size: 512, maskable: false },
  { file: "icon-maskable-512.png", size: 512, maskable: true },
];
for (const { file, size, maskable } of targets) {
  writeFileSync(
    join(OUT_DIR, file),
    encodePng(size, render(size, { maskable })),
  );
  console.log(`geschrieben: public/icons/${file}`);
}
