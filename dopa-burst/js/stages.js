'use strict';
/* ===== ステージ・敵デッキ・ランク戦 ===== */

const PASSIVES = {
  pudding: { name: 'プルプル回復', text: 'ターン開始時、自分のヒーローを20回復',
    turnStart: async (B, pi) => { await B.heal(B.hero(pi), 20); } },
  ifrit: { name: '炎帝の吐息', text: 'ターン開始時、あなたのランダムなユニットに炎上1',
    turnStart: async (B, pi) => { const t = R.pick(B.units(1 - pi)); if (t) await B.burn(t, 1, B.hero(pi)); } },
  tempesta: { name: '絶対零度', text: 'ターン開始時、あなたのランダムなユニット1体を凍結',
    turnStart: async (B, pi) => { const t = R.pick(B.units(1 - pi)); if (t) await B.freeze(t); } },
  goldo: { name: 'イカサマ', text: '常にクリティカル率+30%',
    turnStart: null },
  observer: { name: '未知の観測', text: 'ターン開始時、あなたのランダムなユニット1体を別の空きマスへワープさせる',
    turnStart: async (B, pi) => { const t = R.pick(B.units(1 - pi)); const l = R.pick(B.emptyLanes(1 - pi)); if (t && l != null) await B.moveUnit(t, l, { push: true }); } },
  maou: { name: 'ドーパミン過剰分泌', text: 'ターン開始時、あなたのユニット全員に10ダメージ。フィーバーを使ってくる',
    turnStart: async (B, pi) => { const es = B.units(1 - pi); if (es.length) await B.damageMany(B.spellSrc(pi), es, 10, { fx: 'dark' }); } },
};

