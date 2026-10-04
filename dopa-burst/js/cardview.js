'use strict';
/* ===== カードの見た目 ===== */

const KW_ORDER = ['shield', 'double', 'pierce', 'fly', 'chain', 'thorns', 'drain', 'lucky', 'regen', 'undying', 'poison', 'burnhit', 'freezehit', 'warp'];

// 手札・ギャラリー用のカード
function cardEl(def, o = {}) {
  const t = TRIBES[def.tribe];
  const e = el('div', `card t-${def.tribe} r-${def.rarity} ty-${def.type} ${o.cls || ''}`);
  e.style.setProperty('--tc', t.color);
  e.style.setProperty('--rc', RARITY[def.rarity].color);
  if (o.locked) {
    e.classList.add('locked');
    e.innerHTML = `<div class="card-in"><div class="card-art"><span class="card-emoji">？</span></div><div class="card-rar">${def.rarity}</div><div class="card-name">？？？</div></div>`;
    return e;
  }
  const kws = def.kw.slice().sort((a, b) => KW_ORDER.indexOf(a) - KW_ORDER.indexOf(b));
  const stats = def.type === 'unit'
    ? `<div class="card-atk"><b>${def.atkText || def.atk}</b></div><div class="card-hp"><b>${def.hp}</b></div>`
    : `<div class="card-type">${def.type === 'spell' ? 'SPELL' : 'FIELD'}</div>`;
  const text = o.text ? `<div class="card-text">${esc(cardRulesText(def) || def.text).replace(/\n/g, '<br>')}</div>` : '';
  e.innerHTML = `
    <div class="card-in">
      <div class="card-art"><div class="card-burst"></div><span class="card-emoji">${def.emoji}</span></div>
      <div class="card-cost"><b>${o.cost ?? def.cost}</b></div>
      ${def.hpCost ? `<div class="card-hpcost">♥${def.hpCost}</div>` : ''}
      ${def.countdown ? `<div class="card-count-badge">⏳${def.countdown}</div>` : ''}
      <div class="card-rar">${def.rarity}</div>
      ${kws.length ? `<div class="card-kw">${kws.map(k => `<i title="${KW[k].name}">${KW[k].icon}</i>`).join('')}</div>` : ''}
      <div class="card-name">${esc(def.name)}</div>
      ${text}
      ${stats}
    </div>`;
  if (o.count != null) e.appendChild(el('div', 'card-count', '×' + o.count));
  if (o.isNew) e.appendChild(el('div', 'card-new', 'NEW'));
  return e;
}

// 盤面のユニット
function unitEl(u) {
  const def = u.def, t = TRIBES[def.tribe];
  const e = el('div', `unit t-${def.tribe} r-${def.rarity}`);
  e.dataset.uid = u.uid;
  e.style.setProperty('--tc', t.color);
  e.style.setProperty('--rc', RARITY[def.rarity].color);
  e.innerHTML = `
    <div class="unit-in">
      <div class="card-art"><div class="card-burst"></div><span class="card-emoji">${def.emoji}</span></div>
      <div class="u-stars"></div>
      <div class="u-kw"></div>
      <div class="u-status"></div>
      <div class="card-atk"><b></b></div><div class="card-hp"><b></b></div>
    </div>
    <div class="u-shield"></div>
    <div class="u-ice"></div>`;
  updateUnitEl(e, u);
  return e;
}

function updateUnitEl(e, u) {
  const atk = B.atkOf(u);
  const atkB = e.querySelector('.card-atk b'), hpB = e.querySelector('.card-hp b');
  if (atkB.textContent !== String(atk)) atkB.textContent = atk;
  if (hpB.textContent !== String(Math.max(0, u.hp))) hpB.textContent = Math.max(0, u.hp);
  e.querySelector('.card-atk').classList.toggle('up', atk > u.def.atk * u.star);
  e.querySelector('.card-hp').classList.toggle('hurt', u.hp < u.maxHp);
  e.querySelector('.card-hp').classList.toggle('up', u.hp >= u.maxHp && u.maxHp > u.def.hp * u.star);
  const stars = u.star > 1 ? '★'.repeat(u.star) : '';
  const st = e.querySelector('.u-stars');
  if (st.textContent !== stars) st.textContent = stars;
  e.classList.toggle('star2', u.star === 2);
  e.classList.toggle('star3', u.star === 3);
  const kws = B.kwList(u).sort((a, b) => KW_ORDER.indexOf(a) - KW_ORDER.indexOf(b)).map(k => KW[k].icon).join('');
  const kwEl = e.querySelector('.u-kw');
  if (kwEl.textContent !== kws) kwEl.textContent = kws;
  const status = (u.count > 0 ? `<span class="st-count">⏳${u.count}</span>` : '') + (u.burn > 0 ? `<span class="st-burn">🔥${u.burn}</span>` : '') + (u.frozen ? '<span class="st-ice">❄️</span>' : '');
  const se = e.querySelector('.u-status');
  if (se.innerHTML !== status) se.innerHTML = status;
  e.classList.toggle('shielded', !!u.shield);
  e.classList.toggle('frozen', !!u.frozen);
  e.classList.toggle('burning', u.burn > 0);
  e.classList.toggle('lowhp', u.hp > 0 && u.hp <= u.maxHp * 0.34);
}

