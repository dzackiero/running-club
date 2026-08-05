// One-off rasterizer. Install sharp in apps/web, run this file, then remove sharp.
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const svgPath = path.join(root, "public", "pwa-icon.svg");

async function writePng(size, filename) {
  const png = await sharp(svgPath)
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer();
  const outPath = path.join(root, "public", filename);
  await writeFile(outPath, png);
  console.log(`wrote ${filename} (${size}x${size})`);
}

await writePng(192, "pwa-192.png");
await writePng(512, "pwa-512.png");
await writePng(180, "apple-touch-icon.png");
