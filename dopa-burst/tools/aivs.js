// 先読みAI と 先読みなしAI を同じデッキで戦わせて強さを比べる
const fs = require('fs'), vm = require('vm'), path = require('path');
const dir = path.join(__dirname, '..', 'js');
const ctx = { console, setTimeout, clearTimeout, Math, JSON, performance: { now: () => Date.now() } };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['util.js', 'cards.js', 'engine.js', 'ai.js', 'stages.js']) vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
vm.runInContext(`
Time.headless = true;
globalThis.duel = async function (deckA, deckB, aiA, aiB) {
  B.view = null;
  const G = B.start({ player: { name: 'A', hp: 300, deck: deckA, ai: aiA, fever: true }, enemy: { name: 'B', hp: 300, deck: deckB, ai: aiB, fever: true } });
  let t = 0;
  while (!G.over && t++ < 40) {
    await B.act(async () => {
      await B.beginTurn(0); await AI.takeTurn(B, 0); await B.endTurn(0);
      await B.beginTurn(1); await AI.takeTurn(B, 1); await B.endTurn(1);
    });
  }
  return G.winner;
};
`, ctx);
(async () => {
  const N = +process.argv[2] || 60;
  const depth = +(process.argv[3] || 3);
  if (process.argv[4]) vm.runInContext(`Object.assign(AI.W, ${process.argv[4]})`, ctx);
  const tribes = vm.runInContext('TRIBE_ORDER', ctx);
  let deepWins = 0, games = 0;
  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    const tr = [tribes[i % tribes.length], tribes[(i * 5 + 3) % tribes.length]];
    const deck1 = ctx.makeDeck(tr, 5, i * 31 + 7), deck2 = ctx.makeDeck([tribes[(i + 4) % tribes.length]], 5, i * 17 + 3);
    // 先手後手と使うデッキを入れ替えて公平に
    const deepFirst = i % 2 === 0;
    const swap = Math.floor(i / 2) % 2 === 0;
    const dA = swap ? deck1 : deck2, dB = swap ? deck2 : deck1;
    const w = await ctx.duel(dA, dB, deepFirst ? { depth } : { depth: 0 }, deepFirst ? { depth: 0 } : { depth });
    if (w == null) continue;
    games++;
    if ((w === 0) === deepFirst) deepWins++;
  }
  console.log(`depth ${depth} vs greedy: deep won ${deepWins}/${games} (${Math.round(deepWins / games * 100)}%), ${((Date.now() - t0) / games / 1000).toFixed(2)}s/game`);
})();
