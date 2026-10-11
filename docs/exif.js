// Read only capture dates. Never retain GPS, camera IDs or the original EXIF block.
import { validDate } from './core.js?v=2';

function parseTimestamp(text) {
  const match = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(text);
  if (!match || +match[4] > 23 || +match[5] > 59 || +match[6] > 59) return null;
  const date = `${match[1]}-${match[2]}-${match[3]}`;
  return validDate(date) ? date : null;
}

function tiffDate(bytes, offset, end) {
  if (offset + 8 > end) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const little = bytes[offset] === 0x49 && bytes[offset + 1] === 0x49;
  if (!little && !(bytes[offset] === 0x4d && bytes[offset + 1] === 0x4d)) return null;
  const safe = (p, n) => Number.isSafeInteger(p) && p >= offset && p + n <= end;
  const u16 = p => safe(p, 2) ? view.getUint16(p, little) : null;
  const u32 = p => safe(p, 4) ? view.getUint32(p, little) : null;
  if (u16(offset + 2) !== 42) return null;
  const visited = new Set();
  let fallback = null;
  function directory(relative, depth = 0) {
    const p = offset + relative;
    if (depth > 2 || visited.has(p) || !safe(p, 2)) return null;
    visited.add(p);
    const count = u16(p);
    if (count > 512 || !safe(p + 2, count * 12)) return null;
    let child = null, digitized = null;
    for (let i = 0; i < count; i++) {
      const item = p + 2 + i * 12, tag = u16(item), type = u16(item + 2), size = u32(item + 4);
      if (tag === 0x8769 && type === 4 && size === 1) child = u32(item + 8);
      if (![0x9003, 0x9004, 0x0132].includes(tag) || type !== 2 || size < 19 || size > 64) continue;
      const start = size <= 4 ? item + 8 : offset + u32(item + 8);
      if (!safe(start, size)) continue;
      const date = parseTimestamp(String.fromCharCode(...bytes.subarray(start, start + size)));
      if (tag === 0x9003 && date) return date;
      if (tag === 0x9004 && date) digitized = date;
      if (tag === 0x0132 && date) fallback = date;
    }
    return (child !== null ? directory(child, depth + 1) : null) || digitized;
  }
  return directory(u32(offset + 4)) || fallback;
}

export async function captureDate(file) {
  // Cap metadata scanning; a malformed or unsupported image simply has no known date.
  try {
    const bytes = new Uint8Array(await file.slice(0, 2 * 1024 * 1024).arrayBuffer());
    const view = new DataView(bytes.buffer);
    const text = (p, n) => String.fromCharCode(...bytes.subarray(p, p + n));
    if (bytes[0] === 0xff && bytes[1] === 0xd8) {
      let p = 2;
      while (p + 4 <= bytes.length && bytes[p] === 0xff) {
        const marker = bytes[p + 1];
        if (marker === 0xda || marker === 0xd9) break;
        const size = view.getUint16(p + 2), end = p + 2 + size;
        if (size < 2 || end > bytes.length) break;
        if (marker === 0xe1 && text(p + 4, 6) === 'Exif\0\0') {
          const date = tiffDate(bytes, p + 10, end); if (date) return date;
        }
        p = end;
      }
    } else if (text(1, 3) === 'PNG') {
      let p = 8;
      while (p + 12 <= bytes.length) {
        const size = view.getUint32(p), end = p + 12 + size;
        if (end > bytes.length) break;
        if (text(p + 4, 4) === 'eXIf') return tiffDate(bytes, p + 8, p + 8 + size);
        p = end;
      }
    } else if (text(0, 4) === 'RIFF' && text(8, 4) === 'WEBP') {
      let p = 12;
      while (p + 8 <= bytes.length) {
        const size = view.getUint32(p + 4, true), end = p + 8 + size;
        if (end > bytes.length) break;
        if (text(p, 4) === 'EXIF') return tiffDate(bytes, p + 8 + (text(p + 8, 6) === 'Exif\0\0' ? 6 : 0), end);
        p = end + size % 2;
      }
    }
  } catch { /* Unsupported metadata never prevents manual registration. */ }
  return null;
}
