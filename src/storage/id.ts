/**
 * Random identifier (32 hex chars). crypto.getRandomValues, not crypto.randomUUID: the app is opened over plain
 * http in the office network, where randomUUID (secure contexts only) is missing.
 */
export function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
