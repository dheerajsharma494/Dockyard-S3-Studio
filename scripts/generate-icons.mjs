import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const assetsDir = path.join(rootDir, "assets");
const outputDir = path.join(rootDir, "electron", "icons");
const installerDir = path.join(rootDir, "electron", "installer");
const svgPath = path.join(assetsDir, "app-icon.svg");
const pngPath = path.join(outputDir, "icon.png");
const icoPath = path.join(outputDir, "icon.ico");
const icnsPath = path.join(outputDir, "icon.icns");
const iconsetDir = path.join(outputDir, "icon.iconset");
const dmgBackgroundPath = path.join(installerDir, "dmg-background.png");

const iconsetSizes = [
  [16, "icon_16x16.png"],
  [32, "icon_16x16@2x.png"],
  [32, "icon_32x32.png"],
  [64, "icon_32x32@2x.png"],
  [128, "icon_128x128.png"],
  [256, "icon_128x128@2x.png"],
  [256, "icon_256x256.png"],
  [512, "icon_256x256@2x.png"],
  [512, "icon_512x512.png"],
  [1024, "icon_512x512@2x.png"],
];

const icoSizes = [16, 24, 32, 48, 64, 128, 256];

async function ensureCleanDir(dirPath) {
  await fs.rm(dirPath, { recursive: true, force: true });
  await fs.mkdir(dirPath, { recursive: true });
}

async function generatePng(size, outPath) {
  await sharp(svgPath).resize(size, size).png().toFile(outPath);
}

async function buildIcns() {
  await ensureCleanDir(iconsetDir);

  for (const [size, fileName] of iconsetSizes) {
    await generatePng(size, path.join(iconsetDir, fileName));
  }

  await execFileAsync("iconutil", ["-c", "icns", iconsetDir, "-o", icnsPath]);
}

async function buildIco() {
  const icoInputs = [];

  for (const size of icoSizes) {
    const outPath = path.join(outputDir, `icon-${size}.png`);
    await generatePng(size, outPath);
    icoInputs.push(outPath);
  }

  const icoBuffer = await pngToIco(icoInputs);
  await fs.writeFile(icoPath, icoBuffer);
}

async function buildDmgBackground() {
  await fs.mkdir(installerDir, { recursive: true });

  const iconBuffer = await sharp(svgPath).resize(280, 280).png().toBuffer();
  const accentSvg = Buffer.from(`
    <svg width="1200" height="800" viewBox="0 0 1200 800" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#122743"/>
          <stop offset="55%" stop-color="#0b1522"/>
          <stop offset="100%" stop-color="#183f5b"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="800" rx="0" fill="url(#bg)"/>
      <rect x="70" y="70" width="520" height="660" rx="38" fill="rgba(10, 23, 36, 0.64)" stroke="rgba(125, 224, 214, 0.18)" stroke-width="2"/>
      <text x="120" y="430" fill="#E7F7FF" font-size="54" font-family="Helvetica, Arial, sans-serif" font-weight="700">Dockyard S3 Studio</text>
      <text x="120" y="485" fill="#8FB6D8" font-size="26" font-family="Helvetica, Arial, sans-serif">LocalStack and AWS object workspace</text>
      <text x="120" y="610" fill="#7DE0D6" font-size="24" font-family="Helvetica, Arial, sans-serif">Drag the app into Applications to install</text>
      <circle cx="844" cy="398" r="58" fill="rgba(125, 224, 214, 0.09)"/>
      <path d="M910 398H1038" stroke="#7DE0D6" stroke-width="10" stroke-linecap="round"/>
      <path d="M994 350L1044 398L994 446" stroke="#7DE0D6" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `);

  await sharp({
    create: {
      width: 1200,
      height: 800,
      channels: 4,
      background: "#0b1522",
    },
  })
    .composite([
      { input: accentSvg, top: 0, left: 0 },
      { input: iconBuffer, top: 125, left: 140 },
    ])
    .png()
    .toFile(dmgBackgroundPath);
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  await generatePng(1024, pngPath);
  await buildIcns();
  await buildIco();
  await buildDmgBackground();
  console.log("Generated desktop icons and installer assets");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
