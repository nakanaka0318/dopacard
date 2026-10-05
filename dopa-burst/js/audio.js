'use strict';
/* ===== サウンド：効果音もBGMもすべてWebAudioで合成 ===== */

const Sound = (() => {
  let ctx = null, master, comp, sfxBus, bgmBus, noiseBuf;
  const vol = { bgm: 0.5, sfx: 0.8 };
  const last = {};

  function init() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      ctx = new AC();
    } catch (e) { return false; }
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4;
    comp.attack.value = 0.003; comp.release.value = 0.18;
    master = ctx.createGain(); master.gain.value = 0.9;
    sfxBus = ctx.createGain(); sfxBus.gain.value = vol.sfx;
    bgmBus = ctx.createGain(); bgmBus.gain.value = vol.bgm * 0.55;
    sfxBus.connect(comp); bgmBus.connect(comp); comp.connect(master); master.connect(ctx.destination);
    const len = ctx.sampleRate * 1.0;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  function unlock() {
    if (!init()) return;
    if (ctx.state === 'suspended') ctx.resume();
  }
  function setVolume(kind, v) {
    vol[kind] = v;
    if (!ctx) return;
    if (kind === 'sfx') sfxBus.gain.value = v;
    else bgmBus.gain.setTargetAtTime(v * 0.55, ctx.currentTime, 0.05);
  }

  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  function tone(o) {
    const t = ctx.currentTime + (o.when || 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type || 'square';
    const f = o.freq || mtof(o.note || 69);
    osc.frequency.setValueAtTime(f, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f * o.slide), t + (o.dur || 0.1));
    if (o.detune) osc.detune.value = o.detune;
    const a = o.attack ?? 0.004, dur = o.dur ?? 0.1, rel = o.release ?? 0.06, v = o.vol ?? 0.2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + a);
    g.gain.setValueAtTime(v, t + Math.max(a, dur - rel));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (o.lp) {
      const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = o.lp;
      node.connect(flt); node = flt;
    }
    node.connect(g); g.connect(o.dest || sfxBus);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  function noise(o) {
    const t = ctx.currentTime + (o.when || 0);
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const flt = ctx.createBiquadFilter();
    flt.type = o.filter || 'bandpass';
    flt.frequency.setValueAtTime(o.f || 1200, t);
    if (o.fEnd) flt.frequency.exponentialRampToValueAtTime(o.fEnd, t + (o.dur || 0.2));
    flt.Q.value = o.q ?? 1;
    const g = ctx.createGain();
    const dur = o.dur || 0.2, v = o.vol ?? 0.3;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + (o.attack ?? 0.003));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(flt); flt.connect(g); g.connect(o.dest || sfxBus);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  }

  // ペンタトニックで上がっていくコンボ音
  const PENTA = [0, 2, 4, 7, 9];
  function comboNote(n) {
    const i = Math.max(0, n - 1);
    return 72 + PENTA[i % 5] + 12 * Math.floor(i / 5);
  }

  const SFX = {
    tap() { tone({ note: 84, type: 'square', dur: 0.045, vol: 0.08 }); },
    select() { tone({ note: 79, type: 'square', dur: 0.05, vol: 0.09 }); tone({ note: 91, type: 'square', dur: 0.06, vol: 0.07, when: 0.04 }); },
    cancel() { tone({ note: 72, type: 'triangle', dur: 0.08, vol: 0.12, slide: 0.6 }); },
    error() { tone({ note: 50, type: 'square', dur: 0.12, vol: 0.1 }); tone({ note: 47, type: 'square', dur: 0.14, vol: 0.1, when: 0.09 }); },
    draw() { noise({ f: 2500, fEnd: 6000, dur: 0.14, vol: 0.12, q: 2 }); tone({ note: 88, type: 'sine', dur: 0.08, vol: 0.05, when: 0.05 }); },
    play() {
      tone({ freq: 140, type: 'sine', dur: 0.22, vol: 0.5, slide: 0.35 });
      noise({ f: 900, fEnd: 200, dur: 0.18, vol: 0.25, filter: 'lowpass' });
      tone({ note: 96, type: 'triangle', dur: 0.12, vol: 0.06, when: 0.05 });
    },
    hit(power = 1) {
      const p = Math.min(power, 3);
      tone({ freq: 180, type: 'square', dur: 0.12, vol: 0.18 + p * 0.04, slide: 0.3, lp: 1800 });
      noise({ f: 1800, fEnd: 400, dur: 0.12 + p * 0.03, vol: 0.28, q: 0.8 });
    },
    hitHeavy() {
      tone({ freq: 90, type: 'sine', dur: 0.35, vol: 0.7, slide: 0.4 });
      noise({ f: 1200, fEnd: 120, dur: 0.35, vol: 0.4, filter: 'lowpass' });
      tone({ freq: 220, type: 'sawtooth', dur: 0.15, vol: 0.12, slide: 0.5, lp: 1500 });
    },
    crit() {
      tone({ note: 96, type: 'square', dur: 0.08, vol: 0.12 });
      tone({ note: 103, type: 'square', dur: 0.18, vol: 0.12, when: 0.05 });
      tone({ freq: 70, type: 'sine', dur: 0.4, vol: 0.7, slide: 0.5 });
      noise({ f: 5000, fEnd: 800, dur: 0.3, vol: 0.25, q: 0.7 });
    },
    shield() { tone({ note: 100, type: 'triangle', dur: 0.35, vol: 0.18 }); tone({ note: 107, type: 'sine', dur: 0.3, vol: 0.1, when: 0.02 }); noise({ f: 7000, dur: 0.15, vol: 0.12, q: 4 }); },
    heal() { [76, 81, 88].forEach((n, i) => tone({ note: n, type: 'sine', dur: 0.18, vol: 0.12, when: i * 0.06 })); },
    buff() { [72, 79, 84].forEach((n, i) => tone({ note: n, type: 'square', dur: 0.08, vol: 0.07, when: i * 0.045 })); },
    death() {
      noise({ f: 3000, fEnd: 300, dur: 0.4, vol: 0.32, q: 1.2 });
      tone({ freq: 400, type: 'square', dur: 0.3, vol: 0.1, slide: 0.25, lp: 2000 });
      for (let i = 0; i < 4; i++) tone({ note: 90 + Math.random() * 12, type: 'triangle', dur: 0.05, vol: 0.06, when: 0.05 + i * 0.04 });
    },
    merge() {
      noise({ f: 400, fEnd: 5000, dur: 0.45, vol: 0.2, q: 2 });
      [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => tone({ note: n, type: 'square', dur: 0.12, vol: 0.08, when: 0.25 + i * 0.035 }));
      tone({ freq: 110, type: 'sine', dur: 0.5, vol: 0.5, slide: 0.5, when: 0.25 });
    },
    combo(n) { const m = comboNote(n); tone({ note: m, type: 'square', dur: 0.09, vol: 0.09 }); tone({ note: m + 12, type: 'sine', dur: 0.12, vol: 0.06, when: 0.02 }); },
    coin() { tone({ note: 93, type: 'square', dur: 0.06, vol: 0.07 }); tone({ note: 100, type: 'square', dur: 0.14, vol: 0.07, when: 0.06 }); },
    tick() { tone({ note: 96, type: 'square', dur: 0.025, vol: 0.05 }); },
    energy() { [67, 74, 79, 86].forEach((n, i) => tone({ note: n, type: 'sine', dur: 0.1, vol: 0.07, when: i * 0.04 })); },
    turn() { tone({ note: 64, type: 'square', dur: 0.1, vol: 0.1 }); tone({ note: 76, type: 'square', dur: 0.16, vol: 0.1, when: 0.08 }); noise({ f: 800, fEnd: 4000, dur: 0.25, vol: 0.1, q: 1 }); },
    enemyTurn() { tone({ note: 57, type: 'sawtooth', dur: 0.14, vol: 0.08, lp: 1200 }); tone({ note: 52, type: 'sawtooth', dur: 0.2, vol: 0.08, when: 0.1, lp: 1200 }); },
    fever() {
      noise({ f: 300, fEnd: 9000, dur: 0.9, vol: 0.28, q: 1.5 });
      tone({ freq: 200, type: 'sawtooth', dur: 0.9, vol: 0.1, slide: 4, lp: 3000 });
      [72, 76, 79, 84].forEach(n => tone({ note: n, type: 'square', dur: 0.5, vol: 0.08, when: 0.85 }));
      tone({ freq: 65, type: 'sine', dur: 0.6, vol: 0.7, slide: 0.5, when: 0.85 });
    },
    feverReady() { [79, 84, 88, 91].forEach((n, i) => tone({ note: n, type: 'square', dur: 0.07, vol: 0.08, when: i * 0.05 })); },
    reach() {
      for (let i = 0; i < 3; i++) { tone({ note: 88, type: 'square', dur: 0.07, vol: 0.1, when: i * 0.14 }); tone({ note: 95, type: 'square', dur: 0.07, vol: 0.1, when: i * 0.14 + 0.07 }); }
    },
    burn() { noise({ f: 1500, fEnd: 600, dur: 0.3, vol: 0.2, q: 0.6 }); for (let i = 0; i < 5; i++) noise({ f: 3000, dur: 0.03, vol: 0.12, q: 3, when: Math.random() * 0.25 }); },
    freeze() { [100, 104, 108].forEach((n, i) => tone({ note: n, type: 'triangle', dur: 0.2, vol: 0.08, when: i * 0.05 })); noise({ f: 8000, dur: 0.3, vol: 0.1, q: 6 }); },
    zap() { noise({ f: 4000, fEnd: 1500, dur: 0.18, vol: 0.25, q: 1 }); tone({ freq: 1200, type: 'sawtooth', dur: 0.12, vol: 0.07, slide: 0.3 }); },
    fire() { noise({ f: 900, fEnd: 300, dur: 0.35, vol: 0.3, q: 0.7 }); tone({ freq: 120, type: 'sine', dur: 0.25, vol: 0.3, slide: 0.5 }); },
    dark() { tone({ freq: 220, type: 'sawtooth', dur: 0.35, vol: 0.1, slide: 0.4, lp: 900 }); noise({ f: 500, dur: 0.3, vol: 0.15, q: 2 }); },
    whoosh() { noise({ f: 600, fEnd: 3000, dur: 0.18, vol: 0.12, q: 1.5 }); },
    star() { tone({ note: 88, type: 'square', dur: 0.08, vol: 0.09 }); tone({ note: 95, type: 'square', dur: 0.2, vol: 0.09, when: 0.07 }); tone({ note: 100, type: 'sine', dur: 0.3, vol: 0.07, when: 0.12 }); },
    dice() { for (let i = 0; i < 6; i++) noise({ f: 2500 + Math.random() * 2000, dur: 0.03, vol: 0.15, q: 5, when: i * 0.07 }); },
    slotTick() { tone({ note: 91, type: 'square', dur: 0.02, vol: 0.04 }); },
    slotStop() { tone({ freq: 160, type: 'square', dur: 0.08, vol: 0.18, slide: 0.5 }); tone({ note: 84, type: 'square', dur: 0.06, vol: 0.08 }); },
    jackpot() {
      const seq = [72, 76, 79, 84, 79, 84, 88, 91, 96];
      seq.forEach((n, i) => tone({ note: n, type: 'square', dur: 0.1, vol: 0.09, when: i * 0.07 }));
      for (let i = 0; i < 10; i++) tone({ note: 96 + (i % 3) * 4, type: 'triangle', dur: 0.06, vol: 0.06, when: 0.6 + i * 0.05 });
    },
    lose() { [67, 63, 60, 55].forEach((n, i) => tone({ note: n, type: 'triangle', dur: 0.3, vol: 0.15, when: i * 0.22 })); },
    win() {
      const seq = [[72, 0], [76, 0.1], [79, 0.2], [84, 0.3], [79, 0.45], [84, 0.55]];
      seq.forEach(([n, w]) => { tone({ note: n, type: 'square', dur: 0.14, vol: 0.1, when: w }); tone({ note: n - 12, type: 'triangle', dur: 0.14, vol: 0.12, when: w }); });
      [84, 88, 91, 96].forEach(n => tone({ note: n, type: 'square', dur: 0.7, vol: 0.06, when: 0.7 }));
      tone({ freq: 65, type: 'sine', dur: 0.8, vol: 0.4, when: 0.7 });
    },
    levelup() {
      [60, 64, 67, 72, 76, 79, 84, 88].forEach((n, i) => tone({ note: n, type: 'square', dur: 0.09, vol: 0.08, when: i * 0.05 }));
      [84, 88, 91].forEach(n => tone({ note: n, type: 'triangle', dur: 0.6, vol: 0.08, when: 0.42 }));
    },
    tear() { noise({ f: 2000, fEnd: 7000, dur: 0.35, vol: 0.3, q: 0.8 }); },
    flip() { noise({ f: 3000, dur: 0.06, vol: 0.15, q: 2 }); tone({ note: 84, type: 'triangle', dur: 0.06, vol: 0.06 }); },
    rare(level = 1) {
      const base = 76 + level * 2;
      for (let i = 0; i < 6 + level * 2; i++) tone({ note: base + (i * 5) % 24, type: 'sine', dur: 0.15, vol: 0.06, when: i * 0.04 });
    },
    ssr() {
      tone({ freq: 55, type: 'sine', dur: 1.2, vol: 0.6, slide: 0.6 });
      [60, 67, 72, 76, 79, 84].forEach(n => tone({ note: n, type: 'sawtooth', dur: 1.0, vol: 0.04, lp: 3500, when: 0.05 }));
      for (let i = 0; i < 16; i++) tone({ note: 96 + [0, 4, 7, 12][i % 4], type: 'triangle', dur: 0.08, vol: 0.05, when: 0.1 + i * 0.05 });
      noise({ f: 6000, dur: 1.0, vol: 0.12, q: 0.5 });
    },
    promote() { [79, 83, 86, 91, 95, 98].forEach((n, i) => tone({ note: n, type: 'square', dur: 0.08, vol: 0.08, when: i * 0.06 })); noise({ f: 1000, fEnd: 8000, dur: 0.4, vol: 0.18, q: 1 }); },
    // ボスラッシュ用：警報・必殺技・覚醒
    siren() {
      for (let i = 0; i < 3; i++) {
        tone({ freq: 620, type: 'sawtooth', dur: 0.32, vol: 0.09, slide: 1.45, when: i * 0.62, lp: 2600 });
        tone({ freq: 900, type: 'sawtooth', dur: 0.3, vol: 0.09, slide: 0.69, when: i * 0.62 + 0.31, lp: 2600 });
      }
    },
    ult() {
      noise({ f: 300, fEnd: 5000, dur: 0.7, vol: 0.25, q: 0.7 });
      tone({ freq: 60, type: 'sawtooth', dur: 0.9, vol: 0.35, slide: 2.2, lp: 900 });
      tone({ freq: 55, type: 'sine', dur: 0.7, vol: 0.8, slide: 0.4, when: 0.7 });
      noise({ f: 1500, fEnd: 100, dur: 0.8, vol: 0.5, filter: 'lowpass', when: 0.7 });
      [50, 53, 57].forEach(n => tone({ note: n, type: 'square', dur: 0.9, vol: 0.06, when: 0.7, lp: 1600 }));
    },
    awaken() {
      for (let i = 0; i < 10; i++) tone({ note: 48 + i * 2, type: 'square', dur: 0.08, vol: 0.06, when: i * 0.07, lp: 2400 });
      tone({ freq: 40, type: 'sine', dur: 1.2, vol: 0.9, slide: 0.5, when: 0.72 });
      noise({ f: 6000, fEnd: 200, dur: 1.2, vol: 0.45, q: 0.5, when: 0.72 });
      [38, 45, 50, 53].forEach(n => tone({ note: n, type: 'sawtooth', dur: 1.3, vol: 0.05, when: 0.72, lp: 1200 }));
    },
    claim() { SFX.coin(); [84, 88, 91, 96].forEach((n, i) => tone({ note: n, type: 'square', dur: 0.06, vol: 0.06, when: 0.08 + i * 0.04 })); },
  };

  function play(name, arg) {
    if (!ctx || vol.sfx <= 0 || Time.headless) return;
    const now = performance.now();
    // 同じ音の連打で音割れしないように間引く
    if (last[name] && now - last[name] < 28) return;
    last[name] = now;
    try { SFX[name] && SFX[name](arg); } catch (e) { /* noop */ }
  }

  /* ---------- BGM シーケンサ ---------- */
  // コード: [ルートmidi, 種類]  m=マイナー M=メジャー
  const CH = { m: [0, 3, 7, 12], M: [0, 4, 7, 12] };
  const TRACKS = {
    home: {
      bpm: 108, chords: [[48, 'M'], [43, 'M'], [45, 'm'], [41, 'M']],
      bass: '1...1.2.1...1.2.', arp: '0.1.2.3.2.1.0.2.', arpType: 'triangle', arpOct: 24, arpVol: 0.05,
      kick: 'x.......x.......', snare: '....x.......x...', hat: '..x...x...x...x.', drumVol: 0.6,
      lead: [72, 0, 76, 79, 0, 76, 72, 0, 71, 0, 74, 79, 0, 74, 71, 0, 69, 0, 72, 76, 0, 79, 76, 72, 77, 0, 76, 72, 0, 69, 72, 0],
      leadType: 'triangle', leadVol: 0.05,
    },
    battle: {
      bpm: 138, chords: [[45, 'm'], [41, 'M'], [48, 'M'], [43, 'M']],
      bass: '1.2.1.2.1.2.1.23', arp: '0123210301232103', arpType: 'square', arpOct: 24, arpVol: 0.028,
      kick: 'x...x...x...x...', snare: '....x.......x..x', hat: '..x...x...x...x.', drumVol: 0.9,
      lead: [76, 0, 81, 0, 79, 76, 0, 74, 72, 0, 77, 0, 76, 72, 0, 69, 67, 0, 72, 76, 79, 0, 76, 72, 74, 0, 71, 74, 79, 0, 83, 0],
      leadType: 'square', leadVol: 0.035,
    },
    boss: {
      bpm: 150, chords: [[38, 'm'], [46, 'M'], [43, 'm'], [45, 'M']],
      bass: '1111211112111213', arp: '0120312003210123', arpType: 'sawtooth', arpOct: 24, arpVol: 0.022,
      kick: 'x..xx...x..xx...', snare: '....x.......x.xx', hat: 'xxxxxxxxxxxxxxxx', drumVol: 1,
      lead: [74, 74, 0, 77, 0, 81, 0, 77, 74, 0, 70, 0, 74, 77, 0, 74, 70, 70, 0, 74, 0, 79, 0, 74, 73, 0, 76, 0, 79, 0, 81, 0],
      leadType: 'square', leadVol: 0.035,
    },
    // ボスラッシュ：低いD#マイナーの重いリフ。覚醒後(rush2)はテンポと密度が上がる
    rush: {
      bpm: 156, chords: [[39, 'm'], [39, 'm'], [35, 'M'], [37, 'M']],
      bass: '1.1.21.11.1.21.3', arp: '0.0.1.0.2.0.1.3.', arpType: 'sawtooth', arpOct: 24, arpVol: 0.02,
      kick: 'x.x...x.x.x...x.', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.xx', drumVol: 1,
      lead: [75, 0, 75, 74, 0, 70, 0, 0, 75, 0, 78, 0, 77, 75, 74, 0, 71, 0, 71, 70, 0, 66, 0, 0, 73, 0, 75, 0, 77, 0, 78, 0],
      leadType: 'sawtooth', leadVol: 0.028,
    },
    rush2: {
      bpm: 178, chords: [[39, 'm'], [42, 'M'], [35, 'M'], [37, 'M']],
      bass: '1111211121112123', arp: '0123012301230123', arpType: 'sawtooth', arpOct: 24, arpVol: 0.022,
      kick: 'x.xxx.x.x.xxx.x.', snare: '....x..x....x.xx', hat: 'xxxxxxxxxxxxxxxx', drumVol: 1.1,
      lead: [87, 0, 86, 0, 82, 0, 87, 90, 0, 89, 87, 86, 0, 82, 0, 0, 83, 0, 82, 0, 78, 0, 83, 87, 0, 85, 83, 82, 85, 0, 87, 0],
      leadType: 'square', leadVol: 0.03,
    },
    fever: {
      bpm: 172, chords: [[47, 'm'], [43, 'M'], [50, 'M'], [45, 'M']],
      bass: '1212121212121223', arp: '0123012301230123', arpType: 'square', arpOct: 24, arpVol: 0.03,
      kick: 'x...x...x...x...', snare: '....x.......x.x.', hat: 'xxxxxxxxxxxxxxxx', drumVol: 1,
      lead: [78, 0, 83, 0, 81, 78, 0, 76, 74, 0, 79, 0, 78, 74, 0, 71, 69, 0, 74, 78, 81, 0, 78, 74, 76, 0, 73, 76, 81, 0, 85, 88],
      leadType: 'square', leadVol: 0.045,
    },
  };

  let cur = null, curName = null, step = 0, nextTime = 0, timer = null;

  function playStep(tr, s, t) {
    const bar = Math.floor(s / 16) % tr.chords.length;
    const i = s % 16;
    const [root, q] = tr.chords[bar];
    const tones = CH[q];
    const stepDur = 60 / tr.bpm / 4;
    const b = tr.bass[i];
    if (b && b !== '.') {
      const off = b === '1' ? 0 : b === '2' ? 12 : 7;
      schedTone(t, { note: root - 12 + off + 12, type: 'triangle', dur: stepDur * 1.6, vol: 0.16 });
    }
    const a = tr.arp[i];
    if (a && a !== '.') {
      schedTone(t, { note: root + tr.arpOct + tones[+a], type: tr.arpType, dur: stepDur * 0.9, vol: tr.arpVol, lp: 4000 });
    }
    if (tr.lead && i % 2 === 0) {
      const li = (bar * 8 + i / 2) % tr.lead.length;
      const n = tr.lead[li];
      if (n) schedTone(t, { note: n, type: tr.leadType, dur: stepDur * 1.8, vol: tr.leadVol, lp: 3500 });
    }
    const dv = tr.drumVol;
    if (tr.kick[i] === 'x') schedKick(t, dv);
    if (tr.snare[i] === 'x') schedNoise(t, { f: 1800, dur: 0.12, vol: 0.12 * dv, q: 0.7 });
    if (tr.hat[i] === 'x') schedNoise(t, { f: 9000, dur: 0.035, vol: 0.05 * dv, q: 1, filter: 'highpass' });
  }
  function schedTone(t, o) { o.when = t - ctx.currentTime; o.dest = bgmBus; if (o.when >= -0.01) tone(o); }
  function schedNoise(t, o) { o.when = t - ctx.currentTime; o.dest = bgmBus; if (o.when >= -0.01) noise(o); }
  function schedKick(t, dv) {
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(150, t); osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.5 * dv, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(g); g.connect(bgmBus); osc.start(t); osc.stop(t + 0.2);
  }

  function scheduler() {
    if (!cur || !ctx) return;
    const stepDur = 60 / cur.bpm / 4;
    while (nextTime < ctx.currentTime + 0.12) {
      playStep(cur, step, nextTime);
      nextTime += stepDur; step++;
    }
  }

  function bgm(name) {
    if (Time.headless) return;
    if (!init()) return;
    if (name === curName) return;
    curName = name;
    cur = name ? TRACKS[name] : null;
    if (!cur) { clearInterval(timer); timer = null; return; }
    step = 0; nextTime = ctx.currentTime + 0.06;
    if (!timer) timer = setInterval(scheduler, 25);
  }

  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else if (curName || vol.sfx) ctx.resume();
  });

  return { unlock, play, bgm, setVolume, get current() { return curName; }, vol };
})();