const WORLDS = [
  { id: 1, name: 'はじまりの草原', emoji: '🌱', color: '#8dff4f', stages: [
    { id: '1-1', name: 'わんぱくワンコ', avatar: '🐶', hp: 150, tribes: ['neutral'], level: 0, turns: 7, mistake: 0.5, quote: 'ワンワン！あそぼー！', tutorial: true,
      deck: ['n_dog', 'n_dog', 'n_dog', 'n_dog', 'n_cat', 'n_cat', 'n_cat', 'n_chick', 'n_chick', 'n_chick', 'n_ox', 'n_ox', 'n_dog', 'n_cat', 'n_chick', 'n_ox', 'n_dog', 'n_cat', 'n_chick', 'n_ox'] },
    { id: '1-2', name: 'おかし好きのうさぎ', avatar: '🐰', hp: 200, tribes: ['sugar', 'neutral'], level: 1, turns: 7, mistake: 0.4, quote: 'おやつの時間、じゃましないで！' },
    { id: '1-3', name: 'ねこ番長', avatar: '🐈', hp: 230, tribes: ['neutral'], level: 1, turns: 7, mistake: 0.35, quote: 'このシマはオレのもんだニャ' },
    { id: '1-4', name: 'ビッグプリン', avatar: '🍮', hp: 250, tribes: ['sugar'], level: 2, turns: 8, mistake: 0.3, boss: true, passive: 'pudding', quote: 'プルルン…ワタシは何度でも回復するプル！' },
  ] },
  { id: 2, name: '灼熱の火山', emoji: '🌋', color: '#ff6a3d', stages: [
    { id: '2-1', name: 'ヒバナ団', avatar: '😈', hp: 250, tribes: ['blaze'], level: 2, turns: 7, mistake: 0.3, quote: '燃やせ燃やせー！' },
    { id: '2-2', name: '鉄くず工房', avatar: '🔩', hp: 270, tribes: ['mecha'], level: 3, turns: 8, mistake: 0.25, quote: '合体こそロマンだ！' },
    { id: '2-3', name: '爆弾魔ボンバー', avatar: '🧨', hp: 290, tribes: ['blaze', 'mecha'], level: 3, turns: 8, mistake: 0.2, quote: '芸術は爆発だァ！' },
    { id: '2-4', name: '炎帝イフリート', avatar: '👹', hp: 300, tribes: ['blaze'], level: 4, turns: 9, mistake: 0.15, boss: true, passive: 'ifrit', field: 'b_volcano', quote: '灰になる覚悟はできたか' },
  ] },
  { id: 3, name: '嵐の摩天楼', emoji: '⛈️', color: '#38e1ff', stages: [
    { id: '3-1', name: '雪ん子', avatar: '⛄', hp: 330, tribes: ['storm'], level: 3, turns: 8, mistake: 0.2, quote: 'こおらせちゃうぞ〜' },
    { id: '3-2', name: 'ギャンブラー狸', avatar: '🦝', hp: 350, tribes: ['lucky'], level: 4, turns: 8, mistake: 0.2, quote: '人生は一か八かだポン！' },
    { id: '3-3', name: '雷の魔導士', avatar: '🧙', hp: 370, tribes: ['storm', 'neutral'], level: 4, turns: 8, mistake: 0.15, quote: '連鎖の美しさを見せてやろう' },
    { id: '3-4', name: '嵐の女王テンペスタ', avatar: '🧝', hp: 350, tribes: ['storm'], level: 5, turns: 9, mistake: 0.1, boss: true, passive: 'tempesta', field: 's_skyscraper', quote: '凍てつく嵐の中で踊りなさい' },
  ] },
  { id: 4, name: '真夜中のネオン街', emoji: '🌃', color: '#a978ff', stages: [
    { id: '4-1', name: '墓場のゴースト', avatar: '👻', hp: 390, tribes: ['necro'], level: 5, turns: 8, mistake: 0.15, quote: 'うらめしや〜' },
    { id: '4-2', name: 'カジノディーラー', avatar: '🎩', hp: 410, tribes: ['lucky', 'necro'], level: 5, turns: 8, mistake: 0.12, quote: 'さあ、賭けの時間です' },
    { id: '4-3', name: 'ヴァンパイア伯爵', avatar: '🧛', hp: 430, tribes: ['necro', 'sugar'], level: 6, turns: 9, mistake: 0.1, quote: '甘い血の香りがするな…' },
    { id: '4-4', name: 'カジノ王ゴルドー', avatar: '🤵', hp: 380, tribes: ['lucky'], level: 6, turns: 9, mistake: 0.05, boss: true, passive: 'goldo', field: 'l_casino', extraCrit: 0.3, quote: 'このカジノでは、ワタシが法律だ' },
  ] },
  { id: 5, name: 'ドーパミン魔界', emoji: '🧠', color: '#ff3d8b', stages: [
    { id: '5-1', name: 'ショート動画の悪魔', avatar: '📱', hp: 430, tribes: ['storm', 'blaze'], level: 7, turns: 9, mistake: 0.08, quote: 'あと1本だけ…あと1本だけ見ていけよ' },
    { id: '5-2', name: '無限スクロール', avatar: '🌀', hp: 450, tribes: ['mecha', 'lucky'], level: 7, turns: 9, mistake: 0.06, quote: '終わりなんて、ないんだよ' },
    { id: '5-3', name: '通知の嵐', avatar: '🔔', hp: 480, tribes: ['necro', 'storm'], level: 8, turns: 9, mistake: 0.05, quote: 'ピコン！ピコン！ピコン！ピコン！' },
    { id: '5-4', name: 'ドーパミン魔王', avatar: '🧠', hp: 440, tribes: ['blaze', 'storm', 'necro', 'lucky', 'mecha', 'sugar'], level: 9, turns: 10, mistake: 0, boss: true, passive: 'maou', fever: true, energyBonus: 0, quote: '快楽に溺れよ…それが人の本能だ！' },
  ] },
  { id: 6, name: '未知なる狭間', emoji: '🌌', color: '#8a8cff', axis: true, stages: [
    { id: '6-1', name: '時計職人クロック', avatar: '⏰', hp: 380, tribes: ['chrono', 'neutral'], level: 5, turns: 9, mistake: 0.12, quote: 'チクタク…あと3つで、ドカン。', unlockAfter: '2-4' },
    { id: '6-2', name: '次元の旅人', avatar: '🧳', hp: 400, tribes: ['warp', 'storm'], level: 5, turns: 9, mistake: 0.1, quote: 'そのマス、空いてるよね？' },
    { id: '6-3', name: '仮面の怪盗団', avatar: '🎭', hp: 420, tribes: ['mimic', 'risk'], level: 6, turns: 9, mistake: 0.08, quote: '君のカード、ちょっと借りるね' },
    { id: '6-4', name: '孤独の観測者', avatar: '👁️', hp: 400, tribes: ['solo', 'chrono', 'warp', 'mimic', 'risk'], level: 7, turns: 10, mistake: 0.05, boss: true, passive: 'observer', quote: '未知こそが、最高の快楽だ' },
  ] },
];
const STAGES = {};
const STAGE_ORDER = [];
WORLDS.forEach(w => w.stages.forEach(s => { s.world = w.id; STAGES[s.id] = s; STAGE_ORDER.push(s.id); }));

