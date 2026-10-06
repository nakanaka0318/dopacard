'use strict';
/* ===== バトル画面：描画・入力・演出 ===== */

const FX_COLORS = {
  fire: '#ff7a2e', ice: '#9ff3ff', dark: '#b07bff', gold: '#ffd23f', bolt: '#bff8ff',
  rocket: '#ffffff', laser: '#ff4d6d', meteor: '#ff9a3d', hit: '#ffffff', quake: '#c7a27a',
};
const TILE_LABEL = { power: '⚔<b>+10</b>', guard: '🔰<b>-10</b>', trap: '🕳️<b>罠</b>' };
const TILE_NAME = { power: '力の陣', guard: '守りの陣', trap: '落とし穴' };
const COMBO_WORDS = { 5: 'NICE!', 8: 'GREAT!!', 10: '激アツ!!', 13: 'すごすぎ!!', 16: 'ドパミン全開!!', 20: '脳汁ドバドバ!!!', 25: 'もはや神!!!', 30: '止まらねえ!!!!' };
const CRIT_REACTS = ['えぐっ!!', '神!!', 'やばすぎ!!', 'バグった!?', '気持ちよすぎ!!', '最強!!'];
const RATINGS = [[0, 'NICE'], [80, 'GREAT'], [160, 'EXCELLENT'], [280, 'AMAZING'], [450, 'GODLIKE'], [800, 'DOPAMINE OVERLOAD']];

