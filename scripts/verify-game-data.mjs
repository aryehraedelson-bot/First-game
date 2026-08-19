import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
for (const required of ['Kai', 'Fire Beast', 'Lightning Relic', 'Sanctuary', 'Lightning Strike']) {
  if (!source.includes(required)) throw new Error(`Missing required game concept: ${required}`);
}
console.log('Game data verification passed.');
