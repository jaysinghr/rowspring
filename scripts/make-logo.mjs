// Renders the Rowspring icon (rows -> event dot) to PNG with no dependencies.
import fs from 'node:fs';
import zlib from 'node:zlib';

const INK = [0x17, 0x22, 0x3b];
const SPRING = [0x1f, 0x9d, 0x68];
const WHITE = [255, 255, 255];

// Shapes in a 100x100 unit square: rounded rects (x, y, w, h, r) and circles.
const bg = { rr: [0, 0, 100, 100, 22], color: INK };
const shapes = [
  { rr: [20, 26, 60, 11, 5.5], color: WHITE },
  { rr: [20, 44.5, 60, 11, 5.5], color: WHITE },
  { rr: [20, 63, 38, 11, 5.5], color: WHITE },
  { circle: [70, 68.5, 11], color: SPRING },
];

function inside(shape, x, y) {
  if (shape.circle) {
    const [cx, cy, r] = shape.circle;
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  }
  const [rx, ry, w, h, r] = shape.rr;
  const px = Math.max(rx + r - x, 0, x - (rx + w - r));
  const py = Math.max(ry + r - y, 0, y - (ry + h - r));
  return px * px + py * py <= r * r && x >= rx && x <= rx + w && y >= ry && y <= ry + h;
}

function render(size) {
  const ss = 4;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let py = 0; py < size; py++) {
    raw[py * (size * 4 + 1)] = 0;
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
        const x = ((px + (sx + 0.5) / ss) / size) * 100;
        const y = ((py + (sy + 0.5) / ss) / size) * 100;
        if (!inside(bg, x, y)) continue;
        let c = bg.color;
        for (const s of shapes) if (inside(s, x, y)) c = s.color;
        r += c[0]; g += c[1]; b += c[2]; a += 1;
      }
      const o = py * (size * 4 + 1) + 1 + px * 4;
      const n = ss * ss;
      raw[o] = a ? Math.round(r / a) : 0;
      raw[o + 1] = a ? Math.round(g / a) : 0;
      raw[o + 2] = a ? Math.round(b / a) : 0;
      raw[o + 3] = Math.round((a / n) * 255);
    }
  }
  return png(size, raw);
}

function crc32(buf) {
  let c, crc = ~0;
  for (let i = 0; i < buf.length; i++) {
    c = (crc ^ buf[i]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return ~crc >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(size, raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

fs.mkdirSync('site/assets', { recursive: true });
for (const size of [32, 128, 512]) fs.writeFileSync(`site/assets/rowspring-${size}.png`, render(size));
console.log('Wrote site/assets/rowspring-{32,128,512}.png');
