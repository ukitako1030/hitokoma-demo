// All layout and file generation happens on this device. No screenshot library or server.
export const PAPERS = {
  '2l': { label: '2L判 · 127 × 178 mm', w: 127, h: 178 },
  l: { label: 'L判 · 89 × 127 mm', w: 89, h: 127 },
  postcard: { label: 'ハガキ · 100 × 148 mm', w: 100, h: 148 },
  a5: { label: 'A5手帳に貼る · 138 × 200 mm', w: 138, h: 200 },
  rollbahn: { label: 'ロルバーンL向け · 120 × 165 mm', w: 120, h: 165 },
};
export const LAYOUTS = {
  diary: { label: '日記カード', description: '写真 ＋ 日付 ＋ ひとこと', capacity: 6 },
  sticker: { label: '写真シール', description: '写真 ＋ 日付。余白に手書きを', capacity: 20 },
  calendar: { label: '月のカレンダー', description: 'ひと月を、一枚の思い出に', capacity: 31 },
};
const font = '"Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", sans-serif';
const serif = '"Hiragino Mincho ProN", "Yu Mincho", serif';
export const dimensions = paper => ({ width: Math.round(PAPERS[paper].w / 25.4 * 300), height: Math.round(PAPERS[paper].h / 25.4 * 300) });

