/**
 * constantTimeEqual — compare two strings in constant time to prevent
 * timing oracle attacks on secrets (e.g. tokens, HMAC digests).
 *
 * Uses XOR accumulation so every character is always visited regardless
 * of where the first difference occurs.  Strings of unequal length return
 * false immediately (the lengths themselves are not secret).
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
