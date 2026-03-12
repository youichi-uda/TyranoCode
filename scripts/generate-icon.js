/**
 * Generate a 128x128 PNG icon for TyranoCode VS Code extension.
 * Uses only built-in Node.js modules (zlib + buffer).
 *
 * Design: Dark blue-purple background (#1e1e3f) with a stylized gold "T"
 * and small code brackets "< >" in lighter gold.
 */

const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const W = 128;
const H = 128;

// Colors
const BG      = [0x1e, 0x1e, 0x3f]; // dark blue-purple
const GOLD    = [0xf0, 0xc0, 0x40]; // gold/amber for "T"
const GOLD_LT = [0xf5, 0xd0, 0x70]; // lighter gold for brackets
const ACCENT  = [0x2a, 0x2a, 0x5a]; // subtle lighter bg for rounded rect area
const EDGE    = [0x3a, 0x3a, 0x7a]; // border highlight

// Pixel buffer: each row has a filter byte (0) + W * 3 bytes (RGB)
const rowBytes = 1 + W * 3;
const raw = Buffer.alloc(H * rowBytes, 0);

function setPixel(x, y, r, g, b) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const off = y * rowBytes + 1 + x * 3;
  raw[off]     = r;
  raw[off + 1] = g;
  raw[off + 2] = b;
}

function getPixel(x, y) {
  if (x < 0 || x >= W || y < 0 || y >= H) return BG;
  const off = y * rowBytes + 1 + x * 3;
  return [raw[off], raw[off + 1], raw[off + 2]];
}

function blend(base, top, alpha) {
  return Math.round(base * (1 - alpha) + top * alpha);
}

function setPixelAlpha(x, y, r, g, b, a) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  if (a <= 0) return;
  if (a >= 1) { setPixel(x, y, r, g, b); return; }
  const [br, bg, bb] = getPixel(x, y);
  setPixel(x, y, blend(br, r, a), blend(bg, g, a), blend(bb, b, a));
}

// Draw filled rectangle
function fillRect(x1, y1, x2, y2, color) {
  for (let y = y1; y <= y2; y++)
    for (let x = x1; x <= x2; x++)
      setPixel(x, y, color[0], color[1], color[2]);
}

// Draw filled circle (used for rounded corners)
function fillCircle(cx, cy, r, color) {
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      const dist = Math.sqrt(x * x + y * y);
      if (dist <= r + 0.5) {
        const a = Math.max(0, Math.min(1, r + 0.5 - dist));
        setPixelAlpha(cx + x, cy + y, color[0], color[1], color[2], a);
      }
    }
  }
}

// Draw a rounded rectangle
function fillRoundedRect(x1, y1, x2, y2, r, color) {
  // Center cross
  fillRect(x1 + r, y1, x2 - r, y2, color);
  fillRect(x1, y1 + r, x2, y2 - r, color);
  // Corners
  fillCircle(x1 + r, y1 + r, r, color);
  fillCircle(x2 - r, y1 + r, r, color);
  fillCircle(x1 + r, y2 - r, r, color);
  fillCircle(x2 - r, y2 - r, r, color);
}

// Draw anti-aliased thick line
function drawLineThick(x1, y1, x2, y2, thickness, color) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return;
  const nx = -dy / len;
  const ny = dx / len;
  const half = thickness / 2;

  const minX = Math.floor(Math.min(x1, x2) - half - 1);
  const maxX = Math.ceil(Math.max(x1, x2) + half + 1);
  const minY = Math.floor(Math.min(y1, y2) - half - 1);
  const maxY = Math.ceil(Math.max(y1, y2) + half + 1);

  for (let py = minY; py <= maxY; py++) {
    for (let px = minX; px <= maxX; px++) {
      // Distance from point to line segment
      const apx = px - x1, apy = py - y1;
      let t = (apx * dx + apy * dy) / (len * len);
      t = Math.max(0, Math.min(1, t));
      const closestX = x1 + t * dx;
      const closestY = y1 + t * dy;
      const dist = Math.sqrt((px - closestX) ** 2 + (py - closestY) ** 2);
      if (dist <= half + 0.7) {
        const a = Math.max(0, Math.min(1, half + 0.7 - dist));
        setPixelAlpha(px, py, color[0], color[1], color[2], a);
      }
    }
  }
}

