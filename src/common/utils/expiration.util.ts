/**
 * Convierte un string de expiración tipo "8h", "30m", "7d" a segundos.
 * Devuelve 8h por defecto si el formato no es reconocido.
 * Se usa en los signOptions del JWT (el tipo exige number | StringValue).
 */
export function expirationToSeconds(expiration?: string): number {
  const value = (expiration ?? '8h').trim();
  const match = /^(\d+)([smhd])$/.exec(value);
  if (!match) return 8 * 3600;
  const amount = parseInt(match[1], 10);
  const unit = { s: 1, m: 60, h: 3600, d: 86400 }[
    match[2] as 's' | 'm' | 'h' | 'd'
  ];
  return amount * unit;
}