// 詳細テキスト（ヒント帯・プレビュー用）
function detailHTML(def, u) {
  const t = TRIBES[def.tribe];
  const kws = (u ? B.kwList(u) : def.kw).filter(k => KW[k]);
  let head = `<span class="dt-rar" style="--rc:${RARITY[def.rarity].color}">${def.rarity}</span><span class="dt-name">${esc(def.name)}</span><span class="dt-tribe" style="--tc:${t.color}">${t.icon}${t.name}・${typeLabel(def)}</span>`;
  if (u && u.star > 1) head += `<span class="dt-star">${'★'.repeat(u.star)}</span>`;
  let body = '';
  if (def.text && !def.flavor) body += `<div class="dt-text">${esc(def.text)}</div>`;
  if (kws.length) body += `<div class="dt-kws">${kws.map(k => `<span><b>${KW[k].icon}${KW[k].name}</b> ${KW[k].desc}</span>`).join('')}</div>`;
  if (u) {
    const st = [];
    if (u.shield) st.push(`<span><b>${KW.shield.icon}シールド</b> ${KW.shield.desc}</span>`);
    if (u.burn > 0) st.push(`<span><b>🔥炎上${u.burn}</b> ${STATUS_INFO.burn.replace(/^.+?：/, '')}</span>`);
    if (u.frozen) st.push(`<span><b>❄️凍結</b> ${STATUS_INFO.frozen.replace(/^.+?：/, '')}</span>`);
    if (u.count > 0) st.push(`<span><b>⏳あと${u.count}ターン</b> ${STATUS_INFO.count.replace(/^.+?：/, '')}</span>`);
    if (u.def.atkMod && u.def.atkMod(B, u) > 0) st.push(`<span><b>⚔今ATK+${u.def.atkMod(B, u)}</b> 条件を満たしている！</span>`);
    if (st.length) body += `<div class="dt-kws">${st.join('')}</div>`;
  }
  if (!u && def.countdown) body += `<div class="dt-kws"><span><b>⏳カウント</b> ${STATUS_INFO.count.replace(/^.+?：/, '')}</span></div>`;
  if (def.onPreAttack) body += `<div class="dt-kws"><span><b>⚡アタック前</b> ${STATUS_INFO.preAttack.replace(/^.+?：/, '')}</span></div>`;
  if (def.hpCost) body += `<div class="dt-kws"><span><b>♥HPコスト</b> ${STATUS_INFO.hpCost.replace(/^.+?：/, '')}</span></div>`;
  if (!body) body = `<div class="dt-text dt-flavor">${esc(def.text || '特殊効果なし')}</div>`;
  return `<div class="dt-head">${head}</div>${body}`;
}

// 長押しプレビュー
const Preview = {
  elm: null,
  show(def, u) {
    this.hide();
    const wrap = el('div', 'preview');
    const c = cardEl(def, { cls: 'big' });
    if (u) {
      const a = c.querySelector('.card-atk b'), h = c.querySelector('.card-hp b');
      if (a) a.textContent = B.atkOf(u);
      if (h) h.textContent = u.hp;
    }
    wrap.appendChild(c);
    const info = el('div', 'preview-info', detailHTML(def, u));
    wrap.appendChild(info);
    document.body.appendChild(wrap);
    this.elm = wrap;
    wrap.addEventListener('pointerdown', () => this.hide());
    animate(c, [{ transform: 'scale(.7) rotateY(30deg)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 220, easing: 'cubic-bezier(.2,1.4,.4,1)', realtime: true });
  },
  hide() { if (this.elm) { this.elm.remove(); this.elm = null; } },
};

// 長押し判定ユーティリティ
function onLongPress(target, fn, ms = 420) {
  let timer = null, sx = 0, sy = 0, fired = false;
  target.addEventListener('pointerdown', ev => {
    fired = false; sx = ev.clientX; sy = ev.clientY;
    clearTimeout(timer);
    timer = setTimeout(() => { fired = true; fn(ev); }, ms);
  });
  const cancel = () => clearTimeout(timer);
  target.addEventListener('pointermove', ev => { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 10) cancel(); });
  target.addEventListener('pointerup', () => { cancel(); if (fired) setTimeout(() => Preview.hide(), 0); });
  target.addEventListener('pointercancel', cancel);
  target.addEventListener('pointerleave', cancel);
  target.addEventListener('contextmenu', ev => ev.preventDefault());
  return () => fired;
}
