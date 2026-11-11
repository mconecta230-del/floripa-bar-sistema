const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

function decodeAscii85(str) {
  let s = str.replace(/~>/g, '').replace(/\s+/g, '');
  if (s.startsWith('<~')) s = s.slice(2);
  const out = [];
  let i = 0;
  while (i < s.length) {
    if (s[i] === 'z') { out.push(0, 0, 0, 0); i++; continue; }
    let chunk = s.slice(i, i + 5);
    i += chunk.length;
    let padding = 5 - chunk.length;
    if (padding > 0) chunk += 'u'.repeat(padding);
    let val = 0;
    for (let j = 0; j < 5; j++) val = val * 85 + (chunk.charCodeAt(j) - 33);
    const b = [(val >>> 24) & 0xff, (val >>> 16) & 0xff, (val >>> 8) & 0xff, val & 0xff];
    for (let k = 0; k < 4 - padding; k++) out.push(b[k]);
  }
  return Buffer.from(out);
}

function encodePngRGB(width, height, rgbBuffer) {
  const rowBytes = width * 3;
  const rawScanlines = Buffer.alloc(height * (rowBytes + 1));
  for (let y = 0; y < height; y++) {
    rawScanlines[y * (rowBytes + 1)] = 0;
    rgbBuffer.copy(rawScanlines, y * (rowBytes + 1) + 1, y * rowBytes, (y + 1) * rowBytes);
  }
  const idatData = zlib.deflateSync(rawScanlines);

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const crc = zlib.crc32(Buffer.concat([typeBuf, data]));
    crcBuf.writeUInt32BE(crc >>> 0, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2; // RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    header,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idatData),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

const pdfPath = 'C:\\Users\\charl\\Downloads\\Floripa_Bar_Cardapio_Completo.pdf';
const buf = fs.readFileSync(pdfPath);
const text = buf.toString('latin1');

// Get all Image XObjects
const objRe = /(\d+)\s+0\s+obj\s*<<([\s\S]*?)>>\s*stream\r?\n?([\s\S]*?)\r?\n?endstream/g;
let om;
const imageObjects = new Map();
while ((om = objRe.exec(text)) !== null) {
  const id = Number(om[1]);
  const dict = om[2];
  if (dict.includes('/Subtype /Image') || dict.includes('/Subtype/Image')) {
    const w = Number((dict.match(/\/Width\s+(\d+)/) || [])[1] || 0);
    const h = Number((dict.match(/\/Height\s+(\d+)/) || [])[1] || 0);
    const filter = (dict.match(/\/Filter\s*(\/[A-Za-z0-9]+|\[[^\]]+\])/) || [])[1] || '';
    imageObjects.set(id, { id, dict, stream: om[3], w, h, filter });
  }
}

// Ensure public/products directory exists
const outDir = path.resolve('public', 'products');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Function to extract image to disk
function saveImageObject(objId, filename) {
  const img = imageObjects.get(objId);
  if (!img) return null;
  const targetPath = path.join(outDir, filename);
  
  if (img.filter.includes('/DCTDecode')) {
    const raw = decodeAscii85(img.stream);
    fs.writeFileSync(targetPath, raw);
    return `/products/${filename}`;
  } else {
    const raw = decodeAscii85(img.stream);
    const rgb = zlib.inflateSync(raw);
    const png = encodePngRGB(img.w, img.h, rgb);
    fs.writeFileSync(targetPath, png);
    return `/products/${filename}`;
  }
}

// Create a clean default SVG/PNG for "SEM FOTO"
// Let's create an attractive SVG and convert or write a clean fallback PNG
const semFotoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
  <rect width="200" height="200" fill="#f1f5f9" rx="12"/>
  <rect x="50" y="50" width="100" height="80" rx="8" fill="#e2e8f0" stroke="#cbd5e1" stroke-width="2"/>
  <circle cx="80" cy="80" r="12" fill="#94a3b8"/>
  <path d="M55 125 L90 95 L115 115 L135 100 L145 125 Z" fill="#94a3b8"/>
  <text x="100" y="160" font-family="system-ui, sans-serif" font-size="13" font-weight="bold" fill="#64748b" text-anchor="middle">SEM FOTO</text>
</svg>`;
fs.writeFileSync(path.join(outDir, 'sem-foto.svg'), semFotoSvg);

// Also generate a 200x200 PNG for sem-foto so every device/browser handles it seamlessly
const grayRgb = Buffer.alloc(200 * 200 * 3, 241); // light gray #f1f1f1
for (let y = 0; y < 200; y++) {
  for (let x = 0; x < 200; x++) {
    const idx = (y * 200 + x) * 3;
    // draw a darker camera/frame in the center
    if (x >= 50 && x <= 150 && y >= 50 && y <= 130) {
      if (x === 50 || x === 150 || y === 50 || y === 130) {
        grayRgb[idx] = 180; grayRgb[idx+1] = 190; grayRgb[idx+2] = 205;
      } else {
        grayRgb[idx] = 225; grayRgb[idx+1] = 230; grayRgb[idx+2] = 240;
      }
    }
  }
}
fs.writeFileSync(path.join(outDir, 'sem-foto.png'), encodePngRGB(200, 200, grayRgb));

console.log('Default fallback images created.');

// Let's load the catalog from src/catalog-data.ts
const catalogContent = fs.readFileSync('src/catalog-data.ts', 'utf8');
const catalogItems = [];
const itemRegex = /{\s*id:\s*(\d+),\s*category:\s*'([^']+)',\s*name:\s*'([^']+)',\s*cents:\s*(\d+)/g;
let m;
while ((m = itemRegex.exec(catalogContent)) !== null) {
  catalogItems.push({
    id: Number(m[1]),
    category: m[2],
    name: m[3],
    cents: Number(m[4])
  });
}
console.log('Catalog items loaded from ts:', catalogItems.length);

// Scan all pages of PDF in order
const pageRe2 = /\/Type\s*\/Page\b([\s\S]*?)(?=\/Type\s*\/Page\b|xref|\z)/g;
let pm2;
let pageNum2 = 0;
const pdfProducts = [];

while ((pm2 = pageRe2.exec(text)) !== null) {
  pageNum2++;
  const pageBlock = pm2[1];
  const cMatch = pageBlock.match(/\/Contents\s+(\d+)\s+0\s+R/);
  if (!cMatch) continue;
  const contentId = Number(cMatch[1]);

  const xobjMap = {};
  const xobjBlockMatch = pageBlock.match(/\/XObject\s*<<([\s\S]*?)>>/);
  if (xobjBlockMatch) {
    const itemRe = /\/([A-Za-z0-9_.]+)\s+(\d+)\s+0\s+R/g;
    let im;
    while ((im = itemRe.exec(xobjBlockMatch[1])) !== null) {
      xobjMap[im[1]] = Number(im[2]);
    }
  }

  const cRe = new RegExp(contentId + '\\s+0\\s+obj\\s*<<[\\s\\S]*?>>\\s*stream\\r?\\n?([\\s\\S]*?)\\r?\\n?endstream');
  const cm = cRe.exec(text);
  if (!cm) continue;
  const content = zlib.inflateSync(decodeAscii85(cm[1])).toString('latin1');

  const opRe = /(?:\/([A-Za-z0-9_.]+)\s+Do|\(([^)]+)\)\s+Tj)/g;
  let opm;
  const events = [];
  while ((opm = opRe.exec(content)) !== null) {
    if (opm[1]) {
      events.push({ type: 'xobj', name: opm[1], objId: xobjMap[opm[1]] });
    } else if (opm[2]) {
      const rawText = opm[2].replace(/\\([0-7]{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
      events.push({ type: 'text', text: rawText });
    }
  }

  let lastImage = null;
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (ev.type === 'xobj') {
      lastImage = ev.objId;
    } else if (ev.type === 'text') {
      if (ev.text.includes('SEM FOTO')) {
        lastImage = 'SEM_FOTO';
      } else if (ev.text.includes('R$')) {
        const priceCents = Math.round(Number(ev.text.replace('R$', '').replace('.', '').replace(',', '.').trim()) * 100);
        // Look back for product name
        const textSlice = events
          .slice(Math.max(0, i - 12), i)
          .filter(e => e.type === 'text' && !e.text.includes('FLORIPA') && !e.text.includes('CARDÁPIO') && !e.text.includes('Fonte:'))
          .map(e => e.text);
        pdfProducts.push({
          page: pageNum2,
          priceCents,
          imageObj: lastImage,
          rawTexts: textSlice
        });
        lastImage = null;
      }
    }
  }
}

console.log('Total PDF products parsed:', pdfProducts.length);
