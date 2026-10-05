'use strict';
/* ===== ボスラッシュ：20体のボスと、ボスだけが使う特殊カード（EX） =====
   ボスはそれぞれ
   ・常時能力（毎ターン開始時）
   ・必殺技（数ターンごと。発動までのカウントが画面に出る）
   ・覚醒（HPが一定以下になると一度だけ発動し、戦い方が変わる）
   ・専用のEXカード2種
   を持つ。 */

RARITY.EX = { name: 'EX', color: '#ff2a4d', rank: 5 };

const foe = pi => 1 - pi;
const strongest = (B, pi) => B.units(pi).sort((a, b) => B.atkOf(b) - B.atkOf(a));
const unitPool = f => COLLECTIBLE.filter(c => c.type === 'unit' && f(c));
async function giveCards(B, pi, ids) {
  const P = B.P(pi);
  for (const id of ids) {
    if (P.hand.length >= HAND_MAX) break;
    const c = { uid: B._uid++, id, gift: true };
    P.hand.push(c);
    await B.V('draw', pi, c, { gift: true });
  }
}
async function summonMany(B, pi, id, n, opts) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const l = B.freeLane(pi, 2, true);
    if (l == null) break;
    out.push(await B.summon(pi, id, l, opts || {}));
  }
  return out.filter(Boolean);
}

