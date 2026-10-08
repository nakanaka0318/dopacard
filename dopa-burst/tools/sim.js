// エンジン単体のヘッドレス・シミュレーション（AI同士を大量に対戦させて例外や無限ループを探す）
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const dir = path.join(__dirname, '..', 'js');
const ctx = { console, setTimeout, clearTimeout, Math, JSON, performance: { now: () => Date.now() } };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['util.js', 'cards.js', 'engine.js', 'ai.js', 'stages.js']) {
  vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
}
vm.runInContext(`
Time.headless = true;
async function aiGame(cfgA, cfgB) {
  B.view = null;
  const G = B.start({ player: cfgA, enemy: cfgB });
  let turns = 0;
  while (!G.over && turns < 80) {
    turns++;
    await B.act(async () => {
      await B.beginTurn(0); await AI.takeTurn(B, 0); await B.endTurn(0);
      await B.beginTurn(1); await AI.takeTurn(B, 1); await B.endTurn(1);
    });
  }
  return { winner: G.winner, rounds: G.round, over: G.over, s0: G.stats[0], s1: G.stats[1], hp: [G.P[0].hp, G.P[1].hp] };
}
globalThis.aiGame = aiGame;
`, ctx);

(async () => {
  const N = +process.argv[2] || 300;
  let errors = 0, stalls = 0;
  const wins = {}, games = {}, rounds = [];
  const origErr = console.error;
  console.error = (...a) => { errors++; if (errors < 8) origErr(...a); };
  const tribes = vm.runInContext('TRIBE_ORDER', ctx);
  let maxCombo = 0, maxTurn = 0;
  for (let i = 0; i < N; i++) {
    const ta = tribes[i % tribes.length], tb = tribes[Math.floor(i / tribes.length) % tribes.length];
    const lvl = i % 10;
    const a = { name: 'A', hp: 300, isAI: true, deck: ctx.makeDeck([ta], lvl, i * 7 + 1), ai: {} };
    const b = { name: 'B', hp: 300, isAI: true, deck: ctx.makeDeck([tb], lvl, i * 13 + 5), ai: {}, fever: true };
    const r = await ctx.aiGame(a, b);
    if (!r.over) stalls++;
    rounds.push(r.rounds);
    games[ta] = (games[ta] || 0) + 1; games[tb] = (games[tb] || 0) + 1;
    if (r.winner === 0) wins[ta] = (wins[ta] || 0) + 1;
    if (r.winner === 1) wins[tb] = (wins[tb] || 0) + 1;
    maxCombo = Math.max(maxCombo, r.s0.maxCombo, r.s1.maxCombo);
    maxTurn = Math.max(maxTurn, r.s0.maxTurnDamage, r.s1.maxTurnDamage);
  }
  rounds.sort((a, b) => a - b);
  console.log('games', N, 'errors', errors, 'stalls', stalls);
  console.log('rounds median', rounds[Math.floor(N / 2)], 'min', rounds[0], 'max', rounds[N - 1]);
  console.log('maxCombo', maxCombo, 'maxTurnDamage', maxTurn);
  for (const t of tribes) console.log(t.padEnd(8), 'winrate', ((wins[t] || 0) / (games[t] || 1) * 100).toFixed(0) + '%');
  // ステージの敵デッキ確認
  for (const id of ['1-1', '2-4', '5-4']) console.log(id, ctx.stageConfig(id).deck.join(','));
})();
