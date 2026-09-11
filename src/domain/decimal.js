// Fixed-point decimal helpers keep trading quantities out of JavaScript Number arithmetic.
export function parseDecimal(value) {
  const text = String(value);
  if (!/^-?\d+(?:\.\d+)?$/.test(text)) throw new Error(`invalid decimal: ${text}`);
  const negative = text.startsWith('-');
  const [whole, fraction = ''] = (negative ? text.slice(1) : text).split('.');
  return { units: BigInt(`${negative ? '-' : ''}${whole}${fraction}`), scale: fraction.length };
}
export function formatDecimal({ units, scale }) {
  const negative = units < 0n;
  let digits = (negative ? -units : units).toString().padStart(scale + 1, '0');
  const value = scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}`.replace(/\.0+$|(?<=\.[0-9]*)0+$/g, '') : digits;
  return `${negative ? '-' : ''}${value}`;
}
export function add(a, b) { return binary(a, b, (x, y) => x + y); }
export function subtract(a, b) { return binary(a, b, (x, y) => x - y); }
export function negate(a) { const x = parseDecimal(a); return formatDecimal({ ...x, units: -x.units }); }
export function multiply(a, b) { const x = parseDecimal(a), y = parseDecimal(b); return formatDecimal({ units: x.units * y.units, scale: x.scale + y.scale }); }
export function abs(a) { const x = parseDecimal(a); return formatDecimal({ ...x, units: x.units < 0n ? -x.units : x.units }); }
export function compare(a, b) { const [x, y] = align(parseDecimal(a), parseDecimal(b)); return x.units < y.units ? -1 : x.units > y.units ? 1 : 0; }
export function floorToStep(value, step) {
  const x = parseDecimal(value), s = parseDecimal(step); const scale = Math.max(x.scale, s.scale);
  const xu = x.units * 10n ** BigInt(scale - x.scale), su = s.units * 10n ** BigInt(scale - s.scale);
  return formatDecimal({ units: (xu / su) * su, scale });
}
function binary(a, b, operation) { const [x, y] = align(parseDecimal(a), parseDecimal(b)); return formatDecimal({ units: operation(x.units, y.units), scale: x.scale }); }
function align(a, b) { const scale = Math.max(a.scale, b.scale); return [{ units: a.units * 10n ** BigInt(scale - a.scale), scale }, { units: b.units * 10n ** BigInt(scale - b.scale), scale }]; }
