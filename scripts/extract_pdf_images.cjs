const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

function decodeAscii85(str) {
  let s = str.replace(/~>/g, '').replace(/\s+/g, '');
  if (s.startsWith('<~')) s = s.slice(2);
  const out = [];
  let i = 0;
  while (i < s.length) {
    if (s[i] === 'z') {
      out.push(0, 0, 0, 0);
      i++;
      continue;
    }
    let chunk = s.slice(i, i + 5);
    i += chunk.length;
    let padding = 5 - chunk.length;
    if (padding > 0) {
      chunk += 'u'.repeat(padding);
    }
    let val = 0;
    for (let j = 0; j < 5; j++) {
      val = val * 85 + (chunk.charCodeAt(j) - 33);
    }
    const b = [
      (val >>> 24) & 0xff,
      (val >>> 16) & 0xff,
      (val >>> 8) & 0xff,
      val & 0xff
    ];
    for (let k = 0; k < 4 - padding; k++) {
      out.push(b[k]);
    }
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

// Cache all Image XObjects
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

console.log('Total Image Objects extracted:', imageObjects.size);

// Scan pages
const pageRe = /\/Type\s*\/Page\b([\s\S]*?)(?=\/Type\s*\/Page\b|xref|\z)/g;
let pm;
let pageNum = 0;
const pageResults = [];

while ((pm = pageRe.exec(text)) !== null) {
  pageNum++;
  const pageBlock = pm[1];
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

  pageResults.push({ pageNum, events });
}

console.log('Scanned pages:', pageResults.length);

for (const p of pageResults) {
  console.log(`\n=== PAGE ${p.pageNum} ===`);
  let lastImage = null;
  const items = [];
  for (let i = 0; i < p.events.length; i++) {
    const ev = p.events[i];
    if (ev.type === 'xobj') {
      lastImage = ev.objId;
    } else if (ev.type === 'text') {
      if (ev.text.includes('SEM FOTO')) {
        lastImage = 'SEM_FOTO';
      } else if (ev.text.includes('R$')) {
        const textSlice = p.events
          .slice(Math.max(0, i - 8), i)
          .filter(e => e.type === 'text' && !e.text.includes('FLORIPA') && !e.text.includes('CARDÁPIO') && !e.text.includes('Fonte:'))
          .map(e => e.text)
          .join(' | ');
        console.log(`[Item] Image: ${lastImage} | Price: ${ev.text} | Text: ${textSlice}`);
        lastImage = null;
      }
    }
  }
}
