const CHARSET_IN_HEADER = /charset\s*=\s*["']?([\w.:-]+)/i;
const CHARSET_IN_META = /<meta[^>]*?charset\s*=\s*["']?([\w.:-]+)/i;
/** How many leading bytes are scanned for `<meta charset>` (docs/spec.md, section 7). */
const META_SCAN_BYTES = 2048;

function toBytes(bytes: ArrayBuffer | Uint8Array): Uint8Array {
  return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
}

function decoderFor(label: string | undefined): TextDecoder | null {
  if (!label) return null;
  try {
    return new TextDecoder(label);
  } catch {
    return null; // unknown label: fall through to the next source
  }
}

/** Reads the first bytes as ASCII: every byte becomes one char, multibyte text cannot break the regexp. */
function asciiPrefix(bytes: Uint8Array): string {
  let text = '';
  for (const byte of bytes.subarray(0, META_SCAN_BYTES)) text += String.fromCharCode(byte < 0x80 ? byte : 0x3f);
  return text;
}

/**
 * Decodes page bytes: charset from the Content-Type header, otherwise `<meta charset>` / `http-equiv` found in the
 * first 2048 bytes read as ASCII, otherwise UTF-8. An unknown charset label is skipped like a missing one.
 */
export function decodeHtml(bytes: ArrayBuffer | Uint8Array, contentType: string | null | undefined): string {
  const data = toBytes(bytes);
  const decoder =
    decoderFor(CHARSET_IN_HEADER.exec(contentType ?? '')?.[1]) ??
    decoderFor(CHARSET_IN_META.exec(asciiPrefix(data))?.[1]) ??
    new TextDecoder('utf-8');
  return decoder.decode(data);
}
