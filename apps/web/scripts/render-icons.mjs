/* global Buffer, console -- flat config is not type-aware, and `no-undef` is
   only switched off for TypeScript files; this is the .mjs opt-in. */
/**
 * Renders the icon set from `public/mark.svg`.
 *
 * There is one drawing of the mark in this repository and it is the SVG. This
 * script exists so the raster fallbacks can never drift from it: run it after
 * editing `mark.svg` and commit what it writes.
 *
 *     node apps/web/scripts/render-icons.mjs
 *
 * Playwright is already a dev dependency (the e2e), so the renderer is
 * Chromium — the same engine that will draw the SVG in the tab. No `sharp`, no
 * `resvg`, nothing new in the tree for four files that change about never.
 *
 * `favicon.ico` is written by hand because an ICO is allowed to hold a PNG
 * verbatim: six bytes of directory, sixteen of entry, then the PNG. That is
 * the whole format for a single-image icon, and it is cheaper than a
 * dependency that knows the other ninety percent of it.
 *
 * The two home-screen icons are drawn full-bleed on the paper colour rather
 * than transparent: iOS composites `apple-touch-icon` onto black, so a
 * rounded, transparent mark comes out as a dark tile with dark corners. The
 * favicon keeps its transparent corners, because a browser tab does not mask
 * it and the rounded square is the point.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, '..', 'public');

/** The page ground the icons sit on — `--sheet` in `styles.css`, light theme. */
const SHEET = '#fdfdfe';

/** `size` px of PNG. `bleed` fills the canvas and insets the mark instead. */
async function render(page, svg, size, { bleed = false } = {}) {
  const inset = bleed ? Math.round(size * 0.1) : 0;
  const mark = size - inset * 2;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>
       html, body { margin: 0; padding: 0; background: ${bleed ? SHEET : 'transparent'}; }
       body { width: ${size}px; height: ${size}px; display: grid; place-items: center; }
       img { display: block; width: ${mark}px; height: ${mark}px; }
     </style>
     <img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" />`,
  );
  await page.waitForLoadState('networkidle');
  return page.screenshot({ omitBackground: !bleed });
}

/** A single-image ICO wrapping `png`, declared at `size` x `size`. */
function ico(png, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = icon
  header.writeUInt16LE(1, 4); // one image
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size % 256, 0); // 0 means 256
  entry.writeUInt8(size % 256, 1);
  entry.writeUInt8(0, 2); // palette size
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // colour planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(header.length + entry.length, 12);
  return Buffer.concat([header, entry, png]);
}

const svg = await readFile(join(publicDir, 'mark.svg'), 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage({ colorScheme: 'light', deviceScaleFactor: 1 });

const written = [];
const favicon = await render(page, svg, 32);
await writeFile(join(publicDir, 'favicon.ico'), ico(favicon, 32));
written.push('favicon.ico');

for (const [name, size] of [
  ['apple-touch-icon.png', 180],
  ['icon-512.png', 512],
]) {
  await writeFile(join(publicDir, name), await render(page, svg, size, { bleed: true }));
  written.push(name);
}

await browser.close();
console.log(`wrote ${written.join(', ')} into ${publicDir}`);
