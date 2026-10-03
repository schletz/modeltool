import type { Id } from './model/common';

/**
 * Creates a new random id. Uses `crypto.getRandomValues`, which (unlike
 * `crypto.randomUUID`) is also available in non-secure contexts such as file://.
 */
export function newId(): Id {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
