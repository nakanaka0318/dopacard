// ボスラッシュの勝率確認：プレイヤー側もAI（そこそこ上手い：深さ2・ミス5%）で操作する
// node tools/rushsim.js [N] [br01,br02...]
const fs = require('fs'), vm = require('vm'), path = require('path');
const dir = path.join(__dirname, '..', 'js');
const ctx = { console, setTimeout, clearTimeout, Math, JSON, performance: { now: () => Date.now() } };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['util.js', 'cards.js', 'engine.js', 'ai.js', 'stages.js', 'bosses.js']) vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
vm.runInContext(`
Time.headless = true;
globalThis.errors = 0;
globalThis.play = async function (pDeck, id) {
  B.view = null;
  const G = B.start({ player: { name: 'P', hp: RUSH_PLAYER_HP, deck: pDeck, ai: { mistake: 0.05, depth: 2 }, fever: true }, enemy: rushConfig(id) });
  let t = 0;
  const oe = console.error; console.error = (...a) => { errors++; if (errors < 4) oe(...a); };
  while (!G.over && t++ < 40) {
    await B.act(async () => {
      await B.beginTurn(0); await AI.takeTurn(B, 0); await B.endTurn(0);
      await B.beginTurn(1); await AI.takeTurn(B, 1); await B.endTurn(1);
    });
  }
  console.error = oe;
  return { win: G.winner === 0, over: G.over, rounds: G.round, dmg: 1 - G.P[1].hp / G.P[1].maxHp, phase: G.P[1].phase };
};
`, ctx);
(async () => {
  const N = +process.argv[2] || 20;
  const only = process.argv[3] ? process.argv[3].split(',') : null;
  const decks = {
    late: ctx.makeDeck(['storm', 'mecha', 'neutral'], 6, 1234),
    strong: ctx.makeDeck(['risk', 'solo'], 9, 777),
    blaze9: ctx.makeDeck(['blaze', 'neutral'], 9, 4242),
  };
  console.log('boss    ' + Object.keys(decks).map(k => k.padStart(20)).join(''));
  let tot = 0, wins = 0;
  for (const b of vm.runInContext('BOSS_LIST', ctx)) {
    if (only && !only.includes(b.id)) continue;
    let line = (b.id + ' ' + b.name).slice(0, 14).padEnd(14);
    for (const d of Object.values(decks)) {
      let w = 0, r = 0, dm = 0, stall = 0;
      for (let i = 0; i < N; i++) { const res = await ctx.play(d, b.id); if (res.win) w++; if (!res.over) stall++; r += res.rounds; dm += res.dmg; }
      tot += N; wins += w;
      line += `${Math.round(w / N * 100)}% r${(r / N).toFixed(1)} d${Math.round(dm / N * 100)}${stall ? ' S' + stall : ''}`.padStart(20);
    }
    console.log(line);
  }
  console.log(`player win total ${Math.round(wins / tot * 100)}%  errors ${ctx.errors}`);
})();
