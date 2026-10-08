'use strict';
/* ===== 共通ユーティリティ ===== */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

// 演出の速度・ヘッドレス（テスト用）・エフェクト軽減
const Time = { speed: 1, headless: false, reduced: false };

function wait(ms) {
  if (Time.headless || ms <= 0) return Promise.resolve();
  return new Promise(r => setTimeout(r, ms / Time.speed));
}
// 演出速度に関係なく待つ（UI用）
function waitReal(ms) {
  if (Time.headless || ms <= 0) return Promise.resolve();
  return new Promise(r => setTimeout(r, ms));
}
function nextFrame() {
  if (Time.headless) return Promise.resolve();
  return new Promise(r => requestAnimationFrame(() => r()));
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const R = {
  next: Math.random,
  int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); },
  pick(arr) { return arr.length ? arr[Math.floor(this.next() * arr.length)] : undefined; },
  chance(p) { return this.next() < p; },
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },
  // entries: [[value, weight], ...]
  weighted(entries, rnd = this.next) {
    const total = entries.reduce((s, e) => s + e[1], 0);
    let x = rnd() * total;
    for (const [v, w] of entries) { if ((x -= w) < 0) return v; }
    return entries[entries.length - 1][0];
  },
};

function seeded(seed) {
  const f = mulberry32(seed);
  return {
    next: f,
    int(a, b) { return a + Math.floor(f() * (b - a + 1)); },
    pick(arr) { return arr[Math.floor(f() * arr.length)]; },
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      return a;
    },
    weighted(entries) { return R.weighted(entries, f); },
  };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmt(n) { return Math.round(n).toLocaleString('ja-JP'); }

function todayStr(d = new Date()) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// localStorage は使えない環境があるので必ず try/catch
const Store = {
  get(key, def) {
    try {
      const v = localStorage.getItem(key);
      return v == null ? def : JSON.parse(v);
    } catch (e) { return def; }
  },
  set(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; }
  },
  del(key) { try { localStorage.removeItem(key); } catch (e) { /* noop */ } },
};

// 簡易DOMビルダ
function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

function centerOf(elm) {
  if (!elm || !elm.getBoundingClientRect) return { x: innerWidth / 2, y: innerHeight / 2, w: 0, h: 0 };
  const r = elm.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
}

function vibrate(p) {
  try { if (window.Settings && !Settings.vibrate) return; navigator.vibrate && navigator.vibrate(p); } catch (e) { /* noop */ }
}

// アニメーション（Web Animations API）を Promise で
function animate(elm, frames, opts) {
  if (!elm || Time.headless || !elm.animate) return Promise.resolve();
  const o = Object.assign({}, typeof opts === 'number' ? { duration: opts } : opts);
  if (!o.realtime) o.duration = (o.duration || 300) / Time.speed;
  delete o.realtime;
  try {
    const a = elm.animate(frames, o);
    return a.finished.catch(() => {});
  } catch (e) { return Promise.resolve(); }
}
