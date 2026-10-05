'use strict';
/* ===== セーブ・成長・ガチャ・ミッション ===== */

const SAVE_KEY = 'dopaburst_save_v1';
const SET_KEY = 'dopaburst_settings_v1';

const Settings = { bgm: 0.5, sfx: 0.8, speed: 1, autoEnd: false, reduced: false, vibrate: true, muted: false, preview: true, tips: true, autoHint: true };

const AVATARS = [['😎', 1], ['🤠', 3], ['🥷', 5], ['🦸', 7], ['🧙', 9], ['👽', 11], ['🐲', 14], ['🦊', 17], ['👑', 20], ['🧠', 25]];
const CONVERT = { N: 10, R: 30, SR: 100, SSR: 300, UR: 800 };
const MAXCOPY = r => (r === 'UR' ? 1 : 3);

const MISSION_POOL = [
  { id: 'win2', text: 'バトルに2回勝利', goal: 2, stat: 'wins', reward: { coins: 150 } },
  { id: 'battle3', text: 'バトルを3回遊ぶ', goal: 3, stat: 'battles', reward: { coins: 100 } },
  { id: 'crit15', text: 'クリティカルを15回出す', goal: 15, stat: 'crits', reward: { coins: 150 } },
  { id: 'merge5', text: '合体を5回する', goal: 5, stat: 'merges', reward: { coins: 150 } },
  { id: 'fever2', text: 'フィーバーを2回発動', goal: 2, stat: 'fevers', reward: { tickets: 1 } },
  { id: 'combo10', text: '1ターンで10コンボ達成', goal: 10, stat: 'maxCombo', max: true, reward: { coins: 200 } },
  { id: 'dmg300', text: '1ターンで300ダメージ', goal: 300, stat: 'maxTurnDamage', max: true, reward: { tickets: 1 } },
  { id: 'play30', text: 'カードを30枚プレイ', goal: 30, stat: 'cardsPlayed', reward: { coins: 120 } },
  { id: 'kill20', text: '敵ユニットを20体撃破', goal: 20, stat: 'kills', reward: { coins: 150 } },
  { id: 'gacha1', text: 'ガチャを1回引く', goal: 1, stat: 'gacha', reward: { coins: 100 } },
  { id: 'jackpot1', text: 'スロットで大当たり', goal: 1, stat: 'jackpots', reward: { tickets: 1 } },
  { id: 'star3', text: '★3まで合体させる', goal: 1, stat: 'star3', reward: { coins: 200 } },
  { id: 'spell8', text: 'スペルを8回使う', goal: 8, stat: 'spells', reward: { coins: 120 } },
];
const LOGIN_REWARDS = [{ coins: 100 }, { tickets: 1 }, { coins: 200 }, { tickets: 1 }, { coins: 300 }, { tickets: 2 }, { premium: 1 }];
const STAR_ROAD = [
  { stars: 3, reward: { tickets: 1 } }, { stars: 8, reward: { coins: 300 } }, { stars: 14, reward: { premium: 1 } },
  { stars: 22, reward: { tickets: 3 } }, { stars: 32, reward: { premium: 1 } }, { stars: 44, reward: { coins: 1000 } },
  { stars: 60, reward: { premium: 3 } },
];