function hashStr(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

// 敵デッキ生成（レベルが上がるほどレアが混ざる）
function makeDeck(tribes, level, seed) {
  const rng = seeded(seed);
  const pool = COLLECTIBLE.filter(c => tribes.includes(c.tribe) && (level >= 3 || c.cost <= 5));
  const neutralPool = COLLECTIBLE.filter(c => c.tribe === 'neutral' && c.rarity !== 'UR' && c.cost <= 5);
  const w = {
    N: Math.max(10, 60 - level * 6), R: 30, SR: 4 + level * 3,
    SSR: level >= 3 ? level * 1.6 : 0, UR: level >= 6 ? (level - 5) * 1.2 : 0,
  };
  const deck = [], count = {};
  let guard = 0;
  while (deck.length < 20 && guard++ < 400) {
    const r = rng.weighted(Object.entries(w).filter(e => e[1] > 0));
    let cand = pool.filter(c => c.rarity === r);
    if (rng.next() < 0.12) cand = neutralPool.filter(c => c.rarity === r);
    if (!cand.length) continue;
    const c = rng.pick(cand);
    const cap = c.rarity === 'UR' ? 1 : c.rarity === 'SSR' || c.type === 'field' ? 2 : 3;
    if (c.type === 'field' && deck.some(id => CARDS[id].type === 'field' && id !== c.id)) continue;
    const want = c.rarity === 'UR' ? 1 : c.rarity === 'SSR' ? 1 + (rng.next() < 0.3 ? 1 : 0) : c.rarity === 'SR' || c.type !== 'unit' ? 2 : 3;
    for (let i = 0; i < want && deck.length < 20 && (count[c.id] || 0) < cap; i++) {
      deck.push(c.id); count[c.id] = (count[c.id] || 0) + 1;
    }
  }
  // ユニットが少なすぎると弱いので補正
  let units = deck.filter(id => CARDS[id].type === 'unit').length;
  const cheapUnits = pool.filter(c => c.type === 'unit' && c.cost <= 3 && c.rarity !== 'UR');
  for (let i = 0; i < deck.length && units < 13; i++) {
    if (CARDS[deck[i]].type !== 'unit') {
      const c = rng.pick(cheapUnits.length ? cheapUnits : neutralPool.filter(x => x.type === 'unit'));
      count[deck[i]]--; deck[i] = c.id; units++;
    }
  }
  while (deck.length < 20) deck.push('n_dog');
  return deck;
}

function stageConfig(stageId) {
  const s = STAGES[stageId];
  const p = s.passive ? PASSIVES[s.passive] : null;
  return {
    name: s.name, avatar: s.avatar, hp: s.hp, isAI: true,
    deck: s.deck ? s.deck.slice() : makeDeck(s.tribes, s.level, hashStr(s.id)),
    ai: { mistake: s.mistake || 0, depth: s.boss ? 3 : s.level <= 1 ? 1 : s.level <= 4 ? 2 : 3 },
    passive: p, field: s.field || null, fever: true, feverRate: s.fever ? 1 : Math.min(0.9, 0.35 + s.level * 0.06), // 敵のFEVERゲージは低レベルほど溜まりにくい
    energyBonus: s.energyBonus || 0, extraCrit: s.extraCrit || 0,
  };
}

/* ---------- ランク戦 ---------- */
const RANKS = [
  { name: 'ブロンズ', min: 0, color: '#d08a4a', icon: '🥉' },
  { name: 'シルバー', min: 100, color: '#c7d0e0', icon: '🥈' },
  { name: 'ゴールド', min: 220, color: '#ffcc33', icon: '🥇' },
  { name: 'プラチナ', min: 360, color: '#7fffe0', icon: '💠' },
  { name: 'ダイヤ', min: 520, color: '#7fd1ff', icon: '💎' },
  { name: 'マスター', min: 720, color: '#ff6ad5', icon: '👑' },
  { name: 'ドパミン神', min: 1000, color: '#ffffff', icon: '🧠' },
];
function rankOf(rp) {
  let i = 0;
  for (let k = 0; k < RANKS.length; k++) if (rp >= RANKS[k].min) i = k;
  const cur = RANKS[i], next = RANKS[i + 1];
  return { idx: i, ...cur, next, progress: next ? (rp - cur.min) / (next.min - cur.min) : 1 };
}
const RIVAL_NAMES = ['ドパ太郎', 'ガチャ廃人', '倍速視聴マン', '深夜テンション', '通知オン勢', '爆速スクロール', 'ログボ皆勤賞', '10連の亡者', '確定演出待ち', 'あと1回だけ勢', '寝落ち常習犯', 'リール中毒', '既読スルー王', 'エナドリ3本目', '天井到達者', 'スキップ連打'];
const RIVAL_AVATARS = ['😎', '🤪', '🥸', '😈', '🤖', '👽', '🦊', '🐯', '🐸', '🦖', '🧛', '🥷', '🤠', '👻', '🐙', '🦄'];

function rivalConfig(rp) {
  const r = rankOf(rp);
  const tribes = R.shuffle(TRIBE_ORDER.filter(t => t !== 'neutral')).slice(0, R.chance(0.5) ? 1 : 2);
  const level = Math.min(9, 1 + r.idx * 1.3 + R.next());
  return {
    name: R.pick(RIVAL_NAMES), avatar: R.pick(RIVAL_AVATARS), hp: 260 + r.idx * 40, isAI: true,
    deck: makeDeck(tribes, Math.round(level), Math.floor(R.next() * 1e9)),
    ai: { mistake: Math.max(0, 0.35 - r.idx * 0.07), depth: r.idx <= 1 ? 1 : r.idx <= 3 ? 2 : 3 },
    passive: null, field: null, fever: true, feverRate: Math.min(1, 0.45 + r.idx * 0.09), energyBonus: 0, extraCrit: 0,
    tribes, rankIdx: r.idx,
  };
}

const STARTER_DECK = ['n_dog', 'n_dog', 'n_dog', 'n_chick', 'n_chick', 'n_cat', 'n_cat', 'n_cat', 'n_ox', 'n_ox',
  'n_hammer', 'n_hammer', 'b_imp', 'b_imp', 'su_donut', 'su_donut', 's_bolt', 's_bolt', 'm_robot', 'm_robot'];