// ----- Draw the icon -----

// 1. Background: rounded rectangle with slight gradient effect
fillRoundedRect(2, 2, 125, 125, 16, BG);

// Subtle inner glow / lighter area in center
fillRoundedRect(6, 6, 121, 121, 13, ACCENT);
fillRoundedRect(10, 10, 117, 117, 11, BG);

// 2. Draw the stylized "T" in gold
// Horizontal bar of T
const tTop = 24;
const tBarH = 10;
const tLeft = 28;
const tRight = 99;
fillRoundedRect(tLeft, tTop, tRight, tTop + tBarH, 4, GOLD);

// Vertical stem of T
const stemLeft = 55;
const stemRight = 72;
const stemBottom = 92;
fillRoundedRect(stemLeft, tTop + 4, stemRight, stemBottom, 4, GOLD);

// Small serif/flare at bottom of stem
fillRoundedRect(stemLeft - 4, stemBottom - 4, stemRight + 4, stemBottom + 2, 3, GOLD);

// 3. Draw code brackets "< >" below the T
const bracketY = 102;
const bracketH = 14;
const bracketThick = 2.8;

// Left bracket "<"
const lbx = 34;
drawLineThick(lbx + 12, bracketY, lbx, bracketY + bracketH / 2, bracketThick, GOLD_LT);
drawLineThick(lbx, bracketY + bracketH / 2, lbx + 12, bracketY + bracketH, bracketThick, GOLD_LT);

// Right bracket ">"
const rbx = 93;
drawLineThick(rbx - 12, bracketY, rbx, bracketY + bracketH / 2, bracketThick, GOLD_LT);
drawLineThick(rbx, bracketY + bracketH / 2, rbx - 12, bracketY + bracketH, bracketThick, GOLD_LT);

// Slash "/" between brackets
drawLineThick(68, bracketY, 58, bracketY + bracketH, 2.2, GOLD_LT);

// 4. Add subtle border to the rounded rect
// (draw border pixels on the edge)
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const [r, g, b] = getPixel(x, y);
    // If this pixel is non-black and an adjacent pixel is black, it's an edge
    const isFilled = (r !== 0 || g !== 0 || b !== 0);
    if (!isFilled) continue;
    let isEdge = false;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const [nr, ng, nb] = getPixel(x+dx, y+dy);
      if (nr === 0 && ng === 0 && nb === 0) { isEdge = true; break; }
    }
    if (isEdge) {
      // Blend with edge color
      setPixelAlpha(x, y, EDGE[0], EDGE[1], EDGE[2], 0.6);
    }
  }
}

// ----- Encode as PNG -----

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([len, typeAndData, crc]);
}

// PNG Signature
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

// IHDR: width, height, bit depth 8, color type 2 (RGB), compression 0, filter 0, interlace 0
const ihdrData = Buffer.alloc(13);
ihdrData.writeUInt32BE(W, 0);
ihdrData.writeUInt32BE(H, 4);
ihdrData[8] = 8;   // bit depth
ihdrData[9] = 2;   // color type: RGB
ihdrData[10] = 0;  // compression
ihdrData[11] = 0;  // filter
ihdrData[12] = 0;  // interlace
const ihdr = makeChunk('IHDR', ihdrData);

// IDAT: compressed pixel data
const compressed = zlib.deflateSync(raw, { level: 9 });
const idat = makeChunk('IDAT', compressed);

// IEND
const iend = makeChunk('IEND', Buffer.alloc(0));

const png = Buffer.concat([signature, ihdr, idat, iend]);

const outPath = path.join(__dirname, '..', 'images', 'icon.png');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, png);
console.log(`Icon written to ${outPath} (${png.length} bytes, ${W}x${H})`);
