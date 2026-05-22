const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

// CRC32
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
  const BG = [37, 99, 235];    // #2563eb
  const FG = [255, 255, 255];  // white

  // pixels[y][x] = [r, g, b]
  const px = [];
  for (let y = 0; y < size; y++) {
    px.push([]);
    for (let x = 0; x < size; x++) px[y].push([...BG]);
  }

  const sc = v => Math.round(v * size / 512);

  function rect(x1, y1, x2, y2, col) {
    for (let y = sc(y1); y <= sc(y2); y++)
      for (let x = sc(x1); x <= sc(x2); x++)
        if (x >= 0 && x < size && y >= 0 && y < size)
          px[y][x] = [...col];
  }

  function circle(cx, cy, r, col) {
    const [ccx, ccy, rr] = [sc(cx), sc(cy), sc(r)];
    for (let y = ccy - rr; y <= ccy + rr; y++)
      for (let x = ccx - rr; x <= ccx + rr; x++)
        if ((x-ccx)**2 + (y-ccy)**2 <= rr**2 && x>=0 && x<size && y>=0 && y<size)
          px[y][x] = [...col];
  }

  // ── 장바구니 아이콘 ──────────────────────────────────
  // 손잡이 세로봉
  rect(60, 100, 104, 290, FG);
  // 손잡이 가로봉 (상단 grip)
  rect(60, 100, 200, 148, FG);
  // 바구니 몸체 (사각형, 위쪽이 넓은 모양)
  rect(100, 190, 460, 370, FG);
  // 바구니 내부 (비워서 아웃라인 느낌)
  rect(136, 226, 424, 352, BG);
  // 바구니 아랫쪽 연결 (왼쪽 다리)
  rect(136, 370, 176, 412, FG);
  // 바구니 아랫쪽 연결 (오른쪽 다리)
  rect(384, 370, 424, 412, FG);
  // 왼쪽 바퀴
  circle(156, 452, 52, FG);
  circle(156, 452, 26, BG);
  // 오른쪽 바퀴
  circle(400, 452, 52, FG);
  circle(400, 452, 26, BG);

  // PNG 인코딩
  const sig  = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8]=8; ihdr[9]=2; // 8-bit RGB

  const row = 1 + size * 3;
  const raw = Buffer.alloc(size * row);
  for (let y = 0; y < size; y++) {
    raw[y * row] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      const o = y * row + 1 + x * 3;
      raw[o]   = px[y][x][0];
      raw[o+1] = px[y][x][1];
      raw[o+2] = px[y][x][2];
    }
  }

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const dir = path.join(__dirname, 'mobile', 'icons');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'icon-192.png'), makePNG(192));
fs.writeFileSync(path.join(dir, 'icon-512.png'), makePNG(512));
console.log('아이콘 생성 완료');
