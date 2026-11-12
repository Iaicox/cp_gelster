/**
 * Images of a KP as object URLs with known sizes. Bytes come from the image store first and from the network
 * second (docs/spec.md, section 5); whatever was downloaded is put into the store.
 * Sizes are needed before the pages are measured: the main photo gets width/height attributes, so the text
 * that flows around it has its final height without waiting for the <img> to load.
 */
import { fetchImage, fetchSignature } from '../api/client.ts';
import { getImage, saveImage, signatureKey } from '../storage/images.ts';
import type { KpDocument } from './model.ts';

export type KpImage = { src: string; width: number; height: number };

export type KpAssets = {
  /** By the image URL used in the document; an image that could not be loaded is absent. */
  images: Record<string, KpImage>;
  /** The strip at the bottom of every page: the manager's signature or the common footer.jpg. */
  signature: KpImage;
  /** False when the common footer stands in for the signature. */
  hasSignature: boolean;
};

const COMMON_FOOTER = 'footer.jpg';

export type LoadedAssets = { assets: KpAssets; warnings: string[]; /** Frees the object URLs. */ release: () => void };

/** Image URLs of the document, without duplicates. */
export function imageUrlsOf(doc: KpDocument): string[] {
  const urls = new Set<string>();
  for (const block of doc.blocks) {
    if (block.type === 'mainImage') urls.add(block.src);
    if (block.type === 'articleRow') for (const article of block.articles) urls.add(article.image);
  }
  return [...urls];
}

async function storedOrFetched(key: string, download: () => Promise<Blob>): Promise<Blob> {
  const stored = await getImage(key);
  if (stored) return stored;
  const blob = await download();
  await saveImage(key, blob).catch(() => undefined); // a full store must not hide the picture
  return blob;
}

async function measure(src: string): Promise<{ width: number; height: number }> {
  const image = new Image();
  image.src = src;
  await image.decode();
  return { width: image.naturalWidth, height: image.naturalHeight };
}

export async function loadKpAssets(doc: KpDocument): Promise<LoadedAssets> {
  const created: string[] = [];
  const warnings: string[] = [];
  const images: Record<string, KpImage> = {};

  const toUrl = (blob: Blob) => {
    const src = URL.createObjectURL(blob);
    created.push(src);
    return src;
  };

  await Promise.all(
    imageUrlsOf(doc).map(async (url) => {
      try {
        const src = toUrl(await storedOrFetched(url, () => fetchImage(url)));
        images[url] = { src, ...(await measure(src)) };
      } catch {
        warnings.push(`Картинка не загрузилась: ${url}`);
      }
    }),
  );

  let signature: KpImage | null = null;
  const { managerId, url } = doc.signature;
  if (managerId !== null) {
    try {
      const stored = await getImage(signatureKey(managerId));
      const blob = stored ?? (url === null ? null : await storedOrFetched(signatureKey(managerId), () => fetchSignature(url)));
      if (blob) {
        const src = toUrl(blob);
        signature = { src, ...(await measure(src)) };
      }
    } catch {
      // reported below
    }
    if (signature === null) warnings.push('Подпись менеджера не найдена: на страницах общий подвал без подписи.');
  }

  const hasSignature = signature !== null;
  // Size unknown (0 × 0) when even the common footer fails to load: the page keeps the default strip height.
  signature ??= { src: COMMON_FOOTER, ...(await measure(COMMON_FOOTER).catch(() => ({ width: 0, height: 0 }))) };

  return {
    assets: { images, signature, hasSignature },
    warnings: warnings.sort(),
    release: () => created.forEach((src) => URL.revokeObjectURL(src)),
  };
}
