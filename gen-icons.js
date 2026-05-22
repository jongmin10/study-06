// 외부 패키지 없이 PNG 아이콘 생성 (Node.js 내장 zlib 사용)
const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t   = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

function makePNG(size) {
  const BG  = [37, 99, 235];   // #2563eb
  const FG  = [255, 255, 255]; // white

  // cart 그리기 (scale 기반 좌표)
  const scale = size / 512;
  const pixels = [];

  // 배경: 파란색 전체
  for (let y = 0; y < size; y++) {
    pixels.push(new Array(size).fill(null).map(() => [...BG]));
  }

  function setPixel(x, y, color) {
    x = Math.round(x); y = Math.round(y);
    if (x >= 0 && x < size && y >= 0 && y < size) pixels[y][x] = color;
  }

  function fillRect(x1, y1, x2, y2, color) {
    for (let y = Math.round(y1); y <= Math.round(y2); y++)
      for (let x = Math.round(x1); x <= Math.round(x2); x++)
        setPixel(x, y, color);
  }

  function fillCircle(cx, cy, r, color) {
    for (let y = cy - r; y <= cy + r; y++)
      for (let x = cx - r; x <= cx + r; x++)
        if ((x-cx)**2 + (y-cy)**2 <= r**2) setPixel(x, y, color);
  }

  // 모든 좌표는 512 기준, scale로 실제 크기에 맞게 변환
  const s = v => v * scale;

  // 핸들 수직봉
  fillRect(s(72), s(110), s(108), s(230), FG);
  // 핸들 가로봉
  fillRect(s(72), s(110), s(200), s(150), FG);
  // 바구니 (사다리꼴 모양 근사: 직사각형)
  fillRect(s(150), s(170), s(430), s(330), FG);
  // 바구니 내부 (배경색으로 파냄)
  fillRect(s(175), s(200), s(405), s(310), BG);
  // 왼쪽 다리
  fillRect(s(172), s(330), s(208), s(370), FG);
  // 오른쪽 다리
  fillRect(s(392), s(330), s(428), s(370), FG);
  // 왼쪽 바퀴 외곽
  fillCircle(s(190), s(410), s(52), FG);
  // 왼쪽 바퀴 내부
  fillCircle(s(190), s(410), s(28), BG);
  // 오른쪽 바퀴 외곽
  fillCircle(s(410), s(410), s(52), FG);
  // 오른쪽 바퀴 내부
  fillCircle(s(410), s(410), s(28), BG);

  // PNG 인코딩
  const sig = Buffer.from([137,80,78,71,13,10,26,10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8]=8; ihdr[9]=2; ihdr[10]=0; ihdr[11]=0; ihdr[12]=0;

  const rowSize = 1 + size * 3;
  const raw = Buffer.alloc(size * rowSize);
  for (let y = 0; y < size; y++) {
    raw[y * rowSize] = 0;
    for (let x = 0; x < size; x++) {
      const off = y * rowSize + 1 + x * 3;
      raw[off]   = pixels[y][x][0];
      raw[off+1] = pixels[y][x][1];
      raw[off+2] = pixels[y][x][2];
    }
  }

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const dir = path.join(__dirname, 'mobile', 'icons');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'icon-192.png'), makePNG(192));
fs.writeFileSync(path.join(dir, 'icon-512.png'), makePNG(512));
console.log('아이콘 생성 완료: mobile/icons/icon-192.png, icon-512.png');
