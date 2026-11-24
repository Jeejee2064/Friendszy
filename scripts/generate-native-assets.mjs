// Génère les icônes et splash natifs (Android + masters pour iOS) : gros « F » Pacifico blanc
// sur le dégradé teal → bleu de la marque (même rendu que public/icons/icon-512.png).
// Usage : node scripts/generate-native-assets.mjs   (nécessite la police Pacifico installée)
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const RES = "android/app/src/main/res";
const OUT = "resources";
const GRAD = ["#1ecfb0", "#1ab8c0", "#1a90c8"];

const gradDefs = (w, h) => `<defs><linearGradient id="g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${w}" y2="${h}">
  <stop offset="0" stop-color="${GRAD[0]}"/><stop offset=".5" stop-color="${GRAD[1]}"/><stop offset="1" stop-color="${GRAD[2]}"/></linearGradient></defs>`;

// Le « F » Pacifico rendu seul puis rogné à son encre : centrage exact, indépendant de la chasse de la police.
const glyphSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1600"><text x="800" y="800" font-family="Pacifico" font-size="1200" fill="#fff" text-anchor="middle" dominant-baseline="central">F</text></svg>`;
const glyph = await sharp(Buffer.from(glyphSvg)).png().toBuffer().then((b) => sharp(b).trim().png().toBuffer());
const glyphMeta = await sharp(glyph).metadata();

// F centré dans un canvas w×h, de hauteur `ratio` × (plus petite dimension), plafonné en largeur.
async function withLetter(base, w, h, ratio) {
  const m = Math.min(w, h);
  let gh = Math.round(m * ratio);
  let gw = Math.round((gh * glyphMeta.width) / glyphMeta.height);
  if (gw > m * ratio) { gw = Math.round(m * ratio); gh = Math.round((gw * glyphMeta.height) / glyphMeta.width); }
  const f = await sharp(glyph).resize(gw, gh).png().toBuffer();
  return sharp(base).composite([{ input: f, left: Math.round((w - gw) / 2), top: Math.round((h - gh) / 2) }]).png().toBuffer();
}

const bgSvg = (w, h) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${gradDefs(w, h)}<rect width="${w}" height="${h}" fill="url(#g)"/></svg>`);
const transparent = (s) => sharp({ create: { width: s, height: s, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();

const png = async (bufP, file) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await sharp(await bufP).png().toFile(file);
};

// Icône pleine (carrée) : F ≈ 58 % de la hauteur.
const fullIcon = async (s) => withLetter(bgSvg(s, s), s, s, 0.58);
// Icône ronde : fond dégradé masqué en cercle.
const roundIcon = async (s) => {
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><circle cx="${s / 2}" cy="${s / 2}" r="${s / 2}"/></svg>`);
  const withF = await withLetter(bgSvg(s, s), s, s, 0.5);
  return sharp(withF).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
};
// Avant-plan adaptatif : canvas 108dp, zone sûre 66dp (cercle) → F ≈ 38 % du canvas.
const foreground = async (s) => withLetter(await transparent(s), s, s, 0.38);
// Splash : dégradé plein écran + F ≈ 34 % de la plus petite dimension.
const splash = async (w, h) => withLetter(bgSvg(w, h), w, h, 0.34);

const jobs = [];

// Masters (pour iOS / @capacitor/assets plus tard)
jobs.push(png(fullIcon(1024), `${OUT}/icon-1024.png`));
jobs.push(png(splash(2732, 2732), `${OUT}/splash-2732.png`));

// Android : icônes
const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(dens)) {
  jobs.push(png(fullIcon(Math.round(48 * k)), `${RES}/mipmap-${d}/ic_launcher.png`));
  jobs.push(png(roundIcon(Math.round(48 * k)), `${RES}/mipmap-${d}/ic_launcher_round.png`));
  jobs.push(png(foreground(Math.round(108 * k)), `${RES}/mipmap-${d}/ic_launcher_foreground.png`));
}

// Android : splash (tailles existantes)
const portrait = { mdpi: [320, 480], hdpi: [480, 800], xhdpi: [720, 1280], xxhdpi: [960, 1600], xxxhdpi: [1280, 1920] };
for (const [d, [w, h]] of Object.entries(portrait)) {
  jobs.push(png(splash(w, h), `${RES}/drawable-port-${d}/splash.png`));
  jobs.push(png(splash(h, w), `${RES}/drawable-land-${d}/splash.png`));
}
jobs.push(png(splash(480, 320), `${RES}/drawable/splash.png`));

await Promise.all(jobs);

// Fond adaptatif = dégradé de la marque ; couleur de repli pour le splash Android 12+.
fs.writeFileSync(`${RES}/drawable/ic_launcher_background.xml`, `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <gradient android:type="linear" android:angle="315" android:startColor="${GRAD[0]}" android:centerColor="${GRAD[1]}" android:endColor="${GRAD[2]}"/>
</shape>
`);
for (const f of ["ic_launcher.xml", "ic_launcher_round.xml"]) {
  fs.writeFileSync(`${RES}/mipmap-anydpi-v26/${f}`, `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`);
}
fs.writeFileSync(`${RES}/values/ic_launcher_background.xml`, `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${GRAD[1]}</color>
</resources>
`);
console.log("ok");
