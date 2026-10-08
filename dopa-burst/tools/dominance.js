// 完全上位互換チェック：AがBの完全上位互換（コスト以下・ATK/HP以上・キーワードを全部持つ・Bの効果もAが持つ・デメリットなし）になっている組を列挙する
const fs = require('fs'), vm = require('vm'), path = require('path');
const dir = path.join(__dirname, '..', 'js');
const ctx = { console, Math, JSON }; ctx.globalThis = ctx; vm.createContext(ctx);
for (const f of ['util.js', 'cards.js']) vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
const cards = vm.runInContext('COLLECTIBLE', ctx);
// 効果の「中身」：テキストの効果部分（キーワード名を除いた）。フレーバーは効果なし扱い
const eff = c => (c.flavor || !c.text ? '' : c.text.trim());
const drawback = c => !!(c.hpCost || c.countdown && !c.onCountdown);
const hooks = ['onPlay', 'onDeath', 'onTurnStart', 'onPreAttack', 'onKill', 'onAllySpell', 'onAllyCrit', 'onAnyHeal', 'onAllyCard', 'onHurt', 'onMerge', 'atkMod', 'dynKw', 'costMod', 'beforeAttack', 'afterAttack', 'onCountdown'];
const out = [];
for (const a of cards) for (const b of cards) {
  if (a === b || a.type !== b.type) continue;
  if (a.type === 'unit') {
    if (!(a.cost <= b.cost && a.atk >= b.atk && a.hp >= b.hp)) continue;
    if (!b.kw.every(k => a.kw.includes(k))) continue;
    if (drawback(a) && !drawback(b)) continue;
    if (a.hpCost && (a.hpCost > (b.hpCost || 0))) continue;
    const bEff = eff(b), aEff = eff(a);
    const bHasEff = hooks.some(h => b[h]) || !!bEff;
    // Bに効果があるなら、Aも同じ効果（数字だけ違うものは要確認）を持つ場合だけ
    if (bHasEff && aEff !== bEff) {
      const shape = t => t.replace(/\d+/g, '#');
      if (!aEff || shape(aEff) !== shape(bEff)) continue;
      out.push({ a, b, note: '同じ効果で数値違い→要確認' }); continue;
    }
    const strict = a.cost < b.cost || a.atk > b.atk || a.hp > b.hp || a.kw.length > b.kw.length || (!!aEff && !bEff);
    if (!strict) continue;
    out.push({ a, b, note: (aEff && aEff !== bEff) ? 'Aは効果つき' : '' });
  } else {
    // スペル・フィールドは同じ種類のAIヒントで数値比較
    const ha = a.ai || {}, hb = b.ai || {};
    if (!ha.t || ha.t !== hb.t || ha.t === 'custom' || a.target !== b.target || eff(a) === '' ) continue;
    const better = ['v', 'a', 'h'].every(k => (ha[k] || 0) >= (hb[k] || 0)) && a.cost <= b.cost && !(a.hpCost > (b.hpCost || 0));
    const strict = a.cost < b.cost || ['v', 'a', 'h'].some(k => (ha[k] || 0) > (hb[k] || 0));
    if (better && strict) out.push({ a, b, note: 'スペル(' + ha.t + ')要確認' });
  }
}
const fmt = c => `${c.name}[${c.tribe} ${c.rarity} c${c.cost}${c.type === 'unit' ? ` ${c.atk}/${c.hp}` : ''}${c.kw.length ? ' ' + c.kw.join('+') : ''}]`;
for (const o of out) console.log(`${fmt(o.a)}  >=  ${fmt(o.b)}  ${o.note}`);
console.log('pairs', out.length);

// 追加チェック：効果文が「数字だけ違う」「相手の効果を丸ごと含んでさらに上乗せ」のもの（全種類）
const shape = t => t.replace(/\d+/g, '#');
const nums = t => (t.match(/\d+/g) || []).map(Number);
const extra = [];
for (const a of cards) for (const b of cards) {
  if (a === b || a.type !== b.type) continue;
  const ea = eff(a), eb = eff(b);
  if (!eb || !ea) continue;
  if (a.type === 'unit' && !(a.cost <= b.cost && a.atk >= b.atk && a.hp >= b.hp && b.kw.every(k => a.kw.includes(k)))) continue;
  if (a.type !== 'unit' && !(a.cost <= b.cost && (a.target || '') === (b.target || ''))) continue;
  if ((a.hpCost || 0) > (b.hpCost || 0)) continue;
  if (ea !== eb && shape(ea) === shape(eb)) {
    const na = nums(ea), nb = nums(eb);
    if (na.every((v, i) => v >= nb[i])) extra.push(`${fmt(a)} ${ea}  >=  ${fmt(b)} ${eb}  [数値だけ上]`);
  } else if (ea !== eb && ea.includes(eb.replace(/。$/, ''))) {
    extra.push(`${fmt(a)} ${ea}  >=  ${fmt(b)} ${eb}  [効果を内包]`);
  } else if (ea === eb && (a.cost < b.cost || (a.type === 'unit' && (a.atk > b.atk || a.hp > b.hp)))) {
    extra.push(`${fmt(a)}  >=  ${fmt(b)}  [同じ効果で数値上]`);
  }
}
extra.forEach(x => console.log(x));
console.log('extra', extra.length);
