import sharp from "sharp";
import { writeFileSync, copyFileSync } from "node:fs";

async function main() {
  // 1. Copy icon.svg to public/favicon.svg
  copyFileSync("app/icon.svg", "public/favicon.svg");
  console.log("Copied favicon.svg");

  // 2. Generate PNG icons from app/icon.svg
  const svgIcon = "app/icon.svg";

  // 16x16, 32x32, 48x48, 180x180, 192x192, 512x512
  const p16 = await sharp(svgIcon).resize(16, 16).png().toBuffer();
  const p32 = await sharp(svgIcon).resize(32, 32).png().toBuffer();
  const p48 = await sharp(svgIcon).resize(48, 48).png().toBuffer();
  await sharp(svgIcon).resize(180, 180).png().toFile("public/apple-touch-icon.png");
  await sharp(svgIcon).resize(180, 180).png().toFile("app/apple-icon.png");
  await sharp(svgIcon).resize(192, 192).png().toFile("public/icons/icon-192.png");
  await sharp(svgIcon).resize(512, 512).png().toFile("public/icons/icon-512.png");
  await sharp(svgIcon).resize(512, 512).png().toFile("public/icons/icon-maskable-512.png");

  // Also write 32x32 to public/favicon.ico
  // A single 32x32 PNG is supported by modern browsers for favicon.ico, or ICO container.
  // Standard ICO format with 16, 32, 48:
  function createIco(images: Buffer[]): Buffer {
    const count = images.length;
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0); // reserved
    header.writeUInt16LE(1, 2); // ICO type
    header.writeUInt16LE(count, 4);

    const dirEntries: Buffer[] = [];
    let offset = 6 + count * 16;

    for (const img of images) {
      const entry = Buffer.alloc(16);
      const size = img.length;
      // Get width/height (16, 32, 48)
      const w = img === images[0] ? 16 : img === images[1] ? 32 : 48;
      entry.writeUInt8(w, 0);
      entry.writeUInt8(w, 1);
      entry.writeUInt8(0, 2); // color palette
      entry.writeUInt8(0, 3); // reserved
      entry.writeUInt16LE(1, 4); // color planes
      entry.writeUInt16LE(32, 6); // bpp
      entry.writeUInt32LE(size, 8); // image size
      entry.writeUInt32LE(offset, 12); // offset
      dirEntries.push(entry);
      offset += size;
    }

    return Buffer.concat([header, ...dirEntries, ...images]);
  }

  const icoBuffer = createIco([p16, p32, p48]);
  writeFileSync("public/favicon.ico", icoBuffer);
  writeFileSync("app/favicon.ico", icoBuffer);
  console.log("Generated favicon.ico and PNG icons");

  // 3. Generate OG Image (1200 x 630)
  const svgOg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#080c16"/>
      <stop offset="50%" stop-color="#0e1736"/>
      <stop offset="100%" stop-color="#141f4d"/>
    </linearGradient>
    <radialGradient id="glow" cx="82%" cy="28%" r="65%">
      <stop offset="0%" stop-color="#2a4cd4" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#0a0d18" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="subtle" cx="15%" cy="85%" r="55%">
      <stop offset="0%" stop-color="#1e3a8a" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#070a13" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <rect width="1200" height="630" fill="url(#subtle)"/>

  <rect x="28" y="28" width="1144" height="574" rx="24" fill="none" stroke="#25356b" stroke-width="2" stroke-opacity="0.6"/>

  <g transform="translate(72, 70)">
    <rect x="0" y="0" width="310" height="42" rx="21" fill="#152047" stroke="#2c3e80" stroke-width="1.5"/>
    <circle cx="20" cy="21" r="5" fill="#38bdf8"/>
    <text x="36" y="26" font-family="sans-serif" font-size="14" font-weight="700" letter-spacing="2" fill="#93c5fd">ESTAKA DENTAL CLINIC</text>
  </g>

  <g transform="translate(930, 70)">
    <rect x="0" y="0" width="198" height="42" rx="21" fill="#131b3b" stroke="#233266" stroke-width="1.5"/>
    <text x="99" y="26" font-family="sans-serif" font-size="14" font-weight="600" letter-spacing="1" fill="#cbd5e1" text-anchor="middle">MAKASSAR</text>
  </g>

  <g transform="translate(850, 190)">
    <circle cx="130" cy="130" r="145" fill="#131d45" opacity="0.4"/>
    <circle cx="130" cy="130" r="110" fill="#1a275e" opacity="0.6"/>
    <g transform="translate(45, 45) scale(0.66)">
      <rect width="256" height="256" rx="56" fill="#1d3bb9"/>
      <g fill="#f8fafc">
        <rect x="36" y="40" width="28" height="176" rx="14"/>
        <rect x="36" y="40" width="88" height="26" rx="13"/>
        <rect x="36" y="115" width="68" height="26" rx="13"/>
        <rect x="36" y="190" width="88" height="26" rx="13"/>
        <path transform="translate(140, 48)" d="M16 30C16 10 34 4 48 14C54 18 58 18 64 14C78 4 96 10 96 30C96 52 88 70 86 100L82 150C81 162 70 166 66 154L58 112C57 106 51 106 50 112L44 154C40 166 29 162 28 150L24 100C22 70 16 52 16 30Z" fill="#f8fafc"/>
      </g>
    </g>
  </g>

  <text x="72" y="235" font-family="serif" font-size="68" font-weight="800" fill="#ffffff" letter-spacing="-1">
    Estaka Dental Clinic
  </text>

  <text x="72" y="300" font-family="sans-serif" font-size="28" font-weight="500" fill="#93c5fd">
    Dokter Gigi Umum &amp; Spesialis Konservasi Gigi
  </text>

  <g transform="translate(72, 350)">
    <g transform="translate(0, 0)">
      <rect width="280" height="48" rx="12" fill="#121a38" stroke="#223164" stroke-width="1.2"/>
      <text x="24" y="30" font-family="sans-serif" font-size="15" font-weight="600" fill="#e2e8f0">&#10022; Perawatan Saluran Akar</text>
    </g>
    <g transform="translate(295, 0)">
      <rect width="240" height="48" rx="12" fill="#121a38" stroke="#223164" stroke-width="1.2"/>
      <text x="24" y="30" font-family="sans-serif" font-size="15" font-weight="600" fill="#e2e8f0">&#10022; Tambal &amp; Pembersihan</text>
    </g>
    <g transform="translate(550, 0)">
      <rect width="210" height="48" rx="12" fill="#121a38" stroke="#223164" stroke-width="1.2"/>
      <text x="24" y="30" font-family="sans-serif" font-size="15" font-weight="600" fill="#e2e8f0">&#10022; Reservasi Online</text>
    </g>
  </g>

  <g transform="translate(72, 515)">
    <line x1="0" y1="0" x2="1056" y2="0" stroke="#1f2c59" stroke-width="1.5"/>
    <text x="0" y="35" font-family="sans-serif" font-size="16" font-weight="500" fill="#94a3b8">
      Jl. Andi Tonro Blok F No.30, Tamalate, Makassar • Praktik: Senin – Sabtu 09:00–17:00 WITA
    </text>
    <text x="1056" y="35" font-family="sans-serif" font-size="16" font-weight="700" fill="#60a5fa" text-anchor="end">
      estakadentalclinic.vercel.app
    </text>
  </g>
</svg>`;

  await sharp(Buffer.from(svgOg))
    .png({ quality: 95, compressionLevel: 8 })
    .toFile("public/og-image.png");

  await sharp(Buffer.from(svgOg))
    .jpeg({ quality: 90, mozjpeg: true })
    .toFile("public/og-image.jpg");

  console.log("Generated public/og-image.png and public/og-image.jpg");
}

main().catch(console.error);
