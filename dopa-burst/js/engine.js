'use strict';
/* ===== バトルエンジン =====
   すべてのゲームロジックはここ。演出は B.view（battle-ui.js）に投げるだけ。
   view が無ければ演出なしで高速に動く（テスト・シミュレーション用）。 */

class GameOver extends Error { constructor(w) { super('gameover'); this.winner = w; } }

const LANES = 5;
const HAND_MAX = 9;

const B = {
  G: null,
  view: null,
  _uid: 1,

  V(name, ...a) {
    const v = this.view;
    if (!v || !v[name] || Time.headless) return undefined;
    try {
      const r = v[name](...a);
      return r && r.then ? r.catch(e => console.error('[view]', name, e)) : r;
    } catch (e) { console.error('[view]', name, e); return undefined; }
  },

  /* ---------- 初期化 ---------- */
  start(cfg) {
    this._uid = 1;
    const G = this.G = {
      cfg, round: 0, active: 0, combo: 0, turnDamage: 0, field: null, spellsTurn: 0,
      tiles: [new Array(LANES).fill(null), new Array(LANES).fill(null)], // 陣地の軸：マスに刻まれた陣
      over: false, busy: false, winner: null, endHandled: false,
      P: [this._mkPlayer(cfg.player, 0), this._mkPlayer(cfg.enemy, 1)],
      stats: [this._mkStats(), this._mkStats()],
      reachShown: false,
    };
    for (let i = 0; i < 4; i++) { this._rawDraw(0); this._rawDraw(1); }
    for (let i = 4; i < (cfg.enemy.startHand || 4); i++) this._rawDraw(1);
    if (cfg.enemy.field && CARDS[cfg.enemy.field]) G.field = { def: CARDS[cfg.enemy.field], owner: 1 };
    // ボスは取り巻きを最初から場に置いていることがある
    (cfg.enemy.startUnits || []).forEach(([id, lane]) => { if (!G.P[1].board[lane]) G.P[1].board[lane] = this._mkUnit(1, id, lane); });
    return G;
  },
  _mkPlayer(c, idx) {
    return {
      idx, name: c.name, avatar: c.avatar, hp: c.hp, maxHp: c.hp,
      energy: 0, maxEnergy: c.startEnergy ?? 1, energyBonus: c.energyBonus || 0,
      deck: R.shuffle(c.deck).map(id => ({ uid: this._uid++, id })),
      hand: [], discard: [], grave: [],
      board: new Array(LANES).fill(null),
      fever: 0, feverOn: false, feverEnabled: c.fever !== false, feverRate: c.feverRate ?? 1,
      critBonus: 0, extraCrit: c.extraCrit || 0,
      passive: c.passive || null, isAI: !!c.isAI, ai: c.ai || {},
      // ボスラッシュ用：boss は読み取り専用の定義。状態（phase/ultCd）は数値で持つ（AIの盤面コピーで共有されないように）
      boss: c.boss || null, phase: 0, ultEvery: 0, ultCd: c.boss && c.boss.ult ? c.boss.ult.first ?? c.boss.ult.every : 0,
      heroRef: { isHero: true, owner: idx },
    };
  },
  _mkStats() {
    return { cardsPlayed: 0, spells: 0, crits: 0, merges: 0, kills: 0, fevers: 0, maxCombo: 0, maxTurnDamage: 0, damageDealt: 0, heroDamage: 0, jackpots: 0, star3: 0, healed: 0 };
  },

  /* ---------- 参照系 ---------- */
  P(pi) { return this.G.P[pi]; },
  hero(pi) { return this.G.P[pi].heroRef; },
  isUnit(t) { return !!(t && t.def && !t.isHero); },
  alive(u) { return !!(u && !u.removed && u.hp > 0); },
  units(pi) { return this.G.P[pi].board.filter(u => this.alive(u)); },
  allUnits() { return [...this.units(0), ...this.units(1)]; },
  _rawUnits() { return [...this.G.P[0].board, ...this.G.P[1].board].filter(u => u && !u.removed); },
  emptyLanes(pi) { const r = []; this.G.P[pi].board.forEach((u, i) => { if (!u) r.push(i); }); return r; },
  oppositeOf(u) { const o = this.G.P[1 - u.owner].board[u.lane]; return this.alive(o) ? o : null; },
  adjacent(u) {
    const b = this.G.P[u.owner].board;
    return [b[u.lane - 1], b[u.lane + 1]].filter(x => this.alive(x));
  },
  randomEnemy(pi, includeHero) {
    const pool = this.units(1 - pi);
    if (includeHero || !pool.length) pool.push(this.hero(1 - pi));
    return R.pick(pool);
  },
  spellSrc(pi) { return { owner: pi, spell: true }; },
  fieldSrc(pi) { return { owner: pi, field: true }; },
  ownerOf(src) { return src && src.owner != null ? src.owner : null; },

  atkOf(u) {
    let a = u.atk;
    const f = this.G.field;
    if (f && f.def.fieldAtk) a += f.def.fieldAtk(this, u, f.owner);
    if (u.def.atkMod) a += u.def.atkMod(this, u);
    const tile = this.tileAt(u.owner, u.lane);
    if (tile && tile.kind === 'power') a += 10;
    return Math.max(0, a);
  },
  // 状況で増えるキーワード（例：ひとりの時だけ飛行）も含めて判定
  hasKw(u, k) {
    if (!u || !u.kw) return false;
    if (u.kw.has(k)) return true;
    return !!(u.def.dynKw && this.alive(u) && u.def.dynKw(this, u).includes(k));
  },
  kwList(u) {
    const s = new Set(u.kw);
    if (u.def.dynKw && this.alive(u)) u.def.dynKw(this, u).forEach(k => s.add(k));
    return [...s];
  },
  critChance(u) {
    const P = this.G.P[u.owner];
    let c = 0.1 + P.critBonus + P.extraCrit;
    if (u.kw.has('lucky')) c += 0.3;
    const f = this.G.field;
    if (f && f.def.fieldCrit) c += f.def.fieldCrit(this, u, f.owner);
    return Math.min(0.95, c);
  },
  critMult(u) {
    const f = this.G.field;
    if (f && f.def.fieldCritMult) return f.def.fieldCritMult(this, u, f.owner);
    return 2;
  },
  costOf(pi, def) {
    let c = def.cost - (def.costMod ? def.costMod(this, pi) : 0);
    const P = this.G && this.G.P[pi];
    if (P && P.bigDiscount && def.cost >= 6) c -= P.bigDiscount; // 巨大化の軸：このターン、コスト6以上が安くなる
    return Math.max(0, c);
  },
  // 巨大化の軸：最大PPを増やす（上限10）
  async rampPP(pi, n) {
    const P = this.G.P[pi];
    const before = P.maxEnergy;
    P.maxEnergy = Math.min(10, P.maxEnergy + n);
    await this.V('ramp', pi, P.maxEnergy - before);
  },
  // 呪いの軸：ヒーローに呪いを積む（毎ターン開始時に10×呪いダメージ。減らない。最大6）
  async addCurse(pi, n) {
    const P = this.G.P[pi];
    const before = P.curse || 0;
    P.curse = Math.min(this.CURSE_MAX, before + n);
    if (P.curse !== before) await this.V('curse', pi, P.curse - before);
  },
  CURSE_MAX: 6,
  // 鉄壁の軸：アーマーと守りの陣で、受けるダメージを減らす
  reduceOf(u) {
    let r = this.hasKw(u, 'armor') ? 10 : 0;
    const t = this.tileAt(u.owner, u.lane);
    if (t && t.kind === 'guard') r += 10;
    return r;
  },
  // 守護：ヒーローへの直撃を代わりに受けるユニット（いちばんHPが多いもの）
  guardOf(pi, hpOf) {
    const gs = this.units(pi).filter(u => this.hasKw(u, 'guard') && (!hpOf || hpOf(u) > 0));
    if (!gs.length) return null;
    return gs.sort((a, b) => (hpOf ? hpOf(b) - hpOf(a) : b.hp - a.hp) || a.lane - b.lane)[0];
  },
  tileAt(pi, lane) { const T = this.G.tiles; return T && T[pi] ? T[pi][lane] : null; },
  async setTile(pi, lane, kind, by) {
    const G = this.G;
    if (!G.tiles) G.tiles = [new Array(LANES).fill(null), new Array(LANES).fill(null)];
    G.tiles[pi][lane] = kind ? { kind, by } : null;
    await this.V('tile', pi, lane, kind);
  },
  tileCount(pi, kind) { const T = this.G.tiles; return T ? T[pi].filter(t => t && (!kind || t.kind === kind)).length : 0; },

  /* ---------- ドロー ---------- */
  _rawDraw(pi) {
    const P = this.G.P[pi];
    if (!P.deck.length) {
      if (!P.discard.length) return null;
      P.deck = R.shuffle(P.discard).map(id => ({ uid: this._uid++, id }));
      P.discard = [];
    }
    const c = P.deck.pop();
    if (P.hand.length >= HAND_MAX) { P.discard.push(c.id); return { burned: c }; }
    P.hand.push(c);
    return c;
  },
  async draw(pi, n = 1) {
    for (let i = 0; i < n; i++) {
      const P = this.G.P[pi];
      const reshuffle = !P.deck.length && P.discard.length;
      const c = this._rawDraw(pi);
      if (!c) break;
      if (reshuffle) await this.V('reshuffle', pi);
      if (c.burned) { await this.V('handFull', pi, c.burned); continue; }
      await this.V('draw', pi, c);
    }
  },
  async addRandomCards(pi, n) {
    const P = this.G.P[pi];
    for (let i = 0; i < n; i++) {
      const r = R.weighted([['N', 46], ['R', 30], ['SR', 15], ['SSR', 7], ['UR', 2]]);
      const pool = COLLECTIBLE.filter(c => c.rarity === r);
      const def = R.pick(pool);
      const c = { uid: this._uid++, id: def.id, gift: true };
      if (P.hand.length >= HAND_MAX) { await this.V('handFull', pi, c); continue; }
      P.hand.push(c);
      await this.V('draw', pi, c, { gift: true });
    }
  },

  /* ---------- ダメージ／回復／強化 ---------- */
  async damage(src, target, amt, opts = {}) {
    const G = this.G;
    if (!target || G.over) return 0;
    amt = Math.max(0, Math.round(amt));
    const so = this.ownerOf(src);
    if (this.isUnit(target)) {
      if (target.removed || target.hp <= 0) return 0;
      if (opts.fx && !opts.attack) await this.V('projectile', src, target, opts);
      if (target.removed || target.hp <= 0) return 0;
      if (amt <= 0) { await this.V('damage', target, 0, opts); return 0; }
      if (target.shield) { target.shield = false; await this.V('blocked', target); return 0; }
      const red = this.reduceOf(target);
      if (red > 0) {
        amt = Math.max(0, amt - red);
        if (amt <= 0) { await this.V('damage', target, 0, Object.assign({}, opts, { armored: true })); return 0; }
        opts = Object.assign({}, opts, { armored: true });
      }
      const before = target.hp;
      target.hp -= amt;
      target.lastHitBy = this.isUnit(src) ? src : null;
      target.lastHitOwner = so;
      this._countDamage(so, target.owner, amt);
      await this.V('damage', target, amt, opts);
      if (target.def.onHurt) await target.def.onHurt(this, target, amt, src);
      const overkill = Math.max(0, amt - before);
      const pierce = opts.pierce || (opts.attack && this.isUnit(src) && this.hasKw(src, 'pierce'));
      if (pierce && overkill > 0) {
        await this.V('pierce', target);
        await this.damage(src, this.hero(target.owner), overkill, { pierced: true, crit: opts.crit });
      }
      return Math.min(amt, before);
    }
    if (target.isHero) {
      if (opts.fx && !opts.attack) await this.V('projectile', src, target, opts);
      if (amt <= 0) { await this.V('damage', target, 0, opts); return 0; }
      const P = G.P[target.owner];
      const cap = this.units(target.owner).reduce((m, u) => (u.def.heroCap ? Math.min(m, u.def.heroCap) : m), Infinity);
      if (amt > cap) { amt = cap; opts = Object.assign({}, opts, { capped: true }); }
      P.hp -= amt;
      this._countDamage(so, target.owner, amt);
      if (so != null && so !== target.owner) { G.stats[so].heroDamage += amt; this.addFever(so, amt / 10); }
      await this.V('damage', target, amt, opts);
      if (P.hp <= 0) { P.hp = 0; this.gameOver(1 - target.owner); }
      return amt;
    }
    return 0;
  },
  _countDamage(so, victimOwner, amt) {
    if (so == null || so === victimOwner) return;
    const G = this.G;
    G.stats[so].damageDealt += amt;
    if (so === G.active) G.turnDamage += amt;
  },
  async damageMany(src, targets, amt, opts = {}) {
    targets = targets.filter(t => t && (t.isHero || this.alive(t)));
    if (!targets.length) return;
    if (opts.fx) await this.V('projectileMany', src, targets, opts);
    for (const t of targets) await this.damage(src, t, amt, Object.assign({}, opts, { fx: null, many: true, kind: opts.fx }));
    await this.processDeaths();
  },
  gameOver(winner) {
    const G = this.G;
    if (G.over) throw new GameOver(G.winner);
    G.over = true; G.winner = winner;
    throw new GameOver(winner);
  },
  async heal(target, amt, src) {
    if (!target) return 0;
    if (this.isUnit(target)) {
      if (!this.alive(target)) return 0;
      const v = Math.min(amt, target.maxHp - target.hp);
      if (v <= 0) return 0;
      target.hp += v;
      await this.V('heal', target, v);
      this.G.stats[target.owner].healed += v;
      await this._healHook(target.owner, target, v);
      return v;
    }
    const P = this.G.P[target.owner];
    const v = Math.min(amt, P.maxHp - P.hp);
    if (v <= 0) return 0;
    P.hp += v;
    this.G.stats[target.owner].healed += v;
    await this.V('heal', target, v);
    await this._healHook(target.owner, target, v);
    return v;
  },
  // 癒しの軸：回復が起きるたびに反応するユニット（連鎖しすぎないよう深さを制限）
  async _healHook(pi, target, v) {
    const G = this.G;
    if ((G.healDepth || 0) >= 2) return;
    G.healDepth = (G.healDepth || 0) + 1;
    try { for (const a of this.units(pi)) if (a.def.onAnyHeal) await a.def.onAnyHeal(this, a, target, v); }
    finally { G.healDepth--; }
  },
  async buff(u, a, h, opts = {}) {
    if (!this.alive(u)) return;
    u.atk += a; u.maxHp += h; u.hp += h;
    await this.V('buff', u, a, h, opts);
  },
  async buffAll(pi, a, h, except) {
    const us = this.units(pi).filter(u => u !== except);
    for (const u of us) { u.atk += a; u.maxHp += h; u.hp += h; }
    if (us.length) await this.V('buffMany', us, a, h);
  },
  giveKw(u, kw) { if (!this.alive(u)) return; u.kw.add(kw); this.V('status', u, kw); },
  giveShield(u) { if (!this.alive(u)) return; u.shield = true; this.V('status', u, 'shield'); },
  async burn(u, n, src) {
    if (!this.alive(u)) return;
    u.burn += n; u.burnOwner = src ? this.ownerOf(src) : 1 - u.owner;
    await this.V('status', u, 'burn');
  },
  async freeze(u) { if (!this.alive(u)) return; u.frozen = true; await this.V('status', u, 'frozen'); },
  // 自分のターン中なら今すぐ、相手のターン中なら次の自分のターン開始時にPPを足す
  async gainEnergySoon(pi, n) {
    if (this.G.active === pi) return this.gainEnergy(pi, n);
    this.G.P[pi].nextEnergy = (this.G.P[pi].nextEnergy || 0) + n;
    await this.V('say', pi, `次のターンPP+${n}`, '#2ee6ff');
  },
  async gainEnergy(pi, n) { const P = this.G.P[pi]; P.energy = Math.min(P.energy + n, 15); await this.V('energy', pi, n); },
  addFever(pi, n) {
    const P = this.G.P[pi];
    if (!P.feverEnabled || P.feverOn || n <= 0) return;
    const was = P.fever;
    P.fever = Math.min(100, P.fever + n * 1.4 * P.feverRate); // PP回復だけになったぶん、溜まりやすくしてある
    if (was < 100 && P.fever >= 100) this.V('feverReady', pi);
    this.V('feverGauge', pi);
  },
  bumpCombo(pi, n = 1) {
    const G = this.G;
    if (pi !== G.active) return;
    G.combo += n;
    G.stats[pi].maxCombo = Math.max(G.stats[pi].maxCombo, G.combo);
    this.addFever(pi, n);
    this.V('combo', G.combo, pi);
  },

  /* ---------- 召喚・合体・破壊 ---------- */
  async summon(pi, id, lane, opts = {}) {
    const P = this.G.P[pi];
    if (P.board[lane]) {
      const free = this.emptyLanes(pi);
      if (!free.length) return null;
      lane = R.pick(free);
    }
    const u = this._mkUnit(pi, id, lane);
    P.board[lane] = u;
    await this.V('summon', u, opts);
    const tile = this.tileAt(pi, lane);
    if (tile && tile.kind === 'trap') {
      await this.setTile(pi, lane, null);
      await this.V('trapFx', u);
      await this.damage({ owner: 1 - pi, trap: true }, u, 30, { trap: true });
    }
    // 迎撃：正面に敵が出てきたら、その場で20ダメージ
    const opp = this.G.P[1 - pi].board[lane];
    if (this.alive(u) && this.alive(opp) && this.hasKw(opp, 'intercept')) {
      await this.V('interceptFx', opp, u);
      await this.damage(opp, u, 20, { fx: 'bolt' });
    }
    // トークンの軸：味方が出るたびに反応するユニット
    if (this.alive(u)) for (const a of this.units(pi)) if (a !== u && a.def.onAllySummon) await a.def.onAllySummon(this, a, u);
    return u;
  },
  _mkUnit(pi, id, lane) {
    const def = CARDS[id];
    return {
      uid: this._uid++, id, def, owner: pi, lane,
      atk: def.atk, hp: def.hp, maxHp: def.hp, star: 1,
      kw: new Set(def.kw.filter(k => k !== 'shield')), shield: def.kw.includes('shield'),
      burn: 0, frozen: false, revived: false, removed: false, token: !!def.token, born: this.G ? this.G.round : 0,
      count: def.countdown || 0,
    };
  },
  async _starUp(u, def) {
    if (!this.alive(u) || u.star >= 3) return false;
    u.star++;
    u.atk += def.atk; u.maxHp += def.hp; u.hp = u.maxHp;
    u.burn = 0; u.frozen = false;
    if (def.countdown && u.count <= 0) { u.count = def.countdown; u.countFired = false; } // 発動済みのカウントは合体で再セット
    const awaken = u.star === 3;
    if (awaken) { u.atk += 10; u.maxHp += 10; u.hp = u.maxHp; u.shield = true; this.G.stats[u.owner].star3++; }
    this.G.stats[u.owner].merges++;
    this.addFever(u.owner, 15);
    await this.V('merge', u, awaken);
    if (def.onMerge) await def.onMerge(this, u);
    return true;
  },
  async upgrade(u) { if (await this._starUp(u, u.def)) this.bumpCombo(u.owner); },
  async destroy(u) {
    if (!this.alive(u)) return;
    u.hp = 0;
    u.lastHitOwner = null;
    await this.V('destroyFx', u);
    await this.processDeaths();
  },
  async processDeaths() {
    const G = this.G;
    for (let guard = 0; guard < 30; guard++) {
      const dead = this._rawUnits().filter(u => u.hp <= 0);
      if (!dead.length) return;
      for (const u of dead) {
        if (u.removed) continue;
        if (u.kw.has('undying') && !u.revived) {
          u.revived = true; u.kw.delete('undying');
          u.hp = u.def.fullRevive ? u.maxHp : 10; u.burn = 0; u.frozen = false;
          await this.V('revive', u);
          continue;
        }
        u.removed = true;
        if (G.P[u.owner].board[u.lane] === u) G.P[u.owner].board[u.lane] = null;
        await this.V('death', u);
        if (!u.token) {
          G.P[u.owner].grave.push(u.id);
          for (let s = 0; s < u.star; s++) G.P[u.owner].discard.push(u.id);
        }
        const ko = u.lastHitOwner;
        if (ko != null && ko !== u.owner) {
          G.stats[ko].kills++;
          this.addFever(ko, 8);
          this.bumpCombo(ko);
          const killer = u.lastHitBy;
          if (killer && this.alive(killer) && killer.def.onKill) await killer.def.onKill(this, killer, u);
        }
        // カウント中に倒されたら、残りカウントに関係なくその場で発動
        if (u.count > 0 && u.def.onCountdown && !u.countFired) {
          u.countFired = true; u.count = 0;
          await this.V('countBurst', u);
          await u.def.onCountdown(this, u);
        }
        if (u.def.onDeath) await u.def.onDeath(this, u);
        const f = G.field;
        if (f && f.def.fieldDeath) await f.def.fieldDeath(this, u, f.owner);
      }
    }
  },

  /* ---------- 未知なる軸：時間・移動・変身・代償 ---------- */
  async tickCount(u) {
    if (!this.alive(u) || u.count <= 0) return;
    u.count--;
    await this.V('countTick', u);
    if (u.count === 0 && u.def.onCountdown && !u.countFired) { u.countFired = true; await u.def.onCountdown(this, u); }
  },
  // 自分の空きマスを探す（open=正面に敵がいないマスを優先）
  freeLane(pi, near, preferOpen) {
    const E = this.G.P[1 - pi].board;
    let lanes = this.emptyLanes(pi);
    if (!lanes.length) return null;
    if (preferOpen) { const open = lanes.filter(l => !this.alive(E[l])); if (open.length) lanes = open; }
    lanes.sort((a, b) => Math.abs(a - near) - Math.abs(b - near) || R.next() - 0.5);
    return lanes[0];
  },
  adjacentFree(u) {
    const b = this.G.P[u.owner].board, E = this.G.P[1 - u.owner].board;
    const c = [u.lane - 1, u.lane + 1].filter(l => l >= 0 && l < LANES && !b[l]);
    if (!c.length) return null;
    const open = c.filter(l => !this.alive(E[l]));
    return R.pick(open.length ? open : c);
  },
  async moveUnit(u, lane, opts = {}) {
    const P = this.G.P[u.owner];
    if (!this.alive(u) || lane == null || lane === u.lane || P.board[lane]) return false;
    const from = u.lane;
    if (P.board[from] === u) P.board[from] = null;
    u.lane = lane; P.board[lane] = u;
    await this.V('move', u, from, opts);
    return true;
  },
  async pushAside(t) {
    if (!this.alive(t)) return;
    const l = this.adjacentFree(t);
    if (l == null) { this.V('say', t.owner, '吹き飛ばせない！'); return; }
    await this.moveUnit(t, l, { push: true });
  },
  async compact(pi) {
    let i = 0;
    for (const u of this.units(pi).sort((a, b) => a.lane - b.lane)) { if (u.lane !== i) await this.moveUnit(u, i, { quick: true }); i++; }
  },
  async warpAllToOpen(pi) {
    const E = this.G.P[1 - pi].board;
    for (const u of this.units(pi).sort((a, b) => a.lane - b.lane)) {
      if (!this.alive(E[u.lane])) continue;
      const l = this.freeLane(pi, u.lane, true);
      if (l != null && !this.alive(E[l])) await this.moveUnit(u, l, { quick: true });
    }
  },
  async transform(u, id, opts = {}) {
    if (!this.alive(u)) return;
    const def = CARDS[id], old = u.def;
    Object.assign(u, {
      id, def, atk: def.atk, hp: def.hp, maxHp: def.hp, star: 1,
      kw: new Set(def.kw.filter(k => k !== 'shield')), shield: def.kw.includes('shield'),
      burn: 0, frozen: false, token: !!def.token, count: def.countdown || 0, countFired: false,
    });
    await this.V('transform', u, old, opts);
  },
  async steal(t, toPi) {
    if (!this.alive(t)) return;
    const from = t.owner, fromLane = t.lane;
    const lane = this.freeLane(toPi, t.lane, true);
    if (lane == null) { await this.annihilate({ owner: toPi }, [t]); return; }
    this.G.P[from].board[fromLane] = null;
    t.owner = toPi; t.lane = lane; t.frozen = false;
    this.G.P[toPi].board[lane] = t;
    await this.V('steal', t, from, fromLane);
  },
  async annihilate(src, list) {
    for (const t of list) {
      if (!this.alive(t)) continue;
      t.hp = 0; t.lastHitOwner = this.ownerOf(src); t.lastHitBy = this.isUnit(src) ? src : null;
      this.V('destroyFx', t);
    }
    await this.processDeaths();
  },
  // HPを払う（代償では倒れず、1で踏みとどまる）
  async payHp(pi, n) {
    const P = this.G.P[pi];
    const v = Math.min(n, P.hp - 1);
    if (v <= 0) return 0;
    P.hp -= v;
    await this.V('payHp', pi, v);
    return v;
  },

  // 空きマスにユニットを並べる（near に近いマスから）
  async summonTokens(pi, id, n, near = 2) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const l = this.freeLane(pi, near, false);
      if (l == null) break;
      const u = await this.summon(pi, id, l, { token: true });
      if (u) out.push(u);
    }
    return out;
  },

  /* ---------- ボスが使う特殊な効果 ---------- */
  // ユニットを持ち主の手札に戻す（トークンは消える）
  async bounce(u) {
    if (!this.alive(u)) return;
    const P = this.G.P[u.owner];
    if (P.board[u.lane] === u) P.board[u.lane] = null;
    u.removed = true;
    await this.V('bounce', u);
    if (u.token) return;
    if (P.hand.length < HAND_MAX) P.hand.push({ uid: this._uid++, id: u.id });
    else P.discard.push(u.id);
    this.V('sync');
  },
  // ATKを下げる（0未満にはならない）
  async debuff(u, a) {
    if (!this.alive(u)) return;
    const v = Math.min(a, u.atk);
    u.atk -= v;
    await this.V('debuff', u, v);
  },
  // 手札をランダムに捨てさせる
  async discardRandom(pi, n) {
    const P = this.G.P[pi];
    for (let i = 0; i < n && P.hand.length; i++) {
      const c = P.hand.splice(R.int(0, P.hand.length - 1), 1)[0];
      if (!c.gift) P.discard.push(c.id);
      await this.V('discardCard', pi, c);
    }
  },
  // 墓地のユニットを空きマスに復活
  async reviveFromGrave(pi, n, filter) {
    const P = this.G.P[pi];
    let k = 0;
    for (let i = 0; i < n; i++) {
      const lanes = this.emptyLanes(pi);
      const pool = P.grave.filter(id => CARDS[id] && (!filter || filter(CARDS[id])));
      if (!lanes.length || !pool.length) break;
      const id = R.pick(pool);
      P.grave.splice(P.grave.indexOf(id), 1);
      await this.summon(pi, id, R.pick(lanes), { revive: true });
      k++;
    }
    return k;
  },
  // 場のユニットの位置をばらばらに入れ替える
  async shuffleBoard(pi) {
    const P = this.G.P[pi], us = this.units(pi);
    if (!us.length) return;
    const lanes = R.shuffle([0, 1, 2, 3, 4].filter(l => !P.board[l] || this.alive(P.board[l])));
    us.forEach(u => { P.board[u.lane] = null; });
    const moves = us.map((u, i) => { const from = u.lane; u.lane = lanes[i]; P.board[u.lane] = u; return [u, from]; });
    for (const [u, from] of moves) if (u.lane !== from) await this.V('move', u, from, { quick: true, shuffle: true });
  },
  // 手札のユニットをコストを払わずに出す
  async summonFromHand(pi, n, filter) {
    const P = this.G.P[pi];
    for (let i = 0; i < n; i++) {
      const lanes = this.emptyLanes(pi);
      const cands = P.hand.filter(c => CARDS[c.id].type === 'unit' && (!filter || filter(CARDS[c.id]))).sort((a, b) => CARDS[b.id].cost - CARDS[a.id].cost);
      if (!lanes.length || !cands.length) break;
      const c = cands[0];
      P.hand.splice(P.hand.indexOf(c), 1);
      const u = await this.summon(pi, c.id, this.freeLane(pi, R.pick(lanes), false), { fromHand: true });
      if (u && u.def.onPlay) await u.def.onPlay(this, u);
      await this.processDeaths();
    }
  },
  // ボス：HPがしきい値を下回ったら覚醒（安全なタイミングでまとめて処理）
  async bossCheck() {
    const G = this.G;
    if (!G || G.over || G.bossBusy) return;
    for (const P of G.P) {
      const b = P.boss;
      if (!b || !b.phases) continue;
      while (P.phase < b.phases.length && P.hp > 0 && P.hp <= P.maxHp * b.phases[P.phase].at) {
        const ph = b.phases[P.phase];
        P.phase++;
        G.bossBusy = true;
        try {
          await this.V('bossPhase', P.idx, P.phase, ph);
          await ph.run(this, P.idx);
          await this.processDeaths();
        } finally { G.bossBusy = false; }
      }
    }
  },
  async bossUltimate(pi) {
    const P = this.G.P[pi], u = P.boss && P.boss.ult;
    if (!u) return;
    P.ultCd--;
    if (P.ultCd > 0) { this.V('sync'); return; }
    await this.V('bossUlt', pi, u);
    await u.run(this, pi);
    await this.processDeaths();
    P.ultCd = P.ultEvery || u.every;
    this.V('sync');
  },

  /* ---------- 演出付きランダム ---------- */
  async dice(u) { const n = R.int(1, 6); await this.V('dice', u, n); return n; },
  async coinFlip(pi, n) { const r = []; for (let i = 0; i < n; i++) r.push(R.chance(0.5)); await this.V('coins', pi, r); return r; },
  async roulette(pi, opts) { const i = R.int(0, opts.length - 1); await this.V('roulette', pi, opts, i); return i; },
  async slotMachine(pi, force) {
    const SYM = ['7', '💎', '🍒', '🔔'];
    const pickSym = () => R.weighted([['7', 14], ['💎', 28], ['🍒', 30], ['🔔', 28]]);
    let reels, kind;
    const roll = R.next();
    if (force) { reels = ['7', '7', '7']; kind = 'triple'; }
    else if (roll < 0.2) { const s = pickSym(); reels = [s, s, s]; kind = 'triple'; }
    else if (roll < 0.7) {
      const s = pickSym(); let o; do { o = R.pick(SYM); } while (o === s);
      reels = R.shuffle([s, s, o]); kind = 'double';
    } else {
      reels = R.shuffle(SYM).slice(0, 3); kind = 'none';
    }
    const counts = {}; reels.forEach(s => (counts[s] = (counts[s] || 0) + 1));
    const sym = Object.keys(counts).find(k => counts[k] >= 2);
    await this.V('slot', pi, reels, kind, sym);
    const e = 1 - pi;
    if (kind === 'triple') {
      this.G.stats[pi].jackpots++;
      if (sym === '7') {
        const es = this.units(e);
        if (es.length) await this.damageMany(this.spellSrc(pi), es, 70, { fx: 'gold' });
        await this.damage(this.spellSrc(pi), this.hero(e), 70, { fx: 'gold' });
      } else if (sym === '💎') await this.buffAll(pi, 30, 30);
      else if (sym === '🍒') await this.draw(pi, 3);
      else { await this.gainEnergy(pi, 3); this.addFever(pi, 30); }
    } else if (kind === 'double') {
      if (sym === '7') await this.damage(this.spellSrc(pi), this.hero(e), 40, { fx: 'gold' });
      else if (sym === '💎') { const a = R.pick(this.units(pi)); if (a) await this.buff(a, 20, 20); else await this.heal(this.hero(pi), 20); }
      else if (sym === '🍒') { await this.draw(pi, 1); await this.heal(this.hero(pi), 20); }
      else { await this.gainEnergy(pi, 1); this.addFever(pi, 15); }
    } else {
      await this.draw(pi, 1);
    }
    await this.processDeaths();
  },
  cutin(u, text) { return this.V('cutin', u, text); },
  quake() { return this.V('quake'); },
  explode(u) { this.V('explode', u); },
  say(pi, text, color) { this.V('say', pi, text, color); },

  /* ---------- フィーバー ---------- */
  canFever(pi) { const P = this.G.P[pi]; return P.feverEnabled && P.fever >= 100 && !P.feverOn && this.G.active === pi; },
  async activateFever(pi) {
    if (!this.canFever(pi)) return false;
    const P = this.G.P[pi];
    P.fever = 0; P.feverOn = true; P.energy += 3; // フィーバーはPPを3回復するだけ（上限を超えてもOK）
    this.G.stats[pi].fevers++;
    await this.V('fever', pi, true);
    return true;
  },

  /* ---------- ターン ---------- */
  async beginTurn(pi) {
    const G = this.G;
    G.active = pi; G.combo = 0; G.turnDamage = 0; G.reachShown = false; G.spellsTurn = 0;
    const P = G.P[pi];
    if (pi === 0) G.round++;
    P.critBonus = 0;
    P.maxEnergy = Math.min(10, P.maxEnergy + 1);
    P.energy = Math.max(0, P.maxEnergy + P.energyBonus + (P.nextEnergy || 0));
    P.nextEnergy = 0;
    P.bigDiscount = 0;
    await this.V('turnStart', pi, G.round);
    if (G.round >= 16 && pi === 0) {
      const d = (G.round - 15) * 10;
      await this.V('suddenDeath', d);
      await this.damage(null, this.hero(0), d, { fx: null });
      await this.damage(null, this.hero(1), d, { fx: null });
    }
    await this.draw(pi, 1);
    if (P.curse > 0) {
      await this.V('curseTick', pi, P.curse);
      await this.damage({ owner: 1 - pi, curse: true }, this.hero(pi), P.curse * 10, { curse: true });
    }
    for (const u of this.units(pi)) {
      if (u.burn > 0) {
        const d = 10 * u.burn; u.burn--;
        await this.V('burnTick', u);
        await this.damage({ owner: u.burnOwner, burn: true }, u, d, { burn: true });
      }
    }
    await this.processDeaths();
    const f = G.field;
    if (f && f.owner === pi && f.def.fieldTurnStart) { await this.V('fieldPulse', f); await f.def.fieldTurnStart(this, pi); await this.processDeaths(); }
    for (const u of this.units(pi)) {
      if (!this.alive(u)) continue;
      if (u.count > 0) await this.tickCount(u);
      if (!this.alive(u)) continue;
      if (u.kw.has('regen')) await this.heal(u, 20);
      if (u.def.onTurnStart) { await this.V('trigger', u); await u.def.onTurnStart(this, u); }
    }
    await this.processDeaths();
    if (P.passive && P.passive.turnStart) { await this.V('passive', pi, P.passive); await P.passive.turnStart(this, pi); await this.processDeaths(); }
    if (P.boss) await this.bossUltimate(pi);
    await this.bossCheck();
    this.V('sync');
  },

  async endTurn(pi) {
    const G = this.G;
    // アタック前の効果：攻撃の直前に毎ターン発動（出したターンから）
    for (const u of this.units(pi)) {
      if (!this.alive(u) || !u.def.onPreAttack) continue;
      await this.V('trigger', u, 'pre');
      await u.def.onPreAttack(this, u);
      await this.processDeaths();
    }
    await this.attackPhase(pi);
    await this.bossCheck();
    const st = G.stats[pi];
    st.maxTurnDamage = Math.max(st.maxTurnDamage, G.turnDamage);
    await this.V('turnSummary', pi, G.turnDamage, G.combo);
    const P = G.P[pi];
    if (P.feverOn) { P.feverOn = false; await this.V('fever', pi, false); }
  },

  async attackPhase(pi) {
    const G = this.G, P = G.P[pi];
    await this.V('attackPhase', pi, this.potentialFace(pi) >= G.P[1 - pi].hp);
    const done = new Set(); // ワープで右に移ったユニットが2回攻撃しないように
    for (let lane = 0; lane < LANES; lane++) {
      const u = P.board[lane];
      if (!this.alive(u) || done.has(u.uid)) continue;
      done.add(u.uid);
      if (u.frozen) { u.frozen = false; await this.V('frozenSkip', u); continue; }
      const swings = this.hasKw(u, 'double') ? 2 : 1;
      for (let s = 0; s < swings; s++) {
        if (!this.alive(u) || this.atkOf(u) <= 0) break;
        await this.unitAttack(u);
      }
    }
  },

  async unitAttack(u) {
    const G = this.G, e = 1 - u.owner;
    const opp = G.P[e].board[u.lane];
    let target = (!this.hasKw(u, 'fly') && this.alive(opp)) ? opp : this.hero(e);
    if (target.isHero) { const g = this.guardOf(e); if (g) { target = g; await this.V('guardFx', g, u); } }
    const info = { target, dmg: this.atkOf(u), crit: false, label: null };
    if (!this.simMode && R.chance(this.critChance(u))) { info.crit = true; info.dmg = Math.round(info.dmg * this.critMult(u)); }
    if (u.def.beforeAttack) await u.def.beforeAttack(this, u, info);
    await this.V('lunge', u, target, info);
    if (info.crit && info.dmg > 0) G.stats[u.owner].crits++;
    const dealt = await this.damage(u, target, info.dmg, { attack: true, crit: info.crit, label: info.label, src: u });
    this.V('lungeBack', u);
    if (info.dmg > 0) {
      this.bumpCombo(u.owner);
      this.addFever(u.owner, 3);
      if (info.crit) {
        this.addFever(u.owner, 6);
        for (const a of this.units(u.owner)) if (a.def.onAllyCrit) await a.def.onAllyCrit(this, a);
      }
    }
    if (this.isUnit(target) && info.dmg > 0) {
      if (u.kw.has('burnhit') && this.alive(target)) await this.burn(target, 1, u);
      if (u.kw.has('freezehit') && this.alive(target)) await this.freeze(target);
      if (u.kw.has('poison') && dealt > 0 && this.alive(target)) { target.hp = 0; target.lastHitBy = u; target.lastHitOwner = u.owner; await this.V('poison', target); }
      if (u.kw.has('chain')) {
        const b = G.P[e].board;
        const adj = [b[target.lane - 1], b[target.lane + 1]].filter(x => this.alive(x));
        if (adj.length) await this.damageMany(u, adj, Math.floor(info.dmg / 2), { fx: 'bolt', chain: true });
      }
      if (target.kw.has('thorns') && this.alive(u)) await this.damage(target, u, 20, { thorns: true });
    }
    if (u.kw.has('drain') && dealt > 0) await this.heal(this.hero(u.owner), dealt, u);
    if (u.def.afterAttack && this.alive(u)) await u.def.afterAttack(this, u, info);
    await this.processDeaths();
    if (this.hasKw(u, 'warp') && this.alive(u)) await this.moveUnit(u, this.adjacentFree(u), { warp: true });
    await this.bossCheck();
  },

  // このターン敵ヒーローに入りそうなダメージ（リーチ判定）
  potentialFace(pi) { return this.predictAttacks(pi).face; },

  // 初心者向け：このまま攻撃したら何が起きるか（クリティカル・ランダム効果は除く）
  // skip: 先に倒される予定のユニット（相手の攻撃を予測するときに使う）
  predictAttacks(pi, skip) {
    const G = this.G, P = G.P[pi], E = G.P[1 - pi];
    const st = new Map();
    E.board.forEach(o => { if (this.alive(o)) st.set(o.uid, { hp: o.hp, shield: o.shield }); });
    const list = [];
    let face = 0;
    for (let lane = 0; lane < LANES; lane++) {
      const u = P.board[lane];
      if (!this.alive(u) || (skip && skip.has(u.uid))) continue;
      if (u.frozen) { list.push({ u, frozen: true }); continue; }
      const a = this.atkOf(u);
      if (a <= 0) { list.push({ u, idle: true }); continue; }
      const unsure = !!u.def.beforeAttack;
      const sw = this.hasKw(u, 'double') ? 2 : 1;
      for (let s = 0; s < sw; s++) {
        const opp = E.board[lane], so0 = opp && st.get(opp.uid);
        const fly = this.hasKw(u, 'fly');
        let o = null, so = null;
        if (!fly && so0 && so0.hp > 0) { o = opp; so = so0; }
        else {
          // ヒーローへの直撃は「守護」を持つユニットが代わりに受ける
          const g = this.guardOf(1 - pi, x => (st.get(x.uid) || x).hp);
          if (g) { o = g; so = st.get(g.uid); }
        }
        if (!o) {
          if (!unsure) face += a;
          list.push({ u, hero: true, dmg: a, unsure, fly: fly && !!so0 && so0.hp > 0 });
        } else if (so.shield) {
          so.shield = false; list.push({ u, target: o, dmg: 0, block: true });
        } else {
          const before = so.hp;
          const ad = Math.max(0, a - this.reduceOf(o));
          if (!unsure) so.hp -= ad;
          const kill = !unsure && so.hp <= 0;
          let pierce = 0;
          if (kill && this.hasKw(u, 'pierce')) { pierce = ad - before; face += pierce; }
          list.push({ u, target: o, dmg: ad, kill, pierce, unsure, guard: o !== E.board[lane] || undefined });
        }
      }
    }
    const killed = new Set([...st].filter(([, v]) => v.hp <= 0).map(([k]) => k));
    return { list, face, killed };
  },

  /* ---------- カードプレイ ---------- */
  targetsFor(pi, card) {
    const def = CARDS[card.id], P = this.G.P[pi];
    const out = [];
    if (def.type === 'unit') {
      P.board.forEach((u, lane) => {
        if (!u) out.push({ kind: 'lane', owner: pi, lane });
        else if (this.alive(u) && u.id === def.id && u.star < 3) out.push({ kind: 'merge', owner: pi, lane, u });
      });
      return out;
    }
    switch (def.target) {
      case 'enemyUnit': return this.units(1 - pi).map(u => ({ kind: 'unit', u }));
      case 'allyUnit': return this.units(pi).map(u => ({ kind: 'unit', u }));
      case 'allyUpgrade': return this.units(pi).filter(u => u.star < 3).map(u => ({ kind: 'unit', u }));
      case 'anyUnit': return this.allUnits().map(u => ({ kind: 'unit', u }));
      case 'enemyAny': return [...this.units(1 - pi).map(u => ({ kind: 'unit', u })), { kind: 'hero', owner: 1 - pi }];
      default: return [{ kind: 'none' }];
    }
  },
  canPlay(pi, card) {
    const G = this.G;
    if (!G || G.over || G.active !== pi) return false;
    const def = CARDS[card.id];
    if (this.costOf(pi, def) > G.P[pi].energy) return false;
    if (def.hpCost && G.P[pi].hp <= def.hpCost) return false;
    return this.targetsFor(pi, card).length > 0;
  },
  sameTarget(a, b) {
    if (!a || !b || a.kind !== b.kind) return false;
    if (a.kind === 'lane' || a.kind === 'merge') return a.lane === b.lane && a.owner === b.owner;
    if (a.kind === 'unit') return a.u === b.u;
    if (a.kind === 'hero') return a.owner === b.owner;
    return true;
  },

  async playCard(pi, cuid, tgt) {
    const G = this.G, P = G.P[pi];
    const idx = P.hand.findIndex(c => c.uid === cuid);
    if (idx < 0) return false;
    const card = P.hand[idx], def = CARDS[card.id];
    if (!this.canPlay(pi, card)) return false;
    const valid = this.targetsFor(pi, card);
    const t = valid.find(v => this.sameTarget(v, tgt || { kind: 'none' }));
    if (!t) return false;
    P.energy -= this.costOf(pi, def);
    P.hand.splice(idx, 1);
    G.stats[pi].cardsPlayed++;
    await this.V('cardPlayed', pi, card, def, t);
    if (def.hpCost) await this.payHp(pi, def.hpCost);
    let played = null;
    if (def.type === 'unit') {
      if (t.kind === 'merge') {
        const u = t.u;
        played = u;
        await this._starUp(u, def);
        this.bumpCombo(pi);
        if (def.onPlay && this.alive(u)) await def.onPlay(this, u);
      } else {
        const u = await this.summon(pi, def.id, t.lane, { fromHand: true });
        played = u;
        if (u && def.onPlay && this.alive(u)) await def.onPlay(this, u);
      }
    } else if (def.type === 'spell') {
      G.stats[pi].spells++;
      G.spellsTurn = (G.spellsTurn || 0) + 1;
      const target = t.kind === 'unit' ? t.u : t.kind === 'hero' ? this.hero(t.owner) : null;
      await def.cast(this, pi, target);
      P.discard.push(card.id);
      for (const a of this.units(pi)) if (a.def.onAllySpell) await a.def.onAllySpell(this, a);
    } else if (def.type === 'field') {
      if (G.field && !G.field.def.token) G.P[G.field.owner].discard.push(G.field.def.id);
      G.field = { def, owner: pi };
      await this.V('field', G.field);
    }
    this.bumpCombo(pi);
    this.addFever(pi, 4);
    // 連打の軸：カードを出すたびに反応するユニット
    for (const a of this.units(pi)) if (a !== played && a.def.onAllyCard) { await a.def.onAllyCard(this, a, def); await this.processDeaths(); }
    const f = G.field;
    if (f && f.def.fieldCardPlayed) await f.def.fieldCardPlayed(this, pi, f.owner);
    await this.processDeaths();
    await this.bossCheck();
    this.V('sync');
    return true;
  },

  /* ---------- 行動のラッパー（ゲーム終了の例外をまとめて処理） ---------- */
  async act(fn) {
    const G = this.G;
    if (!G || G.over || G.busy) return false;
    G.busy = true;
    this.V('busy', true);
    try { await fn(); }
    catch (e) { if (!(e instanceof GameOver)) console.error(e); }
    finally { G.busy = false; this.V('busy', false); this.V('sync'); }
    if (G.over && !G.endHandled) {
      G.endHandled = true;
      const res = this.result();
      await this.V('gameOver', G.winner, res);
      if (G.cfg.onEnd) G.cfg.onEnd(res);
    }
    return true;
  },
  result() {
    const G = this.G;
    // 攻撃の途中で決着した場合もそのターンのダメージを記録する
    if (G.active === 0) G.stats[0].maxTurnDamage = Math.max(G.stats[0].maxTurnDamage, G.turnDamage);
    return {
      win: G.winner === 0, rounds: G.round,
      playerHp: G.P[0].hp, playerMaxHp: G.P[0].maxHp,
      enemyHp: G.P[1].hp, enemyMaxHp: G.P[1].maxHp,
      stats: G.stats[0], cfg: G.cfg,
    };
  },
  playerPlay(cuid, tgt) { return this.act(() => this.playCard(0, cuid, tgt)); },
  playerFever() { return this.act(() => this.activateFever(0)); },
  playerEndTurn() {
    return this.act(async () => {
      await this.endTurn(0);
      await this.beginTurn(1);
      await AI.takeTurn(this, 1);
      await this.endTurn(1);
      await this.beginTurn(0);
    });
  },
  begin() { return this.act(() => this.beginTurn(0)); },
};
