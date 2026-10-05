// 정적 SVG + 파비콘 세트 생성: node scripts/build-assets.mjs  (sharp 필요: npm i -D sharp)
import { writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import sharp from 'sharp';
import { toSvg, PunchingBag, BoxingGlove } from '../dist/index.js';

const ACCENT = '#C93C26';
const TILE = '#FBE9E6';
mkdirSync('icons', { recursive: true });
mkdirSync('favicon', { recursive: true });

// 1) 정적 SVG (currentColor) — 디자인 툴/직접 import용
for (const icon of [PunchingBag, BoxingGlove]) {
  writeFileSync(`icons/${icon.name}.svg`, toSvg(icon, { id: `${icon.name}-cut` }) + '\n');
}

// 2) 파비콘: 글러브만(투명) + 타일 배경 버전
const inner = (color, id) => toSvg(BoxingGlove, { color, id }).replace(/^<svg[^>]*>|<\/svg>$/g, '');
const glyph = toSvg(BoxingGlove, { color: ACCENT, id: 'fav-cut' });
const glyphAdaptive = glyph.replace('<svg ', '<svg ').replace(
  /^(<svg[^>]*>)/,
  `$1<style>@media (prefers-color-scheme: dark){svg{color:#FF7A63}}</style>`,
);
const tile = (bg = TILE, fg = ACCENT, r = 5.5) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">` +
  `<rect width="24" height="24" rx="${r}" fill="${bg}"/>` +
  `<g transform="translate(4.2 4.2) scale(0.65)" color="${fg}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${inner(fg, 'tile-cut')}</g></svg>`;

writeFileSync('favicon/favicon.svg', glyphAdaptive + '\n');
writeFileSync('favicon/favicon-tile.svg', tile() + '\n');

const png = (svg, size, out) => sharp(Buffer.from(svg), { density: 72 * (size / 24) * 2 }).resize(size, size).png().toFile(out);
await Promise.all([
  png(glyph, 16, 'favicon/favicon-16.png'),
  png(glyph, 32, 'favicon/favicon-32.png'),
  png(glyph, 48, 'favicon/favicon-48.png'),
  png(tile(TILE, ACCENT, 0), 180, 'favicon/apple-touch-icon.png'),
  png(tile(), 192, 'favicon/icon-192.png'),
  png(tile(), 512, 'favicon/icon-512.png'),
  png(tile(TILE, ACCENT, 0), 512, 'favicon/icon-maskable-512.png'),
]);
try {
  execSync('convert favicon/favicon-16.png favicon/favicon-32.png favicon/favicon-48.png favicon/favicon.ico');
} catch { console.warn('ImageMagick 없음: favicon.ico 생략'); }

writeFileSync('favicon/site.webmanifest', JSON.stringify({
  name: '[YOUR APP NAME]',
  short_name: '[APP]',
  icons: [
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
  theme_color: ACCENT,
  background_color: '#ffffff',
  display: 'standalone',
}, null, 2) + '\n');
console.log('done');
