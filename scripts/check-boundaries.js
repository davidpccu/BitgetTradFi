import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

async function files(root) {
  const result = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) result.push(...await files(path)); else if (path.endsWith('.js')) result.push(path);
  }
  return result;
}

const violations = [];
for (const path of await files('src/public-ui')) {
  const source = await readFile(path, 'utf8');
  if (/from ['"]\.\.\/exchange\//.test(source) || /place[-_ ]?order/i.test(source)) violations.push(`${path}: public UI crosses trading boundary`);
}
for (const path of await files('src')) {
  const source = await readFile(path, 'utf8');
  if (/\/api\/(?:v\d+\/)?trade\/place-order/.test(source)) violations.push(`${path}: real order endpoint is forbidden in Phase 1`);
}
if (violations.length) { console.error(violations.join('\n')); process.exit(1); }
console.info('Architecture boundary check passed: public UI has no exchange import or order route; no real order endpoint exists.');