/* ---------------- EXカード（ボス専用・入手不可） ---------------- */
const BOSS_CARD_LIST = [
  // 01 ガチャ神
  { id: 'x_tenjo', name: '天井ガチャ', emoji: '🎰', tribe: 'lucky', type: 'spell', cost: 3, target: 'none',
    text: 'ランダムなSSRかURのユニットを、空きマスに召喚する', ai: { t: 'custom' },
    cast: async (B, pi) => {
      const l = B.freeLane(pi, 2, true);
      if (l == null) { await B.draw(pi, 1); return; }
      await B.summon(pi, R.pick(unitPool(c => c.rarity === 'SSR' || c.rarity === 'UR')).id, l);
    } },
  { id: 'x_kakuritsu', name: '確率操作官', emoji: '🕴️', tribe: 'lucky', type: 'unit', cost: 3, atk: 30, hp: 40, kw: ['lucky'],
    text: '味方がクリティカルを出すたび、敵ヒーローに20ダメージ',
    onAllyCrit: async (B, u) => { await B.damage(u, B.hero(foe(u.owner)), 20, { fx: 'gold' }); } },
  // 02 炎上インフルエンサー
  { id: 'x_kakusan', name: '拡散希望', emoji: '📢', tribe: 'blaze', type: 'spell', cost: 2, target: 'none',
    text: '敵ユニット全員に炎上2', ai: { t: 'aoe', v: 30 },
    cast: async (B, pi) => { for (const e of B.units(foe(pi))) await B.burn(e, 2, B.hero(pi)); } },
  { id: 'x_fan', name: '炎上ファン', emoji: '🙋', tribe: 'blaze', type: 'unit', cost: 2, atk: 30, hp: 20, kw: ['burnhit'],
    text: '破壊時：敵ユニット全員に炎上1',
    onDeath: async (B, u) => { for (const e of B.units(foe(u.owner))) await B.burn(e, 1, u); } },
  // 03 徹夜の魔物
  { id: 'x_enadori', name: 'エナドリ兵', emoji: '🥫', tribe: 'storm', type: 'unit', cost: 2, atk: 30, hp: 30,
    text: '登場時：PP+1', onPlay: async (B, u) => { await B.gainEnergy(u.owner, 1); } },
  { id: 'x_shinya', name: '深夜テンション', emoji: '🌃', tribe: 'storm', type: 'spell', cost: 2, target: 'none',
    text: '味方全員のATK+20。ランダムな味方1体に連撃', ai: { t: 'buffAll', a: 20, h: 0 },
    cast: async (B, pi) => { await B.buffAll(pi, 20, 0); const u = R.pick(B.units(pi)); if (u) B.giveKw(u, 'double'); } },
  // 04 ウロボロス
  { id: 'x_tail', name: '蛇の尾', emoji: '🪱', tribe: 'necro', type: 'unit', cost: 1, atk: 20, hp: 20, kw: ['undying'], text: '' },
  { id: 'x_ring', name: 'ウロボロスの環', emoji: '⭕', tribe: 'necro', type: 'spell', cost: 3, target: 'none',
    text: '自分の墓地のユニットを2体、空きマスに復活させる', ai: { t: 'custom' },
    cast: async (B, pi) => { if (!(await B.reviveFromGrave(pi, 2))) await B.draw(pi, 1); } },
  // 05 課金王
  { id: 'x_kakin', name: '課金兵', emoji: '💳', tribe: 'mecha', type: 'unit', cost: 3, atk: 40, hp: 40, kw: ['shield'], text: '' },
  { id: 'x_magic', name: '魔法のカード', emoji: '💴', tribe: 'lucky', type: 'spell', cost: 0, target: 'none',
    text: 'PP+2。カードを1枚引く', ai: { t: 'custom' },
    cast: async (B, pi) => { await B.gainEnergy(pi, 2); await B.draw(pi, 1); } },
  // 06 通知の魔神
  { id: 'x_badge', name: '通知バッジ', emoji: '🔴', tribe: 'storm', type: 'unit', cost: 1, atk: 10, hp: 10, kw: ['fly'],
    text: '登場時：敵ヒーローに10ダメージ', onPlay: async (B, u) => { await B.damage(u, B.hero(foe(u.owner)), 10, { fx: 'bolt' }); } },
  { id: 'x_push', name: 'プッシュ通知', emoji: '📳', tribe: 'storm', type: 'spell', cost: 2, target: 'none',
    text: 'ランダムな敵（ユニットかヒーロー）に20ダメージを4回', ai: { t: 'aoe', v: 30 },
    cast: async (B, pi) => {
      for (let i = 0; i < 4; i++) { await B.damage(B.spellSrc(pi), B.randomEnemy(pi, R.chance(0.35)), 20, { fx: 'bolt' }); await B.processDeaths(); }
    } },
  // 07 推しの亡霊
  { id: 'x_penlight', name: 'ペンライト隊', emoji: '🪄', tribe: 'sugar', type: 'unit', cost: 2, atk: 20, hp: 30,
    text: '登場時：味方全員のATK+10', onPlay: async (B, u) => { await B.buffAll(u.owner, 10, 0); } },
  { id: 'x_kyokyu', name: '推しの供給', emoji: '💝', tribe: 'sugar', type: 'spell', cost: 3, target: 'allyUnit',
    text: '味方1体に+40/+40とシールド', ai: { t: 'buff', a: 40, h: 40 },
    cast: async (B, pi, t) => { await B.buff(t, 40, 40); B.giveShield(t); } },
  // 08 リールの帝王
  { id: 'x_buzz', name: 'バズ動画', emoji: '🎬', tribe: 'blaze', type: 'unit', cost: 2, atk: 20, hp: 20, kw: ['double'], text: '' },
  { id: 'x_osusume', name: 'おすすめ欄', emoji: '📜', tribe: 'storm', type: 'spell', cost: 1, target: 'none',
    text: 'カードを2枚引く', ai: { t: 'draw', v: 2 }, cast: async (B, pi) => { await B.draw(pi, 2); } },
  // 09 ブラック企業
  { id: 'x_shachiku', name: '社畜ロボ', emoji: '🦾', tribe: 'mecha', type: 'unit', cost: 2, atk: 30, hp: 30,
    text: '破壊時：ランダムな味方1体に+20/+20', onDeath: async (B, u) => { const a = R.pick(B.units(u.owner)); if (a) await B.buff(a, 20, 20); } },
  { id: 'x_kyujitsu', name: '休日出勤', emoji: '📅', tribe: 'risk', type: 'spell', cost: 2, target: 'none',
    text: '味方全員に+20/+10', ai: { t: 'buffAll', a: 20, h: 10 }, cast: async (B, pi) => { await B.buffAll(pi, 20, 10); } },
  // 10 ループス
  { id: 'x_guardian', name: '時限ガーディアン', emoji: '🛡️', tribe: 'chrono', type: 'unit', cost: 3, atk: 30, hp: 50, countdown: 2,
    text: 'カウント2：敵ユニット全員に40ダメージ',
    onCountdown: async (B, u) => { await B.damageMany(u, B.units(foe(u.owner)), 40, { fx: 'quake' }); } },
  { id: 'x_rewind', name: '巻き戻しの砂', emoji: '⌛', tribe: 'chrono', type: 'spell', cost: 2, target: 'enemyUnit',
    text: '敵ユニット1体を手札に戻す', ai: { t: 'freeze' }, cast: async (B, pi, t) => { await B.bounce(t); } },
  // 11 虚無の王
  { id: 'x_shadow', name: '虚無の影', emoji: '👤', tribe: 'solo', type: 'unit', cost: 5, atk: 60, hp: 60,
    text: '他に味方がいない時、飛行と連撃を得る', dynKw: (B, u) => (B.units(u.owner).length <= 1 ? ['fly', 'double'] : []) },
  { id: 'x_blank', name: '空白', emoji: '⬛', tribe: 'solo', type: 'spell', cost: 3, target: 'enemyUnit',
    text: '敵ユニット1体を破壊する', ai: { t: 'dmgUnit', v: 999 }, cast: async (B, pi, t) => { await B.annihilate(B.spellSrc(pi), [t]); } },
  // 12 錬金術師
  { id: 'x_homun', name: 'ホムンクルス', emoji: '🧪', tribe: 'mimic', type: 'unit', cost: 3, atk: 30, hp: 30,
    text: '登場時：正面の敵ユニットに変身して+20/+20。いなければ+30/+30',
    onPlay: async (B, u) => { const o = B.oppositeOf(u); if (o && !o.def.token) { await B.transform(u, o.id); await B.buff(u, 20, 20); } else await B.buff(u, 30, 30); } },
  { id: 'x_rensei', name: '錬成陣', emoji: '🔯', tribe: 'mimic', type: 'spell', cost: 3, target: 'none',
    text: 'ランダムなSSRユニットを2枚、手札に加える', ai: { t: 'draw', v: 2 },
    cast: async (B, pi) => { const pool = unitPool(c => c.rarity === 'SSR'); await giveCards(B, pi, [R.pick(pool).id, R.pick(pool).id]); } },
  // 13 電脳の女帝
  { id: 'x_drone', name: 'ドローン', emoji: '🛸', tribe: 'mecha', type: 'unit', cost: 1, atk: 10, hp: 10, kw: ['fly'], text: '' },
  { id: 'x_firewall', name: 'ファイアウォール', emoji: '🧱', tribe: 'mecha', type: 'spell', cost: 2, target: 'none',
    text: '味方全員にシールド', ai: { t: 'custom' }, cast: async (B, pi) => { for (const u of B.units(pi)) B.giveShield(u); } },
  // 14 嫉妬の魔獣
  { id: 'x_netami', name: '妬み蛇', emoji: '🐍', tribe: 'risk', type: 'unit', cost: 2, atk: 20, hp: 40,
    text: '正面の敵ユニットのATKぶん、ATKが上がる', atkMod: (B, u) => { const o = B.oppositeOf(u); return o ? o.atk : 0; } },
  { id: 'x_yokodori', name: '横取り', emoji: '🫳', tribe: 'risk', type: 'spell', cost: 2, target: 'enemyUnit',
    text: '敵ユニット1体のATKを0にし、そのぶんランダムな味方1体のATKを上げる', ai: { t: 'freeze' },
    cast: async (B, pi, t) => { const v = t.atk; await B.debuff(t, v); const a = R.pick(B.units(pi)); if (a && v) await B.buff(a, v, 0); } },
  // 15 終焉の時計塔
  { id: 'x_byoshin', name: '秒針の騎士', emoji: '🗡️', tribe: 'chrono', type: 'unit', cost: 2, atk: 30, hp: 30, countdown: 2,
    text: 'カウント2：敵ヒーローに50ダメージ',
    onCountdown: async (B, u) => { await B.damage(u, B.hero(foe(u.owner)), 50, { fx: 'laser' }); } },
  { id: 'x_timebomb', name: '時限爆弾', emoji: '💣', tribe: 'chrono', type: 'unit', cost: 3, atk: 0, hp: 40, countdown: 3,
    text: 'カウント3：敵ユニット全員と敵ヒーローに80ダメージ',
    onCountdown: async (B, u) => { B.explode(u); await B.damageMany(u, [...B.units(foe(u.owner)), B.hero(foe(u.owner))], 80, { fx: 'fire' }); } },
  // 16 深淵の観測者
  { id: 'x_tentacle', name: '深淵の触手', emoji: '🦑', tribe: 'warp', type: 'unit', cost: 3, atk: 40, hp: 40, kw: ['warp', 'chain'], text: '' },
  { id: 'x_tenni', name: '虚空転移', emoji: '🌀', tribe: 'warp', type: 'spell', cost: 1, target: 'none',
    text: '自分のユニット全員を正面が空いたマスへワープさせ、ATK+10', ai: { t: 'buffAll', a: 10, h: 0 },
    cast: async (B, pi) => { await B.warpAllToOpen(pi); await B.buffAll(pi, 10, 0); } },
  // 17 道化師
  { id: 'x_trump', name: 'トランプ兵', emoji: '🃏', tribe: 'lucky', type: 'unit', cost: 2, atk: 30, hp: 30, kw: ['lucky'], text: '' },
  { id: 'x_dice', name: 'イカサマダイス', emoji: '🎲', tribe: 'lucky', type: 'spell', cost: 2, target: 'none',
    text: 'サイコロを振り、出目×20ダメージを敵ヒーローに', ai: { t: 'custom' },
    cast: async (B, pi) => { const n = await B.dice(B.hero(pi)); await B.damage(B.spellSrc(pi), B.hero(foe(pi)), n * 20, { fx: 'gold' }); } },
  // 18 冥府の大司教
  { id: 'x_deathknight', name: '死霊騎士', emoji: '🏇', tribe: 'necro', type: 'unit', cost: 4, atk: 50, hp: 40, kw: ['undying', 'drain'], text: '' },
  { id: 'x_harvest', name: '魂の収穫', emoji: '🌾', tribe: 'necro', type: 'spell', cost: 3, target: 'none',
    text: '敵ユニット全員に20ダメージ。倒した数×30、自分のヒーローを回復', ai: { t: 'aoe', v: 20 },
    cast: async (B, pi) => {
      const es = B.units(foe(pi));
      await B.damageMany(B.spellSrc(pi), es, 20, { fx: 'dark' });
      const k = es.filter(e => !B.alive(e)).length;
      if (k) await B.heal(B.hero(pi), k * 30);
    } },
  // 19 時空王
  { id: 'x_gatekeeper', name: '次元の門番', emoji: '🚪', tribe: 'warp', type: 'unit', cost: 4, atk: 40, hp: 60, kw: ['warp', 'shield'], text: '' },
  { id: 'x_zerocount', name: 'ゼロ・カウント', emoji: '0️⃣', tribe: 'chrono', type: 'unit', cost: 3, atk: 30, hp: 30, countdown: 1,
    text: 'カウント1：敵ユニット全員に60ダメージ',
    onCountdown: async (B, u) => { await B.damageMany(u, B.units(foe(u.owner)), 60, { fx: 'laser' }); } },
  // 20 ドーパミン神
  { id: 'x_apostle', name: '脳汁の使徒', emoji: '👼', tribe: 'neutral', type: 'unit', cost: 5, atk: 40, hp: 40, kw: ['fly', 'drain'], text: '' },
  { id: 'x_flood', name: '快楽の洪水', emoji: '🌊', tribe: 'neutral', type: 'spell', cost: 6, target: 'none',
    text: '敵ユニット全員と敵ヒーローに50ダメージ', ai: { t: 'aoe', v: 50 },
    cast: async (B, pi) => { await B.damageMany(B.spellSrc(pi), [...B.units(foe(pi)), B.hero(foe(pi))], 50, { fx: 'meteor' }); } },
];
BOSS_CARD_LIST.forEach(c => { c.kw = c.kw || []; c.rarity = 'EX'; c.bossCard = true; CARD_LIST.push(c); CARDS[c.id] = c; });

