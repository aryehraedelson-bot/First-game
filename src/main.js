const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');

const keys = new Set();
const justPressed = new Set();
addEventListener('keydown', e => {
  const key = e.key.toLowerCase();
  if (!keys.has(key)) justPressed.add(key);
  keys.add(key);
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) e.preventDefault();
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
const pressed = k => keys.has(k);
const tapped = (...codes) => codes.some(code => justPressed.has(code));

const relicCatalog = ['Fire', 'Water', 'Earth', 'Ice', 'Lightning', 'Magic', 'Dark Power', 'Spirit Power', 'Dragon Power'];
const heroCollection = [{ id: 'ember_guardian', name: 'Ember Guardian', rescued: false, benefit: 'Future sanctuary ally data entry.' }];
const sanctuaries = [{ id: 'village', name: 'Village Sanctuary', restored: false, note: 'Future hub for heroes, relics, upgrades, and area access.' }];

const CONTROLS = 'Move: A/D or ←/→  •  Jump: W/Space/↑  •  Staff: J  •  Step: K  •  Interact: E';
const world = { width: 3600, ground: 430, gravity: 0.72, camera: 0, phase: 'training', message: 'Elder Hero: Move with A/D, jump with Space, strike with J, and evade with K.', objective: 'Training: try movement, jump, staff strike, and step', timer: 0, tip: 'Reach the village when you are ready.' };
const player = { name: 'Kai', age: 15, species: 'Golden Dragon', x: 90, y: 330, w: 34, h: 58, vx: 0, vy: 0, hp: 100, maxHp: 100, facing: 1, grounded: false, coyote: 0, jumpBuffer: 0, attacking: 0, combo: 0, comboWindow: 0, dodge: 0, invincible: 0, lightning: false, lightningCd: 0, rescued: 0 };
const elder = { x: 190, y: world.ground - 76, text: 'Control, Kai. Do not force the hidden Dragon Form.' };
const objects = [
  { type: 'villager', x: 740, y: world.ground - 44, rescued: false, text: 'Thank you! A scout chased me from the Sanctuary path.', prompt: 'Press E to rescue villager' },
  { type: 'sanctuary', x: 1040, y: world.ground - 92, used: false, text: 'The Sanctuary hums: the village path is safe, and the ridge gate can be opened.', prompt: 'Press E to restore Sanctuary' },
  { type: 'gate', x: 1320, y: world.ground - 80, open: false, text: 'The bamboo gate lifts. Continue right toward the Lightning Relic.', prompt: 'Press E to lift gate' },
  { type: 'villager', x: 1660, y: world.ground - 44, rescued: false, text: 'The Lightning Relic is beyond the ridge. When the Fire Beast glows, step away with K!', prompt: 'Press E to help scout' },
  { type: 'relic', x: 3160, y: world.ground - 70, active: false, taken: false, text: 'Lightning Relic absorbed. Press L to use Lightning Strike!', prompt: 'Press E to absorb relic' }
];
const enemies = [
  makeEnemy(540, 'Raider'), makeEnemy(650, 'Raider'), makeEnemy(1480, 'Raider'), makeEnemy(1880, 'Raider')
];
const boss = { name: 'Fire Beast', x: 2920, y: world.ground - 96, w: 108, h: 96, hp: 180, maxHp: 180, active: false, defeated: false, vx: -1.2, windup: 0, hurt: 0, roarHit: false };
function makeEnemy(x, name) { return { name, x, y: world.ground - 50, w: 36, h: 50, hp: 45, maxHp: 45, vx: 0, attack: 0, hurt: 0, alive: true }; }

let last = performance.now();
requestAnimationFrame(loop);
function loop(now) { const dt = Math.min(2, (now - last) / 16.67); last = now; update(dt); draw(); justPressed.clear(); requestAnimationFrame(loop); }

function update(dt) {
  world.timer += dt; player.lightningCd = Math.max(0, player.lightningCd - dt); player.comboWindow = Math.max(0, player.comboWindow - dt); player.attacking = Math.max(0, player.attacking - dt); player.dodge = Math.max(0, player.dodge - dt); player.invincible = Math.max(0, player.invincible - dt); player.jumpBuffer = Math.max(0, player.jumpBuffer - dt);
  player.coyote = player.grounded ? 7 : Math.max(0, player.coyote - dt);
  const left = pressed('a') || pressed('arrowleft'), right = pressed('d') || pressed('arrowright');
  if (left || right) { player.facing = right ? 1 : -1; player.vx += player.facing * (player.dodge ? 0.9 : 0.55) * dt; }
  if (tapped('w', ' ', 'arrowup')) player.jumpBuffer = 7;
  if (player.jumpBuffer > 0 && (player.grounded || player.coyote > 0)) startJump();
  if (tapped('k') && !player.dodge) { player.dodge = 18; player.invincible = Math.max(player.invincible, 12); player.vx = player.facing * 9; }
  if (tapped('j') && player.attacking <= 0) staffAttack();
  if (tapped('l') && player.lightning && player.lightningCd <= 0) lightningStrike();
  player.vy += world.gravity * dt; player.x += player.vx * dt; player.y += player.vy * dt; player.vx *= 0.82;
  if (player.y + player.h >= world.ground) { player.y = world.ground - player.h; player.vy = 0; player.grounded = true; player.coyote = 7; }
  const gate = objects.find(o => o.type === 'gate');
  if (gate && !gate.open && player.x + player.w > gate.x - 8 && player.x < gate.x + 38) {
    player.x = player.facing > 0 ? gate.x - player.w - 8 : gate.x + 38;
    player.vx = 0;
    world.message = sanctuaries[0].restored ? 'The path is blocked by bamboo. Press E beside the gate to lift it.' : 'Restore the Sanctuary first, then return to this gate.';
  }
  if (world.phase !== 'boss' && !sanctuaries[0].restored && player.x > 1210) {
    player.x = 1210;
    world.message = 'Elder Hero: Restore the Sanctuary before taking the relic path.';
  }
  player.x = Math.max(20, Math.min(world.width - 80, player.x));
  handleInteractions(); updateEnemies(dt); updateBoss(dt); updateStory(); world.camera = Math.max(0, Math.min(world.width - canvas.width, player.x - 360));
}
function startJump() { player.vy = -13; player.grounded = false; player.coyote = 0; player.jumpBuffer = 0; }
function staffAttack() { player.attacking = 12; player.combo = player.comboWindow > 0 ? Math.min(3, player.combo + 1) : 1; player.comboWindow = 28; hitThings(48 + player.combo * 12, 18 + player.combo * 7); }
function lightningStrike() { player.attacking = 18; player.lightningCd = 90; hitThings(115, 75); world.message = 'Kai channels Lightning Strike through the Golden Bo Staff!'; }
function hitThings(range, dmg) { const ax = player.x + player.w / 2 + player.facing * range / 2; for (const e of enemies) if (e.alive && overlap(ax - range / 2, player.y, range, player.h, e.x, e.y, e.w, e.h)) { e.hp = Math.max(0, e.hp - dmg); e.hurt = 8; e.vx = player.facing * 2.1; if (e.hp <= 0) { e.alive = false; e.vx = 0; } } if (boss.active && !boss.defeated && overlap(ax - range / 2, player.y, range, player.h, boss.x, boss.y, boss.w, boss.h)) { boss.hp = Math.max(0, boss.hp - dmg); boss.hurt = 10; if (boss.hp <= 0) { boss.defeated = true; boss.active = false; objects.find(o => o.type === 'relic').active = true; world.objective = 'Absorb the Lightning Relic'; world.message = 'The Fire Beast falls. The Lightning Relic remains behind.'; } } }
function updateEnemies(dt) { for (const e of enemies) { if (!e.alive) continue; e.hurt = Math.max(0, e.hurt - dt); e.attack = Math.max(0, e.attack - dt); const dist = player.x - e.x; if (Math.abs(dist) < 260) { e.vx = Math.sign(dist) * 1.25; if (Math.abs(dist) < 42 && e.attack <= 0) { damagePlayer(6); e.attack = 50; } } else { e.vx *= 0.75; } e.x += e.vx * dt; } }
function updateBoss(dt) { if (!boss.active || boss.defeated) return; boss.hurt = Math.max(0, boss.hurt - dt); const dist = player.x - boss.x; boss.vx = Math.sign(dist) * (Math.abs(dist) > 130 ? 1.45 : 0); boss.windup -= dt; if (boss.windup <= 0) { boss.windup = 95; boss.roarHit = false; } if (boss.windup < 18 && !boss.roarHit && Math.abs(dist) < 150) { damagePlayer(16, 42); boss.roarHit = true; } boss.x += boss.vx * dt; }
function handleInteractions() { if (!tapped('e')) return; for (const o of objects) if (Math.abs(player.x - o.x) < 72) { if (o.type === 'villager' && !o.rescued) { o.rescued = true; player.rescued++; heroCollection[0].rescued = true; world.message = o.text; } if (o.type === 'sanctuary' && !o.used) { o.used = true; sanctuaries[0].restored = true; world.message = o.text; } if (o.type === 'gate' && !o.open) { o.open = true; world.message = o.text; } if (o.type === 'relic' && o.active && !o.taken) { o.taken = true; player.lightning = true; world.phase = 'lightning'; world.objective = 'Test Lightning Power'; world.message = o.text; } } }
function updateStory() { if (world.phase === 'training' && (player.x > 300 || world.timer > 420)) { world.phase = 'village'; world.objective = 'Protect the Village'; world.message = 'Fuji Kaze\'s raiders attack, searching for a special Relic!'; } if (world.phase === 'village' && enemies.slice(0,2).every(e => !e.alive)) { world.phase = 'sanctuary'; world.objective = 'Visit the Sanctuary'; world.message = 'Elder Hero: The Lightning Relic is hidden beyond the village path.'; } if (world.phase === 'sanctuary' && sanctuaries[0].restored) { world.phase = 'explore'; world.objective = 'Open the bamboo gate'; world.message = 'Elder Hero: Press E at the bamboo gate, then follow the ridge right.'; } if (world.phase === 'explore' && objects.find(o => o.type === 'gate').open && player.x < 2600) world.objective = 'Find the Lightning Relic'; if (world.phase === 'explore' && !boss.active && !boss.defeated && player.x > 2660) { boss.active = true; world.phase = 'boss'; world.objective = 'Defeat the Fire Beast'; world.message = 'Fire Beast: Fuji Kaze will claim the Lightning Relic!'; } if (world.phase === 'lightning' && player.x > 3280) { world.objective = 'Level complete'; world.message = 'Prototype complete: Kai begins the larger journey against Fuji Kaze.'; } if (player.hp <= 0) { player.hp = player.maxHp; player.x = 120; player.y = world.ground - player.h; player.vx = 0; player.vy = 0; player.coyote = 0; player.jumpBuffer = 0; player.invincible = 90; world.message = 'Kai catches his breath and returns to the village training ground.'; } }
function damagePlayer(amount, invincibleFrames = 40) { if (player.dodge || player.invincible > 0) return; player.hp = Math.max(0, player.hp - amount); player.invincible = invincibleFrames; }
function overlap(a,b,c,d,e,f,g,h){return a<e+g&&a+c>e&&b<f+h&&b+d>f;}

function draw() { ctx.clearRect(0,0,canvas.width,canvas.height); ctx.save(); ctx.translate(-world.camera,0); drawWorld(); drawActors(); ctx.restore(); drawHud(); }
function drawWorld() { const grd = ctx.createLinearGradient(0,0,0,world.ground); grd.addColorStop(0,'#263d65'); grd.addColorStop(1,'#5a7048'); ctx.fillStyle=grd; ctx.fillRect(world.camera,0,canvas.width,world.ground); ctx.fillStyle='#31451f'; ctx.fillRect(0,world.ground,world.width,140); for (let x=0;x<world.width;x+=260){ ctx.fillStyle='#26391d'; ctx.fillRect(x,390,90,40); } ctx.fillStyle='#8c5a2e'; ctx.fillRect(1320, objects[2].open?420:350, 30, objects[2].open?10:80); ctx.fillStyle='#68a7ff'; ctx.fillRect(1000,338,100,92); ctx.fillStyle='#d9c173'; ctx.fillText('Sanctuary',1015,330); ctx.fillStyle='#f5dc58'; if (objects[4].active && !objects[4].taken) { ctx.beginPath(); ctx.arc(objects[4].x, objects[4].y, 22, 0, 7); ctx.fill(); } }
function drawActors() { drawKai(); drawNpc(elder.x, elder.y, '#b9d7ff', 'Elder Hero'); for (const o of objects) { if (o.type==='villager' && !o.rescued) drawNpc(o.x,o.y,'#efcf9a','Villager'); } for (const e of enemies) if (e.alive) drawEnemy(e); if (boss.active || boss.defeated) drawBoss(); }
function drawKai(){ ctx.globalAlpha=player.invincible > 0 && Math.floor(player.invincible / 4) % 2 ? 0.55 : 1; ctx.fillStyle='#d4a11e'; ctx.fillRect(player.x,player.y,player.w,player.h); ctx.fillStyle='#ffe28a'; ctx.fillRect(player.x+7,player.y-8,20,12); ctx.fillStyle='#f7d34d'; ctx.fillRect(player.x-3,player.y+16,player.w+6,30); ctx.strokeStyle=player.lightning?'#8ff3ff':'#e7bf49'; ctx.lineWidth=5; ctx.beginPath(); ctx.moveTo(player.x+17,player.y+28); ctx.lineTo(player.x+17+player.facing*(player.attacking?78:46),player.y+18); ctx.stroke(); if(player.lightningCd>70){ctx.strokeStyle='#9cf';ctx.lineWidth=3;ctx.strokeRect(player.x-12,player.y-12,player.w+24,player.h+24);} ctx.globalAlpha=1; }
function drawNpc(x,y,color,label){ ctx.fillStyle=color; ctx.fillRect(x,y,30,44); ctx.fillStyle='#fff'; ctx.fillText(label,x-16,y-8); }
function drawEnemy(e){ ctx.fillStyle=e.hurt?'#fff':'#39414d'; ctx.fillRect(e.x,e.y,e.w,e.h); ctx.fillStyle='#b44'; ctx.fillRect(e.x,e.y-10,e.w,5); ctx.fillStyle='#3ee070'; ctx.fillRect(e.x,e.y-10,e.w*(e.hp/e.maxHp),5); if (Math.abs(player.x - e.x) < 70 && e.attack <= 8) { ctx.fillStyle='#ffd45a'; ctx.fillText('!',e.x+14,e.y-18); } }
function drawBoss(){ const roaring = boss.active && boss.windup < 28; ctx.fillStyle=boss.defeated?'#49362d':(boss.hurt?'#ffd4b0':(roaring?'#ff7a28':'#b83d20')); ctx.fillRect(boss.x,boss.y,boss.w,boss.h); ctx.fillStyle=roaring?'#ffe66d':'#ffb13b'; ctx.fillRect(boss.x+20,boss.y-18,68,22); ctx.fillStyle='#fff'; ctx.fillText(roaring?'ROAR - step back!':'Fire Beast',boss.x+4,boss.y-24); ctx.fillStyle='#300'; ctx.fillRect(boss.x,boss.y-12,boss.w,6); ctx.fillStyle='#f35'; ctx.fillRect(boss.x,boss.y-12,boss.w*(boss.hp/boss.maxHp),6); }
function drawPrompt(){ const nearby = objects.find(o => !o.rescued && !o.used && !o.open && !o.taken && Math.abs(player.x - o.x) < 86 && (o.type !== 'relic' || o.active)); if (!nearby) return; ctx.fillStyle='#111d'; ctx.fillRect(300,418,360,34); ctx.strokeStyle='#f8e7a1'; ctx.strokeRect(300,418,360,34); ctx.fillStyle='#fff'; ctx.fillText(nearby.prompt,318,440); }
function drawHud(){ drawPrompt(); ctx.fillStyle='#111a'; ctx.fillRect(14,14,460,136); ctx.fillStyle='#7a0f22'; ctx.fillRect(30,30,180,18); ctx.fillStyle='#31d067'; ctx.fillRect(30,30,180*Math.max(0, player.hp/player.maxHp),18); ctx.strokeStyle='#fff'; ctx.strokeRect(30,30,180,18); ctx.fillStyle='#f8e7a1'; ctx.font='16px system-ui'; ctx.fillText(`Kai - Golden Dragon, Golden Bo Staff`,30,70); ctx.fillText(`Power: ${player.lightning?'Lightning Relic / Lightning Strike':'None (Dragon Form locked)'}`,30,94); ctx.fillText(`Objective: ${world.objective}`,30,118); ctx.fillStyle='#cfe7ff'; ctx.fillText(CONTROLS,30,142); ctx.fillStyle='#111b'; ctx.fillRect(180,466,640,54); ctx.fillStyle='#fff'; wrapText(world.message,196,492,600,20); if (boss.active && !boss.defeated) { ctx.fillStyle='#300'; ctx.fillRect(270,20,420,16); ctx.fillStyle='#f35'; ctx.fillRect(270,20,420*(boss.hp/boss.maxHp),16); ctx.strokeStyle='#fff'; ctx.strokeRect(270,20,420,16); ctx.fillStyle='#fff'; ctx.fillText('Fire Beast',440,52); } }
function wrapText(text,x,y,maxWidth,lineHeight){ const words = text.split(' '); let line = ''; for (const word of words) { const test = line ? `${line} ${word}` : word; if (ctx.measureText(test).width > maxWidth && line) { ctx.fillText(line,x,y); line = word; y += lineHeight; } else line = test; } ctx.fillText(line,x,y); }
