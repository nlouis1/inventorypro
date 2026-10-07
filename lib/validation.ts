export class ValidationError extends Error {
  status = 400 as const;
  constructor(message: string) { super(message); this.name = 'ValidationError'; }
}

export function text(value: unknown, field: string, max = 200): string {
  const result = String(value ?? '').trim();
  if (result.length > max) throw new ValidationError(`${field} cannot exceed ${max} characters.`);
  return result;
}

export function requiredText(value: unknown, field: string, max = 200): string {
  const result = text(value, field, max);
  if (!result) throw new ValidationError(`${field} is required.`);
  return result;
}

export function email(value: unknown, field = 'Email'): string {
  const result = requiredText(value, field, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) throw new ValidationError(`${field} is invalid.`);
  return result;
}

export function password(value: unknown, field = 'Password'): string {
  const result = String(value ?? '');
  if (result.length < 8) throw new ValidationError(`${field} must be at least 8 characters.`);
  if (result.length > 128) throw new ValidationError(`${field} cannot exceed 128 characters.`);
  return result;
}

export function nonNegativeNumber(value: unknown, field: string): number {
  const n = typeof value === 'string' && value.trim() === '' ? NaN : Number(value);
  if (!Number.isFinite(n) || n < 0) throw new ValidationError(`${field} must be a valid non-negative number.`);
  return n;
}

export function positiveInteger(value: unknown, field: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new ValidationError(`${field} must be a positive whole number.`);
  return n;
}

export function dateOnly(value: unknown, field: string): string {
  const result = requiredText(value, field, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) throw new ValidationError(`${field} must use YYYY-MM-DD format.`);
  const d = new Date(`${result}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== result) throw new ValidationError(`${field} is invalid.`);
  return result;
}

export function phone(value: unknown, field = 'Phone'): string {
  const result = text(value, field, 25);
  if (result && !/^[0-9+() .-]{6,25}$/.test(result)) throw new ValidationError(`${field} is invalid.`);
  return result;
}

export function imageDataUrl(value: unknown, field: string, maxLength: number, formats: string): string {
  const result = text(value, field, maxLength);
  if (result && !new RegExp(`^data:image\\/(?:${formats});base64,[A-Za-z0-9+/=\\r\\n]+$`, 'i').test(result)) {
    throw new ValidationError(`${field} must be a valid base64 image.`);
  }
  return result;
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return await req.json() as T;
  } catch {
    throw new ValidationError('Request body must contain valid JSON.');
  }
}

export function validationError(error: unknown): boolean {
  return error instanceof ValidationError;
}