const Meta = {
  save: null,

  defaults() {
    const cards = {};
    STARTER_DECK.forEach(id => (cards[id] = (cards[id] || 0) + 1));
    return {
      v: 1, name: 'あなた', avatar: '😎', level: 1, xp: 0,
      coins: 300, tickets: 3, premium: 1,
      cards, deck: STARTER_DECK.slice(),
      stages: {}, starClaims: [],
      rank: { rp: 0, best: 0, streak: 0, bestStreak: 0, wins: 0, games: 0 },
      pity: 0, pulls: 0,
      missions: { date: '', list: [], bonus: false },
      login: { last: '', day: 0 },
      records: { turnDamage: 0, combo: 0 },
      life: { wins: 0, battles: 0, crits: 0, merges: 0, kills: 0 },
      flags: {}, newCards: [],
      rush: { wins: {}, tries: {}, best: {}, fastest: {}, allClear: false },
    };
  },
  load() {
    const d = Store.get(SAVE_KEY, null);
    const base = this.defaults();
    this.save = d && d.v === 1 ? Object.assign(base, d) : base;
    Object.assign(Settings, Store.get(SET_KEY, {}));
    return this.save;
  },
  persist() { Store.set(SAVE_KEY, this.save); },
  saveSettings() { Store.set(SET_KEY, Settings); },
  reset() { Store.del(SAVE_KEY); this.save = this.defaults(); this.persist(); },

  /* ---------- 通貨・報酬 ---------- */
  grant(rw) {
    const s = this.save;
    if (rw.coins) s.coins += rw.coins;
    if (rw.tickets) s.tickets += rw.tickets;
    if (rw.premium) s.premium += rw.premium;
    this.persist();
  },
  rewardText(rw) {
    const a = [];
    if (rw.coins) a.push(`🪙${fmt(rw.coins)}`);
    if (rw.tickets) a.push(`🎫×${rw.tickets}`);
    if (rw.premium) a.push(`💎×${rw.premium}`);
    return a.join(' ');
  },

  /* ---------- レベル ---------- */
  xpNeed(lv) { return 60 + lv * 40; },
  levelReward(lv) {
    const rw = { coins: 100 + lv * 20 };
    if (lv % 3 === 0) rw.tickets = 1;
    if (lv % 10 === 0) rw.premium = 1;
    return rw;
  },
  gainXP(n) {
    const s = this.save, ups = [];
    s.xp += n;
    while (s.xp >= this.xpNeed(s.level)) {
      s.xp -= this.xpNeed(s.level);
      s.level++;
      const rw = this.levelReward(s.level);
      this.grant(rw);
      const av = AVATARS.find(a => a[1] === s.level);
      ups.push({ level: s.level, reward: rw, avatar: av ? av[0] : null });
    }
    this.persist();
    return ups;
  },

  /* ---------- カード ---------- */
  owned(id) { return this.save.cards[id] || 0; },
  addCard(id) {
    const s = this.save, def = CARDS[id];
    const have = s.cards[id] || 0;
    const isNew = have === 0;
    if (have >= MAXCOPY(def.rarity)) {
      const c = CONVERT[def.rarity];
      s.coins += c;
      return { id, isNew: false, conv: c };
    }
    s.cards[id] = have + 1;
    if (isNew && !s.newCards.includes(id)) s.newCards.push(id);
    return { id, isNew, conv: 0 };
  },
  collectionRate() {
    const got = COLLECTIBLE.filter(c => this.owned(c.id) > 0).length;
    return { got, total: COLLECTIBLE.length, pct: Math.floor(got / COLLECTIBLE.length * 100) };
  },

  /* ---------- ガチャ ---------- */
  GACHA: {
    normal: { name: 'ノーマルパック', slots: [{ N: 55, R: 30, SR: 11, SSR: 3.5, UR: 0.5 }, null, null, null, { R: 76, SR: 18, SSR: 5, UR: 1 }] },
    premium: { name: 'プレミアムパック', slots: [{ N: 35, R: 40, SR: 18, SSR: 6, UR: 1 }, null, null, null, { SR: 80, SSR: 17, UR: 3 }] },
  },
  PITY_MAX: 40,
  rollCard(table) {
    const s = this.save;
    let r = R.weighted(Object.entries(table));
    if (s.pity >= this.PITY_MAX - 1 && RARITY[r].rank < 3) r = R.chance(0.12) ? 'UR' : 'SSR';
    if (RARITY[r].rank >= 3) s.pity = 0; else s.pity++;
    const pool = COLLECTIBLE.filter(c => c.rarity === r);
    const def = R.weighted(pool.map(c => [c, this.owned(c.id) ? 1 : 1.6]));
    s.pulls++;
    return def.id;
  },
  pullPack(type) {
    const g = this.GACHA[type];
    const out = [];
    for (let i = 0; i < 5; i++) {
      const table = g.slots[i] || g.slots[0];
      const id = this.rollCard(table);
      out.push(this.addCard(id));
    }
    this.track('gacha', 1);
    this.persist();
    return out;
  },
  // cost: {kind:'tickets'|'premium'|'coins', n}
  pay(cost) {
    const s = this.save;
    if (s[cost.kind] < cost.n) return false;
    s[cost.kind] -= cost.n;
    this.persist();
    return true;
  },

  /* ---------- 交換所（コインで好きなカードと交換） ---------- */
  SHOP_PRICE: { N: 100, R: 500, SR: 1000, SSR: 3000, UR: 5000 },
  shopState(id) {
    const def = CARDS[id], price = this.SHOP_PRICE[def.rarity];
    if (this.owned(id) >= MAXCOPY(def.rarity)) return { ok: false, price, reason: 'max' };
    if (this.save.coins < price) return { ok: false, price, reason: 'coins', need: price - this.save.coins };
    return { ok: true, price };
  },
  buyCard(id) {
    const st = this.shopState(id);
    if (!st.ok) return null;
    this.save.coins -= st.price;
    const r = this.addCard(id);
    this.track('exchange', 1);
    this.persist();
    return Object.assign(r, { price: st.price });
  },

  /* ---------- デッキ ---------- */
  validDeck(deck) {
    if (deck.length !== 20) return false;
    const cnt = {};
    for (const id of deck) {
      cnt[id] = (cnt[id] || 0) + 1;
      if (!CARDS[id] || cnt[id] > MAXCOPY(CARDS[id].rarity) || cnt[id] > this.owned(id)) return false;
    }
    return true;
  },
  autoDeck(focus) {
    const own = COLLECTIBLE.filter(c => this.owned(c.id) > 0);
    const power = {};
    own.forEach(c => { if (c.tribe !== 'neutral') power[c.tribe] = (power[c.tribe] || 0) + (RARITY[c.rarity].rank + 1) * this.owned(c.id); });
    const tribes = focus ? [focus] : Object.keys(power).sort((a, b) => power[b] - power[a]).slice(0, 2);
    const score = c => {
      let v = RARITY[c.rarity].rank * 3 + (c.type === 'unit' ? 2 : 0.5) - Math.max(0, c.cost - 5) * 1.2;
      if (tribes.includes(c.tribe)) v += 4;
      else if (c.tribe !== 'neutral') v -= 6;
      return v;
    };
    const cands = own.slice().sort((a, b) => score(b) - score(a));
    const deck = [];
    const add = (c, n) => { for (let i = 0; i < n && deck.length < 20; i++) deck.push(c.id); };
    const copies = c => Math.min(this.owned(c.id), MAXCOPY(c.rarity));
    // まず軽いユニットで土台を作る
    for (const c of cands.filter(c => c.type === 'unit' && c.cost <= 3)) { if (deck.length >= 10) break; add(c, copies(c)); }
    for (const c of cands) {
      if (deck.length >= 20) break;
      const have = deck.filter(x => x === c.id).length;
      if (c.type === 'field' && deck.some(x => CARDS[x].type === 'field' && x !== c.id)) continue;
      add(c, Math.min(copies(c), c.type === 'field' ? 2 : 3) - have);
    }
    // それでも足りなければ持っている物で埋める
    for (const c of own) { if (deck.length >= 20) break; const have = deck.filter(x => x === c.id).length; add(c, copies(c) - have); }
    return deck.sort((a, b) => CARDS[a].cost - CARDS[b].cost || a.localeCompare(b));
  },

  /* ---------- ステージ ---------- */
  stageMask(id) { return this.save.stages[id] || 0; },
  stageStars(id) { const m = this.stageMask(id); return (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1); },
  totalStars() { return STAGE_ORDER.reduce((s, id) => s + this.stageStars(id), 0); },
  stageUnlocked(id) {
    const s = STAGES[id];
    if (s && s.unlockAfter) return this.stageMask(s.unlockAfter) > 0;
    const i = STAGE_ORDER.indexOf(id);
    return i === 0 || this.stageMask(STAGE_ORDER[i - 1]) > 0;
  },
  nextStage() {
    for (const id of STAGE_ORDER) if (!this.stageMask(id)) return id;
    return STAGE_ORDER[STAGE_ORDER.length - 1];
  },
  // 勝利時の共通ボーナス（本日初勝利×2・ボーナスチャンス抽選）
  winExtras(out) {
    const s = this.save, today = todayStr();
    if (s.flags.firstWinDate !== today) {
      s.flags.firstWinDate = today;
      s.coins += out.coins;
      out.coins *= 2;
      out.firstWin = true;
    }
    out.chance = R.chance(0.3);
  },
  BONUS_WHEEL: [{ coins: 50 }, { coins: 100 }, { tickets: 1 }, { coins: 200 }, { premium: 1 }, { coins: 30 }],
  BONUS_WEIGHT: [30, 25, 15, 10, 4, 16],
  spinBonus() {
    const i = R.weighted(this.BONUS_WEIGHT.map((w, k) => [k, w]));
    this.grant(this.BONUS_WHEEL[i]);
    return i;
  },
  stageResult(id, res) {
    const st = STAGES[id], s = this.save;
    const out = { coins: 0, xp: 0, stars: [], newStars: 0, firstClear: false, bonus: null };
    this.trackBattle(res);
    if (!res.win) {
      out.coins = 20 + st.level * 5; out.xp = 15 + st.level * 3;
      s.coins += out.coins;
      out.levelUps = this.gainXP(out.xp);
      return out;
    }
    const conds = [true, res.playerHp >= res.playerMaxHp * 0.5, res.rounds <= st.turns];
    let mask = 0; conds.forEach((c, i) => { if (c) mask |= 1 << i; });
    const prev = this.stageMask(id);
    const merged = prev | mask;
    out.stars = conds;
    out.newStars = [0, 1, 2].filter(i => (merged >> i) & 1 && !((prev >> i) & 1)).length;
    out.firstClear = prev === 0;
    s.stages[id] = merged;
    out.coins = 60 + st.level * 15 + out.newStars * 40;
    if (out.firstClear) { out.coins += 150 + st.level * 30; if (st.boss) out.bonus = { premium: 1 }; else if (st.level >= 1) out.bonus = { tickets: 1 }; }
    out.xp = 40 + st.level * 12;
    s.coins += out.coins;
    this.winExtras(out);
    if (out.bonus) this.grant(out.bonus);
    out.levelUps = this.gainXP(out.xp);
    this.persist();
    return out;
  },
  starRoad() {
    const total = this.totalStars();
    return STAR_ROAD.map((m, i) => ({ ...m, i, reached: total >= m.stars, claimed: this.save.starClaims.includes(i) }));
  },
  claimStar(i) {
    const m = STAR_ROAD[i];
    if (!m || this.save.starClaims.includes(i) || this.totalStars() < m.stars) return null;
    this.save.starClaims.push(i);
    this.grant(m.reward);
    return m.reward;
  },

  /* ---------- ボスラッシュ ---------- */
  rushUnlocked() { return this.stageMask('1-4') > 0; },
  rushTierOpen(tier) {
    if (tier <= 1) return true;
    return BOSS_LIST.some(b => b.tier === tier - 1 && this.rushWins(b.id) > 0);
  },
  rushWins(id) { return this.save.rush.wins[id] || 0; },
  rushDefeated() { return BOSS_LIST.filter(b => this.rushWins(b.id) > 0).length; },
  rushFirstReward(b) { return { coins: 400 + b.no * 60, premium: b.tier, tickets: b.tier >= 3 ? 2 : 1 }; },
  RUSH_ALL_REWARD: { coins: 10000, premium: 10, tickets: 10 },
  rushResult(id, res) {
    const b = BOSSES[id], s = this.save, rs = s.rush;
    const out = { coins: 0, xp: 0, firstClear: false, bonus: null, allClear: false };
    this.trackBattle(res);
    rs.tries[id] = (rs.tries[id] || 0) + 1;
    const pct = Math.round(Math.min(1, 1 - res.enemyHp / res.enemyMaxHp) * 100);
    out.pct = pct;
    out.bestBefore = rs.best[id] || 0;
    out.newBest = pct > out.bestBefore;
    rs.best[id] = Math.max(out.bestBefore, pct);
    if (!res.win) {
      // 負けても、削ったぶんだけコインがもらえる（あと少し！を味わえるように）
      out.coins = 30 + Math.round(pct * (1 + b.tier * 0.5));
      out.xp = 30 + b.tier * 10;
      s.coins += out.coins;
    } else {
      out.firstClear = !rs.wins[id];
      rs.wins[id] = (rs.wins[id] || 0) + 1;
      out.fastest = !rs.fastest[id] || res.rounds < rs.fastest[id];
      if (out.fastest) rs.fastest[id] = res.rounds;
      out.coins = 250 + b.no * 25;
      out.xp = 120 + b.tier * 40;
      if (out.firstClear) { const f = this.rushFirstReward(b); out.coins += f.coins; out.bonus = { premium: f.premium, tickets: f.tickets }; this.grant(out.bonus); }
      if (!rs.allClear && this.rushDefeated() >= BOSS_LIST.length) { rs.allClear = true; out.allClear = true; this.grant(this.RUSH_ALL_REWARD); }
      s.coins += out.coins;
      this.winExtras(out);
    }
    out.levelUps = this.gainXP(out.xp);
    this.persist();
    return out;
  },

  /* ---------- ランク戦 ---------- */
  rankResult(res, rival) {
    const s = this.save, rk = s.rank;
    const before = rankOf(rk.rp);
    const out = { rpBefore: rk.rp, coins: 0, xp: 0, streak: 0, rankUp: null };
    this.trackBattle(res);
    rk.games++;
    if (res.win) {
      rk.wins++; rk.streak++; rk.bestStreak = Math.max(rk.bestStreak, rk.streak);
      const gain = 25 + Math.min(rk.streak - 1, 5) * 5;
      rk.rp += gain;
      out.rpGain = gain;
      out.coins = 80 + before.idx * 20 + Math.min(rk.streak - 1, 5) * 15;
      out.xp = 50 + before.idx * 10;
    } else {
      rk.streak = 0;
      const floor = before.min;
      const loss = Math.min(10, rk.rp - floor);
      rk.rp -= loss;
      out.rpGain = -loss;
      out.coins = 25; out.xp = 20;
    }
    out.streak = rk.streak;
    rk.best = Math.max(rk.best, rk.rp);
    s.coins += out.coins;
    if (res.win) this.winExtras(out);
    const after = rankOf(rk.rp);
    if (after.idx > before.idx) {
      out.rankUp = after;
      out.rankReward = { premium: 1, coins: 300 };
      this.grant(out.rankReward);
    }
    out.rpAfter = rk.rp;
    out.levelUps = this.gainXP(out.xp);
    this.persist();
    return out;
  },

  /* ---------- ミッション ---------- */
  missionsEnsure() {
    const s = this.save, today = todayStr();
    if (s.missions.date === today && s.missions.list.length) return false;
    const pool = R.shuffle(MISSION_POOL).slice(0, 4);
    s.missions = { date: today, list: pool.map(m => ({ id: m.id, prog: 0, claimed: false })), bonus: false };
    this.persist();
    return true;
  },
  missionDef(id) { return MISSION_POOL.find(m => m.id === id); },
  track(stat, v) {
    const done = [];
    for (const m of this.save.missions.list) {
      const d = this.missionDef(m.id);
      if (!d || d.stat !== stat || m.claimed) continue;
      const before = m.prog;
      m.prog = d.max ? Math.max(m.prog, v) : m.prog + v;
      m.prog = Math.min(m.prog, d.goal);
      if (before < d.goal && m.prog >= d.goal) done.push(d);
    }
    if (done.length) this._doneQueue = (this._doneQueue || []).concat(done);
    return done;
  },
  trackBattle(res) {
    const st = res.stats, life = this.save.life;
    this.track('battles', 1);
    if (res.win) { this.track('wins', 1); life.wins++; }
    life.battles++;
    for (const k of ['crits', 'merges', 'fevers', 'cardsPlayed', 'kills', 'jackpots', 'star3', 'spells']) if (st[k]) this.track(k, st[k]);
    this.track('maxCombo', st.maxCombo);
    this.track('maxTurnDamage', st.maxTurnDamage);
    life.crits += st.crits; life.merges += st.merges; life.kills += st.kills;
    this.save.records.combo = Math.max(this.save.records.combo || 0, st.maxCombo);
  },
  popDone() { const q = this._doneQueue || []; this._doneQueue = []; return q; },
  claimable() {
    const s = this.save;
    let n = s.missions.list.filter(m => { const d = this.missionDef(m.id); return d && !m.claimed && m.prog >= d.goal; }).length;
    if (!s.missions.bonus && s.missions.list.length && s.missions.list.every(m => m.claimed)) n++;
    n += this.starRoad().filter(m => m.reached && !m.claimed).length;
    return n;
  },
  claimMission(i) {
    const m = this.save.missions.list[i];
    const d = m && this.missionDef(m.id);
    if (!d || m.claimed || m.prog < d.goal) return null;
    m.claimed = true;
    this.grant(d.reward);
    return d.reward;
  },
  claimBonus() {
    const s = this.save;
    if (s.missions.bonus || !s.missions.list.every(m => m.claimed)) return null;
    s.missions.bonus = true;
    const rw = { tickets: 1, coins: 200 };
    this.grant(rw);
    return rw;
  },

  /* ---------- ログインボーナス ---------- */
  loginCheck() {
    const s = this.save, today = todayStr();
    if (s.login.last === today) return null;
    const y = new Date(); y.setDate(y.getDate() - 1);
    const cont = s.login.last === todayStr(y);
    s.login.day = cont ? (s.login.day % 7) + 1 : 1;
    s.login.last = today;
    const rw = LOGIN_REWARDS[s.login.day - 1];
    this.grant(rw);
    return { day: s.login.day, reward: rw };
  },
};
