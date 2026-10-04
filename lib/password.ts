import crypto from 'node:crypto';

const PREFIX = 'scrypt$1$';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64);
  return `${PREFIX}${salt}$${derived.toString('hex')}`;
}

export function verifyScryptPassword(password: string, encoded: string): boolean {
  if (!encoded.startsWith(PREFIX)) return false;
  const parts = encoded.split('$');
  if (parts.length !== 4) return false;
  const [, , salt, expectedHex] = parts;
  try {
    const actual = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHex, 'hex');
    return expected.length === actual.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
