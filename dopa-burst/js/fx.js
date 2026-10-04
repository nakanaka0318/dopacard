'use strict';
/* ===== 演出：パーティクル・ダメージ数字・バナー・シェイク ===== */

const FX = (() => {
  let cv, cx, bg, bx, W = 0, H = 0, dpr = 1;
  const parts = [];
  const amb = [];
  let ambKind = 'none';
  let layer, shakeT = 0, shakeA = 0, shakeEl = null;
  const MAX = 700;

  function init() {
    cv = $('#fx'); cx = cv.getContext('2d');
    bg = $('#bgfx'); bx = bg.getContext('2d');
    layer = $('#fx-text');
    resize();
    addEventListener('resize', resize);
    requestAnimationFrame(loop);
  }
  function resize() {
    dpr = Math.min(2, devicePixelRatio || 1);
    W = innerWidth; H = innerHeight;
    for (const c of [cv, bg]) {
      c.width = W * dpr; c.height = H * dpr;
      c.style.width = W + 'px'; c.style.height = H + 'px';
    }
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const scale = () => (Time.reduced ? 0.35 : 1);

  function add(p) {
    if (Time.headless) return;
    if (parts.length >= MAX) parts.shift();
    p.life = p.life ?? 1; p.max = p.life; p.rot = p.rot ?? Math.random() * 6.28; p.vr = p.vr ?? (Math.random() - 0.5) * 0.3;
    p.g = p.g ?? 0; p.drag = p.drag ?? 0.98;
    parts.push(p);
  }

  function burst(x, y, o = {}) {
    const n = Math.round((o.count ?? 24) * scale());
    const colors = o.colors || ['#fff'];
    for (let i = 0; i < n; i++) {
      const a = (o.angle ?? Math.random() * 6.28) + (o.spread != null ? (Math.random() - 0.5) * o.spread : 0);
      const sp = (o.speed ?? 6) * (0.4 + Math.random() * 0.8);
      add({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        size: (o.size ?? 4) * (0.6 + Math.random() * 0.8),
        color: colors[i % colors.length], type: o.type || 'spark',
        life: (o.life ?? 0.7) * (0.6 + Math.random() * 0.6), g: o.gravity ?? 0.15, drag: o.drag ?? 0.95,
      });
    }
  }
  function ring(x, y, o = {}) {
    add({ x, y, vx: 0, vy: 0, type: 'ring', color: o.color || '#fff', size: o.size ?? 10, grow: o.grow ?? 8, life: o.life ?? 0.45, width: o.width ?? 4, g: 0 });
  }
  function rays(x, y, o = {}) {
    add({ x, y, vx: 0, vy: 0, type: 'rays', color: o.color || '#fff', size: o.size ?? 300, life: o.life ?? 1.2, g: 0, vr: 0.01, rot: 0 });
  }
  function confetti(n = 120, o = {}) {
    n = Math.round(n * scale());
    const colors = o.colors || ['#ff3d8b', '#2ee6ff', '#ffcc33', '#8dff4f', '#ffffff'];
    for (let i = 0; i < n; i++) {
      add({
        x: Math.random() * W, y: -20 - Math.random() * H * 0.4,
        vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 4,
        size: 5 + Math.random() * 6, color: colors[i % colors.length], type: 'paper',
        life: 2.5 + Math.random() * 1.5, g: 0.04, drag: 0.995, vr: (Math.random() - 0.5) * 0.4,
      });
    }
  }
  function fountain(x, y, n = 40, colors) {
    n = Math.round(n * scale());
    colors = colors || ['#ffcc33', '#fff3b0', '#ff3d8b', '#2ee6ff'];
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.2;
      const sp = 8 + Math.random() * 9;
      add({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: 4 + Math.random() * 5, color: colors[i % colors.length], type: i % 3 ? 'paper' : 'star', life: 1.6, g: 0.3, drag: 0.985 });
    }
  }
  function coins(x, y, n = 12) {
    n = Math.round(n * scale());
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2;
      const sp = 4 + Math.random() * 7;
      add({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: 7, color: '#ffcc33', type: 'coin', life: 1.2, g: 0.35, drag: 0.98 });
    }
  }
  function bolt(x1, y1, x2, y2, color = '#bff8ff') {
    const pts = [];
    const segs = 10;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const jitter = (i === 0 || i === segs) ? 0 : (Math.random() - 0.5) * 40;
      const nx = -(y2 - y1), ny = x2 - x1, nl = Math.hypot(nx, ny) || 1;
      pts.push([lerp(x1, x2, t) + nx / nl * jitter, lerp(y1, y2, t) + ny / nl * jitter]);
    }
    add({ x: 0, y: 0, vx: 0, vy: 0, type: 'bolt', pts, color, life: 0.28, g: 0, drag: 1 });
  }

  // 発射体（Promiseで着弾を待てる）
  function projectile(x1, y1, x2, y2, o = {}) {
    if (Time.headless) return Promise.resolve();
    const dur = (o.dur ?? 320) / Time.speed;
    const color = o.color || '#fff';
    const kind = o.kind || 'orb';
    if (kind === 'bolt') {
      bolt(x1, y1, x2, y2, color); bolt(x1, y1, x2, y2, '#ffffff');
      return wait(90);
    }
    return new Promise(res => {
      const start = performance.now();
      const arc = o.arc ?? -60;
      const p = { type: 'proj', x: x1, y: y1, vx: 0, vy: 0, color, size: o.size ?? 10, life: 99, g: 0, drag: 1 };
      add(p);
      const step = now => {
        const t = Math.min(1, (now - start) / dur);
        const e = t * t * (3 - 2 * t);
        p.x = lerp(x1, x2, e);
        p.y = lerp(y1, y2, e) + Math.sin(t * Math.PI) * arc;
        if (Math.random() < 0.9 * scale()) add({ x: p.x, y: p.y, vx: (Math.random() - 0.5) * 1.5, vy: (Math.random() - 0.5) * 1.5, size: p.size * 0.6, color, type: 'glow', life: 0.3, g: kind === 'fire' ? -0.05 : 0 });
        if (t < 1) requestAnimationFrame(step); else { p.life = 0; res(); }
      };
      requestAnimationFrame(step);
    });
  }

  function loop() {
    requestAnimationFrame(loop);
    cx.clearRect(0, 0, W, H);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= 1 / 60;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.vx *= p.drag; p.vy *= p.drag; p.vy += p.g;
      p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      draw(cx, p);
    }
    // 画面シェイク
    if (shakeEl) {
      if (shakeT > 0) {
        shakeT -= 1 / 60;
        const a = shakeA * Math.max(0, shakeT) * 3;
        shakeEl.style.transform = `translate(${(Math.random() - 0.5) * a}px, ${(Math.random() - 0.5) * a}px)`;
      } else if (shakeEl.style.transform) shakeEl.style.transform = '';
    }
    drawAmbient();
  }

  function draw(c, p) {
    const k = p.life / p.max;
    c.globalAlpha = Math.min(1, k * 1.6);
    switch (p.type) {
      case 'spark': {
        c.strokeStyle = p.color; c.lineWidth = p.size * 0.6; c.lineCap = 'round';
        c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 2.2, p.y - p.vy * 2.2); c.stroke();
        break;
      }
      case 'glow': {
        c.globalCompositeOperation = 'lighter';
        c.fillStyle = p.color; c.beginPath(); c.arc(p.x, p.y, p.size * k, 0, 6.28); c.fill();
        c.globalCompositeOperation = 'source-over';
        break;
      }
      case 'proj': {
        c.globalCompositeOperation = 'lighter';
        const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2);
        g.addColorStop(0, '#fff'); g.addColorStop(0.3, p.color); g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, p.size * 2, 0, 6.28); c.fill();
        c.globalCompositeOperation = 'source-over';
        break;
      }
      case 'ring': {
        const r = p.size + (1 - k) * p.grow * 12;
        c.strokeStyle = p.color; c.lineWidth = p.width * k + 0.5;
        c.beginPath(); c.arc(p.x, p.y, r, 0, 6.28); c.stroke();
        break;
      }
      case 'rays': {
        c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = Math.min(1, k * 1.5) * 0.35;
        c.fillStyle = p.color;
        for (let i = 0; i < 16; i++) {
          c.rotate(Math.PI / 8);
          c.beginPath(); c.moveTo(0, 0); c.lineTo(p.size, -p.size * 0.08); c.lineTo(p.size, p.size * 0.08); c.closePath(); c.fill();
        }
        c.restore(); c.globalCompositeOperation = 'source-over';
        break;
      }
      case 'paper': {
        c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
        c.fillStyle = p.color; c.fillRect(-p.size / 2, -p.size / 4 * Math.abs(Math.sin(p.rot * 2) + 0.3), p.size, p.size / 2);
        c.restore();
        break;
      }
      case 'star': {
        c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillStyle = p.color;
        c.beginPath();
        for (let i = 0; i < 10; i++) { const r = i % 2 ? p.size * 0.45 : p.size; const a = i * Math.PI / 5; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        c.closePath(); c.fill(); c.restore();
        break;
      }
      case 'coin': {
        c.save(); c.translate(p.x, p.y);
        const sx = Math.abs(Math.cos(p.rot * 3));
        c.scale(Math.max(0.15, sx), 1);
        c.fillStyle = '#ffcc33'; c.beginPath(); c.arc(0, 0, p.size, 0, 6.28); c.fill();
        c.fillStyle = '#fff6c4'; c.beginPath(); c.arc(-p.size * 0.3, -p.size * 0.3, p.size * 0.35, 0, 6.28); c.fill();
        c.strokeStyle = '#b8860b'; c.lineWidth = 1.5; c.beginPath(); c.arc(0, 0, p.size, 0, 6.28); c.stroke();
        c.restore();
        break;
      }
      case 'shard': {
        c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillStyle = p.color;
        c.beginPath(); c.moveTo(0, -p.size); c.lineTo(p.size * 0.7, p.size * 0.6); c.lineTo(-p.size * 0.6, p.size * 0.4); c.closePath(); c.fill();
        c.restore();
        break;
      }
      case 'bolt': {
        c.globalCompositeOperation = 'lighter';
        c.strokeStyle = p.color; c.lineWidth = 3 + k * 4; c.lineJoin = 'round';
        c.shadowColor = p.color; c.shadowBlur = 16;
        c.beginPath(); p.pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
        c.shadowBlur = 0; c.globalCompositeOperation = 'source-over';
        break;
      }
    }
    c.globalAlpha = 1;
  }

  /* ---- 背景のアンビエント粒子（フィールドごと） ---- */
  const AMB = {
    none: { color: ['rgba(180,160,255,.35)'], rate: 0.25, vy: -0.25, size: [1, 2.5] },
    blaze: { color: ['#ff9a3d', '#ff5a36', '#ffd166'], rate: 1.6, vy: -1.2, size: [1.5, 3.5], glow: true },
    storm: { color: ['#bff8ff', '#7fe9ff', '#ffffff'], rate: 1.4, vy: 1.4, vx: -0.6, size: [1, 2.5], flash: true },
    sugar: { color: ['#ff7ac8', '#ffd1ec', '#9ef0ff', '#fff3a0'], rate: 1.0, vy: 0.6, size: [2, 4], paper: true },
    necro: { color: ['rgba(169,120,255,.5)', 'rgba(120,255,200,.35)'], rate: 0.8, vy: -0.35, size: [8, 22], fog: true },
    lucky: { color: ['#ffcc33', '#fff3b0'], rate: 0.6, vy: 1.0, size: [4, 6], coin: true },
    mecha: { color: ['#6dffb3', '#bfffe0'], rate: 0.9, vy: -0.5, size: [1.5, 3], square: true },
    neutral: { color: ['#ffffff', '#ffcc33', '#ff3d8b'], rate: 0.9, vy: -0.6, size: [1.5, 3] },
    fever: { color: ['#ff3d8b', '#ffcc33', '#2ee6ff', '#ffffff'], rate: 3, vy: -2.2, size: [1.5, 4], glow: true },
    risk: { color: ['#ff3a5c', '#b3001e', '#ff8fa3'], rate: 0.9, vy: 1.2, size: [2, 4], glow: true },
  };
  let flashT = 0;
  function setAmbient(kind) { ambKind = AMB[kind] ? kind : 'none'; }
  function drawAmbient() {
    bx.clearRect(0, 0, W, H);
    const a = AMB[ambKind];
    if (a && !Time.headless) {
      const rate = a.rate * (Time.reduced ? 0.3 : 1);
      if (Math.random() < rate % 1 || rate >= 1) {
        const n = Math.max(1, Math.floor(rate));
        for (let i = 0; i < n; i++) {
          if (amb.length > 160) break;
          amb.push({
            x: Math.random() * W, y: a.vy < 0 ? H + 10 : -10,
            vx: (a.vx || 0) + (Math.random() - 0.5) * 0.4, vy: a.vy * (0.6 + Math.random() * 0.8),
            s: a.size[0] + Math.random() * (a.size[1] - a.size[0]), c: a.color[Math.floor(Math.random() * a.color.length)],
            life: 1, r: Math.random() * 6, k: ambKind,
          });
        }
      }
      if (a.flash && !Time.reduced && Math.random() < 0.004) flashT = 1;
    }
    for (let i = amb.length - 1; i >= 0; i--) {
      const p = amb[i];
      p.x += p.vx; p.y += p.vy; p.r += 0.02;
      if (p.y < -40 || p.y > H + 40 || p.k !== ambKind) { p.life -= 0.05; if (p.life <= 0 || p.y < -40 || p.y > H + 40) { amb.splice(i, 1); continue; } }
      const s = AMB[p.k] || AMB.none;
      bx.globalAlpha = 0.7 * p.life;
      bx.fillStyle = p.c;
      if (s.fog) {
        const g = bx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.s * 3);
        g.addColorStop(0, p.c); g.addColorStop(1, 'rgba(0,0,0,0)');
        bx.fillStyle = g; bx.beginPath(); bx.arc(p.x, p.y, p.s * 3, 0, 6.28); bx.fill();
      } else if (s.paper) {
        bx.save(); bx.translate(p.x + Math.sin(p.r) * 8, p.y); bx.rotate(p.r); bx.fillRect(-p.s, -p.s / 3, p.s * 2, p.s * 0.7); bx.restore();
      } else if (s.coin) {
        bx.save(); bx.translate(p.x, p.y); bx.scale(Math.max(0.2, Math.abs(Math.cos(p.r * 2))), 1);
        bx.beginPath(); bx.arc(0, 0, p.s, 0, 6.28); bx.fill(); bx.restore();
      } else if (s.square) {
        bx.save(); bx.translate(p.x, p.y); bx.rotate(p.r); bx.strokeStyle = p.c; bx.lineWidth = 1; bx.strokeRect(-p.s * 1.5, -p.s * 1.5, p.s * 3, p.s * 3); bx.restore();
      } else {
        if (s.glow) { bx.shadowColor = p.c; bx.shadowBlur = 8; }
        bx.beginPath(); bx.arc(p.x + Math.sin(p.r) * 3, p.y, p.s, 0, 6.28); bx.fill();
        bx.shadowBlur = 0;
      }
    }
    if (flashT > 0) {
      bx.globalAlpha = flashT * 0.18; bx.fillStyle = '#dff9ff'; bx.fillRect(0, 0, W, H);
      flashT -= 0.08;
    }
    bx.globalAlpha = 1;
  }

  /* ---- DOM演出 ---- */
  function popText(x, y, text, cls = '', o = {}) {
    if (Time.headless) return;
    const e = el('div', 'pop ' + cls, text);
    e.style.left = x + 'px'; e.style.top = y + 'px';
    if (o.color) e.style.setProperty('--c', o.color);
    if (o.size) e.style.fontSize = o.size + 'px';
    layer.appendChild(e);
    const dur = (o.dur ?? 900) / Math.min(Time.speed, 2);
    const dx = o.dx ?? (Math.random() - 0.5) * 30;
    e.animate([
      { transform: 'translate(-50%,-50%) scale(.3)', opacity: 0 },
      { transform: `translate(calc(-50% + ${dx * 0.4}px),-90%) scale(${o.peak ?? 1.35})`, opacity: 1, offset: 0.18 },
      { transform: `translate(calc(-50% + ${dx * 0.7}px),-110%) scale(1)`, opacity: 1, offset: 0.6 },
      { transform: `translate(calc(-50% + ${dx}px),-190%) scale(.9)`, opacity: 0 },
    ], { duration: dur, easing: 'cubic-bezier(.2,.8,.3,1)' }).finished.then(() => e.remove(), () => e.remove());
  }

  // 画面中央のでかい文字
  function banner(text, o = {}) {
    if (Time.headless) return Promise.resolve();
    const e = el('div', 'banner ' + (o.cls || ''), `<div class="banner-main">${text}</div>${o.sub ? `<div class="banner-sub">${o.sub}</div>` : ''}`);
    if (o.color) e.style.setProperty('--c', o.color);
    if (o.y != null) e.style.top = o.y;
    layer.appendChild(e);
    const dur = (o.dur ?? 1100) / Math.min(Time.speed, 2.5);
    const a = e.animate([
      { transform: 'translate(-50%,-50%) scale(2.6) rotate(-4deg)', opacity: 0, filter: 'blur(6px)' },
      { transform: 'translate(-50%,-50%) scale(.92) rotate(-4deg)', opacity: 1, filter: 'blur(0)', offset: 0.14 },
      { transform: 'translate(-50%,-50%) scale(1.04) rotate(-4deg)', opacity: 1, offset: 0.22 },
      { transform: 'translate(-50%,-50%) scale(1) rotate(-4deg)', opacity: 1, offset: 0.8 },
      { transform: 'translate(-50%,-50%) scale(1.15) rotate(-4deg)', opacity: 0 },
    ], { duration: dur, easing: 'ease-out' });
    return a.finished.then(() => e.remove(), () => e.remove());
  }

  // 「えぐっ!!」みたいなリアクション文字（斜めに飛び込む）
  function react(text, color) {
    if (Time.headless) return;
    const e = el('div', 'react', text);
    if (color) e.style.setProperty('--c', color);
    const left = Math.random() < 0.5;
    e.style.left = left ? '6%' : 'auto';
    e.style.right = left ? 'auto' : '6%';
    e.style.top = (28 + Math.random() * 30) + '%';
    layer.appendChild(e);
    const rot = left ? -12 : 12;
    e.animate([
      { transform: `translateX(${left ? -80 : 80}px) rotate(${rot}deg) scale(.4)`, opacity: 0 },
      { transform: `translateX(0) rotate(${rot}deg) scale(1.2)`, opacity: 1, offset: 0.15 },
      { transform: `translateX(0) rotate(${rot}deg) scale(1)`, opacity: 1, offset: 0.7 },
      { transform: `translateY(-30px) rotate(${rot}deg) scale(1)`, opacity: 0 },
    ], { duration: 1000, easing: 'ease-out' }).finished.then(() => e.remove(), () => e.remove());
  }

  function shake(level = 1, target) {
    if (Time.headless || Time.reduced) return;
    shakeEl = target || $('#scr-battle .battle-stage') || document.body;
    shakeA = Math.max(shakeA * (shakeT > 0 ? 1 : 0), 4 + level * 5);
    shakeT = Math.max(shakeT, 0.18 + level * 0.06);
  }

  function flash(color = '#fff', alpha = 0.35, dur = 180) {
    if (Time.headless || Time.reduced) return;
    const e = el('div', 'flash');
    e.style.background = color;
    layer.appendChild(e);
    e.animate([{ opacity: alpha }, { opacity: 0 }], { duration: dur }).finished.then(() => e.remove(), () => e.remove());
  }

  function toast(html, o = {}) {
    const root = $('#toasts');
    if (!root || Time.headless) return;
    const e = el('div', 'toast ' + (o.cls || ''), html);
    root.appendChild(e);
    setTimeout(() => { e.classList.add('out'); setTimeout(() => e.remove(), 400); }, o.dur ?? 2600);
  }

  return { init, burst, ring, rays, confetti, fountain, coins, bolt, projectile, popText, banner, react, shake, flash, toast, setAmbient, add };
})();
