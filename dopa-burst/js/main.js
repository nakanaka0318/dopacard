'use strict';
/* ===== 起動・画面遷移・バトル開始と終了 ===== */

const RIVAL_TAUNTS = ['よろしくお願いしまーす！', 'あと1戦だけ…のつもり', '寝る前の1戦いきます', '連勝止めてやるよ', 'ガチャ爆死の腹いせです', '倍速でいくぞ', '負けたら課金…はしない'];

const Game = {
  get save() { return Meta.save; },

  boot() {
    Meta.load();
    Time.speed = Settings.speed;
    Time.reduced = !!Settings.reduced;
    document.body.classList.toggle('reduced', Time.reduced);
    this.applyVolume();
    FX.init();
    Screens.show('title');
    // 操作中のダブルタップ拡大やスクロールを抑止
    document.addEventListener('dblclick', e => e.preventDefault());
    document.addEventListener('pointerdown', () => Sound.unlock(), { once: true });
  },

  applyVolume() {
    Sound.setVolume('bgm', Settings.muted ? 0 : Settings.bgm);
    Sound.setVolume('sfx', Settings.muted ? 0 : Settings.sfx);
  },
  toggleMute() { Settings.muted = !Settings.muted; this.applyVolume(); this.saveSettings(); },
  saveSettings() { Meta.saveSettings(); },

  async enterHome() {
    this.applyVolume();
    Screens.show('home');
    const s = Meta.save;
    if (!s.flags.welcome) {
      s.flags.welcome = true; Meta.persist();
      await this.welcome();
    }
    const lb = Meta.loginCheck();
    if (lb) await this.loginBonus(lb);
    if (Screens.cur === 'home') UI.home();
  },

  welcome() {
    return new Promise(res => {
      const box = Modal.open(`
        <div class="welcome">
          <div class="wl-ava">🧠</div>
          <h2>ようこそ！</h2>
          <p>ナビの<b>ドパ美</b>だよ！<br>ここは脳汁ドバドバのカードバトル界。<br>まずは<b>はじめましてプレゼント</b>を受け取って！</p>
          <div class="wl-gift">${rewardChips({ coins: 300, tickets: 3, premium: 1 })}</div>
          <button class="btn big hot" type="button" data-a="ok">受け取る！</button>
        </div>`, { dismiss: false, cls: 'welcome-m' });
      FX.confetti(120);
      Sound.play('levelup');
      box.addEventListener('click', ev => {
        const a = ev.target.closest('[data-a]'); if (!a) return;
        Modal.close();
        celebrate('GET!!', Meta.rewardText({ coins: 300, tickets: 3, premium: 1 }));
        res();
      });
    });
  },

  loginBonus(lb) {
    return new Promise(res => {
      const box = Modal.open(`
        <h2>ログインボーナス</h2>
        <p class="lb-day"><b>${lb.day}</b>日目！</p>
        <div class="lc-row">${LOGIN_REWARDS.map((rw, i) => `<div class="lc-day ${i < lb.day - 1 ? 'got' : ''} ${i === lb.day - 1 ? 'today' : ''} ${i === 6 ? 'big' : ''}"><span class="lc-n">${i + 1}日</span><span class="lc-rw">${rewardChips(rw)}</span>${i < lb.day - 1 ? '<span class="lc-stamp">GET</span>' : ''}</div>`).join('')}</div>
        <p class="lb-next">${lb.day < 7 ? `明日は ${Meta.rewardText(LOGIN_REWARDS[lb.day])} ！` : '7日コンプリート!! また1日目から！'}</p>
        <button class="btn big hot" type="button" data-a="ok">受け取る！</button>`, { dismiss: false, cls: 'login-m' });
      setTimeout(() => {
        const t = $('.lc-day.today', box);
        if (!t) return;
        t.insertAdjacentHTML('beforeend', '<span class="lc-stamp new">GET</span>');
        Sound.play('star');
        const c = centerOf(t); FX.burst(c.x, c.y, { count: 30, colors: ['#ffd23f', '#ff3d8b', '#fff'], speed: 7, type: 'star' });
      }, 500);
      $('[data-a]', box).addEventListener('click', () => {
        Modal.close();
        celebrate('GET!!', Meta.rewardText(lb.reward));
        res();
      });
    });
  },

  playerCfg() {
    const s = Meta.save;
    return { name: s.name, avatar: s.avatar, hp: 300, deck: s.deck.slice(), fever: true };
  },

  checkDeck() {
    if (Meta.validDeck(Meta.save.deck)) return true;
    Sound.play('error');
    FX.toast('デッキが20枚になっていないよ！ 編成しよう');
    Screens.show('deck');
    return false;
  },

  startStage(id) {
    if (!this.checkDeck()) return;
    const s = STAGES[id];
    BUI.start({
      mode: 'stage', stageId: id, boss: !!s.boss, quote: s.quote,
      tutorial: !!s.tutorial && !Meta.save.flags.tutorialDone,
      player: this.playerCfg(), enemy: stageConfig(id),
    });
  },

  startRush(id) {
    if (!this.checkDeck()) return;
    const b = BOSSES[id];
    BUI.start({
      mode: 'rush', bossId: id, boss: true, rush: true, quote: b.quote,
      player: Object.assign(this.playerCfg(), { hp: RUSH_PLAYER_HP }), enemy: rushConfig(id),
    });
  },

  startRank() {
    if (!this.checkDeck()) return;
    const rival = rivalConfig(Meta.save.rank.rp);
    BUI.start({ mode: 'rank', boss: false, quote: R.pick(RIVAL_TAUNTS), player: this.playerCfg(), enemy: rival });
  },

  onBattleEnd(res, cfg) {
    let out;
    if (cfg.mode === 'stage') {
      out = Meta.stageResult(cfg.stageId, res);
      if (cfg.tutorial && res.win) Meta.save.flags.tutorialDone = true;
    } else if (cfg.mode === 'rush') {
      out = Meta.rushResult(cfg.bossId, res);
    } else {
      out = Meta.rankResult(res, cfg.enemy);
    }
    Meta.persist();
    setTimeout(() => UI.results(res, out, cfg), 250);
  },
};

if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', () => Game.boot());
else Game.boot();
