'use strict';
/* ===== カードデータベース ===== */

const TRIBES = {
  neutral: { name: 'ノーマル', icon: '⭐', color: '#c7c3e6', desc: 'クセのない基本カード' },
  blaze: { name: 'ブレイズ', icon: '🔥', color: '#ff6a3d', desc: '炎上と貫通でゴリ押し' },
  storm: { name: 'ストーム', icon: '⚡', color: '#38e1ff', desc: '雷の連鎖と凍結。コンボで化ける' },
  sugar: { name: 'シュガー', icon: '🍬', color: '#ff7ac8', desc: '回復・強化・シールドで粘る' },
  necro: { name: 'ネクロ', icon: '💀', color: '#a978ff', desc: '倒されるほど強くなる' },
  lucky: { name: 'ラッキー', icon: '🎰', color: '#ffd23f', desc: 'クリティカルとギャンブル' },
  mecha: { name: 'メカ', icon: '🤖', color: '#6dffb3', desc: '合体と★アップで巨大化' },
  // ---- 未知なる軸 ----
  chrono: { name: 'クロノ', icon: '⏳', color: '#e0a96d', desc: '【時間の軸】カウントが0になった瞬間に大爆発', axis: true },
  warp: { name: 'ワープ', icon: '🌀', color: '#8a8cff', desc: '【位置の軸】マスを動かして、壁を避けて直撃させる', axis: true },
  mimic: { name: 'ミミック', icon: '🎭', color: '#b8f04a', desc: '【姿の軸】変身・コピー・強奪。敵の力を自分のものに', axis: true },
  risk: { name: 'リスク', icon: '💔', color: '#ff3a5c', desc: '【代償の軸】自分のHPを払うほど強くなる', axis: true },
  solo: { name: 'ソロ', icon: '🌙', color: '#9bb8e0', desc: '【孤独の軸】味方が少ないほど強い。一騎当千', axis: true },
  fort: { name: 'フォート', icon: '🏰', color: '#9fb4c7', desc: '【鉄壁の軸】守護で直撃をかばい、アーマーでダメージを減らす', axis: true },
  bloom: { name: 'ブルーム', icon: '🌸', color: '#7de8c0', desc: '【癒しの軸】回復が起きるたびに強くなる', axis: true },
  geo: { name: 'ジオ', icon: '🗺️', color: '#d1a463', desc: '【陣地の軸】マスに陣を刻み、場そのものを味方にする', axis: true },
  arcane: { name: 'アルカナ', icon: '🔮', color: '#7b8cff', desc: '【呪文の軸】スペルを唱えるほど強く、安くなる', axis: true },
  rhythm: { name: 'リズム', icon: '🎵', color: '#ff9f1c', desc: '【連打の軸】このターンのコンボ数で化ける', axis: true },
};
const TRIBE_ORDER = ['neutral', 'blaze', 'storm', 'sugar', 'necro', 'lucky', 'mecha', 'chrono', 'warp', 'mimic', 'risk', 'solo', 'fort', 'bloom', 'geo', 'arcane', 'rhythm'];

const RARITY = {
  N: { name: 'N', color: '#b9bdd6', rank: 0 },
  R: { name: 'R', color: '#36a8ff', rank: 1 },
  SR: { name: 'SR', color: '#c55bff', rank: 2 },
  SSR: { name: 'SSR', color: '#ffc93a', rank: 3 },
  UR: { name: 'UR', color: '#ffffff', rank: 4 },
};
const RARITY_ORDER = ['N', 'R', 'SR', 'SSR', 'UR'];

const KW = {
  shield: { name: 'シールド', icon: '🛡️', desc: '次に受けるダメージを1回だけ無効にする' },
  double: { name: '連撃', icon: '⚔️', desc: '1ターンに2回攻撃する' },
  pierce: { name: '貫通', icon: '💥', desc: 'ユニットを倒して余ったダメージが敵ヒーローに届く' },
  fly: { name: '飛行', icon: '🕊️', desc: '正面を無視して敵ヒーローを直接攻撃する' },
  chain: { name: '連鎖', icon: '⛓️', desc: '攻撃時、攻撃した相手の両隣にも半分のダメージ' },
  thorns: { name: 'トゲ', icon: '🌵', desc: '攻撃してきたユニットに20ダメージを返す' },
  drain: { name: '吸血', icon: '🩸', desc: '与えたダメージのぶん自分のヒーローを回復' },
  lucky: { name: 'ラッキー', icon: '🍀', desc: 'クリティカル率+30%' },
  regen: { name: '再生', icon: '💚', desc: '自分のターン開始時にHPを20回復' },
  undying: { name: '不死', icon: '🔁', desc: '1回だけ、倒されてもHP10で復活する' },
  poison: { name: '猛毒', icon: '☠️', desc: 'ダメージを与えたユニットを破壊する' },
  burnhit: { name: '炎上撃', icon: '🔥', desc: '攻撃した相手に炎上1を与える' },
  freezehit: { name: '凍結撃', icon: '❄️', desc: '攻撃した相手を凍結させる' },
  warp: { name: 'ワープ', icon: '🌀', desc: '攻撃した後、隣の空きマスへ移動する（正面が空いているマスを優先）' },
  guard: { name: '守護', icon: '🚧', desc: '敵ユニットがヒーローを直接攻撃するとき（飛行も）、代わりにこのユニットが受け止める' },
  armor: { name: 'アーマー', icon: '🪖', desc: '受けるダメージを10減らす' },
};
const STATUS_INFO = {
  burn: '炎上：自分のターン開始時に（10×数値）ダメージ。毎ターン1ずつ減る',
  frozen: '凍結：次の攻撃ができない',
  count: 'カウント：自分のターン開始時に1減り、0になると効果が発動する。途中で倒されても、その場で発動する',
  preAttack: 'アタック前：アタックを押した直後、攻撃の直前に毎ターン発動する（出したターンから発動）',
  tile: '陣：マスに刻まれる。力の陣＝そのマスの味方ATK+10／守りの陣＝そのマスの味方が受けるダメージ-10／落とし穴＝そのマスに敵ユニットが出ると30ダメージ（1回で消える）',
  hpCost: 'HPコスト：出すときにPPとは別に自分のヒーローのHPを払う（HPは1未満にならない）',
};

