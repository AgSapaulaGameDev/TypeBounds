// Copies the web game (repo root) into desktop/app/ and swaps the Google Fonts link for a bundled
// copy of Pixelify Sans, so the .exe works offline. The website files themselves are not changed.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(__dirname, 'app');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const dir of ['js', 'css', 'img']) fs.cpSync(path.join(root, dir), path.join(out, dir), { recursive: true });

const fontDir = path.join(path.dirname(require.resolve('@fontsource/pixelify-sans/package.json')), 'files');
fs.mkdirSync(path.join(out, 'fonts'));
let css = '';
for (const w of [500, 700]) {
  const file = `pixelify-sans-latin-${w}-normal.woff2`;
  fs.copyFileSync(path.join(fontDir, file), path.join(out, 'fonts', file));
  css += `@font-face { font-family: 'Pixelify Sans'; font-style: normal; font-weight: ${w}; font-display: block; src: url(${file}) format('woff2'); }\n`;
}
fs.writeFileSync(path.join(out, 'fonts', 'fonts.css'), css);

let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html
  .replace(/\s*<link rel="preconnect"[^>]*>/g, '')
  .replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/, '<link rel="stylesheet" href="fonts/fonts.css">');
fs.writeFileSync(path.join(out, 'index.html'), html);

console.log('app/ ready');
