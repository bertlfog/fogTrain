import { gzipSync } from "node:zlib";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";

const dist = path.resolve("dist");
const html = readFileSync(path.join(dist, "index.html"), "utf8");
const script = html.match(/<script[^>]+src="([^"]+\.js)"/);

if (!script?.[1]) {
  throw new Error(
    "Initiales JavaScript-Bundle in dist/index.html nicht gefunden.",
  );
}

const filename = path.basename(
  new URL(script[1], "https://trainingapp.local").pathname,
);
const bundlePath = path.join(dist, "assets", filename);
const bytes = readFileSync(bundlePath);
const gzipBytes = gzipSync(bytes, { level: 9 }).byteLength;
const limit = 250 * 1024;

console.info(
  `Initiales JavaScript: ${(gzipBytes / 1024).toFixed(1)} KiB gzip (Limit ${(limit / 1024).toFixed(0)} KiB).`,
);

if (statSync(bundlePath).size === 0 || gzipBytes > limit) {
  throw new Error(
    "Das initiale JavaScript-Bundle überschreitet das Größenlimit.",
  );
}