/* ---------------- 20体のボス ---------------- */
const BOSS_TIERS = [
  { tier: 1, name: '第一階層', sub: '欲望の門', color: '#ff8a3d' },
  { tier: 2, name: '第二階層', sub: '快楽の回廊', color: '#ff3d8b' },
  { tier: 3, name: '第三階層', sub: '虚無の深淵', color: '#a978ff' },
  { tier: 4, name: '最終階層', sub: '脳髄の玉座', color: '#ff2244' },
];

const BOSS_LIST = [
  /* ===== 第一階層 ===== */
  { no: 1, name: 'ガチャ神ルーレット', title: '確率の支配者', avatar: '🎰', color: '#ffd23f', hp: 330, tribes: ['lucky', 'neutral'],
    cards: ['x_tenjo', 'x_kakuritsu'], extraCrit: 0.1,
    quote: '確率は平等だと思ったか？ ここではワタシが確率だ', win: '爆死おつかれさま♪', lose: 'ば、ばかな…天井まで回したのに…',
    passive: { name: 'イカサマコイン', text: 'ターン開始時、コインを2枚投げ、表1枚につきあなたのランダムなユニット（いなければヒーロー）に20ダメージ',
      turnStart: async (B, pi) => { const r = await B.coinFlip(pi, 2); for (const h of r) if (h) await B.damage(B.hero(pi), B.randomEnemy(pi), 20, { fx: 'gold' }); } },
    ult: { name: '確定演出', every: 4, first: 3, text: 'スロット777確定！ あなたのユニット全員とヒーローに70ダメージ', run: async (B, pi) => { await B.slotMachine(pi, true); } },
    phases: [{ at: 0.5, name: 'SSR確定!!', line: 'ここからが本番…虹色の確定演出だ！', text: 'ランダムなSSRユニット2体を召喚',
      run: async (B, pi) => { for (let i = 0; i < 2; i++) { const l = B.freeLane(pi, 2, true); if (l != null) await B.summon(pi, R.pick(unitPool(c => c.rarity === 'SSR')).id, l); } } }] },
  { no: 2, name: '炎上インフルエンサー', title: '燃え広がる女王', avatar: '🤳', color: '#ff6a3d', hp: 500, tribes: ['blaze'],
    cards: ['x_kakusan', 'x_fan'],
    quote: 'あなたの悪いところ、全部拡散してあげる♡', win: '今日のトレンド1位はあなたの敗北よ', lose: 'アカウント…凍結…？',
    passive: { name: '燃料投下', text: 'ターン開始時、あなたのユニット全員に炎上1',
      turnStart: async (B, pi) => { for (const e of B.units(foe(pi))) await B.burn(e, 1, B.hero(pi)); } },
    ult: { name: '大炎上', every: 3, text: 'あなたのユニットに（炎上値×20）ダメージ。さらにヒーローに（燃えているユニット数×20＋30）ダメージ',
      run: async (B, pi) => {
        const es = B.units(foe(pi)); const n = es.filter(e => e.burn > 0).length;
        for (const e of es) if (e.burn > 0) await B.damage(B.hero(pi), e, e.burn * 20, { fx: 'fire' });
        await B.processDeaths();
        await B.damage(B.hero(pi), B.hero(foe(pi)), n * 20 + 30, { fx: 'fire' });
      } },
    phases: [{ at: 0.5, name: 'バズり覚醒', line: 'いいねが…止まらないッ!!', text: 'フィールド「灼熱火山」を展開し、自分のユニット全員のATK+20',
      run: async (B, pi) => { if (B.G.field) B.G.P[B.G.field.owner].discard.push(B.G.field.def.id); B.G.field = { def: CARDS.b_volcano, owner: pi }; await B.V('field', B.G.field); await B.buffAll(pi, 20, 0); } }] },
  { no: 3, name: '徹夜の魔物ネムラーズ', title: '眠らない夜', avatar: '🦇', color: '#38e1ff', hp: 320, tribes: ['storm', 'neutral'],
    cards: ['x_enadori', 'x_shinya'],
    quote: '寝かせないよ…朝まで、ずっと', win: 'おやすみ…永遠にね', lose: 'zzz……はっ、朝!?',
    passive: { name: '寝落ち', text: 'ターン開始時、あなたのいちばんATKが高いユニットを凍結',
      turnStart: async (B, pi) => { const t = strongest(B, foe(pi))[0]; if (t) await B.freeze(t); } },
    ult: { name: '夜明けの絶望', every: 3, text: 'あなたの手札をランダムに2枚捨てさせ、ヒーローに30ダメージ',
      run: async (B, pi) => { await B.discardRandom(foe(pi), 2); await B.damage(B.hero(pi), B.hero(foe(pi)), 30, { fx: 'dark' }); } },
    phases: [{ at: 0.5, name: 'オールナイト', line: 'エナドリ追加！ 夜はこれからだァ!!', text: '「エナドリ兵」を2体召喚し、PP+2',
      run: async (B, pi) => { await summonMany(B, pi, 'x_enadori', 2); await B.gainEnergy(pi, 2); } }] },
  { no: 4, name: 'スクロール大蛇ウロボロス', title: '終わらない蛇', avatar: '🐍', color: '#8dff4f', hp: 330, tribes: ['necro', 'mecha'],
    cards: ['x_tail', 'x_ring'],
    quote: '終わりなどない。お前の指は、永遠にスクロールし続ける', win: 'ほら、また最初からだ', lose: '尾が…尾が切れた…',
    passive: { name: '無限スクロール', text: 'ターン開始時、カードを1枚多く引く', turnStart: async (B, pi) => { await B.draw(pi, 1); } },
    ult: { name: '無限ループ', every: 4, first: 3, text: '墓地のユニットを3体復活させ、それぞれ+10/+10',
      run: async (B, pi) => { const before = new Set(B.units(pi).map(u => u.uid)); await B.reviveFromGrave(pi, 3); for (const u of B.units(pi)) if (!before.has(u.uid)) await B.buff(u, 10, 10, { quick: true }); } },
    phases: [{ at: 0.45, name: '脱皮', line: '古い皮を脱ぎ捨てる…まだ終わらんぞ', text: 'ヒーローHPを150回復し、自分のユニット全員にシールド',
      run: async (B, pi) => { await B.heal(B.hero(pi), 150); for (const u of B.units(pi)) B.giveShield(u); } }] },
  { no: 5, name: '課金王ゴルドラ', title: '札束の暴君', avatar: '🤑', color: '#ffcc33', hp: 340, tribes: ['lucky', 'mecha'],
    cards: ['x_kakin', 'x_magic'], energyBonus: 1,
    quote: '強さは金で買える。それがこの世の真理だ', win: '無課金にしては頑張ったな', lose: 'カードの…限度額が……',
    passive: { name: '重課金', text: '毎ターンPPが1多い', turnStart: null },
    ult: { name: '札束ビンタ', every: 3, text: 'あなたのヒーローに（ボスの手札の枚数×15）ダメージ',
      run: async (B, pi) => { await B.damage(B.hero(pi), B.hero(foe(pi)), Math.max(30, B.P(pi).hand.length * 15), { fx: 'gold' }); } },
    phases: [{ at: 0.5, name: '追い課金', line: 'まだだ！ 天井まで回せェ!!', text: 'カードを3枚引き、PP+3',
      run: async (B, pi) => { await B.draw(pi, 3); await B.gainEnergy(pi, 3); } }] },

  /* ===== 第二階層 ===== */
  { no: 6, name: '通知の魔神ピコーン', title: '鳴り止まぬ鐘', avatar: '🔔', color: '#38e1ff', hp: 360, tribes: ['storm'],
    cards: ['x_badge', 'x_push'], startHand: 5,
    quote: 'ピコン。ピコン。ピコン。…ほら、気になるだろう？', win: '未読999+', lose: '通知を…オフに…された…',
    passive: { name: 'ピコン×3', text: 'ターン開始時、ランダムな敵に20ダメージを3回',
      turnStart: async (B, pi) => { for (let i = 0; i < 3; i++) { await B.damage(B.hero(pi), B.randomEnemy(pi), 20, { fx: 'bolt' }); await B.processDeaths(); } } },
    ult: { name: '既読スルー', every: 3, text: 'あなたのユニット全員に20ダメージを与えて凍結',
      run: async (B, pi) => { const es = B.units(foe(pi)); await B.damageMany(B.hero(pi), es, 20, { fx: 'bolt' }); for (const e of es) await B.freeze(e); } },
    phases: [{ at: 0.5, name: '通知オン', line: 'すべての通知を、オンにした', text: '自分のユニット全員が連鎖を得て、「通知バッジ」を2体召喚',
      run: async (B, pi) => { for (const u of B.units(pi)) B.giveKw(u, 'chain'); await summonMany(B, pi, 'x_badge', 2); } }] },
  { no: 7, name: '推しの亡霊アイドラ', title: '永遠のセンター', avatar: '🎤', color: '#ff7ac8', hp: 480, tribes: ['sugar', 'necro'],
    cards: ['x_penlight', 'x_kyokyu'], startHand: 5,
    quote: 'あなたの推しは、わ・た・し。そうでしょ？', win: 'ずっと応援してね♡', lose: '卒業…します…',
    passive: { name: '推しへの愛', text: 'ターン開始時、自分のユニット全員に+10/+10', turnStart: async (B, pi) => { await B.buffAll(pi, 10, 10); } },
    ult: { name: '限界オタクの絶叫', every: 3, text: 'あなたのユニット全員とヒーローに（ボスの墓地の数×10＋20）ダメージ（最大80）',
      run: async (B, pi) => { const d = Math.min(80, B.P(pi).grave.length * 10 + 20); await B.damageMany(B.hero(pi), [...B.units(foe(pi)), B.hero(foe(pi))], d, { fx: 'dark' }); } },
    phases: [{ at: 0.5, name: '推し変', line: 'あなたの一番の子…わたしにちょうだい？', text: 'あなたのいちばんATKが高いユニットを奪う',
      run: async (B, pi) => { const t = strongest(B, foe(pi))[0]; if (t) await B.steal(t, pi); } }] },
  { no: 8, name: 'ショート動画の帝王リール', title: '15秒の暴君', avatar: '📲', color: '#ff3d8b', hp: 400, tribes: ['storm', 'blaze'],
    cards: ['x_buzz', 'x_osusume'], startHand: 5,
    quote: '長い話はいらない。15秒で終わらせてやる', win: '次の動画へスワイプ', lose: '再生数が…伸びない…',
    passive: { name: '倍速視聴', text: 'ターン開始時、自分のユニット全員が連撃を得る',
      turnStart: async (B, pi) => { for (const u of B.units(pi)) if (!u.kw.has('double')) B.giveKw(u, 'double'); } },
    ult: { name: '無限リール', every: 4, first: 3, text: '手札のユニットを2体、コストを払わずに出す', run: async (B, pi) => { await B.summonFromHand(pi, 2); } },
    phases: [{ at: 0.5, name: 'アルゴリズム最適化', line: 'おすすめに載った…もう誰にも止められない', text: 'カードを2枚引き、PP+3',
      run: async (B, pi) => { await B.draw(pi, 2); await B.gainEnergy(pi, 3); } }] },
  { no: 9, name: 'ブラック社長クロガネ', title: '定時を破壊する者', avatar: '👔', color: '#6dffb3', hp: 400, tribes: ['mecha', 'risk'],
    cards: ['x_shachiku', 'x_kyujitsu'], startHand: 5,
    quote: '定時？ そんな言葉は辞書にない', win: '明日も朝7時集合な', lose: '労基…だと…!?',
    passive: { name: 'サービス残業', text: 'ターン開始時、ボスのHPを10払い、自分のユニット全員のATK+10',
      turnStart: async (B, pi) => { await B.payHp(pi, 10); await B.buffAll(pi, 10, 0); } },
    ult: { name: 'リストラ', every: 3, text: 'あなたのいちばんATKが高いユニットを破壊し、ヒーローに30ダメージ',
      run: async (B, pi) => { const t = strongest(B, foe(pi))[0]; if (t) await B.annihilate(B.hero(pi), [t]); await B.damage(B.hero(pi), B.hero(foe(pi)), 30, { fx: 'dark' }); } },
    phases: [{ at: 0.5, name: '全社員出社', line: '有給？ 却下だ！ 全員出社しろ！', text: '空きマスすべてに「社畜ロボ」を召喚',
      run: async (B, pi) => { await summonMany(B, pi, 'x_shachiku', 5); } }] },
  { no: 10, name: '時の番人ループス', title: '同じ日を繰り返す者', avatar: '♾️', color: '#e0a96d', hp: 480, tribes: ['chrono', 'neutral'],
    cards: ['x_guardian', 'x_rewind'], startHand: 5,
    quote: 'また会ったね。…君にとっては、初めてか', win: 'もう一回。何度でも', lose: 'ループが…ほどけていく…',
    passive: { name: '時間加速', text: 'ターン開始時、自分のカウント中のユニットのカウントがさらに1進む',
      turnStart: async (B, pi) => { for (const u of B.units(pi)) if (u.count > 0) await B.tickCount(u); } },
    ult: { name: 'タイムリープ', every: 3, text: 'あなたのユニット全員を手札に戻す',
      run: async (B, pi) => { for (const u of B.units(foe(pi))) await B.bounce(u); } },
    phases: [{ at: 0.5, name: '時よ止まれ', line: '君の時間だけ、少し遅らせておこう', text: 'あなたは次のターン、PPが2少ない。ボスのカウント中のユニットのカウントが1進む',
      run: async (B, pi) => { B.P(foe(pi)).nextEnergy = (B.P(foe(pi)).nextEnergy || 0) - 2; await B.V('say', foe(pi), '次のターンPP-2', '#ff4d6d'); for (const u of B.units(pi)) if (u.count > 0) await B.tickCount(u); } }] },

  /* ===== 第三階層 ===== */
  { no: 11, name: '虚無の王ニヒル', title: '何も感じない者', avatar: '🕳️', color: '#9bb8e0', hp: 560, tribes: ['solo', 'necro'],
    cards: ['x_shadow', 'x_blank'], startHand: 5,
    quote: '楽しい？ 嬉しい？ …くだらない', win: '……虚しい', lose: 'ああ…これが…“感じる”ということか',
    passive: { name: '無気力', text: 'ターン開始時、あなたのユニット全員のATK-10',
      turnStart: async (B, pi) => { for (const e of B.units(foe(pi))) await B.debuff(e, 10); } },
    ult: { name: '虚無', every: 3, text: '場のすべてのユニットを破壊する（ボスのユニットも）',
      run: async (B, pi) => { await B.annihilate(B.hero(pi), B.allUnits()); } },
    phases: [{ at: 0.5, name: '虚無の化身', line: '何もかも、無に還れ', text: '「虚無の影」を召喚し、シールドを与える',
      run: async (B, pi) => { const [u] = await summonMany(B, pi, 'x_shadow', 1); if (u) B.giveShield(u); } }] },
  { no: 12, name: '錬金術師アルケミ', title: '快楽を精製する者', avatar: '⚗️', color: '#b8f04a', hp: 530, tribes: ['mimic', 'sugar'],
    cards: ['x_homun', 'x_rensei'], startHand: 5,
    quote: '君の脳汁、純度100%に精製してあげよう', win: '実験成功。素晴らしいサンプルだった', lose: '計算が…合わない…',
    passive: { name: '錬成', text: 'ターン開始時、自分のランダムなユニット1体に+20/+20とシールド',
      turnStart: async (B, pi) => { const u = R.pick(B.units(pi)); if (u) { await B.buff(u, 20, 20); B.giveShield(u); } } },
    ult: { name: '黄金錬成', every: 3, text: 'あなたのATKが高いユニット2体を「ぴよぴよ」に変える',
      run: async (B, pi) => { for (const t of strongest(B, foe(pi)).filter(u => u.id !== 'tk_chick').slice(0, 2)) await B.transform(t, 'tk_chick'); } },
    phases: [{ at: 0.5, name: '賢者の石', line: 'ついに完成した…賢者の石だ！', text: '自分のユニット全員の★が1つ上がる',
      run: async (B, pi) => { for (const u of B.units(pi)) await B.upgrade(u); } }] },
  { no: 13, name: '電脳の女帝サイバーナ', title: 'ネットの支配者', avatar: '🦾', color: '#2ee6ff', hp: 430, tribes: ['mecha', 'storm'],
    cards: ['x_drone', 'x_firewall'], startUnits: [['x_drone', 1], ['x_drone', 3]],
    quote: 'あなたの検索履歴、すべて把握しています', win: 'ログアウトを推奨します', lose: 'システム…ダウン……',
    passive: { name: '自動生産', text: 'ターン開始時、空きマスに「ドローン」を1体召喚', turnStart: async (B, pi) => { await summonMany(B, pi, 'x_drone', 1); } },
    ult: { name: 'ハッキング', every: 3, text: 'あなたのいちばんATKが高いユニットを奪う',
      run: async (B, pi) => { const t = strongest(B, foe(pi))[0]; if (t) await B.steal(t, pi); } },
    phases: [{ at: 0.5, name: '全システム起動', line: '防衛プロトコル、全開放', text: '自分のユニット全員に+20/+0とシールド',
      run: async (B, pi) => { await B.buffAll(pi, 20, 0); for (const u of B.units(pi)) B.giveShield(u); } }] },
  { no: 14, name: '嫉妬の魔獣ジェラシア', title: '隣の芝の怪物', avatar: '🐊', color: '#ff3a5c', hp: 440, tribes: ['risk', 'blaze'],
    cards: ['x_netami', 'x_yokodori'], startHand: 5,
    quote: 'ずるい…ずるいずるい！ あんたのそれ、全部ちょうだい', win: 'これで全部わたしのもの', lose: '…うらやましかっただけなのに',
    passive: { name: '隣の芝は青い', text: 'ターン開始時、自分のユニットのATKが、あなたのいちばん高いATKより低ければ同じにする',
      turnStart: async (B, pi) => { const t = strongest(B, foe(pi))[0]; if (!t) return; const top = B.atkOf(t); for (const u of B.units(pi)) { const a = B.atkOf(u); if (a < top) await B.buff(u, top - a, 0, { quick: true }); } } },
    ult: { name: '妬みの業火', every: 3, text: 'あなたのユニット全員に、それぞれのATKと同じダメージ',
      run: async (B, pi) => { for (const e of B.units(foe(pi))) await B.damage(B.hero(pi), e, B.atkOf(e), { fx: 'fire' }); await B.processDeaths(); } },
    phases: [{ at: 0.5, name: '羨望の鏡', line: 'あんたの一番いい子、2匹にしちゃった♪', text: 'あなたのいちばん強いユニットのコピーを2体召喚',
      run: async (B, pi) => { const t = strongest(B, foe(pi)).find(u => !u.def.token); if (t) await summonMany(B, pi, t.id, 2, { copy: true }); } }] },
  { no: 15, name: '終焉の時計塔クロノス', title: '残り時間を刻む者', avatar: '🕰️', color: '#e0a96d', hp: 470, tribes: ['chrono'],
    cards: ['x_byoshin', 'x_timebomb'], startHand: 5,
    quote: '君の残り時間は、あと少しだ', win: '…タイムアップ', lose: '針が…止まった…',
    passive: { name: '刻限', text: 'ターン開始時、自分のカウント中のユニットのカウントがさらに1進む',
      turnStart: async (B, pi) => { for (const u of B.units(pi)) if (u.count > 0) await B.tickCount(u); } },
    ult: { name: '時の審判', every: 4, text: 'あなたのヒーローに100ダメージ（覚醒後は2ターンごと）',
      run: async (B, pi) => { await B.damage(B.hero(pi), B.hero(foe(pi)), 100, { fx: 'laser' }); } },
    phases: [{ at: 0.5, name: '時間加速', line: '時計の針を、早めよう', text: '必殺技がすぐ来る（次のターンに発動、以後2ターンごと）',
      run: async (B, pi) => { const P = B.P(pi); P.ultCd = 1; P.ultEvery = 2; } }] },

  /* ===== 最終階層 ===== */
  { no: 16, name: '深淵の観測者アビス', title: '見つめ返す深淵', avatar: '🌑', color: '#8a8cff', hp: 650, tribes: ['warp', 'solo'],
    cards: ['x_tentacle', 'x_tenni'], startHand: 5,
    quote: '深淵を覗くとき、深淵もまた――お前を見ている', win: 'もう、目を逸らせない', lose: '光が…まぶしい……',
    passive: { name: '狂気の視線', text: 'ターン開始時、あなたのユニットの位置をばらばらに入れ替える', turnStart: async (B, pi) => { await B.shuffleBoard(foe(pi)); } },
    ult: { name: '深淵の眼差し', every: 3, text: 'あなたのATKが高いユニット2体を破壊する',
      run: async (B, pi) => { await B.annihilate(B.hero(pi), strongest(B, foe(pi)).slice(0, 2)); } },
    phases: [{ at: 0.5, name: '深淵の翼', line: 'さあ、もっと深くへ', text: '自分のユニット全員が飛行を得る',
      run: async (B, pi) => { for (const u of B.units(pi)) B.giveKw(u, 'fly'); } }] },
  { no: 17, name: '狂乱の道化師ジョーカー', title: '笑う災厄', avatar: '🤡', color: '#ffd23f', hp: 540, tribes: ['lucky', 'mimic'],
    cards: ['x_trump', 'x_dice'], startHand: 5,
    quote: 'ヒャハハ！ ショーの始まりだ！ 結末？ 知らないよォ！', win: 'ブラボー！ 最高のオチだったよ！', lose: 'ハハ…今日の客は…手強い…',
    passive: { name: '運命のルーレット', text: 'ターン開始時ルーレット：あなたに40ダメージ／自分のユニット全員+20/+20／あなたのユニット1体破壊／カード2枚ドロー',
      turnStart: async (B, pi) => {
        const i = await B.roulette(pi, ['💥 40ダメージ', '💪 全員+20/+20', '☠ 1体破壊', '🃏 2枚ドロー']);
        if (i === 0) await B.damage(B.hero(pi), B.hero(foe(pi)), 40, { fx: 'gold' });
        else if (i === 1) await B.buffAll(pi, 20, 20);
        else if (i === 2) { const t = R.pick(B.units(foe(pi))); if (t) await B.annihilate(B.hero(pi), [t]); else await B.damage(B.hero(pi), B.hero(foe(pi)), 40, { fx: 'gold' }); }
        else await B.draw(pi, 2);
      } },
    ult: { name: 'ビックリ箱の大惨事', every: 3, text: 'あなたのユニット全員をコスト1〜2のユニットに、ボスのユニット全員をコスト5〜7のユニットに変身させる',
      run: async (B, pi) => {
        const lo = unitPool(c => c.cost <= 2), hi = unitPool(c => c.cost >= 5 && c.cost <= 7 && c.rarity !== 'UR');
        for (const e of B.units(foe(pi))) await B.transform(e, R.pick(lo).id);
        for (const u of B.units(pi)) await B.transform(u, R.pick(hi).id);
      } },
    phases: [{ at: 0.5, name: 'ジョーカー・ワイルド', line: '手札は全部ジョーカーだァ！', text: '手札をすべてランダムなSSRカードに変える',
      run: async (B, pi) => {
        const P = B.P(pi), n = Math.max(3, P.hand.length), pool = COLLECTIBLE.filter(c => c.rarity === 'SSR');
        P.hand.length = 0; await giveCards(B, pi, Array.from({ length: n }, () => R.pick(pool).id));
      } }] },
  { no: 18, name: '冥府の大司教モルテ', title: '死を統べる者', avatar: '☠️', color: '#a978ff', hp: 900, tribes: ['necro'],
    cards: ['x_deathknight', 'x_harvest'], startUnits: [['tk_bone', 0], ['tk_bone', 4]],
    quote: '死は終わりではない。我が軍門への入口だ', win: 'ようこそ、我が軍勢へ', lose: '死すら…超えるというのか…',
    passive: { name: '死者の招き', text: 'ターン開始時、空きマスに「ホネホネ」を2体召喚', turnStart: async (B, pi) => { await summonMany(B, pi, 'tk_bone', 2); } },
    ult: { name: '死者の行進', every: 3, text: '墓地のユニットを空きマスすべてに復活させる', run: async (B, pi) => { await B.reviveFromGrave(pi, 5); } },
    phases: [{ at: 0.5, name: '不死の軍勢', line: '立て、我が兵よ。何度でも', text: '自分のユニット全員が不死を得る',
      run: async (B, pi) => { for (const u of B.units(pi)) { u.revived = false; B.giveKw(u, 'undying'); } } }] },
  { no: 19, name: '時空王ゼロ', title: 'すべての軸を束ねる者', avatar: '🪐', color: '#8a8cff', hp: 540, tribes: ['chrono', 'warp', 'mimic', 'risk', 'solo'],
    cards: ['x_gatekeeper', 'x_zerocount'], startHand: 5,
    quote: '時間、位置、姿、代償、孤独――すべては我が掌の上', win: 'ゼロに還れ', lose: '軸が…崩れる……',
    passive: { name: '五つの軸', text: 'ターン開始時ルーレット：カウント進行／あなたのユニットをワープ／あなたのユニット1体をぴよぴよ化／HP20払い全員ATK+20／最強ユニット+40/+40',
      turnStart: async (B, pi) => {
        const i = await B.roulette(pi, ['⏳ 時間', '🌀 位置', '🎭 姿', '💔 代償', '🌙 孤独']);
        if (i === 0) { for (const u of B.units(pi)) if (u.count > 0) await B.tickCount(u); }
        else if (i === 1) { const t = R.pick(B.units(foe(pi))); const l = R.pick(B.emptyLanes(foe(pi))); if (t && l != null) await B.moveUnit(t, l, { push: true }); }
        else if (i === 2) { const t = R.pick(B.units(foe(pi)).filter(u => u.id !== 'tk_chick')); if (t) await B.transform(t, 'tk_chick'); }
        else if (i === 3) { await B.payHp(pi, 20); await B.buffAll(pi, 20, 0); }
        else { const u = strongest(B, pi)[0]; if (u) await B.buff(u, 40, 40); }
      } },
    ult: { name: '次元崩壊', every: 4, first: 3, text: 'あなたのユニットをすべて破壊し、破壊した数×30ダメージをあなたのヒーローに',
      run: async (B, pi) => { const es = B.units(foe(pi)); await B.annihilate(B.hero(pi), es); await B.damage(B.hero(pi), B.hero(foe(pi)), Math.max(20, es.length * 30), { fx: 'laser' }); } },
    phases: [{ at: 0.5, name: 'ゼロ・リセット', line: '世界を、ゼロから書き換える', text: '手札が6枚になるまで引き、PP+4',
      run: async (B, pi) => { const P = B.P(pi); await B.draw(pi, Math.max(0, 6 - P.hand.length)); await B.gainEnergy(pi, 4); } }] },
  { no: 20, name: 'ドーパミン神ドパミネス', title: '脳汁の創造主', avatar: '🧬', color: '#ff3d8b', hp: 480, tribes: ['blaze', 'storm', 'sugar', 'necro', 'lucky', 'mecha'],
    cards: ['x_apostle', 'x_flood'], startHand: 5,
    quote: 'よくぞここまで来た。その快楽、すべて我が糧としよう', win: '快楽に溺れ、眠るがいい', lose: 'これが…人の…意志……!',
    passive: { name: '過剰分泌', text: 'ターン開始時、あなたのヒーローに20ダメージ。自分のランダムなユニット1体に+10/+10',
      turnStart: async (B, pi) => { await B.damage(B.hero(pi), B.hero(foe(pi)), 20, { fx: 'dark' }); const u = R.pick(B.units(pi)); if (u) await B.buff(u, 10, 10); } },
    ult: { name: 'ドーパミン・オーバードーズ', every: 3, first: 4, text: 'あなたのヒーローに80ダメージ。あなたのユニット全員を凍結',
      run: async (B, pi) => { await B.damage(B.hero(pi), B.hero(foe(pi)), 80, { fx: 'laser' }); for (const e of B.units(foe(pi))) await B.freeze(e); } },
    phases: [
      { at: 0.66, name: '第二形態', line: 'ほう…少しは楽しませてくれる', text: '「脳汁の使徒」を1体召喚し、カードを2枚引く',
        run: async (B, pi) => { await summonMany(B, pi, 'x_apostle', 1); await B.draw(pi, 2); } },
      { at: 0.33, name: '真の姿', line: '見せてやろう…神の、真の姿を!!', text: '自分のユニット全員に+30/+30。必殺技が次のターンに発動し、以後2ターンごと',
        run: async (B, pi) => { await B.buffAll(pi, 30, 30); const P = B.P(pi); P.ultCd = 1; P.ultEvery = 2; } },
    ] },
];
const BOSSES = {};
BOSS_LIST.forEach(b => { b.id = 'br' + String(b.no).padStart(2, '0'); b.tier = Math.ceil(b.no / 5); BOSSES[b.id] = b; });

