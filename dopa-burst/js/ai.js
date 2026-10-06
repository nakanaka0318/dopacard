'use strict';
/* ===== 敵AI：先読みして一番おいしい手順を選ぶ =====
   1) 手札から出せる手を、軽い点数づけで有望な順に絞る
   2) 盤面をコピーして実際にカードを出してみる（エンジンをそのまま使う）
   3) 出し切った後の「自分のアタック → 相手の反撃」までシミュレーション
   4) 結果の盤面を評価し、良い手順を何手か先までビームサーチで探す
   実際に1手打つたびに読み直すので、ランダムな結果にも対応できる。 */

const AI = {
  MODE: 1, // 0:相手の攻撃だけ読む 1:相手のターン開始効果も 2:相手が出しそうなカードまで読む
  // 難易度ごとの読みの深さ（depth=何手先まで、beam=候補を何本残すか、width=各局面で試す手の数）
  profile(cfg = {}) {
    return { depth: cfg.depth ?? 3, beam: cfg.beam ?? 4, width: cfg.width ?? 8, mistake: cfg.mistake || 0 };
  },

  async takeTurn(B, pi) {
    const P = B.P(pi);
    const prof = this.profile(P.ai);
    await wait(280);
    for (let guard = 0; guard < 18; guard++) {
      if (B.G.over) return;
      let step = null, plan = null;
      if (prof.mistake && R.chance(prof.mistake)) step = this.sloppyPick(B, pi); // 弱い敵は時々うっかりする
      else if (prof.depth <= 0) step = this.greedyPick(B, pi);
      else plan = await this.plan(B, pi, prof);
      // FEVER：使うとPP+3。今使った方が得なら使う（出せるカードが増えない時は取っておく）
      if (B.canFever(pi) && await this.wantFever(B, pi, prof, plan, step)) {
        await B.activateFever(pi);
        await wait(200);
        continue;
      }
      if (plan) step = plan.actions[0];
      if (!step) break;
      if (plan) B.V('aiThink', pi, plan);
      await wait(240);
      const ok = await B.playCard(pi, step.card.uid, this.mapTarget(step.tgt, B.G));
      if (!ok) break;
      await wait(200);
    }
    await wait(150);
  },

  // 先読みなし：その場の点数が一番高い手（比較・テスト用）
  greedyPick(B, pi) {
    const o = this.options(B, pi).sort((a, b) => b.score - a.score)[0];
    return o && o.score > 0.8 ? o : null;
  },
  // 先読みなしの雑な手（低レベルの敵用）
  sloppyPick(B, pi) {
    const good = this.options(B, pi).filter(o => o.score > 0.8).sort((a, b) => b.score - a.score);
    return good.length ? R.pick(good.slice(0, 4)) : null;
  },

  /* ---------- FEVERの使いどころ ---------- */
  async wantFever(B, pi, prof, plan, step) {
    if (plan) {
      // 先読みできる敵は「FEVERを使ってから打った場合」も読んで、点数が上がるなら使う
      const fp = await this.feverPlan(B, pi, prof);
      return fp.actions.length > 0 && fp.score > plan.score + 1;
    }
    // 先読みしない時：今は高くて出せないカードが、PP+3で出せるようになるなら使う
    return this.feverUnlocks(B, pi) || (!step && this.feverUnlocks(B, pi, true));
  },
  async feverPlan(B, pi, prof) {
    const g = this.clone(B.G);
    if (!(await this.sim(B, g, () => B.activateFever(pi)))) return { actions: [], score: -Infinity };
    return this.plan(B, pi, prof, g);
  },
  feverUnlocks(B, pi, any) {
    const P = B.P(pi);
    const now = new Set(P.hand.filter(c => B.canPlay(pi, c)).map(c => c.uid));
    P.energy += 3;
    try { return P.hand.some(c => (any || !now.has(c.uid)) && B.canPlay(pi, c) && this.options(B, pi).some(o => o.card.uid === c.uid && o.score > 0.8)); }
    finally { P.energy -= 3; }
  },

  /* ---------- 先読み ---------- */
  async plan(B, pi, prof, base) {
    const root = this.clone(base || B.G, true);
    let best = { actions: [], score: await this.evalEnd(B, root, pi) };
    let beam = [{ G: root, actions: [] }];
    let nodes = 0;
    for (let d = 0; d < prof.depth && beam.length; d++) {
      const next = [];
      for (const node of beam) {
        const cands = this.withG(B, node.G, () => this.options(B, pi)).sort((a, b) => b.score - a.score).slice(0, prof.width);
        for (const c of cands) {
          const g = this.clone(node.G);
          const ok = await this.sim(B, g, () => B.playCard(pi, c.card.uid, this.mapTarget(c.tgt, g)));
          nodes++;
          if (!ok) continue;
          const score = g.over ? this.terminal(B, g, pi, 2) : await this.evalEnd(B, g, pi);
          const n = { G: g, actions: [...node.actions, c], score };
          next.push(n);
          if (score > best.score + 1) best = n;
        }
      }
      next.sort((a, b) => b.score - a.score);
      beam = next.slice(0, prof.beam);
    }
    return { actions: best.actions, score: best.score, nodes, depth: best.actions.length };
  },

  // ターンを終えたら：自分のアタック → 相手の反撃 まで進めて評価
  async evalEnd(B, G, pi) {
    const g = this.clone(G);
    const mode = this.MODE;
    await this.sim(B, g, async () => {
      await B.endTurn(pi);
      if (mode >= 1) await B.beginTurn(1 - pi); else { g.active = 1 - pi; g.combo = 0; }
      if (mode >= 2) {
        // 相手も素直に一番よさそうな手を打ってくると仮定する
        for (let k = 0; k < 6; k++) {
          const o = this.greedyPick(B, 1 - pi);
          if (!o || !(await B.playCard(1 - pi, o.card.uid, o.tgt))) break;
        }
      }
      await B.attackPhase(1 - pi);
    });
    if (g.over) return this.terminal(B, g, pi, 1);
    return this.withG(B, g, () => this.evaluate(B, g, pi));
  },
  // 決着がつく局面の点数。勝ち負けが同じでも差がつくように盤面の評価を足す
  // （全部が同じ点数だと「どう打っても負け」で投げてしまい、何もしなくなる）
  terminal(B, G, pi, speed) {
    const base = G.winner === pi ? 1e6 * (1 + speed) : -1e6 * 4;
    return base + this.withG(B, G, () => this.evaluate(B, G, pi));
  },

  // 評価の重み（AI同士を大量に戦わせて調整した値）
  W: { myHp: 1.0, opHp: 1.25, danger: 1.5, mine: 1.0, theirs: 1.3, hand: 10, opHand: 5, face: 0.8, lethal: 300, field: 25 },
  evaluate(B, G, pi) {
    const W = this.W, me = G.P[pi], op = G.P[1 - pi];
    let s = me.hp * W.myHp - op.hp * W.opHp;
    if (me.hp < me.maxHp * 0.3) s -= (me.maxHp * 0.3 - me.hp) * W.danger; // ピンチの時は守りを重視
    for (const u of B.units(pi)) s += this.worth(B, u) * W.mine;
    for (const u of B.units(1 - pi)) s -= this.worth(B, u) * W.theirs;
    s += me.hand.length * W.hand - op.hand.length * W.opHand;
    const next = B.predictAttacks(pi);
    s += next.face >= op.hp ? W.lethal : next.face * W.face; // 次のターンのとどめの圧
    if (G.field) s += G.field.owner === pi ? W.field : -W.field;
    return s;
  },
  worth(B, u) {
    const a = B.atkOf(u);
    let v = a + u.hp * 0.7 + 10;
    if (B.hasKw(u, 'double')) v += a * 1.3; // 連撃：1回目で倒すと2回目はヒーローへ。ほぼATK2倍の価値
    if (B.hasKw(u, 'fly')) v += 15;
    if (u.shield) v += 20;
    if (B.hasKw(u, 'guard')) v += 15;
    if (B.hasKw(u, 'armor')) v += 12;
    if (u.def.onAnyHeal || u.def.onAllySpell || u.def.onAllyCard || u.def.onHurt) v += 15;
    if (u.kw.has('undying') && !u.revived) v += 25;
    if (u.def.onTurnStart || u.def.onPreAttack) v += 25;
    if (u.count > 0 && u.def.onCountdown) v += 40 + 40 / u.count; // 倒されても発動するので確実な価値
    if (u.frozen) v -= a * 0.5;
    if (u.burn) v -= u.burn * 10;
    return v + (u.star - 1) * 15;
  },

  /* ---------- 盤面コピーと仮想実行 ---------- */
  clone(G, shuffleDecks) {
    const cu = u => {
      if (!u) return null;
      const c = Object.assign({}, u);
      c.kw = new Set(u.kw); c.lastHitBy = null;
      return c;
    };
    const rng = shuffleDecks ? seeded(7777) : null;
    const cp = P => Object.assign({}, P, {
      deck: shuffleDecks ? rng.shuffle(P.deck) : P.deck.slice(), // 自分の山札の順番は知らない前提
      hand: P.hand.slice(), discard: P.discard.slice(), grave: P.grave.slice(),
      board: P.board.map(cu), heroRef: { isHero: true, owner: P.idx },
    });
    return Object.assign({}, G, {
      P: [cp(G.P[0]), cp(G.P[1])],
      stats: G.stats.map(x => Object.assign({}, x)),
      field: G.field ? Object.assign({}, G.field) : null,
      tiles: G.tiles ? G.tiles.map(r => r.slice()) : null,
      busy: false, bossBusy: false,
    });
  },
  withG(B, G, fn) {
    const saved = B.G;
    B.G = G;
    try { return fn(); } finally { B.G = saved; }
  },
  // 仮想実行：演出なし・クリティカルなし・乱数は固定シード
  // （await は全部すぐ解決するので、途中で他の処理が割り込むことはない）
  async sim(B, G, fn) {
    const sG = B.G, sV = B.view, sNext = R.next, sUid = B._uid, sMode = B.simMode;
    B.G = G; B.view = null; B.simMode = true; R.next = mulberry32(12345);
    let ok = true;
    try { const r = await fn(); if (r === false) ok = false; }
    catch (e) { if (!(e instanceof GameOver)) { ok = false; if (!AI._warned) { AI._warned = true; console.warn('[AI sim]', e); } } }
    finally { B.G = sG; B.view = sV; R.next = sNext; B._uid = sUid; B.simMode = sMode; }
    return ok;
  },
  mapTarget(t, G) {
    if (!t) return { kind: 'none' };
    if (t.kind === 'unit') return { kind: 'unit', u: G.P[t.u.owner].board[t.u.lane] };
    if (t.kind === 'merge') return { kind: 'merge', owner: t.owner, lane: t.lane, u: G.P[t.owner].board[t.lane] };
    return t;
  },

  options(B, pi) {
    const P = B.P(pi), res = [];
    for (const card of P.hand) {
      if (!B.canPlay(pi, card)) continue;
      const def = CARDS[card.id];
      for (const t of B.targetsFor(pi, card)) {
        let s;
        try { s = this.score(B, pi, def, t); } catch (e) { s = 0; }
        if (Number.isFinite(s)) res.push({ card, tgt: t, score: s + R.next() * 0.3 });
      }
    }
    return res;
  },

  uval(B, u) {
    let v = (B.atkOf(u) + u.hp) / 10;
    if (B.hasKw(u, 'double')) v += B.atkOf(u) / 10 * 1.3;
    if (u.kw.has('fly')) v += 1;
    if (u.def.onTurnStart || u.def.onPreAttack) v += 2;
    if (u.shield) v += 1;
    return v + u.star;
  },

  lethalBonus(B, pi, extraFace) {
    const e = B.P(1 - pi);
    return B.potentialFace(pi) + extraFace >= e.hp ? 60 : 0;
  },

  score(B, pi, def, t) {
    let s = this._score(B, pi, def, t);
    // HPを払うカードは、HPが少ないほど控える
    if (def.hpCost) { const P = B.P(pi); s -= def.hpCost / 10 * (P.hp < P.maxHp * 0.4 ? 1.5 : 0.4); }
    return s + this.special(B, pi, def, t);
  },
  // 未知なる軸のユニットの特別な価値
  special(B, pi, def, t) {
    if (def.type !== 'unit' || t.kind === 'merge') return 0;
    const mine = B.units(pi), theirs = B.units(1 - pi);
    switch (def.id) {
      case 'c_bomb': return theirs.length * 1.2;
      case 'c_tower': return 3 + theirs.length * 1.5;
      case 'c_seer': return 2;
      case 'mi_copycat': { const o = B.G.P[1 - pi].board[t.lane]; return B.alive(o) ? this.uval(B, o) - 2 : 0; }
      case 'mi_egg': return 2.5;
      case 'mi_mirror': return theirs.length ? 3 : -2;
      case 'mi_thief': return theirs.length ? 4 + this.uval(B, theirs.sort((a, b) => B.atkOf(b) - B.atkOf(a))[0]) : -3;
      case 'w_galaxy': return mine.filter(u => B.oppositeOf(u)).length * 1.5;
      case 'so_leopard': return mine.length === 0 ? 3 : -1;
      case 'so_hermit': return (5 - mine.length - 1) * 0.8;
      case 'so_rider': return mine.length === 0 ? 5 : -1;
      case 'so_lion': return mine.length >= 2 ? mine.length * 2 : mine.length === 1 ? 0 : 1;
      case 'ry_dancer': return Math.min(6, B.G.combo) - 1;
      case 'a_star': return (B.G.spellsTurn || 0) * theirs.length * 1.2 - 1;
      case 'g_gaia': return 3 + B.emptyLanes(1 - pi).length * 0.6;
      case 'f_turtle': case 'f_golem': case 'f_king': return theirs.some(u => !B.oppositeOf(u) || B.hasKw(u, 'fly')) ? 2 : 0;
    }
    return 0;
  },

  _score(B, pi, def, t) {
    const G = B.G, P = B.P(pi), E = B.P(1 - pi);
    const ai = def.ai || {};
    let s = 0;

    if (def.type === 'unit') {
      if (t.kind === 'merge') {
        const u = t.u;
        s = (def.atk + def.hp) / 10 * 1.15 + (u.maxHp - u.hp) / 10 * 0.5 + (u.star === 2 ? 3 : 1.5) + def.cost * 0.5;
        if (def.onPlay) s += def.cost * 0.6;
        return s;
      }
      const atk = def.atk + (G.field && G.field.def.fieldAtk ? G.field.def.fieldAtk(B, { owner: pi }, G.field.owner) : 0);
      s = (def.atk + def.hp) / 10 * 0.6 + def.cost * 0.55;
      if (def.onPlay) s += def.cost * 0.6;
      if (def.onTurnStart || def.onPreAttack) s += 3;
      const o = E.board[t.lane];
      const fly = def.kw.includes('fly');
      if (fly || !B.alive(o)) {
        s += atk / 10 * (def.kw.includes('double') ? 2 : 1);
        s += this.lethalBonus(B, pi, atk);
      } else {
        const shield = o.shield;
        if (atk >= o.hp && !shield) s += this.uval(B, o) * 1.2;
        else s += Math.min(atk, o.hp) / 10 * 0.4;
        s += B.atkOf(o) / 10 * 0.8 * (B.hasKw(o, 'double') ? 2 : 1);
        if (B.atkOf(o) >= def.hp && !def.kw.includes('shield')) s -= (def.atk + def.hp) / 10 * 0.45;
      }
      // 自分の盤面がスカスカなら展開を優先
      if (B.units(pi).length < 2) s += 1.5;
      return s;
    }

    if (def.type === 'field') {
      if (G.field && G.field.owner === pi) return -5;
      s = 3 + B.units(pi).length * 0.8;
      if (G.field && G.field.owner !== pi) s += 3;
      return s;
    }

    // ---- スペル ----
    const tu = t.kind === 'unit' ? t.u : null;
    switch (ai.t) {
      case 'dmgUnit': {
        if (!tu) return -1;
        if (tu.shield) return 0.4;
        if (ai.v >= tu.hp) s = this.uval(B, tu) * 1.3 + 1;
        else s = ai.v / 10 * 0.45;
        if (def.id === 'b_fireball' && ai.v > tu.hp) s += (ai.v - tu.hp) / 10 * 0.6;
        return s - def.cost * 0.2;
      }
      case 'dmgAny': {
        if (t.kind === 'hero') return ai.v / 10 * 0.8 + (E.hp <= ai.v ? 100 : 0) + this.lethalBonus(B, pi, ai.v) * 0.2;
        if (!tu || tu.shield) return 0.4;
        return (ai.v >= tu.hp ? this.uval(B, tu) * 1.3 + 1 : ai.v / 10 * 0.45) - def.cost * 0.2;
      }
      case 'aoe': {
        const es = B.units(1 - pi);
        for (const u of es) s += (!u.shield && ai.v >= u.hp) ? this.uval(B, u) * 1.1 : ai.v / 10 * 0.35;
        return es.length >= 2 ? s : s * 0.5;
      }
      case 'buff': {
        if (!tu) return -1;
        s = (ai.a + ai.h) / 10 * 0.7;
        if (!B.oppositeOf(tu) || tu.kw.has('fly')) s += ai.a / 10 * 0.6;
        if (B.hasKw(tu, 'double')) s += ai.a / 10 * 1.2;
        return s;
      }
      case 'buffAll': return B.units(pi).length * (ai.a + ai.h) / 10 * 0.6;
      case 'draw': return P.hand.length < 6 ? ai.v * 1.6 : 0.4;
      case 'freeze': {
        if (!tu) return -1;
        return B.atkOf(tu) / 10 * 0.9 + (ai.v >= tu.hp && !tu.shield ? this.uval(B, tu) : 0);
      }
      case 'kw': {
        if (!tu || tu.kw.has(ai.kw)) return -1;
        return B.atkOf(tu) / 10 * (ai.kw === 'double' ? 2.2 : 1.2);
      }
    }
    switch (def.id) {
      case 's_chain': return Math.min(12, 3 + G.combo) * 20 / 10 * 0.6;
      case 'ne_sacrifice': {
        if (!tu) return -1;
        const bonus = tu.def.onDeath ? 3 : 0;
        return 2.5 + bonus - this.uval(B, tu) * 0.5 + (tu.token ? 1 : 0);
      }
      case 'ne_revive': return P.grave.length && B.emptyLanes(pi).length ? 4 : 1;
      case 'l_clover': return B.units(pi).length * 0.8 + 1.2;
      case 'l_slot': return 3.5;
      case 'm_battery': {
        const want = P.hand.some(c => B.costOf(pi, CARDS[c.id]) === P.energy + 1);
        return want ? 4 : -1;
      }
      case 'm_punch': {
        if (!tu) return -1;
        const a = B.atkOf(tu), o = B.oppositeOf(tu);
        if (!o) return a / 10 * 0.8 + (E.hp <= a ? 100 : 0);
        return (a >= o.hp && !o.shield) ? this.uval(B, o) * 1.2 : a / 10 * 0.3;
      }
      case 'm_upgrade': return tu ? (tu.def.atk + tu.def.hp) / 10 * 1.1 + 2 : -1;
      case 'c_leap': return B.units(pi).filter(u => u.count > 0).length * 2 + 0.8;
      case 'w_gate': {
        if (!tu) return -1;
        const blocked = !!B.oppositeOf(tu) && !B.hasKw(tu, 'fly');
        const l = B.freeLane(pi, tu.lane, true);
        const opens = l != null && !B.alive(E.board[l]);
        return (blocked && opens ? B.atkOf(tu) / 10 * 1.2 + 1 : 0.5) + this.lethalBonus(B, pi, blocked && opens ? B.atkOf(tu) : 0) * 0.3;
      }
      case 'mi_wand': return tu && !tu.def.token ? this.uval(B, tu) - 2.5 : -1;
      case 'ry_finish': {
        const d = G.combo * 15;
        if (t.kind === 'hero') return d / 10 * 0.8 + (E.hp <= d ? 100 : 0);
        if (!tu || tu.shield) return 0.2;
        return d >= tu.hp ? this.uval(B, tu) * 1.3 : d / 10 * 0.4;
      }
      case 'h_rain': return B.units(pi).reduce((a, u) => a + Math.min(30, u.maxHp - u.hp), 0) / 10 * 0.6 + Math.min(30, P.maxHp - P.hp) / 10 * 0.5;
      case 'f_wall': return B.units(pi).length * 1.1;
      case 'g_ward': return B.units(pi).length * 0.8 + 0.5;
      case 'r_pact': return P.hand.length < 6 ? 4.5 : 0.5;
    }
    return 1;
  },
};
