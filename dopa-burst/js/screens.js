'use strict';
/* ===== 画面：タイトル／ホーム／ステージ／ガチャ／デッキ／図鑑／ミッション／設定／リザルト ===== */

const Modal = {
  stack: [],
  open(html, o = {}) {
    const back = el('div', 'modal-back' + (o.backCls ? ' ' + o.backCls : ''));
    const box = el('div', 'modal ' + (o.cls || ''), html);
    back.appendChild(box);
    $('#modal-root').appendChild(back);
    this.stack.push(back);
    if (o.dismiss !== false) back.addEventListener('pointerdown', ev => { if (ev.target === back) { Sound.play('cancel'); this.close(); } });
    animate(box, [{ transform: 'scale(.86) translateY(16px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 240, easing: 'cubic-bezier(.2,1.3,.4,1)', realtime: true });
    return box;
  },
  close() { const b = this.stack.pop(); if (b) b.remove(); },
  closeAll() { while (this.stack.length) this.close(); },
};

const Screens = {
  cur: null,
  show(name, ...args) {
    Preview.hide();
    $$('.screen').forEach(s => { s.hidden = s.id !== 'scr-' + name; });
    const scr = $('#scr-' + name);
    if (scr) scr.scrollTop = 0;
    this.cur = name;
    const r = UI[name];
    if (r) r.call(UI, ...args);
    if (scr) $$('.scroll', scr).forEach(x => { x.scrollTop = 0; });
    if (name !== 'battle') { document.body.classList.remove('fever-on'); FX.setAmbient(name === 'title' ? 'neutral' : 'none'); }
  },
};

const MASCOT_LINES = [
  '今日もドーパミン出していこ！', '合体は正義。同じカードは重ねてナンボ！', 'FEVERはPP+3！ 出したいカードがある時に使え！',
  '「リーチ!」って出たら、アタックで勝てるかも！', 'ラッキー持ちはクリ率+30%だよ！', '正面に敵がいないとヒーローに直撃するよ！',
  '飛行ユニットは壁を無視してヒーローを殴る！', 'フィールドカードで盤面のルールが変わる！', 'スロットは3つ揃えば大当たり！ 2つでも当たり！',
  'ランク戦は連勝するほどボーナス増えるよ！', '1ターンのダメージ記録、更新しちゃお！', '★3まで育てると覚醒してシールドを持つよ！',
];

function curHTML() {
  const s = Meta.save;
  return `<div class="cur"><span class="chip coin" title="コイン">🪙<b>${fmt(s.coins)}</b></span><span class="chip tix" title="ガチャチケット">🎫<b>${s.tickets}</b></span><span class="chip prem" title="プレミアムチケット">💎<b>${s.premium}</b></span></div>`;
}
function topbar(title, backTo = 'home') {
  return `<header class="topbar"><button class="back" type="button" data-back="${backTo}" aria-label="戻る">‹</button><h2>${title}</h2>${curHTML()}</header>`;
}
function bindBack(root) {
  $$('[data-back]', root).forEach(b => b.addEventListener('click', () => { Sound.play('cancel'); Screens.show(b.dataset.back); }));
}
function rewardChips(rw) {
  const a = [];
  if (rw.coins) a.push(`<span class="rw coin">🪙${fmt(rw.coins)}</span>`);
  if (rw.tickets) a.push(`<span class="rw tix">🎫×${rw.tickets}</span>`);
  if (rw.premium) a.push(`<span class="rw prem">💎×${rw.premium}</span>`);
  return a.join('');
}
function celebrate(html, sub, o = {}) {
  Sound.play(o.sound || 'claim');
  FX.fountain(innerWidth / 2, innerHeight * 0.62, 36);
  return FX.banner(html, { cls: o.cls || 'b-gold', sub, dur: 1300 });
}

function rushCTA() {
  const open = Meta.rushUnlocked(), n = Meta.rushDefeated();
  return `<button class="cta-rush ${open ? '' : 'locked'}" type="button" data-go="rush">
    <span class="cr-band"><i>WARNING ⚠ BOSS RUSH ⚠ WARNING ⚠ BOSS RUSH ⚠ WARNING ⚠ BOSS RUSH ⚠</i></span>
    <span class="cr-row"><span class="cr-skull">${open ? '☠' : '🔒'}</span><span class="cr-txt"><span class="cr-main">BOSS RUSH</span>
    <span class="cr-sub">${open ? `20体の凶悪ボス ・ 撃破 <b>${n}</b>/20` : 'ストーリー1-4クリアで解放'}</span></span>
    <span class="cr-faces">${BOSS_LIST.slice(-3).map(b => `<i>${b.avatar}</i>`).join('')}</span></span>
  </button>`;
}
const dangerHTML = t => `<span class="danger">${'☠'.repeat(t)}<i>${'☠'.repeat(4 - t)}</i></span>`;

const UI = {
  /* ---------- タイトル ---------- */
  title() {
    const r = $('#scr-title');
    const sample = ['b_dragon', 'su_unicorn', 'l_king', 's_fenrir', 'm_deus', 'ne_hades', 'n_dragon'];
    r.innerHTML = `
      <div class="t-burst"></div>
      <div class="t-cards">${sample.map((id, i) => `<div class="t-card" style="--i:${i}"></div>`).join('')}</div>
      <div class="t-center">
        <h1 class="t-logo"><span class="t-l1">ドーパミン</span><span class="t-l2">BURST!</span></h1>
        <p class="t-sub">脳汁フィールドカードバトル</p>
        <button class="t-start" type="button">TAP TO START</button>
        <p class="t-foot">🔊 サウンドあり ・ 1戦3分</p>
      </div>`;
    $$('.t-card', r).forEach((c, i) => c.appendChild(cardEl(CARDS[sample[i]])));
    const go = async () => {
      r.removeEventListener('pointerup', go);
      Sound.unlock();
      Sound.play('fever');
      FX.flash('#ff3d8b', 0.4, 400);
      FX.confetti(80);
      await waitReal(350);
      Game.enterHome();
    };
    r.addEventListener('pointerup', go);
  },

  /* ---------- ホーム ---------- */
  home() {
    const s = Meta.save, r = $('#scr-home');
    Meta.missionsEnsure();
    const rk = rankOf(s.rank.rp);
    const next = Meta.nextStage(), ns = STAGES[next];
    const col = Meta.collectionRate();
    const claim = Meta.claimable();
    const free = s.tickets + s.premium + (Meta.freeGachaReady() ? 1 : 0);
    const need = Meta.xpNeed(s.level);
    const picks = COLLECTIBLE.filter(c => RARITY[c.rarity].rank >= 3);
    const pick = picks[hashStr(todayStr()) % picks.length];
    const misTotal = s.missions.list.length;
    const misDone = s.missions.list.filter(m => { const d = Meta.missionDef(m.id); return d && m.prog >= d.goal; }).length;
    let line = R.pick(MASCOT_LINES);
    if (Meta.freeGachaReady()) line = '今日の無料ガチャがまだだよ！ 引こ引こ！🎁';
    else if (free > 0) line = `チケットが${free}枚あるよ！ ガチャ引こ！🎴`;
    else if (claim > 0) line = `ミッション報酬が${claim}個受け取れるよ！🎯`;
    r.innerHTML = `
      <div class="home">
        <div class="hb-top">
          <button class="prof" type="button" data-go="settings">
            <span class="prof-ava">${s.avatar}</span>
            <span class="prof-mid"><span class="prof-name">${esc(s.name)}</span><span class="xpbar"><i style="width:${s.xp / need * 100}%"></i></span></span>
            <span class="prof-lv">Lv<b>${s.level}</b></span>
          </button>
          ${curHTML()}
        </div>
        <div class="h-logo"><span>ドーパミン</span><b>BURST!</b></div>
        <div class="mascot">
          <div class="bubble">${esc(line)}</div>
          <button class="mascot-body" type="button" aria-label="ドパ美">🧠</button>
          <div class="mascot-name">ナビ：ドパ美</div>
        </div>
        <button class="cta-story" type="button" data-go="stages">
          <span class="cta-main">▶ ストーリー</span>
          <span class="cta-sub">${ns ? `NEXT ${ns.id}「${esc(ns.name)}」${ns.boss ? ' <em>BOSS</em>' : ''}` : ''}</span>
          <span class="cta-stars">★ ${Meta.totalStars()} / ${STAGE_ORDER.length * 3}</span>
        </button>
        ${rushCTA()}
        <div class="menu-grid">
          <button type="button" data-go="rank" class="mg-rank"><span class="mg-ic">🏆</span><span class="mg-t">ランク戦</span><small style="color:${rk.color}">${rk.icon} ${rk.name}${s.rank.streak >= 2 ? ` ・ ${s.rank.streak}連勝中🔥` : ''}</small></button>
          <button type="button" data-go="gacha" class="mg-gacha"><span class="mg-ic">🎴</span><span class="mg-t">ガチャ</span><small>SSR確定まで${Meta.PITY_MAX - s.pity}</small>${free ? `<i class="badge">${free}</i>` : ''}</button>
          <button type="button" data-go="deck"><span class="mg-ic">🃏</span><span class="mg-t">デッキ</span><small>${Meta.validDeck(s.deck) ? '20/20 OK' : '<b class="warn">要編成</b>'}</small></button>
          <button type="button" data-go="dex"><span class="mg-ic">📖</span><span class="mg-t">図鑑</span><small>${col.got}/${col.total}（${col.pct}%）</small>${s.newCards.length ? `<i class="badge new">NEW</i>` : ''}</button>
          <button type="button" data-go="missions"><span class="mg-ic">🎯</span><span class="mg-t">ミッション</span><small>毎日更新</small>${claim ? `<i class="badge">${claim}</i>` : ''}</button>
          <button type="button" data-go="shop" class="mg-shop"><span class="mg-ic">🛒</span><span class="mg-t">交換所</span><small>コインで確定GET</small></button>
          <button type="button" data-go="howto"><span class="mg-ic">❓</span><span class="mg-t">遊び方</span><small>ルール・用語</small></button>
          <button type="button" data-go="settings"><span class="mg-ic">⚙️</span><span class="mg-t">設定</span><small>音・演出・名前</small></button>
        </div>
        <div class="h-extra">
          <button class="pickup" type="button" data-go="gacha" style="--tc:${TRIBES[pick.tribe].color};--rc:${RARITY[pick.rarity].color}">
            <div class="pk-card"></div>
            <div class="pk-txt"><span class="pk-tag">TODAY'S PICK UP</span><b>${esc(pick.name)}</b><small>${pick.rarity}・${TRIBES[pick.tribe].icon}${TRIBES[pick.tribe].name} ${Meta.owned(pick.id) ? '✅ 所持済み' : '— ガチャで当てろ!'}</small><span class="pk-go">ガチャへ ▶</span></div>
          </button>
          <button class="h-mis" type="button" data-go="missions"><span>🎯 今日のミッション</span><div class="mi-bar"><i style="width:${misDone / Math.max(1, misTotal) * 100}%"></i><span>${misDone} / ${misTotal}</span></div><em>${claim ? '報酬あり!' : ''}</em></button>
        </div>
      </div>`;
    $('.pk-card', r).appendChild(cardEl(pick));
    $$('[data-go]', r).forEach(b => b.addEventListener('click', () => {
      const g = b.dataset.go;
      if (g === 'rush' && !Meta.rushUnlocked()) { Sound.play('error'); FX.toast('ストーリー1-4「ビッグプリン」を倒すと解放！'); return; }
      Sound.play(g === 'rush' ? 'enemyTurn' : 'select');
      if (g === 'rank') Game.startRank();
      else if (g === 'howto') UI.howto();
      else Screens.show(g);
    }));
    const mb = $('.mascot-body', r);
    mb.addEventListener('click', () => {
      Sound.play('tap');
      $('.bubble', r).textContent = R.pick(MASCOT_LINES);
      animate(mb, [{ transform: 'scale(1)' }, { transform: 'scale(1.25) rotate(-8deg)' }, { transform: 'scale(1)' }], { duration: 300, realtime: true });
      const c = centerOf(mb); FX.burst(c.x, c.y, { count: 12, colors: ['#ff3d8b', '#ffd23f', '#2ee6ff'], speed: 5, type: 'star' });
    });
    Sound.bgm('home');
  },

  howto() {
    Modal.open(`
      <h2>遊び方</h2>
      <div class="howto">
        <section><h3>🎯 目的</h3><p>相手ヒーローのHPを<b>0</b>にしたら勝ち！</p></section>
        <section><h3>🃏 カードを出す</h3><p>手札をタップ → 光っているマスをタップ（ドラッグでもOK）。カード左上の数字は必要な<b>PP</b>。PPは毎ターン全回復して、最大値が1ずつ増える（最大10）。</p></section>
        <section><h3>⚔ アタック</h3><p>「アタック!」を押すと、自分のユニットが<b>左から順に正面の敵を攻撃</b>。正面が空いていたら<b>敵ヒーローに直撃</b>！</p></section>
        <section><h3>★ 合体</h3><p>場にいるユニットに<b>同じカードを重ねる</b>と合体して★2、さらに重ねて★3。★3は<b>覚醒</b>してシールドを持つ。登場時効果ももう一度発動！</p></section>
        <section><h3>🔥 FEVER</h3><p>攻撃・撃破・合体でゲージが溜まる。MAXでボタンを押すと<b>PPが3回復</b>（上限を超えてもOK）。いつ使うかが腕の見せどころ！ <b>相手も</b>ゲージが溜まるとFEVERを使ってくる（右上のゲージをチェック）。</p></section>
        <section><h3>☠ ボスラッシュ</h3><p>ストーリー1-4クリアで解放される、20体の凶悪ボスとの決戦。ボスは専用の<b>EXカード</b>、毎ターンの<b>常時能力</b>、数ターンごとの<b>必殺技</b>（右上の☠カウントで予告）を使い、HPが減ると<b>覚醒</b>して戦い方が変わる。あなたのHPは${RUSH_PLAYER_HP}。負けても削ったぶんだけコインがもらえる。</p></section>
        <section><h3>💥 クリティカル</h3><p>攻撃は<b>10%</b>でクリティカル（ダメージ2倍）。ラッキー持ちやカジノで確率アップ。</p></section>
        <section><h3>🗺 フィールド</h3><p>フィールドカードを出すと、場全体のルールが変わる。新しいフィールドを出すと上書き。</p></section>
        <section><h3>🎰 リーチ</h3><p>アタックすれば倒せそうな時、相手ヒーローに「リーチ!」が光る。</p></section>
        <section><h3>🔰 バトル中のサポート</h3><p><b>⚔数字</b>：ユニットの下に、アタックした時の予想ダメージ（「撃破!」「直撃」も表示）。HPバーの斑点は受けそうなダメージ。<br><b>💡ヒント</b>：ドパ美がおすすめの1手と理由を教えてくれる（迷って止まると自動でも出る）。<br><b>📜ログ</b>：何が起きたかを文章で確認できる。<br>初めて起きたことは、上に<b>ルール解説</b>が出る。</p></section>
        <section><h3>🧭 未知なる軸（新属性）</h3><div class="kw-list">${TRIBE_ORDER.filter(t => TRIBES[t].axis).map(t => `<div><b>${TRIBES[t].icon}${TRIBES[t].name}</b>${TRIBES[t].desc}</div>`).join('')}<div><b>⏳カウント</b>${STATUS_INFO.count.replace('カウント：', '')}</div><div><b>⚡アタック前</b>${STATUS_INFO.preAttack.replace('アタック前：', '')}</div><div><b>♥HPコスト</b>${STATUS_INFO.hpCost.replace('HPコスト：', '')}</div><div><b>🗺️陣</b>${STATUS_INFO.tile.replace('陣：', '')}</div></div></section>
        <section><h3>📚 キーワード</h3><div class="kw-list">${Object.values(KW).map(k => `<div><b>${k.icon}${k.name}</b>${k.desc}</div>`).join('')}<div><b>🔥炎上</b>${STATUS_INFO.burn.replace('炎上：', '')}</div><div><b>❄️凍結</b>${STATUS_INFO.frozen.replace('凍結：', '')}</div></div></section>
      </div>
      <button class="btn" type="button" data-close>OK！</button>`, { cls: 'wide' }).querySelector('[data-close]').addEventListener('click', () => Modal.close());
  },

  /* ---------- ステージ選択 ---------- */
  stages(worldId) {
    const r = $('#scr-stages');
    const next = STAGES[Meta.nextStage()];
    const wid = worldId || this._world || next.world;
    this._world = wid;
    const w = WORLDS.find(x => x.id === wid);
    const unlockedWorld = id => { const first = WORLDS.find(x => x.id === id).stages[0].id; return Meta.stageUnlocked(first); };
    const wStars = w.stages.reduce((a, s) => a + Meta.stageStars(s.id), 0);
    const road = Meta.starRoad();
    const total = Meta.totalStars();
    r.innerHTML = `
      ${topbar('ストーリー')}
      <div class="scroll">
        <div class="world-tabs">${WORLDS.map(x => `<button type="button" class="wt ${x.id === wid ? 'on' : ''} ${unlockedWorld(x.id) ? '' : 'locked'}" data-w="${x.id}" style="--wc:${x.color}"><span>${unlockedWorld(x.id) ? x.emoji : '🔒'}</span>W${x.id}</button>`).join('')}</div>
        <div class="world-head" style="--wc:${w.color}"><div class="wh-emoji">${w.emoji}</div><div><div class="wh-name">WORLD ${w.id}　${esc(w.name)}${w.axis ? '<span class="axis-tag">NEW AXIS</span>' : ''}</div><div class="wh-stars">★ ${wStars} / ${w.stages.length * 3}</div></div></div>
        <div class="stage-path">${w.stages.map((s, i) => {
          const un = Meta.stageUnlocked(s.id), st = Meta.stageStars(s.id), m = Meta.stageMask(s.id);
          return `<button type="button" class="node ${s.boss ? 'boss' : ''} ${un ? '' : 'locked'} ${m ? 'clear' : ''} ${un && !m ? 'next' : ''}" data-s="${s.id}" style="--wc:${w.color}; --i:${i}">
            <span class="node-ava">${un ? s.avatar : '🔒'}</span>
            <span class="node-info"><span class="node-id">${s.id}${s.boss ? ' BOSS' : ''}</span><span class="node-name">${un ? esc(s.name) : '？？？'}</span><span class="node-stars">${[0, 1, 2].map(k => `<i class="${(m >> k) & 1 ? 'on' : ''}">★</i>`).join('')}</span></span>
            ${un && !m ? '<span class="node-go">GO!</span>' : ''}
          </button>`;
        }).join('')}</div>
        <div class="star-road">
          <h3>★ スターロード <small>合計 ${total}★</small></h3>
          <div class="sr-track">${road.map(m => `<button type="button" class="sr-item ${m.reached ? 'reached' : ''} ${m.claimed ? 'claimed' : ''}" data-sr="${m.i}"><span class="sr-need">★${m.stars}</span><span class="sr-rw">${rewardChips(m.reward)}</span><span class="sr-state">${m.claimed ? '受取済' : m.reached ? '受け取る!' : `あと${m.stars - total}`}</span></button>`).join('')}</div>
        </div>
      </div>`;
    bindBack(r);
    $$('.wt', r).forEach(b => b.addEventListener('click', () => {
      if (b.classList.contains('locked')) {
        Sound.play('error');
        const first = WORLDS.find(x => x.id === +b.dataset.w).stages[0];
        FX.toast(first.unlockAfter ? `ステージ${first.unlockAfter}をクリアすると解放！` : '前のワールドのボスを倒すと解放！');
        return;
      }
      Sound.play('tap'); UI.stages(+b.dataset.w);
    }));
    $$('.node', r).forEach(b => b.addEventListener('click', () => {
      if (b.classList.contains('locked')) { Sound.play('error'); FX.toast('前のステージをクリアすると解放！'); return; }
      Sound.play('select'); UI.stageDetail(b.dataset.s);
    }));
    $$('.sr-item.reached:not(.claimed)', r).forEach(b => b.addEventListener('click', async () => {
      const rw = Meta.claimStar(+b.dataset.sr);
      if (rw) { celebrate('スターロード報酬!', Meta.rewardText(rw)); UI.stages(wid); }
    }));
    Sound.bgm('home');
  },

  stageDetail(id) {
    const s = STAGES[id], m = Meta.stageMask(id);
    const p = s.passive ? PASSIVES[s.passive] : null;
    const conds = ['勝利する', 'HP50%以上で勝利', `${s.turns}ラウンド以内に勝利`];
    const box = Modal.open(`
      <div class="sd-head ${s.boss ? 'boss' : ''}">
        <div class="sd-ava">${s.avatar}</div>
        <div><div class="sd-id">STAGE ${s.id}${s.boss ? ' ・ BOSS' : ''}</div><div class="sd-name">${esc(s.name)}</div><div class="sd-quote">「${esc(s.quote)}」</div></div>
      </div>
      <div class="sd-row"><span>HP</span><b>${s.hp}</b></div>
      <div class="sd-row"><span>使う属性</span><b>${s.tribes.map(t => TRIBES[t].icon + TRIBES[t].name).join(' ')}</b></div>
      ${s.field ? `<div class="sd-row"><span>初期フィールド</span><b>${CARDS[s.field].emoji}${CARDS[s.field].name}</b></div>` : ''}
      ${p ? `<div class="sd-passive">⚠ <b>${esc(p.name)}</b>：${esc(p.text)}</div>` : ''}
      <div class="sd-conds">${conds.map((c, i) => `<div class="${(m >> i) & 1 ? 'done' : ''}"><i>★</i>${c}</div>`).join('')}</div>
      <div class="sd-rw">報酬：🪙${60 + s.level * 15}〜 ${m ? '' : `<em>初回クリア 🪙+${150 + s.level * 30} ${s.boss ? '💎×1' : s.level >= 1 ? '🎫×1' : ''}</em>`}</div>
      <div class="sd-btns"><button class="btn ghost" type="button" data-a="deck">デッキ</button><button class="btn big hot" type="button" data-a="go">⚔ バトル開始!</button></div>`, { cls: 'stage-modal' });
    box.addEventListener('click', ev => {
      const a = ev.target.closest('[data-a]');
      if (!a) return;
      if (a.dataset.a === 'go') { Modal.close(); Game.startStage(id); }
      if (a.dataset.a === 'deck') { Modal.close(); Screens.show('deck'); }
    });
  },

  /* ---------- ボスラッシュ ---------- */
  rush() {
    const r = $('#scr-rush');
    const n = Meta.rushDefeated(), rs = Meta.save.rush;
    r.innerHTML = `
      ${topbar('BOSS RUSH')}
      <div class="scroll rush-scroll">
        <div class="rush-hero">
          <div class="rh-title" data-text="BOSS RUSH">BOSS RUSH</div>
          <div class="rh-sub">ストーリーとは別次元の、20体の凶悪ボス。<br>専用の<b class="ex">EXカード</b>・<b>必殺技</b>・<b>覚醒</b>を使ってくる。勝てたら奇跡。</div>
          <div class="rh-prog"><span>撃破</span><div class="rh-bar"><i style="width:${n / BOSS_LIST.length * 100}%"></i></div><b>${n}<small>/${BOSS_LIST.length}</small></b></div>
          <div class="rh-note">⚠ ボスラッシュではあなたのHPが<b>${RUSH_PLAYER_HP}</b>になる ・ 負けても削ったぶんコインがもらえる</div>
        </div>
        ${BOSS_TIERS.map(t => {
          const open = Meta.rushTierOpen(t.tier);
          const bosses = BOSS_LIST.filter(b => b.tier === t.tier);
          const cleared = bosses.filter(b => Meta.rushWins(b.id)).length;
          return `<section class="rush-tier ${open ? '' : 'locked'}" style="--tc:${t.color}">
            <h3><span class="rt-name">${t.name}</span><span class="rt-sub">${t.sub}</span>${dangerHTML(t.tier)}<span class="rt-cnt">${cleared}/5</span></h3>
            ${open ? '' : `<div class="rt-lock">🔒 ${BOSS_TIERS[t.tier - 2].name}のボスを1体倒すと解放</div>`}
            <div class="rush-grid">${bosses.map(b => {
              const w = Meta.rushWins(b.id), best = rs.best[b.id] || 0, tries = rs.tries[b.id] || 0;
              const st = w ? `<span class="rb-st win">撃破 ×${w}</span>` : tries ? `<span class="rb-st">ベスト ${best}%</span>` : '<span class="rb-st new">未挑戦</span>';
              return `<button type="button" class="rboss ${w ? 'beaten' : ''} ${b.no % 5 === 0 ? 'gate' : ''} ${b.no === 20 ? 'final' : ''}" data-b="${b.id}" style="--bc:${b.color}">
                ${b.no % 5 === 0 ? `<span class="rb-gate">${b.no === 20 ? '👑 LAST BOSS' : '階層ボス'}</span>` : ''}
                <span class="rb-no">No.${String(b.no).padStart(2, '0')}</span>
                <span class="rb-ava">${open ? b.avatar : '？'}</span>
                <span class="rb-title">${open ? esc(b.title) : '？？？'}</span>
                <span class="rb-name">${open ? esc(b.name) : '？？？'}</span>
                <span class="rb-hp">HP ${open ? fmt(rushConfig(b.id).hp) : '???'}</span>
                ${open ? st : ''}
                ${!w && tries ? `<span class="rb-best"><i style="width:${best}%"></i></span>` : ''}
                ${w ? '<span class="rb-stamp">撃破</span>' : ''}
              </button>`;
            }).join('')}</div>
          </section>`;
        }).join('')}
        <div class="rush-all ${rs.allClear ? 'done' : ''}">
          <div class="ra-t">👑 全20体撃破ボーナス</div>
          <div class="ra-rw">${rewardChips(Meta.RUSH_ALL_REWARD)}</div>
          <div class="ra-s">${rs.allClear ? '達成済み！ あなたこそ真のドーパミン神' : `あと ${BOSS_LIST.length - n} 体`}</div>
        </div>
      </div>`;
    bindBack(r);
    $$('.rboss', r).forEach(b => b.addEventListener('click', () => {
      const boss = BOSSES[b.dataset.b];
      if (!Meta.rushTierOpen(boss.tier)) { Sound.play('error'); FX.toast(`${BOSS_TIERS[boss.tier - 2].name}のボスを1体倒すと解放！`); return; }
      Sound.play('select'); UI.bossDetail(boss.id);
    }));
    Sound.bgm('rush');
  },

  bossDetail(id) {
    const b = BOSSES[id], cfg = rushConfig(id), rs = Meta.save.rush;
    const w = Meta.rushWins(id), best = rs.best[id] || 0;
    const first = Meta.rushFirstReward(b);
    const box = Modal.open(`
      <div class="bd-head" style="--bc:${b.color}">
        <div class="bd-no">BOSS No.${String(b.no).padStart(2, '0')} ・ ${BOSS_TIERS[b.tier - 1].name}</div>
        <div class="bd-ava">${b.avatar}</div>
        <div class="bd-title">${esc(b.title)}</div>
        <div class="bd-name">${esc(b.name)}</div>
        <div class="bd-quote">「${esc(b.quote)}」</div>
        <div class="bd-stats"><span>HP <b>${fmt(cfg.hp)}</b></span><span>危険度 ${dangerHTML(b.tier)}</span><span>使う属性 ${b.tribes.map(t => TRIBES[t].icon).join('')}</span></div>
      </div>
      <div class="bd-abil">
        <div class="ba pas"><span class="ba-k">常時</span><b>${esc(b.passive.name)}</b><p>${esc(b.passive.text)}</p></div>
        <div class="ba ult"><span class="ba-k">必殺 ${b.ult.first && b.ult.first !== b.ult.every ? `${b.ult.first}ターン目→以後${b.ult.every}ターンごと` : `${b.ult.every}ターンごと`}</span><b>${esc(b.ult.name)}</b><p>${esc(b.ult.text)}</p></div>
        ${b.phases.map(ph => `<div class="ba awk"><span class="ba-k">覚醒 HP${Math.round(ph.at * 100)}%以下</span><b>${esc(ph.name)}</b><p>${esc(ph.text)}</p></div>`).join('')}
      </div>
      <div class="bd-cards-h">専用 <b class="ex">EXカード</b>（ボスだけが使う）</div>
      <div class="bd-cards"></div>
      <div class="bd-rec">${w ? `<span class="win">撃破 ${w}回 ・ 最速 ${rs.fastest[id]}R</span>` : `<span>挑戦 ${rs.tries[id] || 0}回 ・ ベスト ${best}%</span>`}</div>
      <div class="sd-rw">${w ? `勝利報酬：🪙${250 + b.no * 25}〜` : `<em>初撃破 ${rewardChips(first)}</em>`}</div>
      <div class="sd-btns"><button class="btn ghost" type="button" data-a="deck">デッキ</button><button class="btn big hot rush-go" type="button" data-a="go">☠ 挑む!</button></div>`, { cls: 'boss-modal' });
    const cw = $('.bd-cards', box);
    b.cards.forEach(cid => {
      const c = cardEl(CARDS[cid], { text: true, cls: 'bd-card' });
      onLongPress(c, () => Preview.show(CARDS[cid]));
      c.addEventListener('click', () => Preview.show(CARDS[cid]));
      cw.appendChild(c);
    });
    box.addEventListener('click', ev => {
      const a = ev.target.closest('[data-a]');
      if (!a) return;
      if (a.dataset.a === 'go') { Modal.close(); Game.startRush(id); }
      if (a.dataset.a === 'deck') { Modal.close(); Screens.show('deck'); }
    });
  },

  /* ---------- ガチャ ---------- */
  gacha() {
    const s = Meta.save, r = $('#scr-gacha'), g = s.gacha;
    const pityLeft = Meta.PITY_MAX - s.pity;
    const col = Meta.collectionRate();
    const free = Meta.freeGachaReady();
    const focus = g.focus;
    const focusOwned = focus ? COLLECTIBLE.filter(c => c.tribe === focus) : null;
    r.innerHTML = `
      ${topbar('ガチャ')}
      <div class="scroll">
        <div class="g-hero">
          <div class="g-pack-art"><div class="pack mini"><div class="pack-logo">DOPA<br>BURST</div></div><div class="pack mini prem"><div class="pack-logo">PREMIUM</div></div></div>
          <div class="g-copy"><b>1パック5枚入り！</b>5枚目はR以上確定</div>
        </div>
        ${free ? `<button type="button" class="g-free" data-t="free"><span class="gf-ic">🎁</span><span class="gf-t"><b>本日の無料ガチャ</b><small>ノーマルパック×1・毎日0時に復活</small></span><span class="gf-go">引く!</span></button>` : `<div class="g-free done">🎁 本日の無料ガチャは受け取り済み・また明日！</div>`}
        <div class="pity">
          <div class="pity-t">SSR以上確定まで あと <b>${pityLeft}</b> 枚</div>
          <div class="pity-bar"><i style="width:${s.pity / Meta.PITY_MAX * 100}%"></i></div>
        </div>
        <div class="g-focus">
          <div class="gfo-h">🎯 ピックアップ属性 <small>選んだ属性のカードが<b>${Meta.FOCUS_RATE}倍</b>出やすい（レア度の確率は同じ）</small></div>
          <div class="gfo-row">
            <button type="button" data-f="" class="${!focus ? 'on' : ''}">なし</button>
            ${TRIBE_ORDER.map(t => `<button type="button" data-f="${t}" class="${focus === t ? 'on' : ''}" style="--tc:${TRIBES[t].color}">${TRIBES[t].icon}${TRIBES[t].name}</button>`).join('')}
          </div>
          ${focus ? `<div class="gfo-info">${TRIBES[focus].icon}${TRIBES[focus].name}：所持 <b>${focusOwned.filter(c => Meta.owned(c.id)).length}</b> / ${focusOwned.length}種</div>` : ''}
        </div>
        <div class="g-buttons">
          <button type="button" class="g-btn" data-t="n1">
            <span class="g-name">ノーマルパック ×1</span>
            <span class="g-cost">${s.tickets ? '🎫 1枚' : '🪙 100'}</span>
          </button>
          <button type="button" class="g-btn multi" data-t="n5">
            <span class="g-name">ノーマルパック ×5 <em>10%OFF</em></span>
            <span class="g-cost">🪙 450</span>
          </button>
          ${s.tickets >= 2 ? `<button type="button" class="g-btn multi bulk" data-t="nt">
            <span class="g-name">🎫チケットまとめて使う ×${Math.min(10, s.tickets)}</span>
            <span class="g-cost">🎫 ${Math.min(10, s.tickets)}枚</span>
          </button>` : ''}
          <button type="button" class="g-btn prem" data-t="p1">
            <span class="g-name">プレミアムパック <em>SR以上1枚確定!</em></span>
            <span class="g-cost">${s.premium ? '💎 1枚' : '🪙 300'}</span>
          </button>
          ${s.premium >= 2 ? `<button type="button" class="g-btn prem bulk" data-t="pp">
            <span class="g-name">💎ダイヤまとめて使う ×${Math.min(10, s.premium)}</span>
            <span class="g-cost">💎 ${Math.min(10, s.premium)}個</span>
          </button>` : ''}
        </div>
        <label class="g-fast"><input type="checkbox" ${Settings.gachaFast ? 'checked' : ''}><span>⚡ 演出スキップ（結果だけすぐ見る。SSR以上は光って教えてくれる）</span></label>
        <div class="g-col">📖 図鑑 <b>${col.got}</b> / ${col.total}（${col.pct}%）・ 未所持のカードは<b>1.6倍</b>出やすい</div>
        <div class="g-links">
          <button class="rates-btn" type="button" data-a="rates">📊 提供割合</button>
          <button class="rates-btn" type="button" data-a="log">📜 ガチャ履歴</button>
        </div>
        <button class="shop-link" type="button" data-go-shop>🛒 欲しいカードが決まっているなら<b>交換所</b>へ（コインで確定入手）</button>
      </div>`;
    bindBack(r);
    $$('[data-t]', r).forEach(b => b.addEventListener('click', () => this.buyPack(b.dataset.t)));
    const onChip = $('.gfo-row .on', r);
    if (onChip) onChip.parentNode.scrollLeft = Math.max(0, onChip.offsetLeft - 60);
    $$('.gfo-row [data-f]', r).forEach(b => b.addEventListener('click', () => {
      Sound.play('tap');
      g.focus = b.dataset.f || null; Meta.persist();
      const y = $('.scroll', r).scrollTop, x = $('.gfo-row', r).scrollLeft;
      UI.gacha();
      $('.scroll', r).scrollTop = y; $('.gfo-row', r).scrollLeft = x;
    }));
    $('.g-fast input', r).addEventListener('change', ev => { Settings.gachaFast = ev.target.checked; Meta.saveSettings(); Sound.play('tap'); });
    $('[data-go-shop]', r).addEventListener('click', () => { Sound.play('select'); Screens.show('shop'); });
    $('[data-a="rates"]', r).addEventListener('click', () => {
      const row = t => Object.entries(t).map(([k, v]) => `<span style="color:${RARITY[k].color}">${k} ${v}%</span>`).join(' ');
      Modal.open(`<h2>提供割合</h2>
        <div class="rates"><h3>ノーマル（1〜4枚目）</h3><p>${row(Meta.GACHA.normal.slots[0])}</p><h3>ノーマル（5枚目）</h3><p>${row(Meta.GACHA.normal.slots[4])}</p>
        <h3>プレミアム（1〜4枚目）</h3><p>${row(Meta.GACHA.premium.slots[0])}</p><h3>プレミアム（5枚目）</h3><p>${row(Meta.GACHA.premium.slots[4])}</p>
        <p class="small">${Meta.PITY_MAX}枚以内にSSR以上が出なければ次は必ずSSR以上（天井）。同じレア度の中では、未所持のカードは1.6倍、ピックアップ属性のカードは${Meta.FOCUS_RATE}倍出やすい。上限（URは1枚・他は3枚）を超えたダブりはコインに変換されます。</p></div>
        <button class="btn" type="button" data-close>閉じる</button>`).querySelector('[data-close]').addEventListener('click', () => Modal.close());
    });
    $('[data-a="log"]', r).addEventListener('click', () => UI.gachaLog());
    Sound.bgm('home');
  },
  gachaLog() {
    const log = Meta.save.gacha.log;
    const box = Modal.open(`<h2>📜 ガチャ履歴</h2>
      <div class="glog">${log.length ? log.map(e => {
        const d = new Date(e.t);
        const ids = e.ids.slice().sort((a, b) => RARITY[CARDS[b].rarity].rank - RARITY[CARDS[a].rarity].rank);
        return `<div class="gl-row"><div class="gl-h">${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ・ ${e.type === 'premium' ? 'プレミアム' : 'ノーマル'} ${e.ids.length / 5}パック</div>
          <div class="gl-cards">${ids.map(id => `<span class="gl-c r-${CARDS[id].rarity}" style="--rc:${RARITY[CARDS[id].rarity].color}" data-id="${id}">${CARDS[id].emoji}<i>${CARDS[id].rarity}</i></span>`).join('')}</div></div>`;
      }).join('') : '<p class="small">まだガチャを引いていないよ</p>'}</div>
      <button class="btn" type="button" data-close>閉じる</button>`, { cls: 'glog-m' });
    box.addEventListener('click', ev => {
      const c = ev.target.closest('[data-id]');
      if (c) { Preview.show(CARDS[c.dataset.id]); return; }
      if (ev.target.closest('[data-close]')) Modal.close();
    });
  },
  buyPack(t) {
    const s = Meta.save;
    // まとめ引きの「もう1回」で残りがなければ、ふつうの1回に切り替える
    if (t === 'nt' && s.tickets < 1) t = 'n1';
    if (t === 'pp' && s.premium < 1) t = 'p1';
    let cost, type = 'normal', packs = 1;
    if (t === 'free') {
      if (!Meta.useFreeGacha()) { Sound.play('error'); return; }
      cost = null;
    } else if (t === 'n1') cost = s.tickets ? { kind: 'tickets', n: 1 } : { kind: 'coins', n: 100 };
    else if (t === 'n5') { cost = { kind: 'coins', n: 450 }; packs = 5; }
    else if (t === 'nt') { packs = Math.min(10, s.tickets); cost = { kind: 'tickets', n: packs }; }
    else if (t === 'pp') { packs = Math.min(10, s.premium); cost = { kind: 'premium', n: packs }; type = 'premium'; }
    else { cost = s.premium ? { kind: 'premium', n: 1 } : { kind: 'coins', n: 300 }; type = 'premium'; }
    if (cost && (cost.n <= 0 || !Meta.pay(cost))) {
      Sound.play('error');
      FX.toast(cost.kind === 'coins' ? `コインが足りない！（あと🪙${cost.n - s.coins}）バトルで稼ごう！` : cost.kind === 'premium' ? 'ダイヤが足りない！' : 'チケットが足りない！');
      return;
    }
    Sound.play('select');
    const results = [];
    for (let i = 0; i < packs; i++) results.push(Meta.pullPack(type));
    Meta.logGacha(type, results);
    // 「もう1回」は同じ種類で（無料は通常の1回に、まとめ引きは残りの数で）
    const again = t === 'free' ? 'n1' : t;
    Gacha.open(results, type, () => { Screens.show('gacha'); }, again);
  },

  /* ---------- デッキ ---------- */
  deck() {
    const r = $('#scr-deck');
    if (!this._deckWork || this._deckWorkFresh !== true) this._deckWork = Meta.save.deck.slice();
    this._deckWorkFresh = true;
    this._deckFilter = this._deckFilter || 'all';
    r.innerHTML = `
      <header class="topbar"><button class="back" type="button" aria-label="戻る">‹</button><h2>デッキ編成</h2><div class="deck-count"><b>0</b>/20</div></header>
      <div class="deck-wrap">
        <div class="deck-side">
          <div class="deck-tools"><button class="btn small" type="button" data-a="auto">✨ おまかせ</button><button class="btn small ghost" type="button" data-a="clear">空にする</button><button class="btn small hot" type="button" data-a="save">保存</button></div>
          <div class="curve"></div>
          <div class="deck-list"></div>
        </div>
        <div class="coll-side">
          <div class="filter-tabs">${['all', ...TRIBE_ORDER].map(t => `<button type="button" data-f="${t}" class="${this._deckFilter === t ? 'on' : ''}">${t === 'all' ? 'すべて' : TRIBES[t].icon + TRIBES[t].name}</button>`).join('')}</div>
          <p class="coll-hint">タップで追加 ・ 長押しで詳細</p>
          <div class="coll-grid"></div>
        </div>
      </div>`;
    $('.back', r).addEventListener('click', () => this.leaveDeck());
    $$('[data-f]', r).forEach(b => b.addEventListener('click', () => { this._deckFilter = b.dataset.f; Sound.play('tap'); $$('[data-f]', r).forEach(x => x.classList.toggle('on', x === b)); this.renderColl(); }));
    $('[data-a="auto"]', r).addEventListener('click', () => {
      const f = this._deckFilter !== 'all' && this._deckFilter !== 'neutral' ? this._deckFilter : null;
      this._deckWork = Meta.autoDeck(f);
      Sound.play('merge'); FX.toast(f ? `${TRIBES[f].name}中心で組んだよ！` : '一番強そうな組み合わせで組んだよ！');
      this.renderDeck(); this.renderColl();
    });
    $('[data-a="clear"]', r).addEventListener('click', () => { this._deckWork = []; Sound.play('cancel'); this.renderDeck(); this.renderColl(); });
    $('[data-a="save"]', r).addEventListener('click', () => this.saveDeck());
    this.renderDeck(); this.renderColl();
    Meta.save.newCards = [];
    Meta.persist();
  },
  saveDeck(thenLeave) {
    const d = this._deckWork;
    if (!Meta.validDeck(d)) { Sound.play('error'); FX.toast(`デッキはちょうど20枚にしてね（今${d.length}枚）`); return false; }
    Meta.save.deck = d.slice(); Meta.persist();
    this._deckWorkFresh = false;
    Sound.play('claim'); FX.toast('デッキを保存した！', { cls: 'gold' });
    if (thenLeave !== false) Screens.show('home');
    return true;
  },
  leaveDeck() {
    const d = this._deckWork, saved = Meta.save.deck;
    const changed = d.length !== saved.length || d.slice().sort().join() !== saved.slice().sort().join();
    if (!changed) { this._deckWorkFresh = false; Sound.play('cancel'); Screens.show('home'); return; }
    const box = Modal.open(`<h2>変更を保存する？</h2><div class="menu-col"><button class="btn hot" type="button" data-a="s">保存して戻る</button><button class="btn ghost" type="button" data-a="d">保存せずに戻る</button><button class="btn ghost" type="button" data-a="c">編成を続ける</button></div>`);
    box.addEventListener('click', ev => {
      const a = ev.target.closest('[data-a]'); if (!a) return;
      Modal.close();
      if (a.dataset.a === 's') this.saveDeck();
      if (a.dataset.a === 'd') { this._deckWorkFresh = false; Screens.show('home'); }
    });
  },
  renderDeck() {
    const r = $('#scr-deck'), d = this._deckWork;
    $('.deck-count', r).innerHTML = `<b class="${d.length === 20 ? 'ok' : ''}">${d.length}</b>/20`;
    const buckets = [0, 0, 0, 0, 0, 0, 0];
    d.forEach(id => { buckets[Math.min(6, CARDS[id].cost)]++; });
    const mx = Math.max(4, ...buckets);
    $('.curve', r).innerHTML = buckets.map((n, i) => `<div class="cv"><i style="height:${n / mx * 100}%"></i><b>${n || ''}</b><span>${i === 6 ? '6+' : i}</span></div>`).join('');
    const cnt = {};
    d.forEach(id => (cnt[id] = (cnt[id] || 0) + 1));
    const ids = Object.keys(cnt).sort((a, b) => CARDS[a].cost - CARDS[b].cost || a.localeCompare(b));
    const list = $('.deck-list', r);
    list.innerHTML = ids.length ? ids.map(id => {
      const c = CARDS[id];
      return `<button type="button" class="dl-row r-${c.rarity}" data-id="${id}" style="--tc:${TRIBES[c.tribe].color};--rc:${RARITY[c.rarity].color}"><span class="dl-cost">${c.cost}</span><span class="dl-emo">${c.emoji}</span><span class="dl-name">${esc(c.name)}</span><span class="dl-n">×${cnt[id]}</span></button>`;
    }).join('') : '<p class="empty">下のカードをタップして追加しよう</p>';
    $$('.dl-row', list).forEach(b => {
      b.addEventListener('click', () => { const i = this._deckWork.indexOf(b.dataset.id); if (i >= 0) this._deckWork.splice(i, 1); Sound.play('cancel'); this.renderDeck(); this.renderColl(); });
      onLongPress(b, () => Preview.show(CARDS[b.dataset.id]));
    });
  },
  renderColl() {
    const r = $('#scr-deck'), f = this._deckFilter;
    const grid = $('.coll-grid', r);
    const list = COLLECTIBLE.filter(c => Meta.owned(c.id) > 0 && (f === 'all' || c.tribe === f))
      .sort((a, b) => a.cost - b.cost || RARITY[b.rarity].rank - RARITY[a.rarity].rank);
    grid.innerHTML = '';
    if (!list.length) { grid.innerHTML = '<p class="empty">この属性のカードはまだ持っていない。ガチャで集めよう！</p>'; return; }
    for (const c of list) {
      const inDeck = this._deckWork.filter(x => x === c.id).length;
      const max = Math.min(Meta.owned(c.id), MAXCOPY(c.rarity));
      const e = cardEl(c, { cls: 'gcard' + (inDeck >= max ? ' maxed' : '') });
      e.appendChild(el('div', 'own-badge', `${inDeck}/${max}`));
      if (Meta.save.newCards.includes(c.id)) e.appendChild(el('div', 'card-new', 'NEW'));
      e.addEventListener('click', () => {
        if (this._lp && this._lp()) return;
        const now = this._deckWork.filter(x => x === c.id).length;
        if (this._deckWork.length >= 20) { Sound.play('error'); FX.toast('20枚までだよ！ 上のリストから外してね'); return; }
        if (now >= max) { Sound.play('error'); FX.toast(c.rarity === 'UR' ? 'URは1枚まで！' : now >= Meta.owned(c.id) ? 'これ以上持っていない！' : '同じカードは3枚まで！'); return; }
        this._deckWork.push(c.id);
        Sound.play('buff');
        animate(e, [{ transform: 'scale(1)' }, { transform: 'scale(.9)' }, { transform: 'scale(1)' }], { duration: 160, realtime: true });
        this.renderDeck();
        const b = e.querySelector('.own-badge'); b.textContent = `${now + 1}/${max}`;
        e.classList.toggle('maxed', now + 1 >= max);
      });
      const lp = onLongPress(e, () => Preview.show(c));
      this._lp = lp;
      e.addEventListener('pointerdown', () => { this._lp = lp; });
      grid.appendChild(e);
    }
  },

  /* ---------- 交換所 ---------- */
  shop() {
    const r = $('#scr-shop');
    const keep = $('.scroll', r) ? $('.scroll', r).scrollTop : 0;
    this._shopR = this._shopR || 'all';
    this._shopT = this._shopT || 'all';
    r.innerHTML = `
      ${topbar('カード交換所')}
      <div class="scroll">
        <div class="shop-head">
          <div class="shop-title">🛒 コインで好きなカードと交換！</div>
          <div class="shop-prices">${RARITY_ORDER.map(k => `<span style="--rc:${RARITY[k].color}"><b>${k}</b>🪙${fmt(Meta.SHOP_PRICE[k])}</span>`).join('')}</div>
          <p class="shop-note">同じカードは3枚（URは1枚）まで。ガチャのダブりは自動でコインになるよ。</p>
        </div>
        <div class="filter-tabs" data-row="r">${['all', ...RARITY_ORDER].map(k => `<button type="button" data-r="${k}" class="${this._shopR === k ? 'on' : ''}">${k === 'all' ? '全レア' : k}</button>`).join('')}</div>
        <div class="filter-tabs" data-row="t">${['all', ...TRIBE_ORDER].map(t => `<button type="button" data-t="${t}" class="${this._shopT === t ? 'on' : ''}">${t === 'all' ? '全属性' : TRIBES[t].icon + TRIBES[t].name}</button>`).join('')}</div>
        <label class="shop-only" for="shop-only"><input id="shop-only" type="checkbox" ${this._shopOnly ? 'checked' : ''}> 未所持だけ表示</label>
        <div class="shop-grid"></div>
      </div>`;
    bindBack(r);
    $$('[data-r]', r).forEach(b => b.addEventListener('click', () => { this._shopR = b.dataset.r; Sound.play('tap'); this.shop(); }));
    $$('[data-t]', r).forEach(b => b.addEventListener('click', () => { this._shopT = b.dataset.t; Sound.play('tap'); this.shop(); }));
    $('#shop-only', r).addEventListener('change', e => { this._shopOnly = e.target.checked; this.shop(); });
    const grid = $('.shop-grid', r);
    const list = COLLECTIBLE.filter(c => (this._shopR === 'all' || c.rarity === this._shopR) && (this._shopT === 'all' || c.tribe === this._shopT) && (!this._shopOnly || !Meta.owned(c.id)))
      .sort((a, b) => RARITY[b.rarity].rank - RARITY[a.rarity].rank || TRIBE_ORDER.indexOf(a.tribe) - TRIBE_ORDER.indexOf(b.tribe) || a.cost - b.cost);
    if (!list.length) grid.innerHTML = '<p class="empty">条件に合うカードがないよ</p>';
    for (const c of list) {
      const st = Meta.shopState(c.id), own = Meta.owned(c.id);
      const item = el('div', 'shop-item' + (st.reason === 'max' ? ' maxed' : '') + (this._shopFocus === c.id ? ' focus' : ''));
      const card = cardEl(c, { cls: 'gcard' });
      card.appendChild(el('div', 'own-badge', `${own}/${MAXCOPY(c.rarity)}`));
      item.appendChild(card);
      const btn = el('button', 'shop-buy' + (st.reason === 'coins' ? ' poor' : ''), st.reason === 'max' ? '上限' : `🪙${fmt(st.price)}`);
      btn.type = 'button';
      if (st.reason === 'max') btn.disabled = true;
      item.appendChild(btn);
      const open = () => this.confirmBuy(c.id);
      btn.addEventListener('click', open);
      card.addEventListener('click', open);
      grid.appendChild(item);
    }
    $('.scroll', r).scrollTop = keep;
    const f = $('.shop-item.focus', r);
    if (f) { f.scrollIntoView({ block: 'center' }); this._shopFocus = null; }
  },
  confirmBuy(id) {
    const c = CARDS[id], st = Meta.shopState(id);
    Sound.play('tap');
    const box = Modal.open(`
      <div class="buy-card"></div>
      <div class="preview-info buy-info">${detailHTML(c)}</div>
      <div class="buy-own">所持 ${Meta.owned(id)} / ${MAXCOPY(c.rarity)}　・　手持ち 🪙${fmt(Meta.save.coins)}</div>
      <div class="menu-col">
        ${st.ok ? `<button class="btn big hot" type="button" data-a="buy">🪙${fmt(st.price)} で交換する</button>`
          : st.reason === 'max' ? '<button class="btn big" type="button" disabled>もう上限まで持っている</button>'
          : `<button class="btn big" type="button" disabled>コインが足りない（あと🪙${fmt(st.need)}）</button>`}
        <button class="btn ghost" type="button" data-a="close">やめる</button>
      </div>`, { cls: 'buy-modal' });
    $('.buy-card', box).appendChild(cardEl(c, { cls: 'big' }));
    box.addEventListener('click', async ev => {
      const a = ev.target.closest('[data-a]'); if (!a) return;
      Modal.close();
      if (a.dataset.a !== 'buy') return;
      const res = Meta.buyCard(id);
      if (!res) { Sound.play('error'); return; }
      const ctr = centerOf($('#scr-shop .chip.coin'));
      FX.coins(ctr.x, ctr.y, 12);
      if (RARITY[c.rarity].rank >= 3) await Gacha.bigReveal(c, res);
      else { Sound.play(RARITY[c.rarity].rank >= 1 ? 'rare' : 'claim', RARITY[c.rarity].rank); celebrate(`${c.emoji} GET!!`, `${c.name}${res.isNew ? '（NEW!）' : ''}`); }
      this.shop();
    });
  },

  /* ---------- 図鑑 ---------- */
  dex() {
    const r = $('#scr-dex');
    const col = Meta.collectionRate();
    r.innerHTML = `
      ${topbar('カード図鑑')}
      <div class="scroll">
        <div class="dex-top"><div class="dex-pct"><b>${col.pct}</b>%</div><div><div class="dex-t">コンプリート率 ${col.got} / ${col.total}</div><div class="pity-bar"><i style="width:${col.pct}%"></i></div></div></div>
        ${TRIBE_ORDER.map(t => {
          const cs = COLLECTIBLE.filter(c => c.tribe === t).sort((a, b) => RARITY[a.rarity].rank - RARITY[b.rarity].rank || a.cost - b.cost);
          const got = cs.filter(c => Meta.owned(c.id)).length;
          return `<section class="dex-sec" style="--tc:${TRIBES[t].color}"><h3>${TRIBES[t].icon} ${TRIBES[t].name} <small>${got}/${cs.length}${got === cs.length ? ' ✅COMPLETE' : ''}</small><span class="dex-desc">${TRIBES[t].desc}</span></h3><div class="dex-grid" data-t="${t}"></div></section>`;
        }).join('')}
      </div>`;
    bindBack(r);
    TRIBE_ORDER.forEach(t => {
      const g = $(`.dex-grid[data-t="${t}"]`, r);
      COLLECTIBLE.filter(c => c.tribe === t).sort((a, b) => RARITY[a.rarity].rank - RARITY[b.rarity].rank || a.cost - b.cost).forEach(c => {
        const own = Meta.owned(c.id);
        const e = cardEl(c, { cls: 'gcard', locked: !own, count: own || null, isNew: Meta.save.newCards.includes(c.id) });
        if (own) e.addEventListener('click', () => { Sound.play('tap'); Preview.show(c); });
        else e.addEventListener('click', () => {
          Sound.play('tap');
          const box = Modal.open(`<h2>まだ持っていないカード</h2><p>${TRIBES[c.tribe].icon}${TRIBES[c.tribe].name}の<b style="color:${RARITY[c.rarity].color}">${c.rarity}</b>カード。<br>ガチャで当てるか、交換所でコイン<b>🪙${fmt(Meta.SHOP_PRICE[c.rarity])}</b>と交換できます。</p><div class="menu-col"><button class="btn hot" type="button" data-a="shop">🛒 交換所で見る</button><button class="btn ghost" type="button" data-a="close">閉じる</button></div>`);
          box.addEventListener('click', ev => {
            const a = ev.target.closest('[data-a]'); if (!a) return;
            Modal.close();
            if (a.dataset.a === 'shop') { UI._shopR = c.rarity; UI._shopT = c.tribe; UI._shopFocus = c.id; Screens.show('shop'); }
          });
        });
        g.appendChild(e);
      });
    });
    Meta.save.newCards = []; Meta.persist();
  },

  /* ---------- ミッション ---------- */
  missions() {
    const r = $('#scr-missions'), s = Meta.save;
    Meta.missionsEnsure();
    const ms = s.missions.list;
    const allDone = ms.length && ms.every(m => m.claimed);
    r.innerHTML = `
      ${topbar('ミッション')}
      <div class="scroll">
        <section class="login-cal">
          <h3>📅 ログインボーナス <small>${s.login.day}日目</small></h3>
          <div class="lc-row">${LOGIN_REWARDS.map((rw, i) => `<div class="lc-day ${i < s.login.day ? 'got' : ''} ${i === s.login.day - 1 ? 'today' : ''} ${i === 6 ? 'big' : ''}"><span class="lc-n">${i + 1}日</span><span class="lc-rw">${rewardChips(rw)}</span>${i < s.login.day ? '<span class="lc-stamp">GET</span>' : ''}</div>`).join('')}</div>
        </section>
        <section class="mis">
          <h3>🎯 デイリーミッション <small>毎日0時に更新</small></h3>
          ${ms.map((m, i) => {
            const d = Meta.missionDef(m.id); if (!d) return '';
            const done = m.prog >= d.goal;
            return `<div class="mi ${m.claimed ? 'claimed' : done ? 'done' : ''}"><div class="mi-body"><div class="mi-t">${esc(d.text)}</div><div class="mi-bar"><i style="width:${Math.min(100, m.prog / d.goal * 100)}%"></i><span>${fmt(m.prog)} / ${fmt(d.goal)}</span></div></div><div class="mi-rw">${rewardChips(d.reward)}</div><button class="btn small ${done && !m.claimed ? 'hot' : 'ghost'}" type="button" data-i="${i}" ${done && !m.claimed ? '' : 'disabled'}>${m.claimed ? '済' : done ? '受け取る' : '挑戦中'}</button></div>`;
          }).join('')}
          <div class="mi bonus ${s.missions.bonus ? 'claimed' : allDone ? 'done' : ''}"><div class="mi-body"><div class="mi-t">🌟 全ミッション達成ボーナス</div></div><div class="mi-rw">${rewardChips({ tickets: 1, coins: 200 })}</div><button class="btn small ${allDone && !s.missions.bonus ? 'hot' : 'ghost'}" type="button" data-bonus ${allDone && !s.missions.bonus ? '' : 'disabled'}>${s.missions.bonus ? '済' : allDone ? '受け取る' : '未達成'}</button></div>
        </section>
        <section class="life">
          <h3>📈 これまでの記録</h3>
          <div class="life-grid">
            <div><span>勝利</span><b>${fmt(s.life.wins)}</b></div><div><span>バトル</span><b>${fmt(s.life.battles)}</b></div>
            <div><span>クリティカル</span><b>${fmt(s.life.crits)}</b></div><div><span>合体</span><b>${fmt(s.life.merges)}</b></div>
            <div><span>撃破</span><b>${fmt(s.life.kills)}</b></div><div><span>1ターン最高</span><b>${fmt(s.records.turnDamage)}</b></div>
            <div><span>最大コンボ</span><b>${fmt(s.records.combo)}</b></div><div><span>最高ランク</span><b>${rankOf(s.rank.best).name}</b></div>
          </div>
        </section>
      </div>`;
    bindBack(r);
    $$('[data-i]', r).forEach(b => b.addEventListener('click', async () => {
      const rw = Meta.claimMission(+b.dataset.i);
      if (rw) { const c = centerOf(b); FX.coins(c.x, c.y, 14); celebrate('ミッション達成!', Meta.rewardText(rw)); UI.missions(); }
    }));
    const bb = $('[data-bonus]', r);
    if (bb) bb.addEventListener('click', () => { const rw = Meta.claimBonus(); if (rw) { FX.confetti(120); celebrate('ALL CLEAR!!', Meta.rewardText(rw)); UI.missions(); } });
  },

  /* ---------- 設定 ---------- */
  settings() {
    const r = $('#scr-settings'), s = Meta.save;
    r.innerHTML = `
      ${topbar('設定・プロフィール')}
      <div class="scroll">
        <section class="set">
          <h3>プロフィール</h3>
          <label class="set-row" for="set-name"><span>名前</span><input id="set-name" maxlength="10" value="${esc(s.name)}"></label>
          <div class="set-row col"><span>アイコン <small>レベルで解放</small></span><div class="ava-pick">${AVATARS.map(([a, lv]) => `<button type="button" data-ava="${a}" class="${s.avatar === a ? 'on' : ''} ${s.level >= lv ? '' : 'locked'}">${s.level >= lv ? a : '🔒'}<small>Lv${lv}</small></button>`).join('')}</div></div>
        </section>
        <section class="set">
          <h3>サウンド・演出</h3>
          <label class="set-row" for="set-bgm"><span>BGM</span><input id="set-bgm" type="range" min="0" max="1" step="0.05" value="${Settings.bgm}"></label>
          <label class="set-row" for="set-sfx"><span>効果音</span><input id="set-sfx" type="range" min="0" max="1" step="0.05" value="${Settings.sfx}"></label>
          <div class="set-row"><span>演出スピード</span><div class="seg">${[1, 2, 3].map(v => `<button type="button" data-speed="${v}" class="${Settings.speed === v ? 'on' : ''}">x${v}</button>`).join('')}</div></div>
          <label class="set-row" for="set-auto"><span>オートターン終了 <small>出せるカードが無い時</small></span><input id="set-auto" type="checkbox" ${Settings.autoEnd ? 'checked' : ''}></label>
          <label class="set-row" for="set-pred"><span>攻撃予測を表示 <small>⚔の予想ダメージとHPバーの予測</small></span><input id="set-pred" type="checkbox" ${Settings.preview ? 'checked' : ''}></label>
          <label class="set-row" for="set-tips"><span>ルール解説 <small>はじめて起きたことを1行で説明</small></span><input id="set-tips" type="checkbox" ${Settings.tips ? 'checked' : ''}></label>
          <label class="set-row" for="set-hint"><span>自動ヒント <small>迷ったら💡おすすめを表示</small></span><input id="set-hint" type="checkbox" ${Settings.autoHint ? 'checked' : ''}></label>
          <div class="set-row"><span>ルール解説をもう一度見る</span><button class="btn small ghost" type="button" data-retips>リセット</button></div>
          <label class="set-row" for="set-red"><span>エフェクト控えめ <small>揺れ・フラッシュを抑える</small></span><input id="set-red" type="checkbox" ${Settings.reduced ? 'checked' : ''}></label>
          <label class="set-row" for="set-vib"><span>バイブレーション</span><input id="set-vib" type="checkbox" ${Settings.vibrate ? 'checked' : ''}></label>
        </section>
        <section class="set">
          <h3>データ</h3>
          <button class="btn danger" type="button" data-reset>セーブデータを消す</button>
        </section>
        <p class="credit">ドーパミンBURST! ・ 効果音とBGMはすべてブラウザで合成しています</p>
      </div>`;
    bindBack(r);
    $('#set-name', r).addEventListener('change', e => { s.name = e.target.value.trim() || 'あなた'; Meta.persist(); });
    $$('[data-ava]', r).forEach(b => b.addEventListener('click', () => {
      if (b.classList.contains('locked')) { Sound.play('error'); FX.toast('レベルを上げると解放！'); return; }
      s.avatar = b.dataset.ava; Meta.persist(); Sound.play('select');
      $$('[data-ava]', r).forEach(x => x.classList.toggle('on', x === b));
    }));
    $('#set-bgm', r).addEventListener('input', e => { Settings.bgm = +e.target.value; Settings.muted = false; Sound.setVolume('bgm', Settings.bgm); Game.saveSettings(); });
    $('#set-sfx', r).addEventListener('input', e => { Settings.sfx = +e.target.value; Settings.muted = false; Sound.setVolume('sfx', Settings.sfx); Game.saveSettings(); });
    $('#set-sfx', r).addEventListener('change', () => Sound.play('coin'));
    $$('[data-speed]', r).forEach(b => b.addEventListener('click', () => { Settings.speed = +b.dataset.speed; Time.speed = Settings.speed; Game.saveSettings(); Sound.play('tap'); $$('[data-speed]', r).forEach(x => x.classList.toggle('on', x === b)); }));
    $('#set-auto', r).addEventListener('change', e => { Settings.autoEnd = e.target.checked; Game.saveSettings(); });
    $('#set-red', r).addEventListener('change', e => { Settings.reduced = e.target.checked; Time.reduced = Settings.reduced; document.body.classList.toggle('reduced', Settings.reduced); Game.saveSettings(); });
    $('#set-vib', r).addEventListener('change', e => { Settings.vibrate = e.target.checked; Game.saveSettings(); });
    $('#set-pred', r).addEventListener('change', e => { Settings.preview = e.target.checked; Game.saveSettings(); });
    $('#set-tips', r).addEventListener('change', e => { Settings.tips = e.target.checked; Game.saveSettings(); });
    $('#set-hint', r).addEventListener('change', e => { Settings.autoHint = e.target.checked; Game.saveSettings(); });
    $('[data-retips]', r).addEventListener('click', () => { Meta.save.flags.tips = {}; Meta.persist(); Sound.play('select'); FX.toast('ルール解説をリセットしたよ。次のバトルでまた表示されます'); });
    $('[data-reset]', r).addEventListener('click', () => {
      const box = Modal.open(`<h2>本当に消す？</h2><p>カード・レベル・進行状況がすべて消えます。元に戻せません。</p><div class="menu-col"><button class="btn danger" type="button" data-a="y">消す</button><button class="btn ghost" type="button" data-a="n">やめる</button></div>`);
      box.addEventListener('click', ev => {
        const a = ev.target.closest('[data-a]'); if (!a) return;
        Modal.close();
        if (a.dataset.a === 'y') { Meta.reset(); FX.toast('データを消しました'); Screens.show('title'); }
      });
    });
  },

  /* ---------- リザルト ---------- */
  async results(res, out, cfg) {
    const s = Meta.save;
    const win = res.win;
    const st = res.stats;
    const isStage = cfg.mode === 'stage';
    const stage = isStage ? STAGES[cfg.stageId] : null;
    const idx = isStage ? STAGE_ORDER.indexOf(cfg.stageId) : -1;
    const nextId = isStage && win ? STAGE_ORDER[idx + 1] : null;
    const gap = res.enemyHp;
    const isRush = cfg.mode === 'rush', boss = isRush ? BOSSES[cfg.bossId] : null;
    let head;
    if (isRush) head = `<div class="rs-title ${win ? 'win' : 'lose'} rush">${win ? 'BOSS DEFEATED!!' : 'DEFEAT…'}</div>
      <div class="rs-boss" style="--bc:${boss.color}"><span class="rsb-ava">${boss.avatar}</span><div><div class="rsb-name">${esc(boss.name)}</div><div class="rsb-line">「${esc(win ? boss.lose : boss.win)}」</div></div></div>
      <div class="rs-dmg"><span>ボスに与えたダメージ</span><div class="rs-dbar"><i style="width:${out.pct}%"></i>${out.bestBefore && out.bestBefore < 100 ? `<em style="left:${out.bestBefore}%"></em>` : ''}</div><b>${out.pct}%</b>${out.newBest && !win ? '<span class="rs-nb">自己ベスト更新!</span>' : ''}</div>
      ${out.allClear ? `<div class="rs-allclear">👑 全20体撃破!! ${rewardChips(Meta.RUSH_ALL_REWARD)}</div>` : ''}`;
    else if (win) head = `<div class="rs-title win">VICTORY!!</div>`;
    else head = `<div class="rs-title lose">DEFEAT…</div>${!res.surrender && gap > 0 ? `<div class="rs-near">惜しい！ 相手のHPは残り <b>${gap}</b>！${gap <= 60 ? ' あと1発だった!!' : ''}</div>` : ''}`;
    const box = Modal.open(`
      ${head}
      ${isStage ? `<div class="rs-stars">${[0, 1, 2].map(i => `<i class="${win && out.stars[i] ? 'on' : ''}" data-k="${i}">★</i>`).join('')}</div><div class="rs-cond">${win ? ['クリア', 'HP50%以上', `${stage.turns}R以内`].map((c, i) => `<span class="${out.stars[i] ? 'ok' : ''}">${c}</span>`).join('') : ''}</div>` : ''}
      ${cfg.mode === 'rank' ? `<div class="rs-rank"></div>` : ''}
      <div class="rs-stats">
        <div><span>与ダメージ</span><b>${fmt(st.damageDealt)}</b></div>
        <div><span>最大コンボ</span><b>${st.maxCombo}</b></div>
        <div><span>1ターン最高</span><b>${fmt(st.maxTurnDamage)}</b></div>
        <div><span>クリティカル</span><b>${st.crits}</b></div>
        <div><span>撃破</span><b>${st.kills}</b></div>
        <div><span>合体</span><b>${st.merges}</b></div>
      </div>
      <div class="rs-rewards">
        <div class="rs-coin">🪙 <b class="rs-coin-n">0</b>${out.firstClear ? '<em>初回クリア!</em>' : ''}${out.firstWin ? '<em class="fw">本日初勝利 ×2!</em>' : ''}</div>
        ${out.bonus ? `<div class="rs-bonus">${rewardChips(out.bonus)} ゲット！</div>` : ''}
        <div class="rs-xp"><span class="rs-lv">Lv<b>${s.level - (out.levelUps || []).length}</b></span><div class="xpbar big"><i></i></div><span class="rs-xpn">+${out.xp} XP</span></div>
      </div>
      ${out.chance ? `<div class="rs-chance"><button class="btn big chance-btn" type="button" data-chance>🎰 ボーナスチャンス!</button><div class="wheel" hidden>${Meta.BONUS_WHEEL.map((w, i) => `<span data-w="${i}">${rewardChips(w)}</span>`).join('')}</div></div>` : ''}
      <div class="rs-btns">
        ${nextId ? `<button class="btn big hot" type="button" data-a="next">次のステージ ▶</button>` : ''}
        ${!win ? `<button class="btn big hot" type="button" data-a="retry">🔁 ${isRush ? '再挑戦!' : 'リベンジ!'}</button>` : ''}
        ${isRush ? `<button class="btn big ${win ? 'hot' : ''}" type="button" data-a="rushlist">☠ ボスラッシュへ</button>` : ''}
        ${cfg.mode === 'rank' ? `<button class="btn big ${win ? 'hot' : ''}" type="button" data-a="rank">🏆 もう1戦!</button>` : ''}
        ${win && isStage ? `<button class="btn ghost" type="button" data-a="retry">もう一回</button>` : ''}
        <button class="btn ghost" type="button" data-a="home">ホーム</button>
      </div>`, { cls: 'results ' + (win ? 'win' : 'lose'), dismiss: false, backCls: 'rs-back' });
    const cb = $('[data-chance]', box);
    if (cb) cb.addEventListener('click', async () => {
      cb.disabled = true; cb.textContent = '抽選中…';
      const wheel = $('.wheel', box); wheel.hidden = false;
      const cells = $$('span', wheel);
      const idx = Meta.spinBonus();
      const total = 18 + idx + cells.length;
      for (let s2 = 0; s2 <= total; s2++) {
        cells.forEach((c, k) => c.classList.toggle('on', k === s2 % cells.length));
        Sound.play('slotTick');
        await waitReal(40 + Math.pow(s2 / total, 3) * 280);
      }
      cells[idx].classList.add('win');
      const rw = Meta.BONUS_WHEEL[idx];
      Sound.play('jackpot');
      const c = centerOf(cells[idx]); FX.coins(c.x, c.y, 16);
      if (rw.premium) FX.react('大当たり!!', '#ffd23f');
      cb.textContent = `${Meta.rewardText(rw)} ゲット！`;
      celebrate('BONUS!!', Meta.rewardText(rw));
    });
    box.addEventListener('click', ev => {
      const a = ev.target.closest('[data-a]'); if (!a) return;
      Sound.play('select');
      Modal.closeAll();
      if (a.dataset.a === 'next') Game.startStage(nextId);
      else if (a.dataset.a === 'retry') { if (isRush) Game.startRush(cfg.bossId); else Game.startStage(cfg.stageId); }
      else if (a.dataset.a === 'rushlist') Screens.show('rush');
      else if (a.dataset.a === 'rank') Game.startRank();
      else Screens.show(isStage ? 'stages' : 'home');
    });
    Sound.bgm(null);
    if (Time.headless) return;
    // 星
    if (isStage && win) {
      for (let i = 0; i < 3; i++) {
        await waitReal(260);
        const star = $(`.rs-stars i[data-k="${i}"]`, box);
        if (out.stars[i]) {
          star.classList.add('popped');
          Sound.play('star');
          const c = centerOf(star); FX.burst(c.x, c.y, { count: 24, colors: ['#ffd23f', '#fff'], speed: 7, type: 'star' });
        }
      }
    }
    // ランク
    if (cfg.mode === 'rank') {
      const rr = $('.rs-rank', box);
      const rk = rankOf(out.rpAfter);
      rr.innerHTML = `<div class="rr-tier" style="--rc:${rk.color}">${rk.icon} ${rk.name}</div><div class="rr-rp">${out.rpAfter} RP <em class="${out.rpGain >= 0 ? 'up' : 'down'}">${out.rpGain >= 0 ? '+' : ''}${out.rpGain}</em></div>${out.streak >= 2 ? `<div class="rr-streak">🔥 ${out.streak}連勝中！ ボーナス増量</div>` : ''}<div class="pity-bar"><i style="width:${rk.progress * 100}%"></i></div>`;
      if (out.rankUp) {
        await waitReal(400);
        Sound.play('levelup');
        FX.confetti(160);
        await FX.banner(`${out.rankUp.icon} ${out.rankUp.name} 昇格!!`, { cls: 'b-gold', sub: Meta.rewardText(out.rankReward), dur: 1600 });
      }
    }
    // コインのカウントアップ
    await waitReal(250);
    const cn = $('.rs-coin-n', box);
    const total = out.coins;
    const steps = Math.min(30, Math.max(8, Math.round(total / 10)));
    const c = centerOf(cn);
    for (let i = 1; i <= steps; i++) {
      cn.textContent = fmt(Math.round(total * i / steps));
      if (i % 2) Sound.play('tick');
      if (i % 5 === 0) FX.coins(c.x, c.y, 3);
      await waitReal(28);
    }
    Sound.play('coin');
    // XPバー
    const bar = $('.rs-xp .xpbar i', box), lvB = $('.rs-lv b', box);
    const ups = out.levelUps || [];
    let lv = s.level - ups.length;
    const startXp = ups.length ? null : s.xp - out.xp;
    bar.style.transition = 'none';
    bar.style.width = (startXp != null ? Math.max(0, startXp) / Meta.xpNeed(lv) * 100 : 0) + '%';
    await nextFrame();
    for (const u of ups) {
      bar.style.transition = 'width .5s ease-out'; bar.style.width = '100%';
      await waitReal(550);
      lv = u.level; lvB.textContent = lv;
      Sound.play('levelup');
      FX.fountain(innerWidth / 2, innerHeight * 0.6, 50);
      await FX.banner(`LEVEL UP!! Lv${lv}`, { cls: 'b-gold', sub: Meta.rewardText(u.reward) + (u.avatar ? ` ・ アイコン${u.avatar}解放!` : ''), dur: 1300 });
      bar.style.transition = 'none'; bar.style.width = '0%';
      await nextFrame();
    }
    bar.style.transition = 'width .6s ease-out';
    bar.style.width = s.xp / Meta.xpNeed(s.level) * 100 + '%';
    // ミッション達成通知
    const done = Meta.popDone();
    for (const d of done) { await waitReal(300); Sound.play('claim'); FX.toast(`🎯 ミッション達成！「${esc(d.text)}」→ ホームで受け取ろう`, { cls: 'gold', dur: 3200 }); }
  },
};

/* ===================== ガチャ演出 ===================== */
const RAR_GLOW = { N: '', R: 'g-r', SR: 'g-sr', SSR: 'g-ssr', UR: 'g-ur' };
const Gacha = {
  async open(packs, type, onClose, again) {
    const ov = el('div', 'gacha-ov');
    document.body.appendChild(ov);
    Sound.bgm(null);
    let skipAll = !!Settings.gachaFast;
    for (let p = 0; p < packs.length && !skipAll; p++) {
      const res = await this.openPack(ov, packs[p], type, p, packs.length);
      if (res === 'skip') skipAll = true;
    }
    // まとめ
    const all = packs.flat();
    const best = all.reduce((m, r) => Math.max(m, RARITY[CARDS[r.id].rarity].rank), 0);
    const conv = all.reduce((s, r) => s + r.conv, 0);
    const news = all.filter(r => r.isNew).length;
    const cnt = {};
    all.forEach(r => { const k = CARDS[r.id].rarity; cnt[k] = (cnt[k] || 0) + 1; });
    const tally = RARITY_ORDER.slice().reverse().filter(k => cnt[k]).map(k => `<span style="color:${RARITY[k].color}">${k}×${cnt[k]}</span>`).join('');
    ov.innerHTML = `<div class="g-summary"><h2>獲得カード <small>${all.length}枚</small></h2><div class="gs-tally">${tally}</div><div class="gs-grid"></div><div class="gs-info">${news ? `<b class="new">NEW ×${news}</b>` : ''}${conv ? `<span>ダブり変換 🪙+${fmt(conv)}</span>` : ''}<span class="gs-hint">カードをタップで詳細</span></div><div class="gs-btns"><button class="btn big hot" type="button" data-a="again">もう1回!</button><button class="btn" type="button" data-a="deck">🃏 デッキ編成へ</button><button class="btn ghost" type="button" data-a="close">閉じる</button></div></div>`;
    const grid = $('.gs-grid', ov);
    if (all.length > 10) grid.classList.add('many');
    all.sort((a, b) => RARITY[CARDS[b.id].rarity].rank - RARITY[CARDS[a.id].rarity].rank || b.isNew - a.isNew).forEach((r, i) => {
      const def = CARDS[r.id];
      const c = cardEl(def, { cls: 'gcard' + (RARITY[def.rarity].rank >= 3 ? ' gs-hot' : ''), isNew: r.isNew });
      if (r.conv) c.appendChild(el('div', 'conv', `🪙+${r.conv}`));
      else c.appendChild(el('div', 'gs-own', `所持 ${Meta.owned(r.id)}/${MAXCOPY(def.rarity)}`));
      c.style.animationDelay = (i * 30) + 'ms';
      c.addEventListener('click', () => Preview.show(CARDS[r.id]));
      grid.appendChild(c);
    });
    if (best >= 3) Sound.play('jackpot'); else Sound.play('claim');
    Meta.persist();
    ov.addEventListener('click', ev => {
      const a = ev.target.closest('[data-a]'); if (!a) return;
      ov.remove();
      Sound.bgm('home');
      if (a.dataset.a === 'again') { onClose(); UI.buyPack(again); }
      else if (a.dataset.a === 'deck') Screens.show('deck');
      else onClose();
    });
  },

  openPack(ov, results, type, idx, total) {
    return new Promise(resolve => {
      const best = results.reduce((m, r) => Math.max(m, RARITY[CARDS[r.id].rarity].rank), 0);
      const bestR = RARITY_ORDER[best];
      // 期待度演出：パックの光（たまに一段低い色から昇格する）
      const promo = best >= 3 && R.chance(0.4);
      const glow0 = promo ? RARITY_ORDER[best - 1] : bestR;
      ov.innerHTML = `
        <div class="g-stage">
          <div class="g-count">${total > 1 ? `PACK ${idx + 1} / ${total}` : ''}</div>
          <div class="pack big ${type === 'premium' ? 'prem' : ''} ${RAR_GLOW[glow0]}"><div class="pack-logo">${type === 'premium' ? 'PREMIUM' : 'DOPA<br>BURST'}</div><div class="pack-tear"></div></div>
          <div class="g-tap">タップして開封！</div>
          <div class="g-row"></div>
          <div class="g-ctrl" hidden><button class="btn hot" type="button" data-a="all">全部めくる</button>${total > 1 ? '<button class="btn ghost" type="button" data-a="skip">スキップ</button>' : ''}</div>
        </div>`;
      const pack = $('.pack', ov), row = $('.g-row', ov), ctrl = $('.g-ctrl', ov);
      let opened = false;
      Sound.play('rare', best);
      pack.addEventListener('click', async () => {
        if (opened) return;
        opened = true;
        $('.g-tap', ov).remove();
        for (let i = 0; i < 3; i++) {
          Sound.play('tick');
          await animate(pack, [{ transform: 'rotate(0)' }, { transform: `rotate(${i % 2 ? 6 : -6}deg) scale(${1 + i * 0.04})` }, { transform: 'rotate(0)' }], { duration: 160, realtime: true });
        }
        if (promo) {
          pack.classList.remove(RAR_GLOW[glow0]); pack.classList.add(RAR_GLOW[bestR], 'promo');
          Sound.play('promote');
          FX.toast('⚡ 昇格!!', { cls: 'hot', dur: 1200 });
          await waitReal(600);
        }
        Sound.play('tear');
        const c = centerOf(pack);
        FX.burst(c.x, c.y, { count: 50, colors: [RARITY[bestR].color, '#fff', '#ff3d8b'], speed: 10, type: 'star' });
        FX.ring(c.x, c.y, { color: RARITY[bestR].color, size: 30, grow: 14, width: 8 });
        if (best >= 3) FX.rays(c.x, c.y, { color: RARITY[bestR].color, size: 500, life: 1.4 });
        pack.classList.add('torn');
        await waitReal(350);
        pack.remove();
        // カードを並べる
        const cards = results.map((r, i) => {
          const def = CARDS[r.id];
          const w = el('div', 'flip ' + RAR_GLOW[def.rarity]);
          w.innerHTML = `<div class="flip-in"><div class="flip-back"><span>?</span></div><div class="flip-front"></div></div>`;
          const front = cardEl(def, { cls: 'gcard', isNew: r.isNew });
          if (r.conv) front.appendChild(el('div', 'conv', `🪙+${r.conv}`));
          $('.flip-front', w).appendChild(front);
          row.appendChild(w);
          animate(w, [{ transform: 'translateY(-120px) scale(.4)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 360, delay: i * 70, easing: 'cubic-bezier(.2,1.3,.4,1)', realtime: true, fill: 'backwards' });
          return { w, r, def, flipped: false };
        });
        ctrl.hidden = false;
        let left = cards.length;
        const finish = () => { if (left === 0) setTimeout(() => resolve('done'), 700); };
        const flip = async (o, quick) => {
          if (o.flipped) return;
          o.flipped = true;
          const rank = RARITY[o.def.rarity].rank;
          if (rank >= 3 && !quick) await this.bigReveal(o.def, o.r);
          o.w.classList.add('flipped');
          Sound.play(rank >= 2 ? 'rare' : 'flip', rank);
          const c = centerOf(o.w);
          if (rank >= 1) FX.burst(c.x, c.y, { count: 10 + rank * 10, colors: [RARITY[o.def.rarity].color, '#fff'], speed: 5 + rank, type: 'star' });
          left--;
          finish();
        };
        cards.forEach(o => o.w.addEventListener('click', () => flip(o)));
        ctrl.addEventListener('click', async ev => {
          const a = ev.target.closest('[data-a]'); if (!a) return;
          if (a.dataset.a === 'skip') { resolve('skip'); return; }
          ctrl.hidden = true;
          for (const o of cards) { if (!o.flipped) { await flip(o, RARITY[o.def.rarity].rank < 3); await waitReal(120); } }
        });
      });
    });
  },

  bigReveal(def, r) {
    return new Promise(res => {
      const ur = def.rarity === 'UR';
      const ov = el('div', 'reveal ' + (ur ? 'ur' : 'ssr'));
      ov.innerHTML = `<div class="rv-rays"></div><div class="rv-card"></div><div class="rv-rar">${def.rarity}!!</div><div class="rv-name">${esc(def.name)}</div>${r.isNew ? '<div class="rv-new">NEW!</div>' : ''}<div class="rv-tap">タップで続ける</div>`;
      $('.rv-card', ov).appendChild(cardEl(def, { cls: 'big' }));
      $('.rv-name', ov).insertAdjacentHTML('afterend', `<div class="rv-text">${esc(cardRulesText(def) || def.text).replace(/\n/g, '<br>')}</div>`);
      document.body.appendChild(ov);
      Sound.play('ssr');
      FX.flash('#ffffff', 0.8, 500);
      FX.confetti(ur ? 220 : 140, ur ? {} : { colors: ['#ffd23f', '#fff3b0', '#ffffff', '#ff3d8b'] });
      vibrate([80, 50, 80, 50, 200]);
      setTimeout(() => FX.react(ur ? '虹確定!!!' : '神引き!!', ur ? '#ffffff' : '#ffd23f'), 400);
      setTimeout(() => ov.addEventListener('click', () => { ov.remove(); res(); }), 500);
    });
  },
};