// ボスのデッキ：専用EXカード（ユニット3枚・スペル2枚ずつ）＋高レベルの属性デッキ
// 難易度のつまみ（tools/rushsim.js で勝率を見ながら調整）
const BOSS_TUNE = { level: [4, 5, 6, 7], hpMul: [1, 1, 1, 1] };
const RUSH_PLAYER_HP = 450; // ボスラッシュではあなたのHPが多い（そのぶんボスも強い）
function bossDeck(b) {
  const sig = [];
  b.cards.forEach(id => { for (let i = 0; i < (CARDS[id].type === 'unit' ? 3 : 2); i++) sig.push(id); });
  const base = makeDeck(b.tribes, BOSS_TUNE.level[b.tier - 1], hashStr(b.id));
  return [...base.slice(0, 20 - sig.length), ...sig];
}

function rushConfig(id) {
  const b = BOSSES[id];
  return {
    name: b.name, avatar: b.avatar, hp: Math.round(b.hp * BOSS_TUNE.hpMul[b.tier - 1] / 10) * 10, isAI: true,
    deck: bossDeck(b),
    ai: { mistake: 0, depth: 3, width: 10 },
    passive: b.passive, boss: b, field: b.field || null,
    fever: true, feverRate: 1, energyBonus: b.energyBonus || 0, extraCrit: b.extraCrit || 0,
    startEnergy: b.startEnergy || 1, startHand: b.startHand || 4, startUnits: b.startUnits || [],
  };
}