// AIヒント: ai:{t:種類, v:値}
const CARD_LIST = [
  /* ---------------- ノーマル ---------------- */
  { id: 'n_dog', name: 'わんこ', emoji: '🐶', tribe: 'neutral', rarity: 'N', type: 'unit', cost: 1, atk: 20, hp: 30, text: '元気だけが取り柄。' , flavor: true },
  { id: 'n_chick', name: 'ひよこ伝令', emoji: '🐤', tribe: 'neutral', rarity: 'N', type: 'unit', cost: 1, atk: 10, hp: 10, text: '登場時：カードを1枚引く',
    onPlay: async (B, u) => { await B.draw(u.owner, 1); } },
  { id: 'n_cat', name: 'ねこ番長', emoji: '🐈', tribe: 'neutral', rarity: 'N', type: 'unit', cost: 2, atk: 30, hp: 40, text: 'ケンカっぱやい。', flavor: true },
  { id: 'n_ox', name: 'うしモー', emoji: '🐮', tribe: 'neutral', rarity: 'N', type: 'unit', cost: 3, atk: 30, hp: 60, text: 'どっしり構える。', flavor: true },
  { id: 'n_owl', name: 'ものしりフクロウ', emoji: '🦉', tribe: 'neutral', rarity: 'R', type: 'unit', cost: 3, atk: 20, hp: 30, text: '登場時：カードを2枚引く',
    onPlay: async (B, u) => { await B.draw(u.owner, 2); } },
  { id: 'n_shark', name: 'シャーク', emoji: '🦈', tribe: 'neutral', rarity: 'R', type: 'unit', cost: 3, atk: 20, hp: 30, kw: ['double'], text: '' },
  { id: 'n_gorilla', name: 'ゴリラ番長', emoji: '🦍', tribe: 'neutral', rarity: 'R', type: 'unit', cost: 4, atk: 50, hp: 60, text: 'ウホッ。', flavor: true },
  { id: 'n_elephant', name: 'マンモス', emoji: '🐘', tribe: 'neutral', rarity: 'R', type: 'unit', cost: 5, atk: 30, hp: 80, kw: ['thorns'], text: '' },
  { id: 'n_box', name: 'びっくり箱', emoji: '🎁', tribe: 'neutral', rarity: 'N', type: 'spell', cost: 1, target: 'none', text: 'ランダムなカード2枚を手札に加える。何が出るかな？',
    ai: { t: 'draw', v: 2 }, cast: async (B, pi) => { await B.addRandomCards(pi, 2); } },
  { id: 'n_hammer', name: 'ピコピコハンマー', emoji: '🔨', tribe: 'neutral', rarity: 'N', type: 'spell', cost: 2, target: 'enemyUnit', text: '敵ユニット1体に30ダメージ。倒したらカードを1枚引く',
    ai: { t: 'dmgUnit', v: 30 },
    cast: async (B, pi, t) => { await B.damage(B.spellSrc(pi), t, 30, { fx: 'hit' }); await B.processDeaths(); if (t.hp <= 0 || t.removed) await B.draw(pi, 1); } },
  { id: 'n_dopa', name: 'ドーパミン注射', emoji: '💊', tribe: 'neutral', rarity: 'R', type: 'spell', cost: 0, target: 'none', text: 'フィーバーゲージ+35。カードを1枚引く',
    ai: { t: 'draw', v: 1 }, cast: async (B, pi) => { await B.addFever(pi, 35); await B.draw(pi, 1); } },
  { id: 'n_colosseum', name: 'コロシアム', emoji: '🏟️', tribe: 'neutral', rarity: 'R', type: 'field', cost: 2, text: 'フィールド：すべてのユニットのATK+20（敵も）',
    fieldAtk: (B, u, owner) => 20, ambient: 'neutral' },
  { id: 'n_dragon', name: 'ドパミンドラゴン', emoji: '🐉', tribe: 'neutral', rarity: 'SSR', type: 'unit', cost: 6, atk: 60, hp: 60, kw: ['fly'], text: '登場時：フィーバーゲージ+50',
    onPlay: async (B, u) => { await B.addFever(u.owner, 50); } },
  { id: 'n_moai', name: 'モアイ大明神', emoji: '🗿', tribe: 'neutral', rarity: 'UR', type: 'unit', cost: 9, atk: 100, hp: 100, text: '登場時：他のすべてのユニットに50ダメージ（味方も）',
    onPlay: async (B, u) => {
      await B.cutin(u, 'ゴゴゴゴゴ…');
      await B.quake();
      const all = B.allUnits().filter(x => x !== u);
      await B.damageMany(u, all, 50, { fx: 'quake' });
    } },

  /* ---------------- ブレイズ ---------------- */
  { id: 'b_imp', name: 'ヒバナ小鬼', emoji: '😈', tribe: 'blaze', rarity: 'N', type: 'unit', cost: 1, atk: 30, hp: 10, text: 'すぐ燃え尽きる。', flavor: true },
  { id: 'b_lizard', name: 'サラマンダー', emoji: '🦎', tribe: 'blaze', rarity: 'N', type: 'unit', cost: 1, atk: 20, hp: 10, kw: ['burnhit'], text: '' },
  { id: 'b_fox', name: 'キツネ火', emoji: '🦊', tribe: 'blaze', rarity: 'N', type: 'unit', cost: 2, atk: 30, hp: 20, text: '登場時：正面の敵に炎上2。いなければ敵ヒーローに20ダメージ',
    onPlay: async (B, u) => {
      const o = B.oppositeOf(u);
      if (o) await B.burn(o, 2, u); else await B.damage(u, B.hero(1 - u.owner), 20, { fx: 'fire' });
    } },
  { id: 'b_bomber', name: 'ばくだん小僧', emoji: '🧨', tribe: 'blaze', rarity: 'N', type: 'unit', cost: 2, atk: 20, hp: 20, text: '破壊時：正面の敵と敵ヒーローに30ダメージ',
    onDeath: async (B, u) => {
      const o = B.oppositeOf(u);
      B.explode(u);
      if (o) await B.damage(u, o, 30, { fx: 'fire' });
      await B.damage(u, B.hero(1 - u.owner), 30, { fx: 'fire' });
    } },
  { id: 'b_rage', name: 'ブチギレ', emoji: '💢', tribe: 'blaze', rarity: 'N', type: 'spell', cost: 1, target: 'allyUnit', text: '味方1体のATK+30、貫通を得る',
    ai: { t: 'buff', a: 30, h: 0 }, cast: async (B, pi, t) => { await B.buff(t, 30, 0); B.giveKw(t, 'pierce'); } },
  { id: 'b_fireball', name: 'ファイアボール', emoji: '🔥', tribe: 'blaze', rarity: 'N', type: 'spell', cost: 2, target: 'enemyUnit', text: '敵ユニット1体に40ダメージ。余ったダメージは敵ヒーローへ',
    ai: { t: 'dmgUnit', v: 40 }, cast: async (B, pi, t) => { await B.damage(B.spellSrc(pi), t, 40, { fx: 'fire', pierce: true }); } },
  { id: 'b_boar', name: '爆走イノシシ', emoji: '🐗', tribe: 'blaze', rarity: 'R', type: 'unit', cost: 3, atk: 40, hp: 30, kw: ['pierce'], text: '' },
  { id: 'b_volcano', name: '灼熱火山', emoji: '🌋', tribe: 'blaze', rarity: 'R', type: 'field', cost: 3, text: 'フィールド：自分のユニットATK+10。自分のターン開始時、敵ユニット全員に10ダメージ',
    fieldAtk: (B, u, owner) => (u.owner === owner ? 10 : 0),
    fieldTurnStart: async (B, owner) => { const es = B.units(1 - owner); if (es.length) await B.damageMany(B.fieldSrc(owner), es, 10, { fx: 'fire' }); },
    ambient: 'blaze' },
  { id: 'b_ogre', name: '鬼神バクエン', emoji: '👹', tribe: 'blaze', rarity: 'SR', type: 'unit', cost: 6, atk: 40, hp: 50, kw: ['double', 'pierce'], text: '' },
  { id: 'b_meteor', name: 'メテオストライク', emoji: '☄️', tribe: 'blaze', rarity: 'SR', type: 'spell', cost: 5, target: 'none', text: '敵ユニット全員に30ダメージ＋炎上1',
    ai: { t: 'aoe', v: 40 },
    cast: async (B, pi) => {
      const es = B.units(1 - pi);
      await B.damageMany(B.spellSrc(pi), es, 30, { fx: 'meteor' });
      for (const e of es) if (e.hp > 0) await B.burn(e, 1);
    } },
  { id: 'b_dragon', name: '業火竜ヴォルカ', emoji: '🐲', tribe: 'blaze', rarity: 'SSR', type: 'unit', cost: 6, atk: 70, hp: 60, kw: ['pierce'], text: '登場時：敵ユニット全員に炎上2',
    onPlay: async (B, u) => { await B.cutin(u, '焼き尽くせ！'); for (const e of B.units(1 - u.owner)) await B.burn(e, 2, u); } },
  { id: 'b_phoenix', name: '鳳凰フェニクス', emoji: '🦅', tribe: 'blaze', rarity: 'UR', type: 'unit', cost: 6, atk: 50, hp: 40, kw: ['fly', 'undying', 'burnhit'], text: '登場時：敵ユニット全員に20ダメージ。不死は全回復で復活する',
    fullRevive: true,
    onPlay: async (B, u) => { await B.cutin(u, '不死鳥、降臨！'); const es = B.units(1 - u.owner); if (es.length) await B.damageMany(u, es, 20, { fx: 'fire' }); } },

  /* ---------------- ストーム ---------------- */
  { id: 's_hamster', name: 'エレキハムスター', emoji: '🐹', tribe: 'storm', rarity: 'N', type: 'unit', cost: 1, atk: 20, hp: 20, text: '自分がスペルを使うたびATK+10',
    onAllySpell: async (B, u) => { await B.buff(u, 10, 0); } },
  { id: 's_bolt', name: 'ライトニング', emoji: '⚡', tribe: 'storm', rarity: 'N', type: 'spell', cost: 1, target: 'enemyAny', text: '敵1体（ヒーローも可）に30ダメージ',
    ai: { t: 'dmgAny', v: 30 }, cast: async (B, pi, t) => { await B.damage(B.spellSrc(pi), t, 30, { fx: 'bolt' }); } },
  { id: 's_freeze', name: 'フリーズ', emoji: '🧊', tribe: 'storm', rarity: 'N', type: 'spell', cost: 1, target: 'enemyUnit', text: '敵ユニット1体に10ダメージ＋凍結',
    ai: { t: 'freeze', v: 10 }, cast: async (B, pi, t) => { await B.damage(B.spellSrc(pi), t, 10, { fx: 'ice' }); if (t.hp > 0) await B.freeze(t); } },
  { id: 's_mage', name: '雷の見習い', emoji: '🧙', tribe: 'storm', rarity: 'N', type: 'unit', cost: 2, atk: 20, hp: 20, text: '登場時：ランダムな敵（ヒーロー含む）に20ダメージを2回',
    onPlay: async (B, u) => { for (let i = 0; i < 2; i++) await B.damage(u, B.randomEnemy(u.owner, true), 20, { fx: 'bolt' }); } },
  { id: 's_snowman', name: 'ゆきだるま', emoji: '⛄', tribe: 'storm', rarity: 'N', type: 'unit', cost: 2, atk: 20, hp: 40, kw: ['freezehit'], text: '' },
  { id: 's_octopus', name: '放電オクトパス', emoji: '🐙', tribe: 'storm', rarity: 'R', type: 'unit', cost: 3, atk: 30, hp: 40, kw: ['chain'], text: '' },
  { id: 's_chain', name: 'チェインボルト', emoji: '🌩️', tribe: 'storm', rarity: 'R', type: 'spell', cost: 3, target: 'none', text: 'ランダムな敵に20ダメージを（3＋このターンのコンボ数）回。最大12回',
    ai: { t: 'custom' },
    cast: async (B, pi) => {
      const n = Math.min(12, 3 + B.G.combo);
      for (let i = 0; i < n; i++) { const t = B.randomEnemy(pi, true, true); await B.damage(B.spellSrc(pi), t, 20, { fx: 'bolt', quick: true }); }
    } },
  { id: 's_skyscraper', name: '嵐の摩天楼', emoji: '🌪️', tribe: 'storm', rarity: 'R', type: 'field', cost: 3, text: 'フィールド：自分がカードを使うたび、ランダムな敵に10ダメージ',
    fieldCardPlayed: async (B, pi, owner) => { if (pi === owner) await B.damage(B.fieldSrc(owner), B.randomEnemy(owner, true), 10, { fx: 'bolt', quick: true }); },
    ambient: 'storm' },
  { id: 's_raptor', name: '雷帝ラプトル', emoji: '🦖', tribe: 'storm', rarity: 'SR', type: 'unit', cost: 5, atk: 30, hp: 40, kw: ['chain', 'double'], text: '' },
  { id: 's_blizzard', name: 'ブリザード', emoji: '❄️', tribe: 'storm', rarity: 'SR', type: 'spell', cost: 4, target: 'none', text: '敵ユニット全員に20ダメージ＋凍結',
    ai: { t: 'aoe', v: 35 },
    cast: async (B, pi) => {
      const es = B.units(1 - pi);
      await B.damageMany(B.spellSrc(pi), es, 20, { fx: 'ice' });
      for (const e of es) if (e.hp > 0) await B.freeze(e);
    } },
  { id: 's_djinn', name: '嵐の精霊ジン', emoji: '🧞', tribe: 'storm', rarity: 'SSR', type: 'unit', cost: 2, atk: 20, hp: 20, text: '登場時：敵ユニット全員に（このターンのコンボ数×10）ダメージ',
    onPlay: async (B, u) => {
      const v = B.G.combo * 10;
      await B.cutin(u, `コンボ${B.G.combo} → ${v}ダメージ！`);
      const es = B.units(1 - u.owner);
      if (v > 0 && es.length) await B.damageMany(u, es, v, { fx: 'bolt' });
    } },
  { id: 's_fenrir', name: '雷狼フェンリル', emoji: '🐺', tribe: 'storm', rarity: 'UR', type: 'unit', cost: 7, atk: 50, hp: 50, kw: ['chain', 'double'], text: '登場時：敵ユニット全員を凍結',
    onPlay: async (B, u) => { await B.cutin(u, '吠えろ、雷鳴！'); for (const e of B.units(1 - u.owner)) await B.freeze(e); } },

  /* ---------------- シュガー ---------------- */
  { id: 'su_donut', name: 'ドーナツ兵', emoji: '🍩', tribe: 'sugar', rarity: 'N', type: 'unit', cost: 1, atk: 10, hp: 30, kw: ['shield'], text: '' },
  { id: 'su_candy', name: 'ペロペロキャンディ', emoji: '🍭', tribe: 'sugar', rarity: 'N', type: 'spell', cost: 1, target: 'allyUnit', text: '味方1体を+20/+30',
    ai: { t: 'buff', a: 20, h: 30 }, cast: async (B, pi, t) => { await B.buff(t, 20, 30); } },
  { id: 'su_bunny', name: 'ミルクうさぎ', emoji: '🐰', tribe: 'sugar', rarity: 'N', type: 'unit', cost: 2, atk: 20, hp: 30, text: 'アタック前：自分のヒーローを20回復',
    onPreAttack: async (B, u) => { await B.heal(B.hero(u.owner), 20, u); } },
  { id: 'su_shake', name: 'シュガーラッシュ', emoji: '🥤', tribe: 'sugar', rarity: 'N', type: 'spell', cost: 3, target: 'allyUnit', text: '味方1体に連撃を与える',
    ai: { t: 'kw', kw: 'double' }, cast: async (B, pi, t) => { B.giveKw(t, 'double'); await B.buff(t, 0, 0); } },
  { id: 'su_bear', name: 'テディガード', emoji: '🧸', tribe: 'sugar', rarity: 'N', type: 'unit', cost: 3, atk: 20, hp: 60, kw: ['thorns'], text: '' },
  { id: 'su_cupcake', name: 'カップケーキ姫', emoji: '🧁', tribe: 'sugar', rarity: 'R', type: 'unit', cost: 2, atk: 20, hp: 20, text: '登場時：他の味方全員を+10/+10',
    onPlay: async (B, u) => { await B.buffAll(u.owner, 10, 10, u); } },
  { id: 'su_strawberry', name: 'いちごナイト', emoji: '🍓', tribe: 'sugar', rarity: 'R', type: 'unit', cost: 3, atk: 30, hp: 40, kw: ['regen'], text: '' },
  { id: 'su_land', name: 'おかしの国', emoji: '🍰', tribe: 'sugar', rarity: 'R', type: 'field', cost: 3, text: 'フィールド：自分のターン開始時、味方全員と自分のヒーローを20回復',
    fieldTurnStart: async (B, owner) => { for (const u of B.units(owner)) await B.heal(u, 20); await B.heal(B.hero(owner), 20); },
    ambient: 'sugar' },
  { id: 'su_panda', name: 'パンダパティシエ', emoji: '🐼', tribe: 'sugar', rarity: 'SR', type: 'unit', cost: 4, atk: 30, hp: 50, text: 'アタック前：ランダムな味方2体を+10/+10',
    onPreAttack: async (B, u) => { for (let i = 0; i < 2; i++) { const t = R.pick(B.units(u.owner)); if (t) await B.buff(t, 10, 10); } } },
  { id: 'su_cake', name: 'パーティケーキ', emoji: '🎂', tribe: 'sugar', rarity: 'SR', type: 'spell', cost: 4, target: 'none', text: '味方全員を+20/+20',
    ai: { t: 'buffAll', a: 20, h: 20 }, cast: async (B, pi) => { await B.buffAll(pi, 20, 20); } },
  { id: 'su_unicorn', name: 'ユニコーン', emoji: '🦄', tribe: 'sugar', rarity: 'SSR', type: 'unit', cost: 4, atk: 40, hp: 50, text: '登場時：味方全員にシールド',
    onPlay: async (B, u) => { await B.cutin(u, 'みんなを守って！'); for (const a of B.units(u.owner)) B.giveShield(a); } },
  { id: 'su_queen', name: 'スイーツ女王ミルフィ', emoji: '👸', tribe: 'sugar', rarity: 'UR', type: 'unit', cost: 6, atk: 50, hp: 70, text: 'アタック前：味方全員を+10/+10、自分のヒーローを30回復',
    onPlay: async (B, u) => { await B.cutin(u, '甘い夢を見せてあげる♡'); },
    onPreAttack: async (B, u) => { await B.buffAll(u.owner, 10, 10); await B.heal(B.hero(u.owner), 30, u); } },

  /* ---------------- ネクロ ---------------- */
  { id: 'ne_skeleton', name: 'ガイコツ兵', emoji: '💀', tribe: 'necro', rarity: 'N', type: 'unit', cost: 1, atk: 20, hp: 10, text: '破壊時：ホネホネ（10/10）を召喚',
    onDeath: async (B, u) => { await B.summon(u.owner, 'tk_bone', u.lane); } },
  { id: 'ne_ghost', name: 'いたずらゴースト', emoji: '👻', tribe: 'necro', rarity: 'N', type: 'unit', cost: 2, atk: 30, hp: 10, kw: ['fly'], text: '' },
  { id: 'ne_bat', name: '吸血コウモリ', emoji: '🦇', tribe: 'necro', rarity: 'N', type: 'unit', cost: 2, atk: 20, hp: 20, kw: ['drain'], text: '' },
  { id: 'ne_drain', name: 'ソウルドレイン', emoji: '🩸', tribe: 'necro', rarity: 'N', type: 'spell', cost: 2, target: 'enemyUnit', text: '敵ユニット1体に30ダメージ。自分のヒーローを30回復',
    ai: { t: 'dmgUnit', v: 30 }, cast: async (B, pi, t) => { await B.damage(B.spellSrc(pi), t, 30, { fx: 'dark' }); await B.heal(B.hero(pi), 30); } },
  { id: 'ne_sacrifice', name: 'いけにえ', emoji: '🗡️', tribe: 'necro', rarity: 'N', type: 'spell', cost: 0, target: 'allyUnit', text: '味方1体を破壊する。カードを2枚引き、フィーバー+20',
    ai: { t: 'custom' }, cast: async (B, pi, t) => { await B.destroy(t); await B.draw(pi, 2); await B.addFever(pi, 20); } },
  { id: 'ne_zombie', name: 'ゾンビ', emoji: '🧟', tribe: 'necro', rarity: 'R', type: 'unit', cost: 3, atk: 30, hp: 40, kw: ['undying'], text: '' },
  { id: 'ne_spider', name: 'どくグモ', emoji: '🕷️', tribe: 'necro', rarity: 'R', type: 'unit', cost: 3, atk: 10, hp: 30, kw: ['poison'], text: '' },
  { id: 'ne_revive', name: '死者蘇生', emoji: '⚰️', tribe: 'necro', rarity: 'R', type: 'spell', cost: 2, target: 'none', text: '墓地のランダムなユニット1体を空きマスに復活。できなければ1枚引く',
    ai: { t: 'custom' },
    cast: async (B, pi) => {
      const P = B.P(pi), lanes = B.emptyLanes(pi);
      if (!P.grave.length || !lanes.length) { await B.draw(pi, 1); return; }
      const id = R.pick(P.grave);
      P.grave.splice(P.grave.indexOf(id), 1);
      await B.summon(pi, id, R.pick(lanes), { revive: true });
    } },
  { id: 'ne_grave', name: '真夜中の墓場', emoji: '🪦', tribe: 'necro', rarity: 'R', type: 'field', cost: 3, text: 'フィールド：自分のユニットが破壊されるたび、敵ヒーローに20ダメージ',
    fieldDeath: async (B, u, owner) => { if (u.owner === owner) await B.damage(B.fieldSrc(owner), B.hero(1 - owner), 20, { fx: 'dark', from: { unitPos: u } }); },
    ambient: 'necro' },
  { id: 'ne_reaper', name: '死神', emoji: '☠️', tribe: 'necro', rarity: 'SR', type: 'unit', cost: 5, atk: 40, hp: 40, text: '敵ユニットを倒すたび+20/+20',
    onKill: async (B, u) => { await B.buff(u, 20, 20); } },
  { id: 'ne_vampire', name: 'ヴァンパイア伯爵', emoji: '🧛', tribe: 'necro', rarity: 'SSR', type: 'unit', cost: 6, atk: 50, hp: 50, kw: ['drain'], text: '敵ユニットを倒すたび、他の味方全員を+10/+10',
    onPlay: async (B, u) => { await B.cutin(u, '血の宴を始めよう'); },
    onKill: async (B, u) => { await B.buffAll(u.owner, 10, 10, u); } },
  { id: 'ne_hades', name: '冥王ハデス', emoji: '👿', tribe: 'necro', rarity: 'UR', type: 'unit', cost: 8, atk: 60, hp: 80, text: '登場時：敵ユニット全員に（自分の墓地のユニット数×10）ダメージ',
    onPlay: async (B, u) => {
      const v = B.P(u.owner).grave.length * 10;
      await B.cutin(u, `亡者${B.P(u.owner).grave.length}体の怨念 → ${v}ダメージ`);
      const es = B.units(1 - u.owner);
      if (v > 0 && es.length) await B.damageMany(u, es, v, { fx: 'dark' });
    } },

  /* ---------------- ラッキー ---------------- */
  { id: 'l_dice', name: 'サイコロ小僧', emoji: '🎲', tribe: 'lucky', rarity: 'N', type: 'unit', cost: 1, atk: 0, hp: 10, atkText: '?', text: '登場時：サイコロを振り、出た目×10のATKを得る',
    onPlay: async (B, u) => { const n = await B.dice(u); await B.buff(u, n * 10, 0); } },
  { id: 'l_clover', name: '四つ葉のクローバー', emoji: '🍀', tribe: 'lucky', rarity: 'N', type: 'spell', cost: 1, target: 'none', text: 'このターン、味方のクリティカル率+50%。カードを1枚引く',
    ai: { t: 'custom' }, cast: async (B, pi) => { B.P(pi).critBonus += 0.5; B.say(pi, 'クリ率UP!!', '#8dff4f'); await B.draw(pi, 1); } },
  { id: 'l_coin', name: 'コイントス', emoji: '🪙', tribe: 'lucky', rarity: 'N', type: 'spell', cost: 1, target: 'enemyAny', text: '表：敵1体（ヒーローも可）に50ダメージ／裏：カードを1枚引く',
    ai: { t: 'dmgAny', v: 25 },
    cast: async (B, pi, t) => { const [h] = await B.coinFlip(pi, 1); if (h) await B.damage(B.spellSrc(pi), t, 50, { fx: 'gold' }); else await B.draw(pi, 1); } },
  { id: 'l_frog', name: '金運ガエル', emoji: '🐸', tribe: 'lucky', rarity: 'N', type: 'unit', cost: 2, atk: 20, hp: 30, kw: ['lucky'], text: '' },
  { id: 'l_tanuki', name: '一か八かタヌキ', emoji: '🦝', tribe: 'lucky', rarity: 'N', type: 'unit', cost: 3, atk: 40, hp: 30, text: '攻撃時：50%でダメージ3倍、50%でスカ',
    beforeAttack: async (B, u, info) => {
      if (R.chance(0.5)) { info.dmg *= 3; info.label = '3倍!!'; } else { info.dmg = 0; info.label = 'スカ…'; }
    } },
  { id: 'l_cat', name: 'まねきねこ', emoji: '🐱', tribe: 'lucky', rarity: 'R', type: 'unit', cost: 2, atk: 20, hp: 30, text: '味方がクリティカルを出すたびATK+10',
    onAllyCrit: async (B, u) => { await B.buff(u, 10, 0); } },
  { id: 'l_slot', name: 'スロットマシーン', emoji: '🎰', tribe: 'lucky', rarity: 'R', type: 'spell', cost: 2, target: 'none', text: 'スロットを回す！ 3つ揃えば大当たり、2つ揃いでも当たり。ハズレでも1枚引く',
    ai: { t: 'custom' }, cast: async (B, pi) => { await B.slotMachine(pi, false); } },
  { id: 'l_joker', name: 'ジョーカー', emoji: '🃏', tribe: 'lucky', rarity: 'R', type: 'unit', cost: 3, atk: 30, hp: 30, text: '登場時：ルーレット！（敵全員20ダメ／味方全員+20/+20／2枚ドロー／敵ヒーローに50ダメ）',
    onPlay: async (B, u) => {
      const opts = ['敵全員に20', '味方全員+20/+20', '2枚ドロー', 'ヒーローに50'];
      const i = await B.roulette(u.owner, opts);
      if (i === 0) { const es = B.units(1 - u.owner); if (es.length) await B.damageMany(u, es, 20, { fx: 'gold' }); }
      else if (i === 1) await B.buffAll(u.owner, 20, 20);
      else if (i === 2) await B.draw(u.owner, 2);
      else await B.damage(u, B.hero(1 - u.owner), 50, { fx: 'gold' });
    } },
  { id: 'l_casino', name: 'ネオン・カジノ', emoji: '🎡', tribe: 'lucky', rarity: 'R', type: 'field', cost: 3, text: 'フィールド：自分のユニットのクリティカル率+25%、クリティカルダメージが3倍',
    fieldCrit: (B, u, owner) => (u.owner === owner ? 0.25 : 0),
    fieldCritMult: (B, u, owner) => (u.owner === owner ? 3 : 2),
    ambient: 'lucky' },
  { id: 'l_rich', name: '成金ゴブリン', emoji: '🤑', tribe: 'lucky', rarity: 'SR', type: 'unit', cost: 3, atk: 30, hp: 30, kw: ['lucky'], text: '味方がクリティカルを出すたび、敵ヒーローに10ダメージ',
    onAllyCrit: async (B, u) => { await B.damage(u, B.hero(1 - u.owner), 10, { fx: 'gold', quick: true }); } },
  { id: 'l_goddess', name: '幸運の女神フォルトゥナ', emoji: '🧚', tribe: 'lucky', rarity: 'SSR', type: 'unit', cost: 6, atk: 40, hp: 50, kw: ['lucky'], text: '登場時：コインを5回投げ、表の数×20ダメージを敵ヒーローに',
    onPlay: async (B, u) => {
      const r = await B.coinFlip(u.owner, 5);
      const n = r.filter(Boolean).length;
      if (n) await B.damage(u, B.hero(1 - u.owner), n * 20, { fx: 'gold' });
    } },
  { id: 'l_king', name: 'ジャックポット・キング', emoji: '🤴', tribe: 'lucky', rarity: 'UR', type: 'unit', cost: 7, atk: 50, hp: 50, kw: ['lucky'], text: '登場時：確定大当たりスロット！（777：敵全員に70ダメ＆敵ヒーローに70ダメ）',
    onPlay: async (B, u) => { await B.cutin(u, '確定演出！！'); await B.slotMachine(u.owner, true); } },

  /* ---------------- メカ ---------------- */
  { id: 'm_gear', name: 'ギアボット', emoji: '⚙️', tribe: 'mecha', rarity: 'N', type: 'unit', cost: 1, atk: 20, hp: 20, text: '合体時：さらに+20/+20',
    onMerge: async (B, u) => { await B.buff(u, 20, 20); } },
  { id: 'm_battery', name: 'フル充電', emoji: '🔋', tribe: 'mecha', rarity: 'R', type: 'spell', cost: 0, target: 'none', text: 'このターン、PP+1',
    ai: { t: 'custom' }, cast: async (B, pi) => { await B.gainEnergy(pi, 1); } },
  { id: 'm_robot', name: 'ロボ兵', emoji: '🤖', tribe: 'mecha', rarity: 'N', type: 'unit', cost: 2, atk: 40, hp: 20, text: '量産型。合体させてナンボ。', flavor: true },
  { id: 'm_drone', name: 'UFOドローン', emoji: '🛸', tribe: 'mecha', rarity: 'N', type: 'unit', cost: 2, atk: 30, hp: 10, kw: ['fly'], text: '' },
  { id: 'm_punch', name: 'ロケットパンチ', emoji: '🚀', tribe: 'mecha', rarity: 'N', type: 'spell', cost: 2, target: 'allyUnit', text: '味方1体のATKぶんのダメージを、その正面（いなければ敵ヒーロー）に与える',
    ai: { t: 'custom' },
    cast: async (B, pi, t) => { const o = B.oppositeOf(t) || B.hero(1 - pi); await B.damage(t, o, B.atkOf(t), { fx: 'rocket' }); } },
  { id: 'm_arm', name: 'パワーアーム', emoji: '🦾', tribe: 'mecha', rarity: 'N', type: 'unit', cost: 3, atk: 30, hp: 40, text: '登場時：隣の味方のATK+20',
    onPlay: async (B, u) => { for (const a of B.adjacent(u)) await B.buff(a, 20, 0); } },
  { id: 'm_shieldbot', name: 'シールドボット', emoji: '🛡️', tribe: 'mecha', rarity: 'R', type: 'unit', cost: 3, atk: 20, hp: 50, text: '登場時：隣の味方にシールド',
    onPlay: async (B, u) => { for (const a of B.adjacent(u)) B.giveShield(a); } },
  { id: 'm_upgrade', name: 'アップグレード', emoji: '🔧', tribe: 'mecha', rarity: 'R', type: 'spell', cost: 3, target: 'allyUpgrade', text: '味方1体の★を1つ上げる（合体と同じ強化）',
    ai: { t: 'custom' }, cast: async (B, pi, t) => { await B.upgrade(t); } },
  { id: 'm_factory', name: 'メカ工場', emoji: '🏭', tribe: 'mecha', rarity: 'R', type: 'field', cost: 3, text: 'フィールド：自分のターン開始時、味方全員のATK+10',
    fieldTurnStart: async (B, owner) => { await B.buffAll(owner, 10, 0); },
    ambient: 'mecha' },
  { id: 'm_gunship', name: 'ガンシップ', emoji: '🚁', tribe: 'mecha', rarity: 'SR', type: 'unit', cost: 6, atk: 40, hp: 50, kw: ['fly', 'double'], text: '' },
  { id: 'm_satellite', name: '衛星兵器アルテミス', emoji: '🛰️', tribe: 'mecha', rarity: 'SSR', type: 'unit', cost: 5, atk: 50, hp: 50, text: 'アタック前：ランダムな敵に40ダメージ',
    onPlay: async (B, u) => { await B.cutin(u, 'ターゲット、ロックオン'); },
    onPreAttack: async (B, u) => { await B.damage(u, B.randomEnemy(u.owner, true), 40, { fx: 'laser' }); } },
  { id: 'm_deus', name: '機神デウス', emoji: '👾', tribe: 'mecha', rarity: 'UR', type: 'unit', cost: 8, atk: 80, hp: 80, text: '登場時：他の味方全員の★を1つ上げる',
    onPlay: async (B, u) => { await B.cutin(u, '全機、リミッター解除'); for (const a of B.units(u.owner)) if (a !== u && a.star < 3) await B.upgrade(a); } },

  /* ================= 未知なる軸 ================= */
  /* ---------------- クロノ（時間差で発動） ---------------- */
  { id: 'c_bomb', name: '時限ボム', emoji: '💣', tribe: 'chrono', rarity: 'N', type: 'unit', cost: 2, atk: 0, hp: 30, countdown: 2,
    text: 'カウント2：0になると敵全員（ヒーロー含む）に20ダメージ。その後こわれる',
    onCountdown: async (B, u) => {
      B.explode(u);
      await B.damageMany(u, [...B.units(1 - u.owner), B.hero(1 - u.owner)], 20, { fx: 'fire' });
      await B.destroy(u);
    } },
  { id: 'c_hourglass', name: '砂時計の番人', emoji: '⌛', tribe: 'chrono', rarity: 'N', type: 'unit', cost: 2, atk: 20, hp: 40, countdown: 2,
    text: 'カウント2：0になると味方全員を+10/+10', onCountdown: async (B, u) => { await B.buffAll(u.owner, 10, 10); } },
  { id: 'c_leap', name: 'タイムリープ', emoji: '⏩', tribe: 'chrono', rarity: 'R', type: 'spell', cost: 1, target: 'none',
    text: '味方全員のカウントを1進める。カードを1枚引く', ai: { t: 'custom' },
    cast: async (B, pi) => { for (const u of B.units(pi)) if (u.count > 0) await B.tickCount(u); await B.draw(pi, 1); } },
  { id: 'c_seer', name: '未来予知の魔女', emoji: '🔮', tribe: 'chrono', rarity: 'SR', type: 'unit', cost: 3, atk: 20, hp: 30, countdown: 1,
    text: 'カウント1：0になるとカードを2枚引き、PP+2（相手のターン中なら次の自分のターンに）', onCountdown: async (B, u) => { await B.draw(u.owner, 2); await B.gainEnergySoon(u.owner, 2); } },
  { id: 'c_tower', name: '終焉の時計塔', emoji: '🕰️', tribe: 'chrono', rarity: 'SSR', type: 'unit', cost: 5, atk: 0, hp: 60, countdown: 2,
    text: 'カウント2：0になると敵ユニット全員に60ダメージ、敵ヒーローに60ダメージ',
    onPlay: async (B, u) => { await B.cutin(u, '刻め、終焉のカウントダウン…'); },
    onCountdown: async (B, u) => {
      await B.cutin(u, 'タイムアップ！！');
      await B.quake();
      await B.damageMany(u, B.units(1 - u.owner), 60, { fx: 'laser' });
      await B.damage(u, B.hero(1 - u.owner), 60, { fx: 'laser' });
    } },

  /* ---------------- ワープ（マスを動かす） ---------------- */
  { id: 'w_mouse', name: '次元ネズミ', emoji: '🐭', tribe: 'warp', rarity: 'N', type: 'unit', cost: 1, atk: 20, hp: 20, kw: ['warp'], text: '' },
  { id: 'w_rhino', name: '突進サイ', emoji: '🦏', tribe: 'warp', rarity: 'N', type: 'unit', cost: 3, atk: 40, hp: 40,
    text: '攻撃した後、正面の敵を隣の空きマスへ吹き飛ばす',
    afterAttack: async (B, u, info) => { if (B.isUnit(info.target) && B.alive(info.target)) await B.pushAside(info.target); } },
  { id: 'w_gate', name: 'ワープゲート', emoji: '🚪', tribe: 'warp', rarity: 'R', type: 'spell', cost: 1, target: 'allyUnit',
    text: '味方1体を、正面に敵がいない空きマスへワープさせ、ATK+20', ai: { t: 'custom' },
    cast: async (B, pi, t) => { const l = B.freeLane(pi, t.lane, true); if (l != null) await B.moveUnit(t, l); await B.buff(t, 20, 0); } },
  { id: 'w_blackhole', name: 'ブラックホール', emoji: '🕳️', tribe: 'warp', rarity: 'SR', type: 'spell', cost: 4, target: 'none',
    text: '敵ユニット全員に20ダメージ。生き残った敵を左側へ吸い寄せる（右側に直撃コースが空く）', ai: { t: 'aoe', v: 25 },
    cast: async (B, pi) => { await B.damageMany(B.spellSrc(pi), B.units(1 - pi), 20, { fx: 'dark' }); await B.compact(1 - pi); } },
  { id: 'w_galaxy', name: '銀河の門番', emoji: '🌌', tribe: 'warp', rarity: 'SSR', type: 'unit', cost: 4, atk: 50, hp: 50,
    text: '登場時：味方全員を、正面に敵がいない空きマスへできるだけワープさせる',
    onPlay: async (B, u) => { await B.cutin(u, '全軍、ワープ開始！'); await B.warpAllToOpen(u.owner); } },

  /* ---------------- ミミック（変身・コピー・強奪） ---------------- */
  { id: 'mi_copycat', name: 'ものまね師', emoji: '🤹', tribe: 'mimic', rarity: 'N', type: 'unit', cost: 2, atk: 10, hp: 10,
    text: '登場時：正面の敵ユニットに変身する（そのカード本来の強さになる）。正面にいなければ+20/+10',
    onPlay: async (B, u) => { const o = B.oppositeOf(u); if (o && !o.def.token) await B.transform(u, o.id); else await B.buff(u, 20, 10); } },
  { id: 'mi_egg', name: 'ふしぎなタマゴ', emoji: '🥚', tribe: 'mimic', rarity: 'N', type: 'unit', cost: 3, atk: 0, hp: 20,
    text: 'アタック前：ランダムなコスト3〜5のユニットに孵化して、そのまま攻撃する。何が生まれるかな？',
    onPreAttack: async (B, u) => {
      const pool = COLLECTIBLE.filter(c => c.type === 'unit' && c.cost >= 3 && c.cost <= 5 && c.rarity !== 'UR');
      await B.transform(u, R.pick(pool).id, { hatch: true });
    } },
  { id: 'mi_wand', name: 'へんしんステッキ', emoji: '🪄', tribe: 'mimic', rarity: 'R', type: 'spell', cost: 2, target: 'enemyUnit',
    text: '敵ユニット1体を「ぴよぴよ」（10/10・能力なし）に変える', ai: { t: 'custom' },
    cast: async (B, pi, t) => { await B.transform(t, 'tk_chick'); } },
  { id: 'mi_mirror', name: 'ミラーマン', emoji: '🪞', tribe: 'mimic', rarity: 'SR', type: 'unit', cost: 4, atk: 30, hp: 30,
    text: '登場時：ランダムな敵ユニット1体のコピーを、自分の空きマスに召喚する',
    onPlay: async (B, u) => {
      const e = R.pick(B.units(1 - u.owner).filter(x => !x.def.token));
      const l = B.freeLane(u.owner, u.lane, true);
      if (e && l != null) await B.summon(u.owner, e.id, l, { copy: true });
    } },
  { id: 'mi_thief', name: '怪盗ファントム', emoji: '🦹', tribe: 'mimic', rarity: 'SSR', type: 'unit', cost: 6, atk: 40, hp: 40,
    text: '登場時：いちばんATKが高い敵ユニット1体を奪い、自分の空きマスに置く（空きがなければ破壊）',
    onPlay: async (B, u) => {
      await B.cutin(u, 'その宝、いただくぜ！');
      const es = B.units(1 - u.owner);
      if (es.length) await B.steal(es.sort((a, b) => B.atkOf(b) - B.atkOf(a))[0], u.owner);
    } },

  /* ---------------- リスク（HPを払う・背水） ---------------- */
  { id: 'r_boxer', name: '捨て身ボクサー', emoji: '🥊', tribe: 'risk', rarity: 'N', type: 'unit', cost: 1, atk: 40, hp: 10, hpCost: 30,
    text: 'HPコスト30：出すとき自分のヒーローHPを30払う。そのぶん強い' },
  { id: 'r_ronin', name: '背水の浪人', emoji: '🥷', tribe: 'risk', rarity: 'N', type: 'unit', cost: 2, atk: 20, hp: 30,
    text: '自分のヒーローHPが半分以下ならATK+30', atkMod: (B, u) => { const P = B.P(u.owner); return P.hp <= P.maxHp / 2 ? 30 : 0; } },
  { id: 'r_pact', name: '悪魔の契約', emoji: '📜', tribe: 'risk', rarity: 'R', type: 'spell', cost: 1, target: 'none', hpCost: 30,
    text: 'HPコスト30：カードを3枚引く', ai: { t: 'custom' }, cast: async (B, pi) => { await B.draw(pi, 3); } },
  { id: 'r_moon', name: 'ブラッドムーン', emoji: '🌕', tribe: 'risk', rarity: 'SR', type: 'field', cost: 2,
    text: 'フィールド：自分のターン開始時、自分のヒーローHPを20払い、味方全員のATK+10（毎ターン重なる）',
    fieldTurnStart: async (B, owner) => { await B.payHp(owner, 20); await B.buffAll(owner, 10, 0); }, ambient: 'risk' },
  { id: 'r_berserk', name: '狂戦士ベルセルク', emoji: '😡', tribe: 'risk', rarity: 'SSR', type: 'unit', cost: 6, atk: 40, hp: 50, kw: ['double'],
    text: '自分のヒーローが失ったHP40ごとにATK+10',
    onPlay: async (B, u) => { await B.cutin(u, '痛みが…力になる！！'); },
    atkMod: (B, u) => { const P = B.P(u.owner); return Math.floor(Math.max(0, P.maxHp - P.hp) / 40) * 10; } },

  /* ---------------- ソロ（味方が少ないほど強い） ---------------- */
  { id: 'so_leopard', name: '孤高のヒョウ', emoji: '🐆', tribe: 'solo', rarity: 'N', type: 'unit', cost: 2, atk: 20, hp: 30,
    text: '他に味方がいなければATK+30', atkMod: (B, u) => (B.units(u.owner).length <= 1 ? 30 : 0) },
  { id: 'so_hermit', name: '山ごもり仙人', emoji: '🧘', tribe: 'solo', rarity: 'N', type: 'unit', cost: 3, atk: 10, hp: 50,
    text: '自分の場の空きマス1つにつきATK+10', atkMod: (B, u) => B.emptyLanes(u.owner).length * 10 },
  { id: 'so_spot', name: 'スポットライト', emoji: '🔦', tribe: 'solo', rarity: 'R', type: 'spell', cost: 2, target: 'allyUnit',
    text: '味方1体を+20/+20。味方がその1体だけなら、さらに連撃を与える', ai: { t: 'buff', a: 20, h: 20 },
    cast: async (B, pi, t) => { await B.buff(t, 20, 20); if (B.units(pi).length === 1) B.giveKw(t, 'double'); } },
  { id: 'so_rider', name: '一騎当千ライダー', emoji: '🏇', tribe: 'solo', rarity: 'SR', type: 'unit', cost: 5, atk: 40, hp: 40,
    text: '他に味方がいない時、飛行と連撃を得る', dynKw: (B, u) => (B.units(u.owner).length <= 1 ? ['fly', 'double'] : []) },
  { id: 'so_lion', name: '孤高の覇王レグルス', emoji: '🦁', tribe: 'solo', rarity: 'SSR', type: 'unit', cost: 6, atk: 50, hp: 50,
    text: '登場時：他の味方をすべて破壊し、1体につき+30/+30',
    onPlay: async (B, u) => {
      const others = B.units(u.owner).filter(x => x !== u);
      await B.cutin(u, others.length ? `${others.length}体の魂を喰らう！` : '我ひとりで十分だ');
      for (const o of others) await B.destroy(o);
      if (others.length) await B.buff(u, 30 * others.length, 30 * others.length);
    } },

  /* ---------------- フォート（鉄壁の軸：守護・アーマー） ---------------- */
  { id: 'f_turtle', name: 'てっぺきガメ', emoji: '🐢', tribe: 'fort', rarity: 'N', type: 'unit', cost: 2, atk: 20, hp: 50, kw: ['guard'], text: '' },
  { id: 'f_hedgehog', name: 'ヨロイハリネズミ', emoji: '🦔', tribe: 'fort', rarity: 'N', type: 'unit', cost: 1, atk: 10, hp: 30, kw: ['armor'], text: '' },
  { id: 'f_golem', name: '城壁ゴーレム', emoji: '🧱', tribe: 'fort', rarity: 'R', type: 'unit', cost: 4, atk: 20, hp: 80, kw: ['guard', 'armor'], text: '' },
  { id: 'f_wall', name: '鉄壁の陣形', emoji: '🛡️', tribe: 'fort', rarity: 'SR', type: 'spell', cost: 2, target: 'none',
    text: '味方全員がアーマーを得る。いちばんHPが多い味方は守護も得る', ai: { t: 'custom' },
    cast: async (B, pi) => {
      const us = B.units(pi);
      for (const u of us) B.giveKw(u, 'armor');
      const top = us.sort((a, b) => b.hp - a.hp)[0];
      if (top) B.giveKw(top, 'guard');
    } },
  { id: 'f_king', name: '不落の要塞王', emoji: '🏯', tribe: 'fort', rarity: 'SSR', type: 'unit', cost: 6, atk: 30, hp: 90, kw: ['guard', 'armor'],
    text: 'ダメージを受けるたび、受けたダメージと同じだけ敵ヒーローにダメージを返す',
    onPlay: async (B, u) => { await B.cutin(u, '我が城壁、一歩も通さぬ！'); },
    onHurt: async (B, u, amt) => { if (amt > 0) await B.damage(u, B.hero(1 - u.owner), amt, { fx: 'hit' }); } },

  /* ---------------- ブルーム（癒しの軸：回復で強くなる） ---------------- */
  { id: 'h_fairy', name: '癒しの妖精', emoji: '🧚', tribe: 'bloom', rarity: 'N', type: 'unit', cost: 1, atk: 20, hp: 20,
    text: 'ターン開始時：自分のヒーローを20回復', onTurnStart: async (B, u) => { await B.heal(B.hero(u.owner), 20, u); } },
  { id: 'h_flower', name: '花の守り手', emoji: '🌷', tribe: 'bloom', rarity: 'N', type: 'unit', cost: 2, atk: 20, hp: 40,
    text: '自分のヒーローかユニットが回復するたび、ATK+10', onAnyHeal: async (B, a) => { await B.buff(a, 10, 0, { quick: true }); } },
  { id: 'h_rain', name: 'いやしの雨', emoji: '🌦️', tribe: 'bloom', rarity: 'R', type: 'spell', cost: 2, target: 'none',
    text: '味方全員と自分のヒーローを30回復', ai: { t: 'custom' },
    cast: async (B, pi) => { for (const u of B.units(pi)) await B.heal(u, 30); await B.heal(B.hero(pi), 30); } },
  { id: 'h_tree', name: '生命の大樹', emoji: '🌳', tribe: 'bloom', rarity: 'SR', type: 'field', cost: 3,
    text: 'フィールド：自分のターン開始時、味方全員のHP最大値+10、さらに30回復（ヒーローは回復しない）',
    fieldTurnStart: async (B, owner) => { for (const u of B.units(owner)) { await B.buff(u, 0, 10, { quick: true }); await B.heal(u, 30); } }, ambient: 'sugar' },
  { id: 'h_saint', name: '聖女アマネ', emoji: '😇', tribe: 'bloom', rarity: 'SSR', type: 'unit', cost: 5, atk: 40, hp: 60,
    text: '登場時：自分のヒーローを50回復。味方が回復するたび、回復した量（最大40）のダメージをランダムな敵に',
    onPlay: async (B, u) => { await B.cutin(u, '癒しの光よ、刃となれ'); await B.heal(B.hero(u.owner), 50, u); },
    onAnyHeal: async (B, a, t, v) => { await B.damage(a, B.randomEnemy(a.owner), Math.min(40, v), { fx: 'gold' }); await B.processDeaths(); } },

  /* ---------------- ジオ（陣地の軸：マスに陣を刻む） ---------------- */
  { id: 'g_mason', name: '陣地職人', emoji: '👷', tribe: 'geo', rarity: 'N', type: 'unit', cost: 2, atk: 20, hp: 30,
    text: '登場時：このマスに「力の陣」を刻む（このマスの味方はATK+10）', onPlay: async (B, u) => { await B.setTile(u.owner, u.lane, 'power', u.owner); } },
  { id: 'g_digger', name: '落とし穴掘り', emoji: '⛏️', tribe: 'geo', rarity: 'N', type: 'unit', cost: 1, atk: 10, hp: 20,
    text: '登場時：正面に敵がいれば20ダメージ。いなければ正面の敵のマスに「落とし穴」（敵ユニットが出ると30ダメージ）',
    onPlay: async (B, u) => { const o = B.oppositeOf(u); if (o) await B.damage(u, o, 20, { fx: 'hit' }); else await B.setTile(1 - u.owner, u.lane, 'trap', u.owner); } },
  { id: 'g_ward', name: '守りの結界', emoji: '🔰', tribe: 'geo', rarity: 'R', type: 'spell', cost: 2, target: 'none',
    text: '陣のない自分のマスすべてに「守りの陣」を刻む（このマスの味方が受けるダメージ-10）', ai: { t: 'custom' },
    cast: async (B, pi) => { for (let l = 0; l < LANES; l++) if (!B.tileAt(pi, l)) await B.setTile(pi, l, 'guard', pi); } },
  { id: 'g_lord', name: '領域支配者', emoji: '🚩', tribe: 'geo', rarity: 'SR', type: 'unit', cost: 4, atk: 30, hp: 40,
    text: '自分の陣1つにつきATK+10。登場時：このマスに「力の陣」を刻む',
    atkMod: (B, u) => B.tileCount(u.owner) * 10, onPlay: async (B, u) => { await B.setTile(u.owner, u.lane, 'power', u.owner); } },
  { id: 'g_gaia', name: '大地の覇者ガイア', emoji: '🌍', tribe: 'geo', rarity: 'SSR', type: 'unit', cost: 6, atk: 50, hp: 60,
    text: '登場時：自分のマスすべてに「力の陣」、敵の空きマスすべてに「落とし穴」を刻む',
    onPlay: async (B, u) => {
      await B.cutin(u, '大地よ、我に従え！');
      await B.quake();
      for (let l = 0; l < LANES; l++) await B.setTile(u.owner, l, 'power', u.owner);
      for (const l of B.emptyLanes(1 - u.owner)) await B.setTile(1 - u.owner, l, 'trap', u.owner);
    } },

  /* ---------------- アルカナ（呪文の軸：スペルで強く・安く） ---------------- */
  { id: 'a_apprentice', name: '見習い魔法使い', emoji: '🧑‍🎓', tribe: 'arcane', rarity: 'N', type: 'unit', cost: 2, atk: 20, hp: 30,
    text: '味方がスペルを使うたび+10/+10', onAllySpell: async (B, a) => { await B.buff(a, 10, 10, { quick: true }); } },
  { id: 'a_missile', name: 'マジックミサイル', emoji: '✨', tribe: 'arcane', rarity: 'N', type: 'spell', cost: 1, target: 'none',
    text: 'ランダムな敵ユニット（いなければヒーロー）に20ダメージを2回。このターン2枚目以降のスペルなら3回', ai: { t: 'aoe', v: 30 },
    cast: async (B, pi) => {
      const n = B.G.spellsTurn >= 2 ? 3 : 2;
      for (let i = 0; i < n; i++) { await B.damage(B.spellSrc(pi), B.randomEnemy(pi), 20, { fx: 'bolt' }); await B.processDeaths(); }
    } },
  { id: 'a_tome', name: '魔導書の写本', emoji: '📖', tribe: 'arcane', rarity: 'R', type: 'spell', cost: 0, target: 'none',
    text: 'カードを1枚引く。このターン使ったスペルが2枚以上なら、さらに1枚引く', ai: { t: 'draw', v: 1.5 },
    cast: async (B, pi) => { await B.draw(pi, B.G.spellsTurn >= 2 ? 2 : 1); } },
  { id: 'a_merlin', name: '大魔導士メルリン', emoji: '🧙‍♂️', tribe: 'arcane', rarity: 'SR', type: 'unit', cost: 5, atk: 30, hp: 40,
    text: 'このターン使ったスペル1枚につきコスト-1。味方がスペルを使うたび、敵ヒーローに20ダメージ',
    costMod: (B, pi) => (B.G.active === pi ? B.G.spellsTurn || 0 : 0),
    onAllySpell: async (B, a) => { await B.damage(a, B.hero(1 - a.owner), 20, { fx: 'bolt' }); } },
  { id: 'a_star', name: '星詠みの賢者', emoji: '🌠', tribe: 'arcane', rarity: 'SSR', type: 'unit', cost: 7, atk: 50, hp: 50,
    text: 'このターン使ったスペル1枚につきコスト-1。登場時：このターン使ったスペルの数×20ダメージを敵ユニット全員に',
    costMod: (B, pi) => (B.G.active === pi ? B.G.spellsTurn || 0 : 0),
    onPlay: async (B, u) => {
      const n = B.G.spellsTurn || 0;
      await B.cutin(u, n ? `${n}つの呪文が星を呼ぶ！` : '星はまだ眠っている…');
      if (n) await B.damageMany(u, B.units(1 - u.owner), n * 20, { fx: 'meteor' });
    } },

  /* ---------------- リズム（連打の軸：コンボで化ける） ---------------- */
  { id: 'ry_kid', name: 'リズム小僧', emoji: '🥁', tribe: 'rhythm', rarity: 'N', type: 'unit', cost: 1, atk: 10, hp: 20,
    text: '登場時：コンボ+2。コンボが5以上なら、さらにカードを1枚引く',
    onPlay: async (B, u) => { B.bumpCombo(u.owner, 2); if (B.G.combo >= 5) await B.draw(u.owner, 1); } },
  { id: 'ry_dancer', name: 'ビートダンサー', emoji: '🕺', tribe: 'rhythm', rarity: 'N', type: 'unit', cost: 2, atk: 20, hp: 20,
    text: '登場時：このターンのコンボ数×10、ATKとHPを得る（最大+60/+60）',
    onPlay: async (B, u) => { const v = Math.min(60, B.G.combo * 10); if (v) await B.buff(u, v, v); } },
  { id: 'ry_finish', name: 'フィニッシュブロー', emoji: '👊', tribe: 'rhythm', rarity: 'R', type: 'spell', cost: 2, target: 'enemyAny',
    text: '敵1体（ヒーローも可）に、このターンのコンボ数×15ダメージ', ai: { t: 'custom' },
    cast: async (B, pi, t) => { await B.damage(B.spellSrc(pi), t, B.G.combo * 15, { fx: 'meteor' }); } },
  { id: 'ry_dj', name: 'DJスクラッチ', emoji: '🎧', tribe: 'rhythm', rarity: 'SR', type: 'unit', cost: 3, atk: 30, hp: 30,
    text: '自分がカードを出すたび、ランダムな敵に20ダメージ＆コンボ+1',
    onAllyCard: async (B, a) => { await B.damage(a, B.randomEnemy(a.owner), 20, { fx: 'bolt' }); B.bumpCombo(a.owner, 1); } },
  { id: 'ry_master', name: 'コンボマスター・ビート', emoji: '🎶', tribe: 'rhythm', rarity: 'SSR', type: 'unit', cost: 6, atk: 40, hp: 40, kw: ['double'],
    text: '登場時：コンボ+3。自分のターン中、コンボ数×10だけATKが上がる（最大+80）',
    onPlay: async (B, u) => { await B.cutin(u, 'ビートを刻め！ 止まるな！'); B.bumpCombo(u.owner, 3); },
    atkMod: (B, u) => (B.G.active === u.owner ? Math.min(80, B.G.combo * 10) : 0) },

  /* ---------------- トークン（入手不可） ---------------- */
  { id: 'tk_bone', name: 'ホネホネ', emoji: '🦴', tribe: 'necro', rarity: 'N', type: 'unit', cost: 1, atk: 10, hp: 10, token: true, text: 'カタカタ。', flavor: true },
  { id: 'tk_chick', name: 'ぴよぴよ', emoji: '🐣', tribe: 'mimic', rarity: 'N', type: 'unit', cost: 1, atk: 10, hp: 10, token: true, text: '変身させられてしまった…', flavor: true },
];

const CARDS = {};
CARD_LIST.forEach(c => { c.kw = c.kw || []; CARDS[c.id] = c; });
const COLLECTIBLE = CARD_LIST.filter(c => !c.token);

// カードの説明文（キーワード込み）
function cardRulesText(def) {
  const parts = [];
  if (def.hpCost && !/HPコスト/.test(def.text)) parts.push(`HPコスト${def.hpCost}`);
  if (def.kw && def.kw.length) parts.push(def.kw.map(k => KW[k].name).join('・'));
  if (def.text && !def.flavor) parts.push(def.text);
  return parts.join('\n');
}
function typeLabel(def) {
  return def.type === 'unit' ? 'ユニット' : def.type === 'spell' ? 'スペル' : 'フィールド';
}
