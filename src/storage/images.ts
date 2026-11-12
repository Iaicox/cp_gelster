/**
 * Image bytes in IndexedDB (database `gelster-kp-images`, key = image URL). The KP page and the export read
 * images from here first and only then from the network (docs/spec.md, section 5).
 * Bytes are stored as { type, bytes: ArrayBuffer } rather than Blob: plain data clones everywhere.
 */
import { clear, createStore, del, get, getMany, set, keys, setMany, type UseStore } from 'idb-keyval';

type StoredImage = { type: string; bytes: ArrayBuffer };

let store: UseStore | null = null;
function imagesStore(): UseStore {
  store ??= createStore('gelster-kp-images', 'images');
  return store;
}

/**
 * Key of a manager's signature. Project keeps only managerId and managerName, so a signature is stored under
 * the manager id: it must stay findable after the manager is removed from the list.
 */
export function signatureKey(managerId: string): string {
  return `signature:${managerId}`;
}

function isStored(value: unknown): value is StoredImage {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as StoredImage).type === 'string' &&
    // Not instanceof: the buffer may come from another realm (structured clone in tests, other window).
    Object.prototype.toString.call((value as StoredImage).bytes) === '[object ArrayBuffer]'
  );
}

export async function saveImage(key: string, blob: Blob): Promise<void> {
  const record: StoredImage = { type: blob.type || 'application/octet-stream', bytes: await blob.arrayBuffer() };
  await set(key, record, imagesStore());
}

export async function getImage(key: string): Promise<Blob | null> {
  const value = await get<unknown>(key, imagesStore());
  return isStored(value) ? new Blob([value.bytes], { type: value.type }) : null;
}

export async function hasImage(key: string): Promise<boolean> {
  return isStored(await get<unknown>(key, imagesStore()));
}

export async function deleteImage(key: string): Promise<void> {
  await del(key, imagesStore());
}

export async function clearImages(): Promise<void> {
  await clear(imagesStore());
}

export async function listImageKeys(): Promise<string[]> {
  return keys<string>(imagesStore());
}

/* ---- data: URLs (export file) ---- */

/** Images by key as data: URLs; missing keys are left out. */
export async function getImagesAsDataUrls(wanted: readonly string[]): Promise<Record<string, string>> {
  const unique = [...new Set(wanted)];
  const found = await getMany<unknown>(unique, imagesStore());
  const result: Record<string, string> = {};
  unique.forEach((key, i) => {
    const value = found[i];
    if (isStored(value)) result[key] = toDataUrl(value);
  });
  return result;
}

/** Stores already decoded images in one transaction. */
export async function putImages(images: ReadonlyArray<[string, StoredImage]>): Promise<void> {
  if (images.length > 0) await setMany(images as [string, StoredImage][], imagesStore());
}

export function toDataUrl({ type, bytes }: StoredImage): string {
  const view = new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < view.length; i += 0x8000) {
    binary += String.fromCharCode(...view.subarray(i, i + 0x8000));
  }
  return `data:${type};base64,${btoa(binary)}`;
}

/** Decodes a base64 data: URL; null when it is not one. */
export function fromDataUrl(url: string): StoredImage | null {
  const match = /^data:([^;,]*)(?:;[^,]*)?;base64,([A-Za-z0-9+/=\s]*)$/.exec(url);
  if (!match) return null;
  let binary: string;
  try {
    binary = atob((match[2] ?? '').replace(/\s+/g, ''));
  } catch {
    return null;
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { type: match[1] || 'application/octet-stream', bytes: bytes.buffer };
}

export type { StoredImage };
