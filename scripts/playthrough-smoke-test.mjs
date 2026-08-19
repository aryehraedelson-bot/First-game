import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const listeners = new Map();
const context = {
  console,
  performance: { now: () => 0 },
  requestAnimationFrame: () => 1,
  addEventListener(type, handler) { listeners.set(type, handler); },
  document: {
    querySelector(selector) {
      if (selector !== '#game') throw new Error(`Unexpected selector: ${selector}`);
      return {
        width: 960,
        height: 540,
        getContext() { return drawingContext; }
      };
    }
  }
};
const gradient = { addColorStop() {} };
const drawingContext = new Proxy({ createLinearGradient: () => gradient }, {
  get(target, prop) {
    if (prop in target) return target[prop];
    return () => {};
  },
  set(target, prop, value) { target[prop] = value; return true; }
});
vm.createContext(context);
const source = `${readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')}\n` +
  `globalThis.__game = { world, player, enemies, boss, objects, sanctuaries, keys, justPressed, update, draw };`;
vm.runInContext(source, context, { filename: 'src/main.js' });
const game = context.__game;

const tap = key => game.justPressed.add(key);
const hold = key => game.keys.add(key);
const release = key => game.keys.delete(key);
const step = (frames = 1) => { for (let i = 0; i < frames; i++) { game.update(1); game.draw(); game.justPressed.clear(); } };
const moveTo = x => { game.player.x = x; step(2); };
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const attackUntilDefeated = target => {
  let guard = 0;
  while ((target.alive ?? !target.defeated) && guard++ < 30) { tap('j'); step(13); }
  assert(!(target.alive ?? !target.defeated), `${target.name} was not defeated by staff attacks`);
};

assert(game.world.phase === 'training', 'Fresh game did not start in training');
hold('d'); step(24); release('d'); assert(game.player.x > 90, 'Kai movement failed');
tap(' '); step(4); assert(game.player.y < game.world.ground - game.player.h, 'Kai jump failed');
step(40); assert(game.player.grounded, 'Kai did not land after jump');
tap('k'); step(1); assert(game.player.dodge > 0, 'Kai dodge/step failed');
moveTo(515); attackUntilDefeated(game.enemies[0]);
moveTo(625); attackUntilDefeated(game.enemies[1]);
assert(game.world.phase === 'sanctuary', 'Village attack did not progress after initial enemies');
moveTo(1040); tap('e'); step(2); assert(game.sanctuaries[0].restored, 'Sanctuary interaction failed');
assert(game.world.phase === 'explore', 'Sanctuary did not advance to exploration');
moveTo(1285); step(2); assert(game.player.x < 1320, 'Closed gate failed to block Kai');
tap('e'); step(2); assert(game.objects.find(o => o.type === 'gate').open, 'Gate interaction failed');
moveTo(1660); tap('e'); step(2); assert(game.objects[3].rescued, 'Exploration villager interaction failed');
moveTo(2665); step(2); assert(game.boss.active && game.world.phase === 'boss', 'Fire Beast did not spawn in arena');
assert(!game.player.lightning, 'Lightning unlocked before boss defeat');
moveTo(game.boss.x - 60); attackUntilDefeated(game.boss);
assert(game.objects.find(o => o.type === 'relic').active, 'Lightning Relic did not appear after Fire Beast defeat');
moveTo(3160); tap('e'); step(2); assert(game.player.lightning, 'Lightning Power did not unlock');
assert(game.world.objective === 'Test Lightning Power', 'HUD objective did not update after relic pickup');
tap('l'); step(1); const cooldownAfterTap = game.player.lightningCd; assert(cooldownAfterTap > 0, 'Lightning Strike did not fire');
hold('l'); step(10); release('l'); assert(game.player.lightningCd < cooldownAfterTap, 'Lightning cooldown failed to tick down');
moveTo(3290); step(2); assert(game.world.message.includes('Prototype complete'), 'Final objective did not complete');
console.log('Scripted first-level playthrough passed.');