const BUI = {
  root: null, stage: null,
  unitEls: new Map(), handEls: new Map(),
  sel: null, focus: null, press: null, drag: null,
  cfg: null, tut: null, built: false,
  W: 0, H: 0, cw: 80, hw: 80,

  build() {
    if (this.built) return;
    this.built = true;
    const r = this.root = $('#scr-battle');
    const slots = p => Array.from({ length: LANES }, (_, i) => `<div class="slot" data-p="${p}" data-lane="${i}"><div class="slot-mark"></div><div class="slot-tile"></div></div>`).join('');
    r.innerHTML = `
      <div class="battle-stage">
        <header class="b-top">
          <div class="hero hero-e" data-p="1">
            <div class="hero-ava" data-p="1"><span></span><div class="reach">リーチ!</div><div class="curse-badge" hidden></div></div>
            <div class="hero-body">
              <div class="boss-title" hidden></div>
              <div class="hero-name"></div>
              <div class="hpbar"><i class="hp-ghost"></i><i class="hp-fill"></i><span class="hp-marks"></span><span class="hp-num"></span></div>
              <div class="hero-sub"><span class="ehand"></span><span class="edeck"></span><span class="epassive"></span></div>
              <div class="boss-row" hidden><button type="button" class="ult-chip"></button><span class="phase-chip"></span></div>
            </div>
            <div class="e-fever" hidden><i></i><span>FEVER</span></div>
          </div>
          <div class="b-tools">
            <button class="btn-speed" type="button" aria-label="演出スピード">▶ x1</button>
            <button class="btn-menu" type="button" aria-label="メニュー">☰</button>
          </div>
        </header>
        <div class="e-handfan"></div>
        <div class="board-wrap">
        <div class="board">
          <div class="row row-e">${slots(1)}</div>
          <div class="midline">
            <div class="round-chip">ROUND <b>1</b></div>
            <button class="field-chip" type="button"></button>
            <div class="mid-tools">
              <button class="btn-hint" type="button" aria-label="ヒント">💡<span>ヒント</span></button>
              <button class="btn-log" type="button" aria-label="バトルログ">📜</button>
            </div>
          </div>
          <div class="row row-p">${slots(0)}</div>
          <div class="combo" hidden><b>0</b><span>COMBO</span></div>
          <div class="tut" hidden></div>
        </div>
        <div class="b-info"><div class="guide"></div><div class="hint-strip" hidden></div></div>
        </div>
        <footer class="b-bottom">
          <div class="hero hero-p" data-p="0">
            <div class="hero-ava" data-p="0"><span></span><div class="curse-badge" hidden></div></div>
            <div class="hero-body">
              <div class="hpbar"><i class="hp-ghost"></i><i class="hp-fill"></i><span class="hp-num"></span></div>
              <div class="energy"><div class="orbs"></div><span class="en-num"></span></div>
            </div>
          </div>
          <button class="fever-btn" type="button" aria-label="フィーバー"><span class="fever-fill"></span><span class="fever-label">FEVER</span><span class="fever-pct">0%</span></button>
          <button class="end-btn" type="button"><span class="end-main">⚔ アタック!</span><span class="end-sub">ターン終了</span></button>
        </footer>
        <div class="hand"></div>
        <div class="pdeck"><span>🂠</span><b>0</b></div>
      </div>
      <div class="b-overlay"></div>
      <aside class="blog" hidden><div class="blog-head"><b>📜 バトルログ</b><button type="button" class="blog-close" aria-label="閉じる">×</button></div><ol class="blog-list"></ol></aside>`;
    this.stage = $('.battle-stage', r);
    this.ov = $('.b-overlay', r);

    $$('.slot', r).forEach(s => {
      s.addEventListener('click', () => this.onSlot(+s.dataset.p, +s.dataset.lane));
      onLongPress(s, () => { const u = B.G && B.G.P[+s.dataset.p].board[+s.dataset.lane]; if (u) Preview.show(u.def, u); });
    });
    $$('.hero-ava', r).forEach(h => h.addEventListener('click', () => this.onHero(+h.dataset.p)));
    $('.end-btn', r).addEventListener('click', () => this.endTurn());
    $('.fever-btn', r).addEventListener('click', () => this.fever());
    $('.btn-speed', r).addEventListener('click', () => this.cycleSpeed());
    $('.btn-menu', r).addEventListener('click', () => this.menu());
    $('.field-chip', r).addEventListener('click', () => {
      const f = B.G && B.G.field;
      if (f) this.strip(detailHTML(f.def) + `<div class="dt-owner">${f.owner === 0 ? 'あなた' : '相手'}のフィールド</div>`);
    });
    $('.btn-hint', r).addEventListener('click', ev => { ev.stopPropagation(); this.hint(); });
    $('.btn-log', r).addEventListener('click', ev => { ev.stopPropagation(); this.toggleLog(); });
    $('.blog-close', r).addEventListener('click', () => this.toggleLog(false));
    // 何か触ったら自動ヒントのタイマーをリセット
    r.addEventListener('pointerdown', () => this.armIdle());
    this.stage.addEventListener('click', ev => {
      if (ev.target.closest('.slot,.hero-ava,.hand,.card,.hint-strip,button,.b-tools')) return;
      this.deselect();
    });
    addEventListener('resize', () => { if (this.root && !this.root.hidden) { this.layout(); this.layoutHand(); } });
    addEventListener('pointermove', ev => this.onMove(ev));
    addEventListener('pointerup', ev => this.onUp(ev));
    addEventListener('pointercancel', ev => this.onUp(ev, true));
  },

  /* ---------- 開始 ---------- */
  async start(cfg) {
    this.build();
    Screens.show('battle');
    this.cfg = cfg;
    this.unitEls.clear(); this.handEls.clear();
    $$('.slot', this.root).forEach(s => $$('.unit', s).forEach(u => u.remove()));
    $('.hand', this.root).innerHTML = '';
    this.ov.innerHTML = '';
    $('.blog-list', this.root).innerHTML = '';
    $('.blog', this.root).hidden = true;
    this.sel = null; this.focus = null; this.drag = null; this.press = null;
    this.bestShown = false;
    this.said = {};
    this.tut = cfg.tutorial ? { step: 0, seen: {} } : null;
    document.body.classList.remove('fever-on');
    this.stage.classList.remove('fever-on');
    B.view = View;
    B.start({ player: cfg.player, enemy: cfg.enemy, onEnd: res => Game.onBattleEnd(res, cfg) });
    this.layout();
    this.sync();
    $('.e-fever', this.root).hidden = !cfg.enemy.fever;
    this.setupBoss(cfg);
    $('.epassive', this.root).innerHTML = cfg.enemy.passive ? `<button type="button" class="passive-chip">⚠ ${esc(cfg.enemy.passive.name)}</button>` : '';
    const pc = $('.passive-chip', this.root);
    if (pc) pc.addEventListener('click', () => this.strip(`<div class="dt-head"><span class="dt-name">⚠ ${esc(cfg.enemy.passive.name)}</span></div><div class="dt-text">${esc(cfg.enemy.passive.text)}</div>`));
    this.updateSpeedBtn();
    Sound.bgm(this.bgmName());
    this.applyField();
    await (cfg.rush ? this.rushIntro(cfg) : this.intro(cfg));
    this.tutorial('start');
    await B.begin();
    this.afterAction();
  },

  bgmName() {
    const c = this.cfg, G = B.G;
    if (c && c.rush) return G && G.P[1].phase > 0 ? 'rush2' : 'rush';
    return c && c.boss ? 'boss' : 'battle';
  },
  // ボスラッシュ用の表示（二つ名・覚醒ライン・必殺技カウント）
  setupBoss(cfg) {
    const b = cfg.rush ? cfg.enemy.boss : null;
    const he = $('.hero-e', this.root);
    this.stage.classList.toggle('rush', !!b);
    this.stage.classList.remove('awakened');
    he.classList.toggle('boss-hud', !!b);
    he.style.setProperty('--bc', b ? b.color : '');
    $('.boss-title', he).hidden = !b;
    $('.boss-row', he).hidden = !b;
    $('.hp-marks', he).innerHTML = b ? b.phases.map(ph => `<i style="left:${ph.at * 100}%"></i>`).join('') : '';
    if (!b) return;
    $('.boss-title', he).textContent = `No.${String(b.no).padStart(2, '0')} ${b.title}`;
    const uc = $('.ult-chip', he);
    uc.onclick = () => {
      const P = B.G.P[1];
      this.strip(`<div class="dt-head"><span class="dt-rar" style="--rc:#ff2244">必殺</span><span class="dt-name">☠ ${esc(b.ult.name)}</span></div><div class="dt-text">${esc(b.ult.text)}</div><div class="dt-kws"><span><b>⏳ ${P.ultCd <= 1 ? '次の相手のターンに発動！' : `あと${P.ultCd}ターン`}</b> 相手のターン開始時にカウントが減り、0で発動</span></div>`
        + b.phases.map(ph => `<div class="dt-kws"><span><b>${P.phase > b.phases.indexOf(ph) ? '✅' : '🔥'} 覚醒（HP${Math.round(ph.at * 100)}%以下）「${esc(ph.name)}」</b> ${esc(ph.text)}</span></div>`).join(''));
    };
  },
  syncBoss() {
    const G = B.G, E = G.P[1], b = E.boss;
    if (!b) return;
    const he = $('.hero-e', this.root);
    const uc = $('.ult-chip', he);
    const soon = E.ultCd <= 1;
    const html = `☠ <b>${esc(b.ult.name)}</b> <em>${soon ? '次のターン!!' : `あと${E.ultCd}`}</em>`;
    if (uc.innerHTML !== html) uc.innerHTML = html;
    uc.classList.toggle('soon', soon);
    const pc = $('.phase-chip', he);
    const pt = E.phase > 0 ? (b.phases.length > 1 ? `覚醒${E.phase}` : '覚醒') : '';
    if (pc.textContent !== pt) pc.textContent = pt;
    pc.hidden = !pt;
    $$('.hp-marks i', he).forEach((m, i) => m.classList.toggle('passed', E.phase > i));
  },

  // ボスラッシュの登場演出：警報 → 闇から姿 → 二つ名 → 名前を叩きつける
  async rushIntro(cfg) {
    if (Time.headless) return;
    const b = cfg.enemy.boss, t = BOSS_TIERS[b.tier - 1];
    const ov = el('div', 'boss-intro');
    ov.style.setProperty('--bc', b.color);
    const band = 'WARNING ⚠ BOSS APPROACHING ⚠ '.repeat(6);
    ov.innerHTML = `
      <div class="bi-scan"></div>
      <div class="bi-band top"><span>${band}</span></div>
      <div class="bi-band bot"><span>${band}</span></div>
      <div class="bi-warn">WARNING</div>
      <div class="bi-center">
        <div class="bi-no">BOSS RUSH No.${String(b.no).padStart(2, '0')} ・ ${t.name}「${t.sub}」</div>
        <div class="bi-ava">${b.avatar}</div>
        <div class="bi-title">― ${esc(b.title)} ―</div>
        <div class="bi-name">${esc(b.name)}</div>
        <div class="bi-hp">HP <b>${fmt(cfg.enemy.hp)}</b> <span>${'☠'.repeat(b.tier)}</span></div>
        <div class="bi-quote">「${esc(b.quote)}」</div>
      </div>
      <div class="vs-skip">タップでスキップ</div>`;
    this.root.appendChild(ov);
    Sound.bgm(null);
    Sound.play('siren');
    let done;
    const p = new Promise(r => (done = r));
    const tm = [];
    tm.push(setTimeout(() => { Sound.play('ult'); }, 900));
    tm.push(setTimeout(() => { Sound.play('hitHeavy'); FX.shake(5); FX.flash(b.color, 0.35, 300); }, 1750));
    tm.push(setTimeout(done, 3900));
    ov.addEventListener('pointerdown', () => { tm.forEach(clearTimeout); done(); });
    await p;
    Sound.bgm(this.bgmName());
    ov.classList.add('out');
    setTimeout(() => ov.remove(), 350);
  },

  async intro(cfg) {
    if (Time.headless) return;
    const ov = el('div', 'vs-intro' + (cfg.boss ? ' boss' : ''));
    ov.innerHTML = `
      ${cfg.boss ? '<div class="warn-band"><span>WARNING ⚠ WARNING ⚠ WARNING ⚠ WARNING ⚠ WARNING ⚠ WARNING</span></div>' : ''}
      <div class="vs-side vs-p"><div class="vs-ava">${cfg.player.avatar}</div><div class="vs-name">${esc(cfg.player.name)}</div></div>
      <div class="vs-side vs-e"><div class="vs-ava">${cfg.enemy.avatar}</div><div class="vs-name">${esc(cfg.enemy.name)}</div>${cfg.quote ? `<div class="vs-quote">「${esc(cfg.quote)}」</div>` : ''}</div>
      <div class="vs-mark">VS</div>
      <div class="vs-skip">タップでスキップ</div>`;
    this.root.appendChild(ov);
    Sound.play(cfg.boss ? 'reach' : 'whoosh');
    let done;
    const p = new Promise(r => (done = r));
    const t = setTimeout(done, cfg.boss ? 2600 : 1900);
    ov.addEventListener('pointerdown', () => { clearTimeout(t); done(); });
    setTimeout(() => Sound.play('hitHeavy'), 350);
    await p;
    ov.classList.add('out');
    setTimeout(() => ov.remove(), 350);
  },

  applyField() {
    const f = B.G.field;
    const chip = $('.field-chip', this.root);
    TRIBE_ORDER.forEach(t => this.stage.classList.remove('fld-' + t));
    if (f) {
      chip.innerHTML = `<span>${f.def.emoji}</span>${esc(f.def.name)}<em>${f.owner === 0 ? 'あなた' : '相手'}</em>`;
      chip.classList.toggle('mine', f.owner === 0);
      chip.classList.toggle('theirs', f.owner === 1);
      chip.hidden = false;
      this.stage.classList.add('fld-' + f.def.tribe);
    } else {
      chip.innerHTML = '<span>🗺️</span>フィールドなし';
      chip.classList.remove('mine', 'theirs');
    }
    if (!this.stage.classList.contains('fever-on')) FX.setAmbient(f ? (f.def.ambient || f.def.tribe) : 'none');
  },

  /* ---------- レイアウト ---------- */
  layout() {
    const st = this.stage;
    const W = st.clientWidth, H = st.clientHeight;
    this.W = W; this.H = H;
    const tall = H >= 700 && W < 700;
    // 横長で背が低い画面（スマホ横持ちなど）は操作パネルを右側に寄せる
    const wide = W / H > 1.5 && H < 620;
    const side = wide ? 158 : 0;
    const top = wide ? 50 : (W < 520 ? 56 : 66) + (tall ? 34 : 0), bottom = wide ? 0 : W < 520 ? 66 : 76, mid = 30, pad = wide ? 20 : 30;
    const gap = clamp(W * 0.014, 4, 12);
    const byW = (Math.min(W - side, 860) - 16 - gap * 4) / 5;
    // 手札は重ねて並べるので盤面より少し大きくてOK
    const hwFor = c => clamp(Math.min(c * 1.15, (Math.min(W - side, 900) - 16) / 4.3), 54, 134);
    let ratio = 1.24, info = 22;
    const need = c => 2 * c * ratio + mid + pad + hwFor(c) * 1.4 + 16 + top + bottom + 8 + info;
    let cw = Math.min(byW, 150);
    if (need(cw) > H) {
      let lo = 36, hi = cw;
      for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (need(m) > H) hi = m; else lo = m; }
      cw = lo;
    } else {
      let extra = H - need(cw);
      if (extra > 70) { const add = Math.min(74, Math.round(extra * 0.35)); info += add; extra -= add; }
      ratio = Math.min(1.5, 1.24 + extra * 0.6 / (2 * cw));
    }
    cw = Math.floor(clamp(cw, 40, 150));
    const hw = Math.floor(hwFor(cw));
    this.cw = cw; this.hw = hw;
    st.classList.toggle('tall', tall);
    st.classList.toggle('wide', wide);
    st.classList.toggle('has-info', info > 40);
    st.style.setProperty('--cw', cw + 'px');
    st.style.setProperty('--ch', Math.round(cw * ratio) + 'px');
    st.style.setProperty('--hw', hw + 'px');
    st.style.setProperty('--hh', Math.round(hw * 1.4) + 'px');
    st.style.setProperty('--gap', gap + 'px');
    st.style.setProperty('--info-h', info + 'px');
  },

  layoutHand() {
    const hand = $('.hand', this.root);
    const P = B.G.P[0];
    const n = P.hand.length;
    const W = hand.clientWidth || this.W;
    const hw = this.hw, hh = Math.round(hw * 1.4);
    const avail = Math.min(W - 36, 900);
    const step = n > 1 ? Math.min(hw + 6, (avail - hw) / (n - 1)) : 0;
    const total = step * (n - 1) + hw;
    const x0 = (W - total) / 2;
    const mid = (n - 1) / 2;
    P.hand.forEach((c, i) => {
      const e = this.handEls.get(c.uid);
      if (!e || e.classList.contains('dragging')) return;
      const d = i - mid;
      const rot = d * Math.min(4, 26 / Math.max(n, 1));
      let y = Math.abs(d) * Math.abs(d) * 1.6 + 6;
      let sc = 1;
      if (this.sel === c.uid) { y -= hh * 0.24; sc = 1.07; }
      e.style.zIndex = this.sel === c.uid ? 60 : 10 + i;
      e.style.transform = `translate(${x0 + i * step}px, ${y}px) rotate(${this.sel === c.uid ? 0 : rot}deg) scale(${sc})`;
    });
  },

  /* ---------- 同期 ---------- */
  sync() {
    const G = B.G;
    if (!G || !this.root) return;
    for (let p = 0; p < 2; p++) {
      const P = G.P[p];
      const h = $(p ? '.hero-e' : '.hero-p', this.root);
      const ava = $('.hero-ava span', h);
      if (ava.textContent !== P.avatar) ava.textContent = P.avatar;
      const pct = clamp(P.hp / P.maxHp, 0, 1) * 100;
      $('.hp-fill', h).style.width = pct + '%';
      $('.hp-ghost', h).style.width = pct + '%';
      $('.hp-num', h).textContent = `${Math.max(0, P.hp)} / ${P.maxHp}`;
      h.classList.toggle('danger', P.hp <= P.maxHp * 0.25);
      const cb = $('.curse-badge', h);
      if (cb) { const c = P.curse || 0; cb.hidden = !c; const t = `🕯️${c}`; if (cb.textContent !== t) cb.textContent = t; cb.title = `呪い${c}：ターン開始時に${c * 10}ダメージ`; }
      h.classList.toggle('active', G.active === p && !G.over);
      // ユニット
      P.board.forEach((u, lane) => {
        const slot = this.slotEl(p, lane);
        if (u && !u.removed) {
          let e = this.unitEls.get(u.uid);
          if (!e) { e = unitEl(u); this.unitEls.set(u.uid, e); slot.appendChild(e); }
          else if (e.parentNode !== slot) slot.appendChild(e);
          updateUnitEl(e, u);
        }
      });
    }
    // 陣地の軸：マスに刻まれた陣
    for (let p = 0; p < 2; p++) for (let lane = 0; lane < LANES; lane++) {
      const t = B.tileAt(p, lane), slot = this.slotEl(p, lane);
      const kind = t ? t.kind : '';
      if (slot.dataset.tile !== kind) {
        slot.dataset.tile = kind;
        $('.slot-tile', slot).innerHTML = kind ? TILE_LABEL[kind] : '';
      }
    }
    // 消えたユニットの掃除
    for (const [uid, e] of this.unitEls) {
      const alive = G.P.some(P => P.board.some(u => u && u.uid === uid && !u.removed));
      if (!alive && !e.classList.contains('dying')) { e.remove(); this.unitEls.delete(uid); }
    }
    const P = G.P[0], E = G.P[1];
    $('.hero-e .hero-name', this.root).textContent = E.name;
    $('.ehand', this.root).innerHTML = `✋<b>${E.hand.length}</b>`;
    const fan = $('.e-handfan', this.root);
    if (fan.childElementCount !== E.hand.length) {
      fan.innerHTML = E.hand.map((_, i) => `<i style="--k:${i - (E.hand.length - 1) / 2}"></i>`).join('');
    }
    $('.edeck', this.root).innerHTML = `🂠<b>${E.deck.length}</b>`;
    $('.pdeck b', this.root).textContent = P.deck.length;
    $('.round-chip b', this.root).textContent = G.round;
    // PP
    const orbs = $('.orbs', this.root);
    const maxShow = Math.min(12, Math.max(P.maxEnergy, P.energy));
    orbs.classList.toggle('many', maxShow > 10);
    if (orbs.children.length !== maxShow) {
      orbs.innerHTML = '';
      for (let i = 0; i < maxShow; i++) orbs.appendChild(el('i', i >= P.maxEnergy ? 'extra' : ''));
    }
    Array.from(orbs.children).forEach((o, i) => o.classList.toggle('on', i < P.energy));
    $('.en-num', this.root).innerHTML = `<b>${P.energy}</b>/${P.maxEnergy}<small>PP</small>`;
    // フィーバー
    const fb = $('.fever-btn', this.root);
    fb.querySelector('.fever-fill').style.height = P.fever + '%';
    fb.querySelector('.fever-pct').textContent = P.feverOn ? 'ON!' : Math.floor(P.fever) + '%';
    const ready = B.canFever(0) && !G.busy;
    fb.classList.toggle('ready', P.fever >= 100 && !P.feverOn);
    fb.classList.toggle('on', P.feverOn);
    fb.disabled = !ready;
    if (E.boss) this.syncBoss();
    const ef = $('.e-fever', this.root);
    if (ef) {
      ef.querySelector('i').style.width = (E.feverOn ? 100 : E.fever) + '%';
      ef.classList.toggle('ready', E.fever >= 100 && !E.feverOn);
      ef.classList.toggle('on', !!E.feverOn);
      const lb = E.feverOn ? 'FEVER中' : E.fever >= 100 ? 'READY!' : 'FEVER';
      const sp = ef.querySelector('span');
      if (sp.textContent !== lb) sp.textContent = lb;
      ef.title = `相手のFEVERゲージ ${Math.floor(E.fever)}%（満タンになると相手もPP+3を使える）`;
    }
    // ターンボタン
    const myTurn = G.active === 0 && !G.over;
    const eb = $('.end-btn', this.root);
    eb.disabled = !myTurn || G.busy;
    eb.classList.toggle('enemy', !myTurn);
    eb.querySelector('.end-main').textContent = myTurn ? '⚔ アタック!' : '相手のターン';
    eb.querySelector('.end-sub').textContent = myTurn ? 'ターン終了' : '…';
    const anyPlayable = myTurn && P.hand.some(c => B.canPlay(0, c));
    eb.classList.toggle('nudge', myTurn && !G.busy && !anyPlayable && !B.canFever(0));
    $('.btn-hint', this.root).disabled = !myTurn || G.busy;
    // リーチ
    const reach = myTurn && B.potentialFace(0) >= E.hp && E.hp > 0;
    const re = $('.hero-e .reach', this.root);
    re.classList.toggle('on', reach);
    if (reach && !G.reachShown && !G.busy) { G.reachShown = true; Sound.play('reach'); FX.toast('<b>リーチ!!</b> アタックで決着がつくかも！', { cls: 'hot' }); }
    this.syncHand();
    this.root.classList.toggle('busy', G.busy);
    this.renderPredict();
  },

  /* ---------- 初心者サポート：攻撃予測・ガイド ---------- */
  renderPredict() {
    const G = B.G, r = this.root;
    $$('.pred', r).forEach(x => x.remove());
    $$('.hp-pred', r).forEach(x => { x.style.width = '0'; x.dataset.v = ''; });
    const guide = $('.guide', r);
    const myTurn = G.active === 0 && !G.over;
    if (!myTurn) { guide.innerHTML = G.over ? '' : '<span class="g-enemy">相手のターン…ようすを見よう</span>'; return; }
    if (G.busy) return;
    const me = B.predictAttacks(0);
    if (Settings.preview) {
      for (const a of me.list) {
        const slot = this.slotEl(0, a.u.lane);
        let txt, cls = '';
        if (a.frozen) { txt = '❄ 休み'; cls = 'ice'; }
        else if (a.idle) {
          if (a.u.count) { txt = `⏳あと${a.u.count}`; cls = 'idle'; }
          else if (a.u.def.onPreAttack) { txt = a.u.def.id === 'mi_egg' ? '⚡孵化→攻撃' : '⚡アタック前'; cls = 'kill'; }
          else continue;
        }
        else if (a.unsure) { txt = '⚔ ?'; }
        else if (a.hero) { txt = `⚔直撃${a.dmg}`; cls = 'face'; }
        else if (a.block) { txt = '⚔🛡'; }
        else if (a.kill) { txt = a.pierce ? `⚔撃破+${a.pierce}` : '⚔撃破!'; cls = 'kill'; }
        else txt = `⚔${a.dmg}`;
        const prev = $('.pred.mine', slot);
        if (prev) { prev.textContent += ' ' + txt.replace('⚔', ''); continue; } // 連撃は2つ目を後ろに足す
        slot.appendChild(el('div', `pred mine ${cls}`, txt));
      }
      // 敵ユニットが受ける予定のダメージ
      const taken = new Map();
      for (const a of me.list) if (a.target && !a.unsure && a.dmg) taken.set(a.target.uid, (taken.get(a.target.uid) || 0) + a.dmg);
      for (const [uid, d] of taken) {
        const u = G.P[1].board.find(x => x && x.uid === uid);
        if (!u) continue;
        const burst = me.killed.has(uid) && u.count > 0 && u.def.onCountdown;
        this.slotEl(1, u.lane).appendChild(el('div', `pred theirs ${me.killed.has(uid) ? 'kill' : ''}`, burst ? '💀撃破→⏳発動' : me.killed.has(uid) ? '💀撃破' : `-${d}`));
      }
      // HPバーに予想ダメージ（敵：このターン／自分：次の相手ターン）
      const opp = B.predictAttacks(1, me.killed);
      this.hpPred(1, me.face);
      this.hpPred(0, opp.face);
      if (me.list.length && !G.cfg.predTipShown) { G.cfg.predTipShown = true; this.tip('pred', '👁 ユニットの上の<b>⚔数字</b>は、アタックした時の<b>予想</b>。赤いHPバーの斑点は受けそうなダメージ'); }
    }
    // いまやること
    const P = G.P[0], E = G.P[1];
    const playable = P.hand.filter(c => B.canPlay(0, c)).length;
    const pred = me.face > 0 ? `<span class="g-pred">予想：敵ヒーローに <b>${me.face}</b>${me.killed.size ? ` ・ ${me.killed.size}体撃破` : ''}</span>` : (me.killed.size ? `<span class="g-pred">予想：${me.killed.size}体撃破</span>` : '');
    let step;
    if (me.face >= E.hp) step = '<span class="g-hot">🎯 リーチ！ <b>⚔アタック!</b>で勝てるかも！</span>';
    else if (playable) step = `<span class="g-step"><b>①</b> 光っているカードを出す（あと${playable}枚出せる） → <b>②</b> ⚔アタック!</span>`;
    else if (B.canFever(0)) step = '<span class="g-step">🔥 <b>FEVER</b>でPPを3回復できる！</span>';
    else step = '<span class="g-step">出せるカードはもうない → <b>⚔アタック!</b>で攻撃！</span>';
    guide.innerHTML = step + pred;
  },
  hpPred(pi, dmg) {
    const P = B.G.P[pi];
    const h = $(pi ? '.hero-e' : '.hero-p', this.root);
    const bar = $('.hpbar', h);
    let e = $('.hp-pred', bar);
    if (!e) { e = el('i', 'hp-pred'); bar.insertBefore(e, $('.hp-num', bar)); }
    const cur = clamp(P.hp / P.maxHp, 0, 1) * 100;
    const w = Math.min(cur, dmg / P.maxHp * 100);
    e.style.left = (cur - w) + '%';
    e.style.width = (Settings.preview && dmg > 0 ? w : 0) + '%';
    e.classList.toggle('lethal', dmg >= P.hp);
  },

  /* ---------- ヒント（ドパ美のおすすめ） ---------- */
  async hint(auto) {
    if (!this.canAct() || this.thinking) return;
    $$('.hint-t', this.root).forEach(x => x.classList.remove('hint-t'));
    // ドパ美も敵と同じ先読みで考える（2手先まで、相手の反撃込み）
    this.thinking = true;
    let plan, fp = null;
    const prof = { depth: 2, beam: 3, width: 8 };
    try {
      plan = await AI.plan(B, 0, prof);
      if (B.canFever(0)) fp = await AI.feverPlan(B, 0, prof); // FEVERを使った場合も読んで比べる
    } finally { this.thinking = false; }
    if (!this.canAct()) return;
    const best = plan.actions[0] || null;
    Sound.play(auto ? 'tap' : 'select');
    if (fp && fp.actions.length && fp.score > plan.score + 1) {
      const nm = fp.actions.map(x => esc(CARDS[x.card.id].name)).join(' → ');
      this.strip(`<div class="dt-hint">💡 ドパ美のおすすめ</div>🔥 今が<b>FEVER</b>の使いどき！ PP+3で <b>${nm}</b> まで出せる`);
      $('.fever-btn', this.root).classList.add('hint-t');
      return;
    }
    if (!best) {
      const keep = B.canFever(0) ? '（FEVERは出したいカードがある時まで取っておこう）' : '';
      this.strip(`<div class="dt-hint">💡 ドパ美のおすすめ</div>もう出せる良いカードはないよ！ <b>⚔アタック!</b>で攻撃しよう${keep}`);
      $('.end-btn', this.root).classList.add('hint-t');
      return;
    }
    this.select(best.card.uid, true);
    const t = AI.mapTarget(best.tgt, B.G);
    let tEl = null;
    if (t.kind === 'lane' || t.kind === 'merge') tEl = this.slotEl(0, t.lane);
    else if (t.kind === 'unit') tEl = this.slotEl(t.u.owner, t.u.lane);
    else if (t.kind === 'hero') tEl = this.heroEl(t.owner);
    else tEl = $('.use-btn', this.root);
    if (tEl) tEl.classList.add('hint-t');
    const s = $('.hint-strip', this.root);
    const follow = plan.actions.length > 1 ? `<div class="dt-plan">読み：${plan.actions.map(x => esc(CARDS[x.card.id].name)).join(' → ')}</div>` : '';
    s.insertAdjacentHTML('afterbegin', `<div class="dt-hint">💡 ドパ美のおすすめ${auto ? '（迷ったらコレ）' : ''}</div><div class="dt-reason">${this.hintReason({ card: best.card, tgt: t })}${follow}</div>`);
    this.log('💡', `ヒント：${CARDS[best.card.id].name}`);
  },
  hintReason(o) {
    const def = CARDS[o.card.id], t = o.tgt, E = B.G.P[1];
    if (def.type === 'unit') {
      if (t.kind === 'merge') return `同じカードを重ねて<b>★${t.u.star + 1}に合体</b>！ ステータスが大きく上がる`;
      const opp = B.alive(E.board[t.lane]) ? E.board[t.lane] : null;
      if (def.kw.includes('fly')) return '<b>飛行</b>なので正面を無視して、アタックで<b>敵ヒーローに直撃</b>できる';
      if (!opp) return `正面が空いているマス。アタックで<b>敵ヒーローに${def.atk}ダメージ直撃</b>！`;
      if (def.atk >= opp.hp && !opp.shield) return `正面の<b>${esc(opp.def.name)}を倒せる</b>（ATK${def.atk} ≧ HP${opp.hp}）`;
      if (B.atkOf(opp) > 0) return `正面の${esc(opp.def.name)}の攻撃を<b>受け止めて</b>、ヒーローを守れる`;
      return 'まずは場にユニットを出そう';
    }
    if (def.type === 'field') return 'フィールドを出すと、場全体が自分に有利なルールになる';
    if (t.kind === 'hero') return '敵ヒーローを直接ねらえる！';
    if (t.kind === 'unit') {
      const u = t.u, v = def.ai && def.ai.v;
      if (u.owner === 1) return v && v >= u.hp && !u.shield ? `<b>${esc(u.def.name)}を倒せる</b>！` : `<b>${esc(u.def.name)}</b>に使って弱らせよう`;
      return `<b>${esc(u.def.name)}</b>に使うのがおすすめ`;
    }
    return `「${esc(def.name)}」の効果を使おう`;
  },
  armIdle() {
    clearTimeout(this.idleT);
    if (!Settings.autoHint) return;
    this.idleT = setTimeout(() => {
      if (this.canAct() && !this.sel && !Modal.stack.length) this.hint(true);
    }, 9000);
  },

  /* ---------- バトルログ・はじめて解説 ---------- */
  log(icon, text, cls = '') {
    const list = $('.blog-list', this.root);
    if (!list) return;
    const li = el('li', cls, `<span class="bl-ic">${icon}</span><span>${text}</span>`);
    list.appendChild(li);
    while (list.children.length > 120) list.firstChild.remove();
    if (!$('.blog', this.root).hidden) li.scrollIntoView({ block: 'end' });
  },
  toggleLog(force) {
    const b = $('.blog', this.root);
    b.hidden = force != null ? !force : !b.hidden;
    Sound.play('tap');
    if (!b.hidden) { const l = $('.blog-list', b); l.scrollTop = l.scrollHeight; }
  },
  tip(key, html) {
    if (!Settings.tips) return;
    const f = Meta.save.flags.tips = Meta.save.flags.tips || {};
    if (f[key]) return;
    f[key] = true;
    Meta.persist();
    FX.toast(`<span class="tip-tag">ルール</span>${html}`, { cls: 'tip', dur: 5200 });
  },

  syncHand() {
    const G = B.G, P = G.P[0];
    const hand = $('.hand', this.root);
    const ids = new Set(P.hand.map(c => c.uid));
    for (const [uid, e] of this.handEls) {
      if (!ids.has(uid) && !e.classList.contains('flying')) { e.remove(); this.handEls.delete(uid); }
    }
    for (const c of P.hand) {
      let e = this.handEls.get(c.uid);
      if (!e) {
        e = this.makeHandCard(c);
        hand.appendChild(e);
        const r = hand.getBoundingClientRect();
        e.style.transform = `translate(${r.width + 40}px, 20px) rotate(20deg)`;
      }
      const ok = B.canPlay(0, c) && !G.busy;
      e.classList.toggle('playable', ok);
      const cost = B.costOf(0, CARDS[c.id]);
      e.classList.toggle('unaff', cost > P.energy);
      const cb = e.querySelector('.card-cost b');
      if (cb && cb.textContent !== String(cost)) { cb.textContent = cost; e.classList.toggle('cost-down', cost < CARDS[c.id].cost); }
      e.classList.toggle('sel', this.sel === c.uid);
    }
    if (this.sel && !ids.has(this.sel)) this.deselect(true);
    this.layoutHand();
  },

  makeHandCard(c) {
    const def = CARDS[c.id];
    const e = cardEl(def, { cls: 'hcard' + (c.gift ? ' gift' : '') });
    e.dataset.uid = c.uid;
    this.handEls.set(c.uid, e);
    e.addEventListener('pointerdown', ev => this.onHandDown(ev, c.uid));
    e.addEventListener('contextmenu', ev => ev.preventDefault());
    // マウス環境では、カードに乗せるだけで説明を出す
    e.addEventListener('pointerenter', ev => {
      if (ev.pointerType !== 'mouse' || this.sel || this.drag) return;
      this.strip(detailHTML(CARDS[c.id]));
    });
    return e;
  },

  slotEl(p, lane) { return $(`.slot[data-p="${p}"][data-lane="${lane}"]`, this.root); },
  heroEl(p) { return $(`.hero-ava[data-p="${p}"]`, this.root); },
  posOf(t) {
    if (!t) return { x: this.W / 2, y: this.H / 2 };
    if (t.isHero) return centerOf(this.heroEl(t.owner));
    if (t.def) {
      const e = this.unitEls.get(t.uid);
      return centerOf(e && e.isConnected ? e : this.slotEl(t.owner, t.lane));
    }
    return centerOf($('.board', this.root));
  },
  srcPos(src, opts = {}) {
    if (opts.from && opts.from.unitPos) return this.posOf(opts.from.unitPos);
    if (!src) { const b = centerOf($('.board', this.root)); return { x: b.x, y: -30 }; }
    if (src.isHero) return centerOf(this.heroEl(src.owner));
    if (src.def) return this.posOf(src);
    if (src.field) return centerOf($('.field-chip', this.root));
    if (src.spell) { const b = centerOf($('.board', this.root)); return { x: b.x, y: b.y + (src.owner === 0 ? b.h * 0.3 : -b.h * 0.3) }; }
    return centerOf($('.board', this.root));
  },

  /* ---------- 入力 ---------- */
  canAct() { const G = B.G; return G && !G.over && !G.busy && G.active === 0; },

  onHandDown(ev, uid) {
    if (ev.button > 0) return;
    ev.preventDefault();
    Sound.unlock();
    const e = this.handEls.get(uid);
    this.press = { uid, x: ev.clientX, y: ev.clientY, el: e, moved: false, preview: false };
    clearTimeout(this.pressTimer);
    this.pressTimer = setTimeout(() => {
      if (this.press && !this.press.moved) {
        this.press.preview = true;
        const c = B.G.P[0].hand.find(x => x.uid === uid);
        if (c) Preview.show(CARDS[c.id]);
      }
    }, 450);
  },
  onMove(ev) {
    const pr = this.press;
    if (!pr) return;
    const d = Math.hypot(ev.clientX - pr.x, ev.clientY - pr.y);
    if (!pr.moved && d > 12) {
      pr.moved = true;
      clearTimeout(this.pressTimer);
      if (pr.preview) return;
      const c = B.G.P[0].hand.find(x => x.uid === pr.uid);
      if (c && this.canAct() && B.canPlay(0, c)) this.startDrag(c, ev);
    }
    if (this.drag) {
      const g = this.drag.ghost;
      g.style.left = ev.clientX + 'px'; g.style.top = ev.clientY + 'px';
      const t = this.dropTargetAt(ev.clientX, ev.clientY);
      $$('.hover-t', this.root).forEach(x => x.classList.remove('hover-t'));
      if (t && t.elm) t.elm.classList.add('hover-t');
    }
  },
  onUp(ev, cancel) {
    const pr = this.press;
    if (!pr) return;
    this.press = null;
    clearTimeout(this.pressTimer);
    if (pr.preview) { Preview.hide(); return; }
    if (this.drag) {
      const dr = this.drag; this.drag = null;
      dr.ghost.remove();
      dr.src.classList.remove('dragging');
      $$('.hover-t', this.root).forEach(x => x.classList.remove('hover-t'));
      if (!cancel) {
        const t = this.dropTargetAt(ev.clientX, ev.clientY);
        if (t && t.desc) { this.play(dr.card, t.desc, ev.clientX, ev.clientY); return; }
        const def = CARDS[dr.card.id];
        const handTop = $('.hand', this.root).getBoundingClientRect().top;
        if ((def.type !== 'unit' && (def.target === 'none' || def.type === 'field')) && ev.clientY < handTop - 20) {
          this.play(dr.card, { kind: 'none' }, ev.clientX, ev.clientY); return;
        }
      }
      this.layoutHand();
      return;
    }
    if (!pr.moved) this.toggleSelect(pr.uid);
  },
  startDrag(c, ev) {
    const src = this.handEls.get(c.uid);
    this.select(c.uid, true);
    src.classList.add('dragging');
    const g = cardEl(CARDS[c.id], { cls: 'hcard drag-ghost' });
    g.style.setProperty('--hw', this.hw + 'px');
    g.style.setProperty('--hh', Math.round(this.hw * 1.4) + 'px');
    g.style.left = ev.clientX + 'px'; g.style.top = ev.clientY + 'px';
    document.body.appendChild(g);
    this.drag = { card: c, ghost: g, src };
    Sound.play('select');
  },
  dropTargetAt(x, y) {
    const card = this.drag ? this.drag.card : null;
    if (!card) return null;
    const elm = document.elementFromPoint(x, y);
    if (!elm) return null;
    const slot = elm.closest('.slot'), hero = elm.closest('.hero-ava');
    let desc = null, tEl = null;
    if (slot) { desc = this.matchTarget(card, +slot.dataset.p, +slot.dataset.lane, null); tEl = slot; }
    else if (hero) { desc = this.matchTarget(card, null, null, +hero.dataset.p); tEl = hero; }
    return desc ? { desc, elm: tEl } : null;
  },
  matchTarget(card, p, lane, heroP) {
    const valid = B.targetsFor(0, card);
    if (heroP != null) return valid.find(v => v.kind === 'hero' && v.owner === heroP) || null;
    return valid.find(v =>
      ((v.kind === 'lane' || v.kind === 'merge') && v.owner === p && v.lane === lane) ||
      (v.kind === 'unit' && v.u.owner === p && v.u.lane === lane)) || null;
  },

  toggleSelect(uid) {
    if (this.sel === uid) { this.deselect(); Sound.play('cancel'); return; }
    this.select(uid);
  },
  select(uid, silent) {
    const G = B.G;
    const c = G.P[0].hand.find(x => x.uid === uid);
    if (!c) return;
    this.sel = uid; this.focus = null;
    if (!silent) Sound.play('select');
    const def = CARDS[c.id];
    const playable = this.canAct() && B.canPlay(0, c);
    this.clearTargets();
    let extra = '';
    if (playable) {
      const valid = B.targetsFor(0, c);
      for (const v of valid) {
        if (v.kind === 'lane') this.slotEl(0, v.lane).classList.add('tgt', 'tgt-lane');
        else if (v.kind === 'merge') this.slotEl(0, v.lane).classList.add('tgt', 'tgt-merge');
        else if (v.kind === 'unit') this.slotEl(v.u.owner, v.u.lane).classList.add('tgt', v.u.owner === 0 ? 'tgt-ally' : 'tgt-enemy');
        else if (v.kind === 'hero') this.heroEl(v.owner).classList.add('tgt', 'tgt-enemy');
      }
      if (valid[0].kind === 'none') extra = `<button class="use-btn" type="button">${def.type === 'field' ? '🗺️ 展開する!' : '✨ 使う!'}</button>`;
      else if (def.type === 'unit') extra = `<div class="dt-howto">光ってるマスをタップ${valid.some(v => v.kind === 'merge') ? '／<b>同じカードに重ねて合体!</b>' : ''}</div>`;
      else extra = '<div class="dt-howto">対象をタップ</div>';
    } else {
      const why = G.active !== 0 ? '相手のターン中' : def.cost > G.P[0].energy ? `PPが足りない（あと${def.cost - G.P[0].energy}）` : '使える対象がいない';
      extra = `<div class="dt-howto ng">${why}</div>`;
    }
    this.strip(detailHTML(def) + extra, true);
    const ub = $('.use-btn', this.root);
    if (ub) ub.addEventListener('click', ev => { ev.stopPropagation(); this.play(c, { kind: 'none' }); });
    this.syncHand();
    this.tutorial('select');
  },
  deselect(silent) {
    this.sel = null; this.focus = null;
    this.clearTargets();
    this.strip(null);
    if (!silent) this.syncHand();
  },
  clearTargets() {
    $$('.hint-t', this.root).forEach(x => x.classList.remove('hint-t'));
    $$('.tgt', this.root).forEach(x => x.classList.remove('tgt', 'tgt-lane', 'tgt-merge', 'tgt-ally', 'tgt-enemy'));
  },
  strip(html, keep) {
    const s = $('.hint-strip', this.root);
    if (!html) { s.hidden = true; s.innerHTML = ''; return; }
    s.innerHTML = html;
    s.hidden = false;
    clearTimeout(this.stripT);
    if (!keep) this.stripT = setTimeout(() => { if (!this.sel) s.hidden = true; }, 4000);
  },

  onSlot(p, lane) {
    Sound.unlock();
    const G = B.G;
    if (!G) return;
    if (this.sel) {
      const c = G.P[0].hand.find(x => x.uid === this.sel);
      if (c && this.canAct()) {
        const t = this.matchTarget(c, p, lane, null);
        if (t) { this.play(c, t); return; }
      }
    }
    const u = G.P[p].board[lane];
    if (u && !u.removed) {
      this.deselect(true); this.syncHand();
      this.focus = u;
      this.strip(detailHTML(u.def, u) + `<div class="dt-howto">${u.owner === 0 ? '味方' : '敵'}・攻撃力 ${B.atkOf(u)}・クリ率 ${Math.round(B.critChance(u) * 100)}%</div>`);
      Sound.play('tap');
      const e = this.unitEls.get(u.uid);
      if (e) animate(e, [{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: 200, realtime: true });
    } else if (this.sel) { this.deselect(); Sound.play('cancel'); }
  },
  onHero(p) {
    Sound.unlock();
    const G = B.G;
    if (!G) return;
    if (this.sel) {
      const c = G.P[0].hand.find(x => x.uid === this.sel);
      if (c && this.canAct()) {
        const t = this.matchTarget(c, null, null, p);
        if (t) { this.play(c, t); return; }
      }
    }
    const P = G.P[p];
    this.strip(`<div class="dt-head"><span class="dt-name">${P.avatar} ${esc(P.name)}</span></div><div class="dt-text">HP ${P.hp}/${P.maxHp}・山札${P.deck.length}枚・手札${P.hand.length}枚${p === 1 && P.passive ? `<br>⚠ ${esc(P.passive.name)}：${esc(P.passive.text)}` : ''}</div>`);
  },

  async play(card, desc, x, y) {
    if (!this.canAct()) return;
    this.lastDrop = x != null ? { x, y } : null;
    this.deselect(true);
    await B.playerPlay(card.uid, desc);
    this.tutorial('played');
    this.afterAction();
  },
  async fever() {
    if (!this.canAct() || !B.canFever(0)) return;
    this.deselect(true);
    await B.playerFever();
    this.afterAction();
  },
  async endTurn() {
    if (!this.canAct()) return;
    this.deselect(true);
    this.tutorial('end');
    await B.playerEndTurn();
    this.tutorial('turn2');
    this.afterAction();
  },
  afterAction() {
    const G = B.G;
    if (!G || G.over) return;
    this.sync();
    if (G.active !== 0 || G.busy) return;
    this.armIdle();
    if (B.canFever(0)) this.tutorial('fever');
    const P = G.P[0];
    const any = P.hand.some(c => B.canPlay(0, c)) || B.canFever(0);
    if (!any && Settings.autoEnd) {
      clearTimeout(this.autoT);
      this.autoT = setTimeout(() => { if (this.canAct() && !P.hand.some(c => B.canPlay(0, c)) && !B.canFever(0)) this.endTurn(); }, 700);
    }
  },
  cycleSpeed() {
    Settings.speed = Settings.speed >= 3 ? 1 : Settings.speed + 1;
    Time.speed = Settings.speed;
    Game.saveSettings();
    this.updateSpeedBtn();
    Sound.play('tap');
  },
  updateSpeedBtn() { $('.btn-speed', this.root).textContent = '▶'.repeat(Settings.speed) + ' x' + Settings.speed; },
  menu() {
    Sound.play('tap');
    const m = Modal.open(`
      <h2>メニュー</h2>
      <div class="menu-col">
        <button class="btn" data-a="close" type="button">バトルに戻る</button>
        <button class="btn ghost" data-a="sound" type="button">サウンド：${Sound.vol.bgm > 0 || Sound.vol.sfx > 0 ? 'ON' : 'OFF'}</button>
        <button class="btn ghost" data-a="auto" type="button">オートターン終了：${Settings.autoEnd ? 'ON' : 'OFF'}</button>
        <button class="btn ghost" data-a="pred" type="button">攻撃予測：${Settings.preview ? 'ON' : 'OFF'}</button>
        <button class="btn ghost" data-a="ahint" type="button">自動ヒント：${Settings.autoHint ? 'ON' : 'OFF'}</button>
        <button class="btn ghost" data-a="rules" type="button">📖 ルールを見る</button>
        <button class="btn danger" data-a="give" type="button">降参する</button>
      </div>`);
    m.addEventListener('click', ev => {
      const a = ev.target.closest('[data-a]');
      if (!a) return;
      if (a.dataset.a === 'close') Modal.close();
      if (a.dataset.a === 'sound') { Game.toggleMute(); a.textContent = 'サウンド：' + (Settings.muted ? 'OFF' : 'ON'); }
      if (a.dataset.a === 'auto') { Settings.autoEnd = !Settings.autoEnd; Game.saveSettings(); a.textContent = 'オートターン終了：' + (Settings.autoEnd ? 'ON' : 'OFF'); }
      if (a.dataset.a === 'give') { Modal.close(); this.surrender(); }
      if (a.dataset.a === 'pred') { Settings.preview = !Settings.preview; Game.saveSettings(); a.textContent = '攻撃予測：' + (Settings.preview ? 'ON' : 'OFF'); this.renderPredict(); }
      if (a.dataset.a === 'ahint') { Settings.autoHint = !Settings.autoHint; Game.saveSettings(); a.textContent = '自動ヒント：' + (Settings.autoHint ? 'ON' : 'OFF'); this.armIdle(); }
      if (a.dataset.a === 'rules') { Modal.close(); UI.howto(); }
    });
  },
  async surrender() {
    const G = B.G;
    if (!G || G.over || G.busy) { FX.toast('演出中は降参できません'); return; }
    G.over = true; G.winner = 1; G.endHandled = true;
    const res = B.result();
    res.surrender = true;
    await View.gameOver(1, res);
    Game.onBattleEnd(res, this.cfg);
  },

  enemySay(text, key) {
    if (key) { this.said = this.said || {}; if (this.said[key]) return; this.said[key] = true; }
    const top = $('.b-top', this.root);
    $$('.e-say', top).forEach(x => x.remove());
    const e = el('div', 'e-say', esc(text));
    top.appendChild(e);
    setTimeout(() => e.remove(), 2200);
  },

  /* ---------- チュートリアル ---------- */
  tutorial(ev) {
    const t = this.tut;
    if (!t) return;
    const box = $('.tut', this.root);
    const show = (key, html, ms) => {
      if (t.seen[key]) return;
      t.seen[key] = true;
      box.innerHTML = html; box.hidden = false;
      box.className = 'tut tut-' + key;
      clearTimeout(t.timer);
      if (ms) t.timer = setTimeout(() => { box.hidden = true; }, ms);
    };
    if (ev === 'start') show('start', '👇 <b>手札のカードをタップ</b>して選ぼう！');
    else if (ev === 'select' && t.seen.start) show('select', '✨ <b>光っているところ</b>をタップ！（ドラッグでもOK）');
    else if (ev === 'played' && t.seen.select) show('played', 'PPが残ってたらもっと出そう！<br>終わったら <b>⚔アタック!</b> で全員攻撃！');
    else if (ev === 'end') box.hidden = true;
    else if (ev === 'turn2') show('turn2', '💡 <b>同じカードを重ねると合体</b>して★アップ！<br>正面に敵がいないと<b>ヒーローに直撃</b>！', 6000);
    else if (ev === 'fever') show('fever', '🔥 <b>FEVER</b>ボタンでPPが3回復！ もう1〜2枚出せる！', 6000);
  },
};

