const SCALE_DIGITS = 12;
const SCALE = 10n ** BigInt(SCALE_DIGITS);

export function parseDecimal(value) {
  const raw = String(value).trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(raw)) throw new Error(`Invalid decimal: ${raw}`);
  const negative = raw.startsWith('-');
  const unsigned = negative ? raw.slice(1) : raw;
  const [whole, fraction = ''] = unsigned.split('.');
  if (fraction.length > SCALE_DIGITS && /[1-9]/.test(fraction.slice(SCALE_DIGITS))) {
    throw new Error(`Decimal exceeds ${SCALE_DIGITS} places: ${raw}`);
  }
  const atoms = BigInt(whole) * SCALE + BigInt((fraction.slice(0, SCALE_DIGITS) + '0'.repeat(SCALE_DIGITS)).slice(0, SCALE_DIGITS));
  return negative ? -atoms : atoms;
}

export function formatDecimal(atoms) {
  const negative = atoms < 0n;
  const absolute = negative ? -atoms : atoms;
  const whole = absolute / SCALE;
  const fraction = String(absolute % SCALE).padStart(SCALE_DIGITS, '0').replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`;
}

export function multiply(a, b) { return (a * b) / SCALE; }
export function absolute(a) { return a < 0n ? -a : a; }
export function floorToStepTowardZero(value, step) {
  if (step <= 0n) throw new Error('step must be positive');
  return (value / step) * step;
}
export function decimalScale() { return SCALE; }
