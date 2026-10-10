// Uploaded site photos and design files are kept in the database (see the files table). The browser shrinks photos
// before sending, so the limit is small. In a larger deployment these would move to object storage.
export const MAX_BYTES = 2.5 * 1024 * 1024;

const SIGNATURES = [
  ['image/jpeg', (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff],
  ['image/png', (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47],
  ['image/webp', (b) => b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP'],
  ['application/pdf', (b) => b.slice(0, 4).toString() === '%PDF'],
];

// Decides what the bytes really are, whatever the sender claimed. SVG is refused: it can carry scripts.
export function inspectUpload(base64, claimedMime, { allowPdf = false } = {}) {
  const buf = Buffer.from(String(base64 || ''), 'base64');
  if (!buf.length) return { error: 'The file is empty.' };
  if (buf.length > MAX_BYTES) return { error: 'The file is too large. Keep it under 2.5 MB.' };
  const found = SIGNATURES.find(([, test]) => test(buf));
  if (!found) return { error: 'Upload a JPG, PNG or WebP image' + (allowPdf ? ' or a PDF.' : '.') };
  const mime = found[0];
  if (mime === 'application/pdf' && !allowPdf) return { error: 'Site photos must be images.' };
  if (claimedMime && claimedMime !== mime && !(claimedMime === 'image/jpg' && mime === 'image/jpeg')) return { error: 'The file type does not match its contents.' };
  return { buf, mime };
}