/* ===================== 演出フック ===================== */
const View = {
  sync() { BUI.sync(); },
  busy(b) { if (BUI.root) BUI.root.classList.toggle('busy', b); },

  async turnStart(pi, round) {
    BUI.sync();
    BUI.log('━', `ROUND ${round} ・ ${pi === 0 ? 'あなた' : '相手'}のターン`, 'sep');
    if (pi === 1) BUI.tip('enemyturn', '相手のターン：相手も同じルールでカードを出して、<b>正面のマス</b>に攻撃してくる');
    if (pi === 0) {
      Sound.play('turn');
      await FX.banner('YOUR TURN', { cls: 'b-turn', sub: `ROUND ${round}`, dur: 900 });
      Sound.play('energy');
      $$('.orbs i.on', BUI.root).forEach((o, i) => animate(o, [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1.6)' }, { transform: 'scaleY(1)' }], { duration: 300, delay: i * 40, realtime: true }));
    } else {
      Sound.play('enemyTurn');
      await FX.banner('ENEMY TURN', { cls: 'b-turn enemy', dur: 750 });
    }
  },

  async draw(pi, card, o = {}) {
    if (pi !== 0) { BUI.sync(); return wait(60); }
    Sound.play('draw');
    BUI.syncHand();
    const e = BUI.handEls.get(card.uid);
    if (o.gift && e) {
      const p = centerOf(e);
      FX.burst(p.x, p.y, { count: 20, colors: ['#ffd23f', '#fff', '#ff3d8b'], speed: 5 });
      FX.popText(p.x, p.y - 30, 'GET!', 'pop-gold');
      Sound.play('rare', 1);
    }
    return wait(140);
  },
  reshuffle(pi) { if (pi === 0) FX.toast('山札を<b>リシャッフル</b>！'); },
  handFull(pi) { if (pi === 0) FX.toast('手札がいっぱい！ カードが燃えた🔥'); },

  async cardPlayed(pi, card, def, t) {
    const stage = BUI.stage;
    BUI.log(def.emoji, `${pi === 0 ? 'あなた' : '相手'}が「${esc(def.name)}」を${def.type === 'unit' ? (t.kind === 'merge' ? '重ねて合体' : '出した') : '使った'}`, pi === 0 ? 'me' : 'op');
    let from;
    const he = BUI.handEls.get(card.uid);
    if (pi === 0 && he) {
      from = he.getBoundingClientRect();
      he.classList.add('flying');
      he.remove(); BUI.handEls.delete(card.uid);
      BUI.layoutHand();
    }
    const fly = cardEl(def, { cls: 'fly-card' });
    fly.style.setProperty('--hw', BUI.hw + 'px');
    fly.style.setProperty('--hh', Math.round(BUI.hw * 1.4) + 'px');
    document.body.appendChild(fly);
    const board = centerOf($('.board', BUI.root));
    let dest = board;
    if (t.kind === 'lane' || t.kind === 'merge') dest = centerOf(BUI.slotEl(pi, t.lane));
    else if (t.kind === 'unit') dest = BUI.posOf(t.u);
    else if (t.kind === 'hero') dest = centerOf(BUI.heroEl(t.owner));
    Sound.play('whoosh');
    if (pi === 0) {
      const sx = from ? from.left + from.width / 2 : board.x, sy = from ? from.top + from.height / 2 : innerHeight - 80;
      if (def.type === 'unit') {
        await animate(fly, [
          { transform: `translate(${sx}px, ${sy}px) translate(-50%,-50%) scale(1)` },
          { transform: `translate(${dest.x}px, ${dest.y}px) translate(-50%,-50%) scale(.8)` },
        ], { duration: 200, easing: 'cubic-bezier(.5,0,.7,1)' });
      } else {
        await animate(fly, [
          { transform: `translate(${sx}px, ${sy}px) translate(-50%,-50%) scale(1)` },
          { transform: `translate(${board.x}px, ${board.y}px) translate(-50%,-50%) scale(1.5)`, offset: 0.5 },
          { transform: `translate(${board.x}px, ${board.y}px) translate(-50%,-50%) scale(1.5)`, offset: 0.8 },
          { transform: `translate(${board.x}px, ${board.y}px) translate(-50%,-50%) scale(2)`, opacity: 0 },
        ], { duration: 520, easing: 'ease-out' });
        FX.burst(board.x, board.y, { count: 30, colors: [TRIBES[def.tribe].color, '#fff'], speed: 7 });
      }
    } else {
      // 敵のカードは中央で見せてから飛ばす
      if (def.rarity === 'EX') BUI.enemySay(R.pick(['これが我が力…EXカードだ!', 'ボスだけの特権だ!', '受けてみよ!']));
      else if (RARITY[def.rarity].rank >= 3) BUI.enemySay(R.pick(['これでどうだ!', '切り札の出番だ!', '見せてやろう、本気を!']));
      const eh = centerOf($('.hero-e', BUI.root));
      await animate(fly, [
        { transform: `translate(${eh.x}px, ${eh.y}px) translate(-50%,-50%) scale(.3) rotateY(180deg)`, opacity: 0 },
        { transform: `translate(${board.x}px, ${board.y}px) translate(-50%,-50%) scale(1.45) rotateY(0deg)`, opacity: 1 },
      ], { duration: 300, easing: 'cubic-bezier(.2,1.2,.4,1)' });
      if (def.rarity === 'EX') {
        Sound.play('reach'); FX.flash('#ff2244', 0.25, 260); FX.shake(2);
        FX.rays(board.x, board.y, { color: '#ff2244', size: 320, life: 1 });
        FX.popText(board.x, board.y - BUI.hw * 1.3, 'EX CARD!!', 'pop-ex', { size: 34, dx: 0, dur: 1100 });
        await wait(300);
      }
      await wait(def.type === 'unit' ? 450 : 600);
      await animate(fly, [
        { transform: `translate(${board.x}px, ${board.y}px) translate(-50%,-50%) scale(1.45)` },
        def.type === 'unit'
          ? { transform: `translate(${dest.x}px, ${dest.y}px) translate(-50%,-50%) scale(.8)` }
          : { transform: `translate(${board.x}px, ${board.y}px) translate(-50%,-50%) scale(2)`, opacity: 0 },
      ], { duration: 220, easing: 'ease-in' });
      BUI.sync();
    }
    fly.remove();
  },

  async summon(u, o = {}) {
    const slot = BUI.slotEl(u.owner, u.lane);
    let e = BUI.unitEls.get(u.uid);
    if (!e) { e = unitEl(u); BUI.unitEls.set(u.uid, e); }
    slot.appendChild(e);
    updateUnitEl(e, u);
    const p = centerOf(slot);
    Sound.play('play');
    if (o.revive) { FX.burst(p.x, p.y, { count: 30, colors: ['#a978ff', '#7fffd4', '#fff'], speed: 5, gravity: -0.05 }); FX.popText(p.x, p.y - 30, '復活!', 'pop-dark'); }
    animate(e, [
      { transform: 'translateY(-30%) scale(1.5)', opacity: 0, filter: 'brightness(3)' },
      { transform: 'translateY(4%) scale(.92)', opacity: 1, filter: 'brightness(1.6)', offset: 0.6 },
      { transform: 'translateY(0) scale(1)', opacity: 1, filter: 'brightness(1)' },
    ], { duration: 280, easing: 'cubic-bezier(.5,0,.6,1)' });
    await wait(170);
    FX.ring(p.x, p.y, { color: TRIBES[u.def.tribe].color, size: 20, grow: 6 });
    FX.burst(p.x, p.y + BUI.cw * 0.5, { count: 14, colors: ['#ffffff', TRIBES[u.def.tribe].color], speed: 4, angle: -Math.PI / 2, spread: 2.6 });
    FX.shake(u.def.cost >= 6 ? 2 : 0.4);
    if (RARITY[u.def.rarity].rank >= 3) { FX.rays(p.x, p.y, { color: RARITY[u.def.rarity].color, size: 220, life: 0.9 }); vibrate(40); }
    return wait(120);
  },

  async merge(u, awaken) {
    const e = BUI.unitEls.get(u.uid);
    BUI.log('★', `${esc(u.def.name)}が★${u.star}に合体！`);
    BUI.tip('merge', '★ <b>合体</b>：場のユニットに同じカードを重ねると★アップ。HP全回復＆登場時効果ももう一度！');
    const p = BUI.posOf(u);
    Sound.play('merge');
    if (e) {
      updateUnitEl(e, u);
      animate(e, [
        { transform: 'scale(1) rotate(0)', filter: 'brightness(1)' },
        { transform: 'scale(.7) rotate(-8deg)', filter: 'brightness(2.5)', offset: 0.35 },
        { transform: 'scale(1.3) rotate(4deg)', filter: 'brightness(2)', offset: 0.7 },
        { transform: 'scale(1) rotate(0)', filter: 'brightness(1)' },
      ], { duration: 520, easing: 'ease-out' });
    }
    await wait(260);
    FX.ring(p.x, p.y, { color: '#ffd23f', size: 10, grow: 10, width: 6 });
    FX.burst(p.x, p.y, { count: 40, colors: ['#ffd23f', '#fff', TRIBES[u.def.tribe].color], speed: 8, type: 'star', size: 6 });
    FX.popText(p.x, p.y - 20, `★${u.star} 合体!!`, 'pop-merge', { size: 30, peak: 1.6 });
    FX.shake(1.2);
    vibrate([30, 30, 60]);
    if (awaken) {
      await wait(250);
      Sound.play('ssr');
      FX.rays(p.x, p.y, { color: '#ffd23f', size: 380, life: 1.4 });
      FX.fountain(p.x, p.y, 40);
      await FX.banner('★3 覚醒!!', { cls: 'b-gold', sub: `${u.def.name}がシールドを得た`, dur: 1100 });
    }
    return wait(160);
  },

  async lunge(u, target, info) {
    const e = BUI.unitEls.get(u.uid);
    if (target.isHero && B.hasKw(u, 'fly') && B.oppositeOf(u)) BUI.tip('fly', '🕊️ <b>飛行</b>：正面に敵がいても飛び越えて<b>ヒーローを直接攻撃</b>する');
    if (!e) return;
    const a = centerOf(e), b = BUI.posOf(target);
    const dx = (b.x - a.x) * 0.72, dy = (b.y - a.y) * 0.72;
    if (info.crit) {
      Sound.play('select');
      FX.popText(a.x, a.y - BUI.cw * 0.5, '!', 'pop-warn', { size: 34, dur: 500 });
      e.classList.add('charge');
      await wait(160);
    }
    e.style.zIndex = 30;
    const anim = animate(e, [
      { transform: 'translate(0,0) scale(1)' },
      { transform: `translate(${-dx * 0.08}px, ${-dy * 0.08}px) scale(1.05)`, offset: 0.25 },
      { transform: `translate(${dx}px, ${dy}px) scale(1.12)`, offset: 0.55 },
      { transform: 'translate(0,0) scale(1)' },
    ], { duration: 420, easing: 'ease-in-out' });
    anim.then(() => { e.style.zIndex = ''; e.classList.remove('charge'); });
    return wait(230);
  },
  lungeBack() {},

  async projectile(src, target, opts) {
    const kind = opts.fx;
    if (!kind) return;
    const a = BUI.srcPos(src, opts), b = BUI.posOf(target);
    const color = FX_COLORS[kind] || '#fff';
    const q = opts.quick ? 0.6 : 1;
    switch (kind) {
      case 'bolt': Sound.play('zap'); await FX.projectile(a.x, a.y, b.x, b.y, { kind: 'bolt', color }); break;
      case 'laser': Sound.play('zap'); await FX.projectile(b.x, -20, b.x, b.y, { kind: 'bolt', color }); break;
      case 'meteor': Sound.play('fire'); await FX.projectile(b.x + 120, -40, b.x, b.y, { color, size: 16, arc: 0, dur: 360 * q, kind: 'fire' }); break;
      case 'fire': Sound.play('fire'); await FX.projectile(a.x, a.y, b.x, b.y, { color, size: 12, dur: 320 * q, kind: 'fire' }); break;
      case 'quake': break;
      default: Sound.play('whoosh'); await FX.projectile(a.x, a.y, b.x, b.y, { color, size: 10, dur: 300 * q, arc: kind === 'rocket' ? -10 : -50 });
    }
  },
  async projectileMany(src, targets, opts) {
    if (opts.fx === 'quake') { FX.shake(3); Sound.play('hitHeavy'); return wait(200); }
    await Promise.all(targets.map((t, i) => wait(i * 50).then(() => this.projectile(src, t, Object.assign({}, opts, { quick: true })))));
  },

  async damage(target, amt, opts) {
    const p = BUI.posOf(target);
    const kind = opts.kind || opts.fx;
    const srcU = opts.src && opts.src.def ? opts.src : null;
    const color = srcU ? TRIBES[srcU.def.tribe].color : (FX_COLORS[kind] || '#ffffff');
    const tname = target.isHero ? (target.owner === 0 ? 'あなた' : '相手ヒーロー') : esc(target.def.name);
    if (amt > 0) BUI.log(opts.crit ? '💥' : opts.burn ? '🔥' : '⚔', `${srcU ? esc(srcU.def.name) + '→' : ''}${tname}に${amt}ダメージ${opts.crit ? '（クリティカル!）' : ''}${opts.pierced ? '（貫通）' : ''}`, target.isHero ? 'hero' : '');
    if (opts.attack && target.isHero) BUI.tip('face', '正面に敵ユニットがいないと、攻撃は<b>敵ヒーローに直撃</b>する！');
    else if (opts.attack && target.def) BUI.tip('lane', 'ユニットは<b>正面のマスの敵</b>を攻撃する。攻撃された側は反撃しない');
    if (opts.crit) BUI.tip('crit', '💥 <b>クリティカル</b>：攻撃はたまにダメージ2倍（基本10%、🍀ラッキーで+30%）');
    if (opts.pierced) BUI.tip('pierce', '💥 <b>貫通</b>：敵を倒して余ったダメージがヒーローに届く');
    if (opts.thorns) BUI.tip('thorns', '🌵 <b>トゲ</b>：攻撃してきた相手に20ダメージを返す');
    if (opts.chain) BUI.tip('chain', '⛓️ <b>連鎖</b>：攻撃した相手の両隣にも半分のダメージ');
    if (opts.capped) { FX.popText(p.x, p.y - 40, '🗿上限30', 'pop-label', { dur: 800 }); BUI.tip('heroCap', '🗿 <b>守護神アイギス</b>：いる限り、ヒーローが一度に受けるダメージは最大30'); }
    if (opts.armored) { FX.popText(p.x, p.y - 34, '🪖軽減', 'pop-label', { dur: 700 }); BUI.tip('armor', '🪖 <b>アーマー／守りの陣</b>：受けるダメージが10減る。小さい攻撃はほとんど効かない！'); }
    if (amt <= 0) {
      FX.popText(p.x, p.y, opts.label || (opts.armored ? 'GUARD' : 'MISS'), 'pop-miss');
      Sound.play('cancel');
      return wait(220);
    }
    const crit = !!opts.crit;
    const big = amt >= 100;
    let cls = 'pop-dmg';
    if (crit) cls += ' pop-crit';
    if (opts.burn) cls += ' pop-burn';
    if (target.isHero) cls += ' pop-hero';
    const size = clamp(22 + Math.sqrt(amt) * 2.2, 22, 74) * (crit ? 1.25 : 1);
    if (crit) FX.popText(p.x, p.y - size * 0.9, 'CRITICAL!', 'pop-critlabel', { dur: 900, dx: 0 });
    if (opts.pierced) FX.popText(p.x, p.y - size * 0.9, '貫通!', 'pop-label', { dx: 0 });
    if (opts.label) FX.popText(p.x, p.y - size, opts.label, 'pop-label', { dx: 0 });
    if (opts.thorns) FX.popText(p.x, p.y - size * 0.8, 'トゲ!', 'pop-label', { dx: 0 });
    FX.popText(p.x, p.y, (crit ? '' : '') + fmt(amt) + (crit ? '!' : ''), cls, { size, peak: crit ? 1.7 : 1.35 });
    // 被弾した要素の反応
    const e = target.isHero ? BUI.heroEl(target.owner) : BUI.unitEls.get(target.uid);
    if (e) {
      e.classList.remove('hit'); void e.offsetWidth; e.classList.add('hit');
      if (target.def) updateUnitEl(e, target);
    }
    if (target.isHero) {
      const h = $(target.owner ? '.hero-e' : '.hero-p', BUI.root);
      const P = B.G.P[target.owner];
      $('.hp-fill', h).style.width = clamp(P.hp / P.maxHp, 0, 1) * 100 + '%';
      $('.hp-num', h).textContent = `${Math.max(0, P.hp)} / ${P.maxHp}`;
      setTimeout(() => { $('.hp-ghost', h).style.width = clamp(P.hp / P.maxHp, 0, 1) * 100 + '%'; }, 450);
      if (target.owner === 1 && amt >= 40) FX.coins(p.x, p.y, Math.min(14, Math.round(amt / 15)));
    }
    const parts = kind === 'ice' ? ['#9ff3ff', '#ffffff'] : kind === 'fire' || opts.burn ? ['#ff7a2e', '#ffd166', '#ff3d3d'] : kind === 'dark' ? ['#b07bff', '#7fffd4'] : kind === 'gold' ? ['#ffd23f', '#fff6c4'] : [color, '#ffffff'];
    FX.burst(p.x, p.y, { count: crit ? 46 : big ? 32 : 18, colors: parts, speed: crit ? 11 : 7, type: kind === 'ice' ? 'shard' : 'spark' });
    if (crit || big) FX.ring(p.x, p.y, { color: crit ? '#ffd23f' : '#ffffff', size: 12, grow: crit ? 12 : 8, width: 6 });
    if (crit) FX.rays(p.x, p.y, { color: '#ffd23f', size: 240, life: 0.7 });
    if (crit) Sound.play('crit'); else if (big || target.isHero) Sound.play('hitHeavy'); else Sound.play('hit', amt / 40);
    if (target.isHero) {
      const P = B.G.P[target.owner];
      if (P.hp <= 0) {
        // とどめの一撃：ヒットストップ＋白フラッシュ
        FX.flash('#ffffff', 0.75, 420);
        FX.rays(p.x, p.y, { color: '#ffffff', size: 500, life: 1.2 });
        FX.popText(p.x, p.y - 60, 'FINISH!!', 'pop-crit', { size: 40, dx: 0, dur: 1200 });
        vibrate([100, 60, 220]);
        await waitReal(420);
      } else if (target.owner === 1 && P.hp <= P.maxHp * 0.35) {
        BUI.enemySay(R.pick(['ぐぬぬ…!', 'ちょ、ちょっと待って!?', 'まだだ…まだ終わらんよ!', 'こんなはずでは…', '効いてない…効いてないぞ!']), 'low');
      } else if (target.owner === 0 && P.hp <= P.maxHp * 0.3) {
        BUI.enemySay(R.pick(['もう終わりか?', 'フハハ! 弱い弱い!', 'そろそろトドメだな']), 'win');
      }
    }
    FX.shake(clamp(amt / 45, 0.3, 3) + (crit ? 1 : 0) + (target.isHero ? 0.5 : 0));
    if (crit || big) vibrate(crit ? [20, 20, 50] : 30);
    if (crit && (amt >= 80 || R.chance(0.35))) FX.react(R.pick(CRIT_REACTS), '#ffd23f');
    else if (target.isHero && target.owner === 1 && amt >= 120) FX.react(R.pick(['痛恨の一撃!!', 'ぶっ刺さった!!', 'えぐい!!']), '#ff3d8b');
    if (opts.many) return wait(45);
    if (crit || big) await wait(130); // ヒットストップ
    return wait(opts.quick ? 70 : 150);
  },
  async blocked(target) {
    const p = BUI.posOf(target);
    BUI.log('🛡️', `${esc(target.def.name)}のシールドがダメージを防いだ`);
    BUI.tip('shield', '🛡️ <b>シールド</b>：次に受けるダメージを1回だけ0にする（泡が消える）');
    Sound.play('shield');
    FX.ring(p.x, p.y, { color: '#7fe9ff', size: BUI.cw * 0.4, grow: 5, width: 5 });
    FX.burst(p.x, p.y, { count: 24, colors: ['#bff8ff', '#ffffff'], speed: 6, type: 'shard' });
    FX.popText(p.x, p.y, 'BLOCK!', 'pop-block');
    const e = BUI.unitEls.get(target.uid);
    if (e) updateUnitEl(e, target);
    return wait(220);
  },
  pierce() {},
  async heal(target, amt) {
    const p = BUI.posOf(target);
    Sound.play('heal');
    FX.popText(p.x, p.y, '+' + amt, 'pop-heal');
    FX.burst(p.x, p.y + 20, { count: 14, colors: ['#8dff4f', '#d6ffb8', '#ffffff'], speed: 3, gravity: -0.12, type: 'glow', size: 4 });
    if (target.isHero) BUI.sync(); else { const e = BUI.unitEls.get(target.uid); if (e) updateUnitEl(e, target); }
    return wait(160);
  },
  async buff(u, a, h, o = {}) {
    const p = BUI.posOf(u);
    const e = BUI.unitEls.get(u.uid);
    if (e) {
      updateUnitEl(e, u);
      animate(e, [{ transform: 'scale(1)', filter: 'brightness(1)' }, { transform: 'scale(1.15)', filter: 'brightness(1.8)' }, { transform: 'scale(1)', filter: 'brightness(1)' }], { duration: 280 });
    }
    if (a || h) {
      Sound.play('buff');
      FX.popText(p.x, p.y, `+${a}/+${h}`, 'pop-buff');
      FX.burst(p.x, p.y + 20, { count: 12, colors: ['#ffd23f', '#fff'], speed: 3, gravity: -0.15, type: 'star', size: 4 });
    }
    return wait(o.quick ? 60 : 180);
  },
  async buffMany(us, a, h) {
    Sound.play('buff');
    us.forEach(u => {
      const p = BUI.posOf(u), e = BUI.unitEls.get(u.uid);
      if (e) { updateUnitEl(e, u); animate(e, [{ transform: 'scale(1)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }], { duration: 280 }); }
      FX.popText(p.x, p.y, `+${a}/+${h}`, 'pop-buff');
      FX.burst(p.x, p.y + 20, { count: 10, colors: ['#ffd23f', '#fff'], speed: 3, gravity: -0.15, type: 'star', size: 4 });
    });
    return wait(260);
  },
  async status(u, kind) {
    const p = BUI.posOf(u);
    if (kind === 'burn') { BUI.log('🔥', `${esc(u.def.name)}が炎上（${u.burn}）`); BUI.tip('burn', '🔥 <b>炎上</b>：そのユニットのターン開始時に（10×数値）ダメージ。毎ターン1ずつ減る'); }
    if (kind === 'frozen') { BUI.log('❄️', `${esc(u.def.name)}が凍結`); BUI.tip('frozen', '❄️ <b>凍結</b>：凍ったユニットは次の攻撃を1回お休みする'); }
    const e = BUI.unitEls.get(u.uid);
    if (e) updateUnitEl(e, u);
    const map = {
      burn: ['炎上!', 'pop-burn', 'burn'], frozen: ['凍結!', 'pop-ice', 'freeze'], shield: ['シールド!', 'pop-block', 'shield'],
      double: ['連撃!', 'pop-buff', 'buff'], pierce: ['貫通!', 'pop-buff', 'buff'],
    };
    const m = map[kind] || [KW[kind] ? KW[kind].name + '!' : '!', 'pop-buff', 'buff'];
    FX.popText(p.x, p.y - 10, m[0], m[1]);
    Sound.play(m[2]);
    if (kind === 'burn') FX.burst(p.x, p.y, { count: 16, colors: ['#ff7a2e', '#ffd166'], speed: 4, gravity: -0.12, type: 'glow', size: 5 });
    if (kind === 'frozen') FX.burst(p.x, p.y, { count: 16, colors: ['#bff8ff', '#fff'], speed: 5, type: 'shard' });
    return wait(140);
  },
  async burnTick(u) {
    const p = BUI.posOf(u);
    FX.burst(p.x, p.y, { count: 18, colors: ['#ff7a2e', '#ffd166', '#ff3d3d'], speed: 4, gravity: -0.15, type: 'glow', size: 6 });
    Sound.play('burn');
    return wait(100);
  },
  async frozenSkip(u) {
    const p = BUI.posOf(u);
    FX.popText(p.x, p.y, '凍って動けない…', 'pop-ice', { size: 16 });
    const e = BUI.unitEls.get(u.uid);
    if (e) { updateUnitEl(e, u); animate(e, [{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }], { duration: 240 }); }
    Sound.play('freeze');
    return wait(300);
  },
  async poison(t) {
    BUI.tip('poison', '☠️ <b>猛毒</b>：ダメージを与えたユニットを一撃で倒す'); const p = BUI.posOf(t); FX.popText(p.x, p.y - 20, '猛毒!', 'pop-dark'); FX.burst(p.x, p.y, { count: 20, colors: ['#8dff4f', '#b07bff'], speed: 4, type: 'glow' }); Sound.play('dark'); return wait(160); },
  async destroyFx(u) { const p = BUI.posOf(u); FX.burst(p.x, p.y, { count: 20, colors: ['#b07bff', '#000000', '#ffffff'], speed: 5 }); Sound.play('dark'); return wait(120); },

  async death(u) {
    const e = BUI.unitEls.get(u.uid);
    BUI.log('💀', `${esc(u.def.name)}（${u.owner === 0 ? '味方' : '敵'}）が倒れた`);
    BUI.tip('death', 'HPが0になったユニットは倒れる。空いたマスの正面からは<b>ヒーローに直撃</b>が通る');
    const p = BUI.posOf(u);
    const c = TRIBES[u.def.tribe].color;
    Sound.play('death');
    FX.burst(p.x, p.y, { count: 26, colors: [c, '#ffffff', '#222244'], speed: 8, type: 'shard', size: 9, gravity: 0.3, life: 0.9 });
    FX.ring(p.x, p.y, { color: c, size: 10, grow: 7 });
    if (u.owner === 1) FX.coins(p.x, p.y, 5);
    if (e) {
      e.classList.add('dying');
      await animate(e, [
        { transform: 'scale(1) rotate(0)', opacity: 1, filter: 'brightness(3)' },
        { transform: 'scale(1.15) rotate(-6deg)', opacity: 1, filter: 'brightness(3)', offset: 0.3 },
        { transform: 'scale(.2) rotate(25deg)', opacity: 0, filter: 'brightness(1)' },
      ], { duration: 260, easing: 'ease-in' });
      e.remove();
      BUI.unitEls.delete(u.uid);
    }
    if (u.owner === 1 && B.G.active === 0 && B.G.combo >= 2 && R.chance(0.25)) FX.react(R.pick(['無双!!', '蹴散らせ!!', 'まとめて粉砕!!']), '#2ee6ff');
    return wait(60);
  },
  async revive(u) {
    const e = BUI.unitEls.get(u.uid);
    BUI.log('🔁', `${esc(u.def.name)}が復活！`);
    BUI.tip('undying', '🔁 <b>不死</b>：1回だけ、倒されてもHP10で復活する');
    const p = BUI.posOf(u);
    if (e) updateUnitEl(e, u);
    Sound.play('heal');
    FX.burst(p.x, p.y, { count: 36, colors: u.def.tribe === 'blaze' ? ['#ff7a2e', '#ffd166', '#fff'] : ['#a978ff', '#7fffd4', '#fff'], speed: 6, gravity: -0.1 });
    FX.popText(p.x, p.y - 20, '復活!!', 'pop-dark', { size: 28 });
    if (e) await animate(e, [{ transform: 'scale(.3)', opacity: 0.2 }, { transform: 'scale(1.2)', opacity: 1 }, { transform: 'scale(1)' }], { duration: 380 });
    return wait(120);
  },

  aiThink(pi, plan) {
    const a = plan.actions[0];
    if (!a) return;
    const names = plan.actions.map(x => `「${esc(CARDS[x.card.id].name)}」`).join('→');
    BUI.log('🧠', `相手は${plan.nodes}通りの展開を読み、${names}の順が最善と判断`, 'op');
    if (plan.nodes >= 20 && R.chance(0.25)) BUI.enemySay(R.pick(['ふむ…読めたぞ', 'その手は通さん', '3手先まで見えている', '計算通りだ']));
  },

  // ---- 未知なる軸の演出 ----
  async move(u, from, o = {}) {
    const e = BUI.unitEls.get(u.uid);
    const to = BUI.slotEl(u.owner, u.lane);
    if (!e) return;
    const a = e.getBoundingClientRect();
    to.appendChild(e);
    const b = e.getBoundingClientRect();
    Sound.play('whoosh');
    if (o.warp) { const p = centerOf(e); FX.ring(p.x, p.y, { color: '#8a8cff', size: 10, grow: 6 }); FX.popText(p.x, p.y - 20, 'ワープ!', 'pop-warp'); }
    if (o.push) { const p = centerOf(e); FX.popText(p.x, p.y - 20, 'ふっとばし!', 'pop-label'); }
    await animate(e, [
      { transform: `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${o.warp ? 0.3 : 1})`, opacity: o.warp ? 0.2 : 1 },
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
    ], { duration: o.quick ? 220 : 320, easing: 'cubic-bezier(.3,1.3,.5,1)' });
    BUI.log('🌀', `${u.def.name}がマス${from + 1}→${u.lane + 1}へ移動`);
    BUI.tip('warp', '🌀 <b>移動</b>：ユニットは別のマスへ移ることがある。正面が空けば<b>ヒーローに直撃</b>！');
  },
  async transform(u, old, o = {}) {
    const prev = BUI.unitEls.get(u.uid);
    const slot = BUI.slotEl(u.owner, u.lane);
    const p = centerOf(slot);
    Sound.play(o.hatch ? 'rare' : 'merge', 2);
    FX.burst(p.x, p.y, { count: 34, colors: [TRIBES[u.def.tribe].color, '#fff', '#b8f04a'], speed: 7, type: 'star' });
    FX.ring(p.x, p.y, { color: '#b8f04a', size: 10, grow: 9 });
    if (prev) { await animate(prev, [{ transform: 'scale(1) rotateY(0)' }, { transform: 'scale(.6) rotateY(90deg)', filter: 'brightness(3)' }], { duration: 200 }); prev.remove(); }
    const e = unitEl(u);
    BUI.unitEls.set(u.uid, e);
    slot.appendChild(e);
    await animate(e, [{ transform: 'scale(.6) rotateY(-90deg)', filter: 'brightness(3)' }, { transform: 'scale(1.15) rotateY(0)' }, { transform: 'scale(1)' }], { duration: 300 });
    FX.popText(p.x, p.y - 24, o.hatch ? `孵化！ ${u.def.name}!!` : `${u.def.name}に変身!`, o.hatch ? 'pop-merge' : 'pop-label', { size: o.hatch ? 22 : 16 });
    if (o.hatch && RARITY[u.def.rarity].rank >= 2) FX.react('当たりタマゴ!!', '#b8f04a');
    BUI.log('🎭', `${old.name}が${u.def.name}に${o.hatch ? '孵化' : '変身'}`);
    return wait(150);
  },
  async steal(u, from, fromLane) {
    const e = BUI.unitEls.get(u.uid);
    const to = BUI.slotEl(u.owner, u.lane);
    Sound.play('dark');
    if (e) {
      const a = e.getBoundingClientRect();
      to.appendChild(e);
      updateUnitEl(e, u);
      const b = e.getBoundingClientRect();
      await animate(e, [
        { transform: `translate(${a.left - b.left}px, ${a.top - b.top}px) rotate(0)` },
        { transform: `translate(${(a.left - b.left) / 2}px, ${(a.top - b.top) / 2 - 40}px) rotate(180deg) scale(1.2)`, offset: 0.5 },
        { transform: 'translate(0,0) rotate(360deg)' },
      ], { duration: 600, easing: 'ease-in-out' });
    }
    const p = centerOf(to);
    FX.burst(p.x, p.y, { count: 30, colors: ['#b8f04a', '#fff', '#ffd23f'], speed: 7, type: 'star' });
    FX.popText(p.x, p.y - 24, 'いただき!!', 'pop-merge', { size: 26 });
    BUI.log('🦹', `${u.def.name}が${u.owner === 0 ? 'あなた' : '相手'}の味方になった`);
  },
  async countTick(u) {
    const e = BUI.unitEls.get(u.uid);
    const p = BUI.posOf(u);
    if (e) { updateUnitEl(e, u); animate(e, [{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 260 }); }
    if (u.count > 0) {
      Sound.play('tick');
      FX.popText(p.x, p.y - 20, `⏳ あと${u.count}`, 'pop-count', { size: 20 });
    } else {
      Sound.play('reach');
      FX.ring(p.x, p.y, { color: '#e0a96d', size: 10, grow: 12, width: 6 });
      FX.popText(p.x, p.y - 30, '⏳ 0!! 発動!!', 'pop-merge', { size: 26 });
      await wait(350);
    }
    BUI.log('⏳', `${u.def.name}のカウント → ${u.count}${u.count === 0 ? '（発動！）' : ''}`);
    BUI.tip('countdown', '⏳ <b>カウント</b>：自分のターンが来るたびに1減って、<b>0で効果が発動</b>！');
    return wait(160);
  },
  async countBurst(u) {
    const p = BUI.posOf(u);
    Sound.play('reach');
    FX.ring(p.x, p.y, { color: '#e0a96d', size: 10, grow: 12, width: 6 });
    FX.popText(p.x, p.y - 30, '倒されても⏳発動!!', 'pop-merge', { size: 22 });
    BUI.log('⏳', `${esc(u.def.name)}が倒されたので、その場で発動！`);
    BUI.tip('countburst', '⏳ <b>カウント</b>のユニットは、途中で倒されても<b>その場で効果が発動</b>する！');
    return wait(350);
  },
  async payHp(pi, n) {
    const h = BUI.heroEl(pi), p = centerOf(h);
    Sound.play('dark');
    FX.popText(p.x, p.y, `♥-${n}`, 'pop-pay', { size: 26 });
    FX.burst(p.x, p.y, { count: 16, colors: ['#ff3a5c', '#ffb0b8'], speed: 5 });
    h.classList.remove('hit'); void h.offsetWidth; h.classList.add('hit');
    BUI.sync();
    BUI.log('💔', `${pi === 0 ? 'あなた' : '相手'}がHPを${n}払った`);
    BUI.tip('hpcost', '💔 <b>HPコスト</b>：PPとは別に<b>自分のHPを払う</b>カード。HPは1未満にはならない');
    return wait(200);
  },

  combo(n, pi) {
    const box = $('.combo', BUI.root);
    if (n < 2) return;
    box.hidden = false;
    box.classList.toggle('enemy', pi === 1);
    const lv = n >= 20 ? 4 : n >= 13 ? 3 : n >= 8 ? 2 : n >= 5 ? 1 : 0;
    box.dataset.lv = lv;
    box.querySelector('b').textContent = n;
    animate(box, [{ transform: 'scale(1.6) rotate(-6deg)' }, { transform: 'scale(1) rotate(-6deg)' }], { duration: 220, easing: 'cubic-bezier(.2,1.6,.4,1)', realtime: true });
    if (pi === 0) {
      Sound.play('combo', n);
      if (COMBO_WORDS[n]) {
        FX.react(COMBO_WORDS[n], ['#ffffff', '#2ee6ff', '#ffd23f', '#ff3d8b', '#ff3d8b'][lv]);
        if (n >= 10) { const c = centerOf(box); FX.burst(c.x, c.y, { count: 30, colors: ['#ffd23f', '#ff3d8b', '#2ee6ff'], speed: 8, type: 'star' }); }
      }
    }
  },

  feverGauge() { BUI.sync(); },
  feverReady(pi) {
    if (pi === 0) BUI.tip('fever', '🔥 <b>FEVER</b>：ゲージが満タン！ ボタンを押すと<b>PPが3回復</b>してカードを追加で出せる');
    if (pi === 0) {
      Sound.play('feverReady');
      FX.toast('🔥 <b>FEVER準備OK!</b> ボタンを押せ！', { cls: 'hot' });
      const b = $('.fever-btn', BUI.root); const c = centerOf(b);
      FX.burst(c.x, c.y, { count: 30, colors: ['#ff3d8b', '#ffd23f'], speed: 6, type: 'star' });
    } else {
      FX.toast('⚠ 相手のFEVERゲージが満タン！', { cls: 'warn' });
      BUI.log('⚠', '相手のFEVERゲージが満タン（次のターンにPP+3で大量展開してくるかも）');
      BUI.tip('efever', '⚠ <b>相手のFEVER</b>：相手もゲージが満タンになると<b>PP+3</b>でカードを多く出してくる。右上のゲージに注意！');
    }
    BUI.sync();
  },
  async fever(pi, on) {
    if (on) BUI.log('🔥', `${pi === 0 ? 'あなた' : '相手'}のFEVER！ PPが3回復`);
    if (on) {
      Sound.play('fever');
      vibrate([50, 40, 50, 40, 120]);
      if (pi === 0) {
        BUI.stage.classList.add('fever-on');
        document.body.classList.add('fever-on');
        FX.setAmbient('fever');
        FX.flash('#ff3d8b', 0.35, 300);
        await wait(300);
        Sound.bgm('fever');
        FX.confetti(90);
        await FX.banner('FEVER TIME!!', { cls: 'b-fever', sub: 'PPが3回復！ カードをもっと出せる！', dur: 1300 });
      } else {
        BUI.sync();
        FX.flash('#ff2244', 0.3, 300);
        await FX.banner('ENEMY FEVER!!', { cls: 'b-fever enemy', sub: '相手のPPが3回復！', dur: 1100 });
      }
      BUI.sync();
    } else if (pi === 0) {
      BUI.stage.classList.remove('fever-on');
      document.body.classList.remove('fever-on');
      Sound.bgm(BUI.bgmName());
      BUI.applyField();
    }
  },

  async field(f) {
    Sound.play('rare', 2);
    BUI.log('🗺️', `フィールド「${esc(f.def.name)}」（${f.owner === 0 ? 'あなた' : '相手'}）`);
    BUI.tip('field', '🗺️ <b>フィールド</b>：場全体のルールが変わる。出した側に有利。新しいフィールドで上書きできる');
    FX.flash(TRIBES[f.def.tribe].color, 0.3, 400);
    BUI.applyField();
    const c = centerOf($('.board', BUI.root));
    FX.rays(c.x, c.y, { color: TRIBES[f.def.tribe].color, size: 420, life: 1.2 });
    await FX.banner(`${f.def.emoji} ${f.def.name}`, { cls: 'b-field', sub: f.def.text.replace('フィールド：', ''), color: TRIBES[f.def.tribe].color, dur: 1500 });
  },
  async fieldPulse(f) {
    const chip = $('.field-chip', BUI.root);
    animate(chip, [{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 300 });
    return wait(150);
  },
  async trigger(u, kind) {
    const e = BUI.unitEls.get(u.uid);
    if (kind === 'pre') {
      const p = BUI.posOf(u);
      FX.popText(p.x, p.y - 30, '⚡アタック前', 'pop-label', { color: '#ffd23f', dx: 0 });
      BUI.log('⚡', `アタック前：${esc(u.def.name)}の効果`);
      BUI.tip('preattack', '⚡ <b>アタック前</b>の効果：アタックを押すと、攻撃の直前に<b>毎ターン</b>発動する（出したターンから！）');
    }
    if (e) await animate(e, [{ filter: 'brightness(1)' }, { filter: 'brightness(2) drop-shadow(0 0 10px var(--tc))' }, { filter: 'brightness(1)' }], { duration: 300 });
  },
  async passive(pi, pas) {
    const h = centerOf($('.hero-e', BUI.root));
    FX.popText(h.x, h.y + 40, '⚠ ' + pas.name, 'pop-warnlabel', { dx: 0, dur: 1100 });
    if (BUI.cfg && BUI.cfg.rush) { BUI.log('⚠', `ボスの常時能力「${esc(pas.name)}」`, 'op'); Sound.play('dark'); animate($('.hero-e .hero-ava', BUI.root), [{ filter: 'brightness(1)' }, { filter: 'brightness(2.2) drop-shadow(0 0 12px #ff2244)' }, { filter: 'brightness(1)' }], { duration: 500 }); }
    return wait(250);
  },

  /* ---- ボスラッシュ ---- */
  // 必殺技：画面を黒帯で切って、ボスの顔と技名をドーンと出す
  async bossUlt(pi, u) {
    const b = B.G.P[pi].boss;
    BUI.log('☠', `ボスの必殺技「${esc(u.name)}」！ ${esc(u.text)}`, 'op');
    BUI.tip('ult', '☠ <b>必殺技</b>：ボスは数ターンごとに強力な技を撃ってくる。右上の<b>☠カウント</b>を見て、来る前に備えよう！');
    const c = el('div', 'ult-cut');
    c.style.setProperty('--bc', b.color);
    c.innerHTML = `<div class="uc-bar top"></div><div class="uc-bar bot"></div>
      <div class="uc-ava">${b.avatar}</div>
      <div class="uc-txt"><div class="uc-k">☠ ULTIMATE ☠</div><div class="uc-name">${esc(u.name)}</div><div class="uc-desc">${esc(u.text)}</div></div>`;
    BUI.ov.appendChild(c);
    Sound.play('ult');
    vibrate([60, 40, 160]);
    FX.flash('#000000', 0.5, 300);
    await wait(700);
    FX.shake(6);
    FX.flash(b.color, 0.45, 350);
    const h = centerOf($('.hero-e', BUI.root));
    FX.rays(h.x, h.y, { color: '#ff2244', size: 520, life: 1.2 });
    await wait(1100);
    c.classList.add('out');
    await wait(220);
    c.remove();
  },
  // 覚醒：白→赤のフラッシュ、ひび割れ、BGMが切り替わる
  async bossPhase(pi, phase, ph) {
    const P = B.G.P[pi], b = P.boss;
    BUI.log('🔥', `ボスが覚醒！「${esc(ph.name)}」 ${esc(ph.text)}`, 'op');
    BUI.tip('awaken', '🔥 <b>覚醒</b>：ボスはHPが減ると覚醒して戦い方が変わる。HPバーの<b>白い線</b>が覚醒ライン');
    BUI.deselect(true);
    const c = el('div', 'awaken');
    c.style.setProperty('--bc', b.color);
    c.innerHTML = `<div class="aw-crack"></div><div class="aw-ava">${b.avatar}</div>
      <div class="aw-main">覚醒!!</div><div class="aw-name">${b.phases.length > 1 ? `PHASE ${phase + 1} ・ ` : ''}${esc(ph.name)}</div>
      <div class="aw-line">「${esc(ph.line)}」</div><div class="aw-desc">${esc(ph.text)}</div>`;
    BUI.ov.appendChild(c);
    Sound.bgm(null);
    Sound.play('awaken');
    vibrate([100, 60, 100, 60, 300]);
    await wait(720);
    FX.flash('#ffffff', 0.85, 250);
    FX.shake(9);
    const h = centerOf($('.hero-e', BUI.root));
    FX.burst(h.x, h.y, { count: 90, colors: [b.color, '#ff2244', '#fff'], speed: 14, type: 'shard', size: 8 });
    FX.ring(h.x, h.y, { color: '#ff2244', size: 30, grow: 22, width: 10 });
    BUI.stage.classList.add('awakened');
    BUI.syncBoss();
    await wait(1700);
    Sound.bgm(BUI.bgmName());
    c.classList.add('out');
    await wait(250);
    c.remove();
  },
  async bounce(u) {
    const e = BUI.unitEls.get(u.uid);
    BUI.log('⌛', `${esc(u.def.name)}が手札に戻された`);
    Sound.play('whoosh');
    if (e) {
      const to = centerOf(u.owner === 0 ? $('.hand', BUI.root) : $('.hero-e', BUI.root));
      const a = e.getBoundingClientRect();
      e.classList.add('dying');
      await animate(e, [
        { transform: 'translate(0,0) scale(1)', opacity: 1, filter: 'brightness(1)' },
        { transform: `translate(${to.x - a.left - a.width / 2}px, ${to.y - a.top - a.height / 2}px) scale(.3) rotate(-30deg)`, opacity: 0, filter: 'brightness(2.5)' },
      ], { duration: 380, easing: 'ease-in' });
      e.remove();
      BUI.unitEls.delete(u.uid);
    }
    const p = centerOf(BUI.slotEl(u.owner, u.lane));
    FX.popText(p.x, p.y - 20, '手札へ!', 'pop-label');
    BUI.sync();
    if (u.owner === 0) BUI.syncHand();
  },
  async debuff(u, v) {
    const e = BUI.unitEls.get(u.uid), p = BUI.posOf(u);
    if (e) { updateUnitEl(e, u); animate(e, [{ filter: 'brightness(1)' }, { filter: 'grayscale(1) brightness(.6)' }, { filter: 'brightness(1)' }], { duration: 320 }); }
    if (v) FX.popText(p.x, p.y, `ATK-${v}`, 'pop-dark');
    Sound.play('dark');
    return wait(120);
  },
  // ---- 迎撃・呪い・巨大化 ----
  async interceptFx(g, u) {
    const p = BUI.posOf(g);
    BUI.tip('intercept', '🎯 <b>迎撃</b>：正面のマスに敵ユニットが出てくると、その場で20ダメージを撃ち込む');
    FX.popText(p.x, p.y - 30, '迎撃!', 'pop-label', { size: 20 });
    BUI.log('🎯', `${esc(g.def.name)}が${esc(u.def.name)}を迎撃！`);
    return wait(100);
  },
  async curse(pi, n) {
    BUI.sync();
    const p = centerOf(BUI.heroEl(pi));
    Sound.play('dark');
    FX.popText(p.x, p.y - 30, `呪い+${n}`, 'pop-dark', { size: 22 });
    FX.burst(p.x, p.y, { count: 18, colors: ['#e05be0', '#3a0a3c', '#fff'], speed: 4, gravity: -0.1 });
    BUI.log('🕯️', `${pi === 0 ? 'あなた' : '相手'}に呪い+${n}（合計${B.P(pi).curse}）`);
    BUI.tip('curse', '🕯️ <b>呪い</b>：呪われたヒーローは、自分のターン開始時に（10×呪い）ダメージを受ける。時間では減らない！');
    return wait(150);
  },
  async curseTick(pi, n) {
    const p = centerOf(BUI.heroEl(pi));
    FX.popText(p.x, p.y - 40, `🕯️呪い×${n}`, 'pop-dark', { size: 20 });
    FX.burst(p.x, p.y, { count: 14 + n * 4, colors: ['#e05be0', '#ffffff'], speed: 5 });
    Sound.play('dark');
    return wait(200);
  },
  async ramp(pi, n) {
    BUI.sync();
    if (!n) return;
    const el2 = pi === 0 ? $('.energy', BUI.root) : BUI.heroEl(1);
    const p = centerOf(el2);
    FX.popText(p.x, p.y - 24, `最大PP+${n}`, 'pop-energy', { size: 22 });
    Sound.play('energy');
    BUI.log('🗻', `${pi === 0 ? 'あなた' : '相手'}の最大PPが${B.P(pi).maxEnergy}に`);
    return wait(150);
  },

  // ---- 新しい軸の演出 ----
  async tile(pi, lane, kind) {
    const slot = BUI.slotEl(pi, lane);
    BUI.sync();
    if (!kind) return;
    BUI.log('🗺️', `${pi === 0 ? '自分' : '相手'}のマス${lane + 1}に「${TILE_NAME[kind]}」`);
    BUI.tip('tile', '🗺️ <b>陣</b>：マスに刻まれる効果。⚔力の陣＝ATK+10／🔰守りの陣＝受けるダメージ-10／🕳️落とし穴＝敵が出ると30ダメージ');
    const c = centerOf(slot);
    Sound.play('buff');
    FX.ring(c.x, c.y, { color: kind === 'trap' ? '#ff4d5e' : '#d1a463', size: 10, grow: 8, width: 6 });
    animate(slot, [{ filter: 'brightness(1)' }, { filter: 'brightness(2.2)' }, { filter: 'brightness(1)' }], { duration: 300 });
    return wait(120);
  },
  async trapFx(u) {
    const p = BUI.posOf(u);
    Sound.play('hitHeavy');
    FX.shake(2);
    FX.popText(p.x, p.y - 30, '落とし穴!!', 'pop-label', { size: 22 });
    FX.burst(p.x, p.y + 20, { count: 24, colors: ['#8a6a3a', '#d1a463', '#fff'], speed: 6, gravity: 0.3 });
    BUI.log('🕳️', `${esc(u.def.name)}が落とし穴にはまった！`);
    return wait(200);
  },
  async guardFx(g, attacker) {
    const p = BUI.posOf(g);
    BUI.tip('guard', '🚧 <b>守護</b>：ヒーローへの直撃（飛行も）を、守護を持つユニットが代わりに受け止める');
    FX.popText(p.x, p.y - 36, 'かばう!', 'pop-label', { size: 20 });
    const e = BUI.unitEls.get(g.uid);
    if (e) animate(e, [{ transform: 'scale(1)' }, { transform: 'scale(1.15)', filter: 'brightness(1.8)' }, { transform: 'scale(1)' }], { duration: 260 });
    BUI.log('🚧', `${esc(g.def.name)}が${esc(attacker.def.name)}の直撃をかばった`);
    return wait(120);
  },
  async discardCard(pi, c) {
    const def = CARDS[c.id];
    BUI.log('🗑️', `${pi === 0 ? 'あなた' : '相手'}の手札「${esc(def.name)}」が捨てられた`);
    if (pi !== 0) { BUI.sync(); return wait(80); }
    BUI.syncHand();
    const board = centerOf($('.board', BUI.root));
    const fly = cardEl(def, { cls: 'fly-card' });
    fly.style.setProperty('--hw', BUI.hw + 'px');
    fly.style.setProperty('--hh', Math.round(BUI.hw * 1.4) + 'px');
    document.body.appendChild(fly);
    Sound.play('burn');
    await animate(fly, [
      { transform: `translate(${board.x}px, ${innerHeight - 90}px) translate(-50%,-50%) scale(1)`, opacity: 1 },
      { transform: `translate(${board.x}px, ${board.y}px) translate(-50%,-50%) scale(1.3) rotate(-6deg)`, opacity: 1, filter: 'brightness(1)', offset: 0.45 },
      { transform: `translate(${board.x}px, ${board.y - 30}px) translate(-50%,-50%) scale(1.1) rotate(8deg)`, opacity: 0, filter: 'brightness(.2) sepia(1) saturate(4) hue-rotate(-30deg)' },
    ], { duration: 650, easing: 'ease-in' });
    FX.burst(board.x, board.y, { count: 26, colors: ['#ff7a2e', '#ffd166', '#222'], speed: 5, gravity: -0.15 });
    FX.popText(board.x, board.y - 40, '捨てられた…', 'pop-dark');
    fly.remove();
  },
  async energy(pi, n) {
    BUI.sync();
    if (pi !== 0) return;
    const p = centerOf($('.energy', BUI.root));
    FX.popText(p.x, p.y - 20, `+${n} PP`, 'pop-energy');
    Sound.play('energy');
    return wait(150);
  },
  say(pi, text, color) {
    const p = centerOf(BUI.heroEl(pi));
    FX.popText(p.x, p.y - 30, text, 'pop-label', { color });
  },
  async suddenDeath(d) {
    Sound.play('reach');
    await FX.banner('サドンデス!!', { cls: 'b-warn', sub: `両者に${d}ダメージ`, dur: 1100 });
  },

  async attackPhase(pi, reach) {
    BUI.deselect(true);
    if (pi === 0 && reach) {
      Sound.play('reach');
      FX.flash('#ff2244', 0.25, 300);
      await FX.banner('激アツ!!', { cls: 'b-hot', sub: 'LETHAL CHANCE', dur: 1100 });
    } else if (pi === 1 && reach) {
      await FX.banner('ピンチ!!', { cls: 'b-warn', dur: 900 });
    } else if (pi === 0 && B.units(0).length) {
      await FX.banner('ATTACK!', { cls: 'b-atk', dur: 600 });
    }
  },
  async turnSummary(pi, dmg, combo) {
    const box = $('.combo', BUI.root);
    setTimeout(() => { box.hidden = true; }, 600);
    if (pi !== 0 || dmg <= 0) return;
    let rate = RATINGS[0][1];
    for (const [v, n] of RATINGS) if (dmg >= v) rate = n;
    Sound.play(dmg >= 160 ? 'jackpot' : 'star');
    const isBest = dmg > (Game.save.records.turnDamage || 0);
    if (isBest) Game.save.records.turnDamage = dmg;
    if (dmg >= 280) { FX.confetti(60); FX.flash('#ffd23f', 0.2, 300); }
    await FX.banner(`${fmt(dmg)} DAMAGE`, { cls: 'b-total', sub: rate + (combo >= 2 ? ` ・ ${combo} COMBO` : ''), dur: 1150 });
    if (isBest && dmg >= 60) { Sound.play('levelup'); FX.toast(`🏆 <b>自己ベスト更新!!</b> 1ターン${fmt(dmg)}ダメージ`, { cls: 'gold' }); }
  },

  /* ---- ランダム演出 ---- */
  async dice(u, n) {
    const p = BUI.posOf(u);
    const faces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    const d = el('div', 'dice-pop', faces[0]);
    d.style.left = p.x + 'px'; d.style.top = p.y + 'px';
    document.body.appendChild(d);
    Sound.play('dice');
    for (let i = 0; i < 9; i++) { d.textContent = faces[R.int(0, 5)]; await wait(55 + i * 10); }
    d.textContent = faces[n - 1];
    d.classList.add('land');
    Sound.play(n >= 5 ? 'jackpot' : 'slotStop');
    FX.popText(p.x, p.y - 40, `${n}!!`, n >= 5 ? 'pop-crit' : 'pop-label', { size: 34 });
    if (n === 6) { FX.react('出目6!! 神!!', '#ffd23f'); FX.coins(p.x, p.y, 10); }
    await wait(450);
    d.remove();
  },
  async coins(pi, results) {
    const wrap = el('div', 'coin-row');
    BUI.ov.appendChild(wrap);
    for (let i = 0; i < results.length; i++) {
      const c = el('div', 'coin-flip', '🪙');
      wrap.appendChild(c);
      Sound.play('coin');
      await animate(c, [{ transform: 'rotateX(0) translateY(0)' }, { transform: 'rotateX(1440deg) translateY(-60px)', offset: 0.5 }, { transform: 'rotateX(2880deg) translateY(0)' }], { duration: results.length > 1 ? 380 : 650 });
      c.textContent = results[i] ? '表' : '裏';
      c.classList.add(results[i] ? 'heads' : 'tails');
      if (results[i]) Sound.play('star'); else Sound.play('cancel');
    }
    const n = results.filter(Boolean).length;
    if (results.length > 1) { FX.popText(innerWidth / 2, innerHeight * 0.42, `表 ×${n}`, n >= 3 ? 'pop-crit' : 'pop-label', { size: 34, dx: 0 }); if (n >= 4) FX.react('豪運!!', '#ffd23f'); }
    await wait(500);
    wrap.remove();
  },
  async roulette(pi, opts, idx) {
    const wrap = el('div', 'roulette');
    wrap.innerHTML = `<div class="rl-title">🃏 ROULETTE</div><div class="rl-grid">${opts.map((o, i) => `<div class="rl-item" data-i="${i}">${esc(o)}</div>`).join('')}</div>`;
    BUI.ov.appendChild(wrap);
    const items = $$('.rl-item', wrap);
    const total = 14 + idx + R.int(0, 1) * opts.length;
    let cur = 0;
    for (let s = 0; s <= total; s++) {
      cur = s % opts.length;
      items.forEach((it, i) => it.classList.toggle('on', i === cur));
      Sound.play('slotTick');
      await wait(50 + Math.pow(s / total, 3) * 260);
    }
    items[cur].classList.add('win');
    Sound.play('jackpot');
    const c = centerOf(items[cur]);
    FX.burst(c.x, c.y, { count: 30, colors: ['#ffd23f', '#fff', '#ff3d8b'], speed: 7, type: 'star' });
    await wait(650);
    wrap.remove();
  },
  async slot(pi, reels, kind, sym) {
    const SYM = ['7', '💎', '🍒', '🔔'];
    const wrap = el('div', 'slotm');
    wrap.innerHTML = `<div class="slot-top">🎰 SLOT</div><div class="slot-reels">${reels.map(() => '<div class="reel"><span></span></div>').join('')}</div><div class="slot-msg"></div>`;
    BUI.ov.appendChild(wrap);
    const rs = $$('.reel span', wrap);
    const msg = $('.slot-msg', wrap);
    const stopped = [false, false, false];
    let spinning = true;
    (async () => {
      while (spinning) {
        rs.forEach((r, i) => { if (!stopped[i]) r.textContent = R.pick(SYM) === '7' ? '7' : R.pick(SYM); });
        Sound.play('slotTick');
        await waitReal(55);
        if (Time.headless) break;
      }
    })();
    const stop = i => { stopped[i] = true; rs[i].textContent = reels[i]; rs[i].parentNode.classList.add('stop'); Sound.play('slotStop'); };
    await wait(650); stop(0);
    await wait(380); stop(1);
    if (reels[0] === reels[1]) {
      msg.textContent = 'リーチ!!'; msg.className = 'slot-msg reach';
      wrap.classList.add('reach');
      Sound.play('reach');
      await wait(1300);
    } else await wait(420);
    stop(2);
    spinning = false;
    if (kind === 'triple') {
      msg.textContent = sym === '7' ? 'JACKPOT!!!' : '大当たり!!'; msg.className = 'slot-msg win';
      wrap.classList.add('win');
      Sound.play('jackpot');
      FX.confetti(110);
      FX.coins(innerWidth / 2, innerHeight / 2, 24);
      vibrate([60, 40, 60, 40, 200]);
      FX.react(sym === '7' ? '777!!!' : '揃った!!', '#ffd23f');
      await wait(1100);
    } else if (kind === 'double') {
      msg.textContent = '当たり!'; msg.className = 'slot-msg hit';
      Sound.play('coin');
      await wait(650);
    } else {
      msg.textContent = 'ハズレ… (1枚ドロー)'; msg.className = 'slot-msg miss';
      await wait(650);
    }
    wrap.remove();
  },
  async cutin(u, text) {
    const t = TRIBES[u.def.tribe];
    const c = el('div', 'cutin');
    c.style.setProperty('--tc', t.color);
    c.style.setProperty('--rc', RARITY[u.def.rarity].color);
    c.innerHTML = `<div class="cutin-band"><div class="cutin-emoji">${u.def.emoji}</div><div class="cutin-txt"><div class="cutin-rar">${u.def.rarity}</div><div class="cutin-name">${esc(u.def.name)}</div><div class="cutin-line">${esc(text)}</div></div></div>`;
    BUI.ov.appendChild(c);
    Sound.play(u.def.rarity === 'UR' ? 'ssr' : 'rare', 3);
    vibrate(60);
    await wait(1250);
    c.classList.add('out');
    await wait(200);
    c.remove();
  },
  async quake() { Sound.play('hitHeavy'); FX.shake(4); FX.flash('#c7a27a', 0.25, 400); await wait(400); },
  explode(u) { const p = BUI.posOf(u); FX.burst(p.x, p.y, { count: 40, colors: ['#ff7a2e', '#ffd166', '#ffffff'], speed: 9 }); FX.ring(p.x, p.y, { color: '#ff7a2e', size: 10, grow: 12, width: 8 }); Sound.play('hitHeavy'); FX.shake(2); },

  async gameOver(winner, res) {
    BUI.deselect(true);
    BUI.log('🏁', winner === 0 ? '勝利！' : '敗北…', 'sep');
    await wait(250);
    if (winner === 0) {
      const p = centerOf(BUI.heroEl(1));
      Sound.play('hitHeavy');
      FX.flash('#ffffff', 0.6, 500);
      FX.rays(p.x, p.y, { color: '#ffd23f', size: 600, life: 2 });
      FX.burst(p.x, p.y, { count: 80, colors: ['#ffd23f', '#ff3d8b', '#2ee6ff', '#ffffff'], speed: 14, type: 'star', size: 7 });
      vibrate([80, 50, 200]);
      await waitReal(250);
      Sound.play('win');
      FX.confetti(180);
      if (BUI.cfg && BUI.cfg.rush) {
        const b = BUI.cfg.enemy.boss;
        BUI.enemySay(b.lose);
        FX.flash('#ff2244', 0.4, 400);
        FX.burst(p.x, p.y, { count: 120, colors: [b.color, '#ff2244', '#ffd23f', '#fff'], speed: 18, type: 'shard', size: 10 });
        await FX.banner('BOSS BREAK!!', { cls: 'b-ko b-break', sub: `No.${String(b.no).padStart(2, '0')} ${b.name} 撃破!!`, dur: 2000 });
      } else await FX.banner('K.O.!!', { cls: 'b-ko', dur: 1600 });
    } else {
      if (BUI.cfg && BUI.cfg.rush) BUI.enemySay(BUI.cfg.enemy.boss.win);
      Sound.play('lose');
      await FX.banner(res && res.surrender ? '降参…' : 'DEFEAT…', { cls: 'b-lose', dur: 1400 });
    }
  },
};
