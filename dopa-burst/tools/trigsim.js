// 「ターン開始時／アタック前」「カウントダウン」持ちのユニットが、場に出てから1回でも効果を出せた割合を測る
const fs = require('fs'), vm = require('vm'), path = require('path');
const dir = path.join(__dirname, '..', 'js');
const ctx = { console, setTimeout, clearTimeout, Math, JSON, performance: { now: () => Date.now() } };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['util.js', 'cards.js', 'engine.js', 'ai.js', 'stages.js']) vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
vm.runInContext(`
Time.headless = true;
const HOOKS = ['onTurnStart', 'onPreAttack', 'onCountdown'];
const watched = CARD_LIST.filter(c => HOOKS.some(h => c[h]));
for (const c of watched) for (const h of HOOKS) if (c[h]) { const f = c[h]; c[h] = async (B, u, ...r) => { u._fired = true; return f(B, u, ...r); }; }
const placed = [];
const origSummon = B.summon.bind(B);
B.summon = async (...a) => { const u = await origSummon(...a); if (u && !B.simMode && watched.includes(u.def)) placed.push({ u, id: u.def.id }); return u; };
globalThis.runTrig = async function (N) {
  const ids = watched.map(c => c.id);
  for (let i = 0; i < N; i++) {
    // 対象カードを多めに入れたデッキ同士で戦わせる
    const mk = seed => { const d = makeDeck(['sugar', 'chrono', 'mimic', 'mecha'], 5, seed); for (let k = 0; k < 8; k++) d[k] = ids[(seed + k) % ids.length]; return d; };
    B.view = null;
    const G = B.start({ player: { name: 'A', hp: 300, deck: mk(i * 3 + 1), ai: { depth: 2 }, fever: true }, enemy: { name: 'B', hp: 300, deck: mk(i * 7 + 2), ai: { depth: 2 }, fever: true } });
    let t = 0;
    while (!G.over && t++ < 40) await B.act(async () => { await B.beginTurn(0); await AI.takeTurn(B, 0); await B.endTurn(0); await B.beginTurn(1); await AI.takeTurn(B, 1); await B.endTurn(1); });
  }
  const by = {};
  for (const p of placed) { const k = p.id; by[k] = by[k] || [0, 0]; by[k][0]++; if (p.u._fired) by[k][1]++; }
  return Object.entries(by).map(([k, [n, f]]) => [CARDS[k].name, n, f]);
};
`, ctx);
(async () => {
  const rows = await ctx.runTrig(+process.argv[2] || 200);
  let tn = 0, tf = 0;
  for (const [name, n, f] of rows.sort((a, b) => a[2] / a[1] - b[2] / b[1])) { tn += n; tf += f; console.log(`${name.padEnd(14, '　')} 出した${String(n).padStart(4)}回  発動${String(Math.round(f / n * 100)).padStart(3)}%`); }
  console.log(`全体  発動 ${Math.round(tf / tn * 100)}%`);
})();
