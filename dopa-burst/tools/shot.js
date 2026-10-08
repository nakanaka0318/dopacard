// ブラウザで実際に動かしてスクリーンショットとエラーを確認する
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const OUT = process.env.OUT || '/tmp/shots';
const URL = process.env.URL || 'http://localhost:8765/index.html';
const fs = require('fs');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-proxy-server', '--autoplay-policy=no-user-gesture-required'] });
  const vp = (process.env.VP || '390x844').split('x').map(Number);
  const ctx = await browser.newContext({ viewport: { width: vp[0], height: vp[1] }, deviceScaleFactor: 2, hasTouch: !!process.env.TOUCH, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message + '\n' + e.stack));
  // Google Fonts はローカルに落としたものを返す
  const FD = process.env.FONTDIR;
  if (FD) {
    await page.route(/fonts\.googleapis\.com/, r => r.fulfill({ contentType: 'text/css', body: fs.readFileSync(FD + '/fonts.css', 'utf8') }));
    await page.route(/fonts\.gstatic\.com/, r => {
      const f = r.request().url().replace('https://fonts.gstatic.com/', '').replace(/\//g, '_');
      try { r.fulfill({ contentType: 'font/woff2', body: fs.readFileSync(FD + '/' + f) }); } catch (e) { r.abort(); }
    });
  } else await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto(URL);
  await page.waitForTimeout(600);
  await page.evaluate(() => document.fonts.ready);
  console.log('fonts:', await page.evaluate(() => [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family).join(',')));
  const tag = vp.join('x');
  const snap = async n => { await page.screenshot({ path: `${OUT}/${tag}-${n}.png` }); };
  await snap('01-title');
  await page.mouse.click(vp[0] / 2, vp[1] / 2);
  await page.waitForTimeout(1500);
  await snap('02-welcome');
  await page.click('[data-a="ok"]', { force: true });
  await page.waitForTimeout(1200);
  await snap('02b-login');
  await page.click('[data-a="ok"]', { force: true });
  await page.waitForTimeout(1500);
  await snap('02c-home');
  await page.click('[data-go="gacha"]', { force: true });
  await page.waitForTimeout(500);
  await snap('03-gacha');
  await page.click('.g-btn[data-t="p1"]', { force: true });
  await page.waitForTimeout(500);
  await snap('04-pack');
  await page.click('.pack.big', { force: true });
  await page.waitForTimeout(2200);
  await snap('05-pack-open');
  // 全部めくる（SSRなら演出をタップで閉じる）
  await page.click('[data-a="all"]', { force: true });
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(500);
    if (await page.$('.reveal')) { await snap('06-reveal'); await page.click('.reveal', { force: true }); }
  }
  await page.waitForTimeout(1200);
  await snap('07-summary');
  await page.click('[data-a="close"]', { force: true });
  await page.waitForTimeout(300);
  // ホーム
  await page.evaluate(() => Screens.show('home'));
  await page.waitForTimeout(400);
  await snap('08-home');
  await page.evaluate(() => Screens.show('stages'));
  await page.waitForTimeout(300);
  await snap('09-stages');
  await page.evaluate(() => Screens.show('deck'));
  await page.waitForTimeout(300);
  await snap('10-deck');
  await page.evaluate(() => Screens.show('dex'));
  await page.waitForTimeout(300);
  await snap('11-dex');
  await page.evaluate(() => Screens.show('missions'));
  await page.waitForTimeout(300);
  await snap('12-missions');
  await page.evaluate(() => Screens.show('settings'));
  await page.waitForTimeout(300);
  await snap('13-settings');
  // バトル
  await page.evaluate(() => { Settings.speed = 3; Time.speed = 3; Game.startStage('2-4'); });
  await page.waitForTimeout(700);
  await snap('14-vs');
  await page.mouse.click(vp[0] / 2, vp[1] / 2);
  await page.waitForTimeout(2500);
  await snap('15-battle-start');
  // 手札を選択
  const hc = await page.$('.hcard.playable');
  if (hc) { await hc.click({ force: true }); await page.waitForTimeout(400); await snap('16-selected'); }
  // 自動で数ターン遊ぶ
  for (let turn = 0; turn < 14; turn++) {
    const over = await page.evaluate(() => !B.G || B.G.over);
    if (over) break;
    for (let k = 0; k < 6; k++) {
      const played = await page.evaluate(async () => {
        if (!BUI.canAct()) return false;
        const P = B.G.P[0];
        if (B.canFever(0)) { await BUI.fever(); return true; }
        const c = P.hand.find(x => B.canPlay(0, x));
        if (!c) return false;
        const ts = B.targetsFor(0, c);
        const t = ts.find(x => x.kind === 'merge') || ts.find(x => x.kind === 'hero') || ts[0];
        await BUI.play(c, t);
        return true;
      });
      if (!played) break;
      if (turn === 1 && k === 0) await snap('17-midturn');
    }
    if (turn === 2) await snap('18-before-attack');
    await page.evaluate(() => BUI.endTurn());
    await page.waitForTimeout(300);
    if (turn === 2) { await page.waitForTimeout(500); await snap('19-attacking'); }
    await page.waitForFunction(() => !B.G || B.G.over || (!B.G.busy && B.G.active === 0), null, { timeout: 60000 });
  }
  await page.waitForTimeout(3500);
  await snap('20-result');
  console.log('ERRORS:', errs.length ? '\n' + errs.join('\n') : 'none');
  const st = await page.evaluate(() => ({ over: B.G.over, winner: B.G.winner, round: B.G.round, hp: [B.G.P[0].hp, B.G.P[1].hp] }));
  console.log(JSON.stringify(st));
  await browser.close();
})();
