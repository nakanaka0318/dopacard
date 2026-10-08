// ステージ難易度の確認：プレイヤー側もAIで操作し、各ステージの勝率を見る
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const dir = path.join(__dirname, '..', 'js');
const ctx = { console, setTimeout, clearTimeout, Math, JSON, performance: { now: () => Date.now() } };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['util.js', 'cards.js', 'engine.js', 'ai.js', 'stages.js']) vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
vm.runInContext(`
Time.headless = true;
globalThis.play = async function (pDeck, stageId, mistake) {
  B.view = null;
  const G = B.start({ player: { name: 'P', hp: 300, deck: pDeck, ai: { mistake, depth: 1 }, fever: true }, enemy: stageConfig(stageId) });
  let t = 0;
  while (!G.over && t++ < 60) {
    await B.act(async () => {
      await B.beginTurn(0); await AI.takeTurn(B, 0); await B.endTurn(0);
      await B.beginTurn(1); await AI.takeTurn(B, 1); await B.endTurn(1);
    });
  }
  return { win: G.winner === 0, rounds: G.round, hp: G.P[0].hp };
};
`, ctx);

(async () => {
  const N = +process.argv[2] || 60;
  const decks = {
    starter: vm.runInContext('STARTER_DECK', ctx),
    mid: ctx.makeDeck(['blaze', 'sugar', 'neutral'], 3, 99),
    late: ctx.makeDeck(['storm', 'mecha', 'neutral'], 6, 1234),
  };
  console.log('stage   ' + Object.keys(decks).map(k => k.padStart(14)).join(''));
  const only = process.argv[3] ? process.argv[3].split(',') : null;
  for (const id of vm.runInContext('STAGE_ORDER', ctx)) {
    if (only && !only.includes(id)) continue;
    let line = id.padEnd(8);
    for (const [k, d] of Object.entries(decks)) {
      let w = 0, r = 0;
      for (let i = 0; i < N; i++) { const res = await ctx.play(d, id, 0.15); if (res.win) w++; r += res.rounds; }
      line += `${Math.round(w / N * 100)}% r${(r / N).toFixed(1)}`.padStart(14);
    }
    console.log(line);
  }
})();