export function dailyRecords(entries, month) {
  const byDate = new Map();
  const ordered = [...entries].filter(e => e.date.startsWith(month)).sort((a, b) => Number(Boolean(a.sample)) - Number(Boolean(b.sample)) || (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt));
  for (const entry of ordered) if (!byDate.has(entry.date)) byDate.set(entry.date, entry);
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function lineText(ctx, text, x, y, width, size, limit, color = '#343b32') {
  ctx.fillStyle = color; ctx.font = `${size}px ${font}`;
  const lines = []; let current = '';
  for (const character of Array.from(text.replace(/\r/g, ''))) {
    if (character === '\n') { lines.push(current); current = ''; continue; }
    if (current && ctx.measureText(current + character).width > width) { lines.push(current); current = character; }
    else current += character;
  }
  if (current) lines.push(current);
  if (lines.length > limit) {
    let last = lines[limit - 1];
    while (last && ctx.measureText(last + '…').width > width) last = Array.from(last).slice(0, -1).join('');
    lines[limit - 1] = last + '…';
  }
  lines.slice(0, limit).forEach((line, i) => ctx.fillText(line, x, y + size + i * size * 1.45));
  return lines.length > limit;
}

function crop(ctx, image, x, y, w, h) {
  const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
  const sw = w / scale, sh = h / scale;
  ctx.drawImage(image, (image.naturalWidth - sw) / 2, (image.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
}

export async function renderSheet({ entries, month, layout, paper, page = 0, format = 'png', photoURL }) {
  if (!PAPERS[paper] || !LAYOUTS[layout] || !/^\d{4}-\d{2}$/.test(month)) throw new Error('書き出し設定が正しくありません。');
  const { w, h } = PAPERS[paper], { width, height } = dimensions(paper);
  const records = dailyRecords(entries, month), capacity = LAYOUTS[layout].capacity;
  const pages = Math.max(1, Math.ceil(records.length / capacity));
  const selected = layout === 'calendar' ? records : records.slice(page * capacity, (page + 1) * capacity);
  const images = new Map();
  for (const entry of selected) {
    const image = new Image(); image.src = photoURL(entry);
    try { await image.decode(); } catch { throw new Error(`${entry.date}の写真を読み込めません。記録を編集して写真を選び直してください。`); }
    images.set(entry.id, image);
  }
  await document.fonts.ready;
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('画像を作れませんでした。もう一度お試しください。');
  ctx.scale(width / w, height / h); ctx.fillStyle = '#fffef9'; ctx.fillRect(0, 0, w, h);
  ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#435a45'; ctx.font = `5.3px ${serif}`;
  const [year, numericMonth] = month.split('-').map(Number);
  ctx.fillText(`${numericMonth}月のひとこま`, 5, 11);
  ctx.font = `2.2px ${font}`; ctx.fillStyle = '#657458'; ctx.fillText(`${year}  /  写真と、ひとこと。`, 5, 16);
  ctx.textAlign = 'right'; ctx.fillText(`${page + 1} / ${pages}`, w - 5, 11); ctx.textAlign = 'left';
  ctx.strokeStyle = '#cbd2c2'; ctx.lineWidth = .15; ctx.beginPath(); ctx.moveTo(5, 20); ctx.lineTo(w - 5, 20); ctx.stroke();
  let truncated = 0;
  if (layout === 'calendar') {
    const start = new Date(year, numericMonth - 1, 1).getDay(), days = new Date(year, numericMonth, 0).getDate();
    const rows = Math.ceil((start + days) / 7), cw = (w - 10) / 7, ch = (h - 38) / rows;
    const map = new Map(records.map(e => [e.date, e]));
    ['日', '月', '火', '水', '木', '金', '土'].forEach((day, i) => { ctx.fillStyle = i === 0 ? '#966253' : '#657458'; ctx.font = `2.4px ${font}`; ctx.textAlign = 'center'; ctx.fillText(day, 5 + (i + .5) * cw, 25); });
    ctx.textAlign = 'left';
    for (let slot = 0; slot < rows * 7; slot++) {
      const x = 5 + slot % 7 * cw, y = 28 + Math.floor(slot / 7) * ch, day = slot - start + 1;
      ctx.strokeStyle = '#d8ddcf'; ctx.strokeRect(x, y, cw, ch);
      if (day < 1 || day > days) continue;
      const entry = map.get(`${month}-${String(day).padStart(2, '0')}`);
      ctx.fillStyle = '#435a45'; ctx.font = `2.7px ${font}`; ctx.fillText(String(day), x + 1, y + 3.5);
      if (!entry) continue;
      const ph = Math.max(5, Math.min(cw - 2, ch - 13));
      crop(ctx, images.get(entry.id), x + 1, y + 5, cw - 2, ph);
      if (lineText(ctx, entry.memo, x + 1, y + 6 + ph, cw - 2, 1.75, 2)) truncated++;
      if (entry.sample) { ctx.fillStyle = '#435a45'; ctx.font = `1.3px ${font}`; ctx.textAlign = 'right'; ctx.fillText('sample', x + cw - 1, y + 3.3); ctx.textAlign = 'left'; }
    }
  } else {
    const columns = layout === 'diary' ? 2 : 4, rows = layout === 'diary' ? 3 : 5, gap = layout === 'diary' ? 3 : 2;
    const cw = (w - 10 - gap * (columns - 1)) / columns, ch = (h - 34 - gap * (rows - 1)) / rows;
    selected.forEach((entry, i) => {
      const x = 5 + i % columns * (cw + gap), y = 24 + Math.floor(i / columns) * (ch + gap);
      ctx.fillStyle = '#fff'; ctx.fillRect(x, y, cw, ch);
      ctx.strokeStyle = '#ccd3c2'; ctx.lineWidth = .12; ctx.setLineDash([.5, .6]); ctx.strokeRect(x, y, cw, ch); ctx.setLineDash([]);
      const pad = layout === 'diary' ? 1.6 : 1, ph = layout === 'diary' ? ch * .57 : ch - 6;
      crop(ctx, images.get(entry.id), x + pad, y + pad, cw - pad * 2, ph);
      ctx.fillStyle = '#435a45'; ctx.font = `${layout === 'diary' ? 2.7 : 2.2}px ${font}`;
      const date = new Date(`${entry.date}T12:00:00`);
      ctx.fillText(`${numericMonth}.${String(date.getDate()).padStart(2, '0')}  ${['日', '月', '火', '水', '木', '金', '土'][date.getDay()]}`, x + pad + .7, y + pad + ph + 3.9);
      if (entry.sample) { ctx.textAlign = 'right'; ctx.font = `1.5px ${font}`; ctx.fillText('sample', x + cw - pad - .4, y + pad + ph + 3.7); ctx.textAlign = 'left'; }
      if (layout === 'diary') {
        const available = ch - ph - pad - 6, size = w < 100 ? 2 : 2.3, lines = Math.max(1, Math.floor(available / (size * 1.45)));
        if (lineText(ctx, entry.memo, x + pad + .5, y + pad + ph + 5.2, cw - pad * 2 - 1, size, lines)) truncated++;
      }
    });
  }
  ctx.font = `1.9px ${font}`; ctx.fillStyle = '#657458'; ctx.fillText('ひとこま  ·  たいせつな日々を、手帳に。', 5, h - 3.7);
  ctx.textAlign = 'right'; ctx.font = `1.5px ${font}`; ctx.fillText(`${w} × ${h} mm  /  300 dpi`, w - 5, h - 3.7);
  const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  const raw = await new Promise(resolve => canvas.toBlob(resolve, mime, .95));
  canvas.width = canvas.height = 1;
  if (!raw) throw new Error('画像を書き出せませんでした。サイズを小さくしてお試しください。');
  return { blob: await addDensity(raw, format), width, height, pages, count: records.length, truncated };
}

const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ value >>> 1 : value >>> 1;
  return value >>> 0;
});
export function crc32(bytes) { let crc = 0xffffffff; for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ crc >>> 8; return (crc ^ 0xffffffff) >>> 0; }

async function addDensity(blob, format) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (format === 'jpeg') {
    // Always insert a standard 300 dpi JFIF header; remove the old JFIF header if present.
    const jfif = new Uint8Array([255,224,0,16,74,70,73,70,0,1,1,1,1,44,1,44,0,0]);
    const skip = bytes[2] === 255 && bytes[3] === 224 && bytes[6] === 74 && bytes[7] === 70 ? 4 + ((bytes[4] << 8) | bytes[5]) : 2;
    return new Blob([bytes.subarray(0, 2), jfif, bytes.subarray(skip)], { type: 'image/jpeg' });
  }
  const chunk = new Uint8Array(21), view = new DataView(chunk.buffer);
  view.setUint32(0, 9); chunk.set([112,72,89,115], 4); view.setUint32(8, 11811); view.setUint32(12, 11811); chunk[16] = 1; view.setUint32(17, crc32(chunk.subarray(4, 17)));
  const parts = [bytes.subarray(0, 8)], source = new DataView(bytes.buffer);
  let p = 8;
  while (p + 12 <= bytes.length) {
    const size = source.getUint32(p), end = p + size + 12;
    if (end > bytes.length) throw new Error('画像の作成に失敗しました。');
    const type = String.fromCharCode(...bytes.subarray(p + 4, p + 8));
    if (type !== 'pHYs') parts.push(bytes.subarray(p, end));
    if (type === 'IHDR') parts.push(chunk);
    p = end;
  }
  return new Blob(parts, { type: 'image/png' });
}

export async function makeZip(files) {
  const chunks = [], directory = []; let offset = 0;
  for (const file of files) {
    const name = new TextEncoder().encode(file.name), bytes = new Uint8Array(await file.blob.arrayBuffer()), crc = crc32(bytes);
    const header = new Uint8Array(30 + name.length), v = new DataView(header.buffer);
    v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true); v.setUint32(14, crc, true); v.setUint32(18, bytes.length, true); v.setUint32(22, bytes.length, true); v.setUint16(26, name.length, true); header.set(name, 30);
    const central = new Uint8Array(46 + name.length), c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint32(16, crc, true); c.setUint32(20, bytes.length, true); c.setUint32(24, bytes.length, true); c.setUint16(28, name.length, true); c.setUint32(42, offset, true); central.set(name, 46);
    chunks.push(header, bytes); directory.push(central); offset += header.length + bytes.length;
  }
  const size = directory.reduce((sum, item) => sum + item.length, 0), end = new Uint8Array(22), e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, size, true); e.setUint32(16, offset, true);
  return new Blob([...chunks, ...directory, end], { type: 'application/zip' });
}

export function saveFile(blob, name) {
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = name; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
