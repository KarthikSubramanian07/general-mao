/**
 * Six-character table codes. Uses an unambiguous alphabet (no O/0, I/1) so codes
 * are easy to read aloud and type on a phone.
 */

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function makeTableCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += ALPHABET[(bytes[i] as number) % ALPHABET.length];
  }
  return code;
}

const CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;

export function isValidCode(code: string): boolean {
  return CODE_RE.test(code);
}

export function normalizeCode(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  return isValidCode(code) ? code : null;
}
