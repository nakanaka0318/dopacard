// ボスラッシュ：ホーム入口 → 一覧 → ボス詳細 → 登場演出 → 必殺技 → 覚醒 → 撃破 を撮影
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const OUT = process.env.OUT || '/tmp/shots';
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-proxy-server'] });
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true })).newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  const FD = process.env.FONTDIR;
  await page.route(/fonts\.googleapis\.com/, r => FD ? r.fulfill({ contentType: 'text/css', body: fs.readFileSync(FD + '/fonts.css', 'utf8') }) : r.abort());
  await page.route(/fonts\.gstatic\.com/, r => { try { r.fulfill({ contentType: 'font/woff2', body: fs.readFileSync(FD + '/' + r.request().url().replace('https://fonts.gstatic.com/', '').replace(/\//g, '_')) }); } catch (e) { r.abort(); } });
  await page.goto('http://localhost:8765/index.html');
  await page.waitForTimeout(500);
  const snap = n => page.screenshot({ path: `${OUT}/br-${n}.png` });
  await page.evaluate(() => {
    const s = Meta.save; s.flags.welcome = true; s.flags.tutorialDone = true; s.login.last = todayStr();
    s.stages['1-4'] = 7; s.rush.wins.br01 = 1; s.rush.tries.br01 = 3; s.rush.best.br01 = 100; s.rush.fastest.br01 = 6; s.rush.tries.br02 = 2; s.rush.best.br02 = 64; s.rush.wins.br07 = 1;
    Meta.persist(); Game.enterHome();
  });
  await page.waitForTimeout(500);
  await snap('01-home');
  await page.evaluate(() => Screens.show('rush'));
  await page.waitForTimeout(600);
  await snap('02-rush');
  await page.evaluate(() => { $('#scr-rush .scroll').scrollTop = 1400; });
  await page.waitForTimeout(300);
  await snap('03-rush-scroll');
  await page.evaluate(() => UI.bossDetail('br20'));
  await page.waitForTimeout(500);
  await snap('04-detail');
  await page.evaluate(() => { Modal.closeAll(); Settings.speed = 1; Time.speed = 1; Game.startRush('br07'); });
  await page.waitForTimeout(600); await snap('05-intro-warn');
  await page.waitForTimeout(1500); await snap('06-intro-name');
  await page.waitForTimeout(1400); await snap('07-intro-full');
  await page.waitForFunction(() => B.G && B.G.active === 0 && !B.G.busy, null, { timeout: 30000 });
  await page.waitForTimeout(400);
  await snap('08-battle');
  // 必殺技をすぐ撃たせる
  await page.evaluate(() => { B.G.P[1].ultCd = 1; BUI.sync(); });
  await page.waitForTimeout(200);
  await snap('09-ult-soon');
  const o = await page.evaluate(() => { window.__ev = []; for (const k of ['bossUlt', 'bossPhase']) { const f = View[k]; View[k] = function (...a) { window.__ev.push(k); return f.apply(this, a); }; } BUI.endTurn(); return 1; });
  await page.waitForFunction(() => window.__ev.includes('bossUlt'), null, { timeout: 30000 });
  await page.waitForTimeout(1000);
  await snap('10-ult');
  await page.waitForFunction(() => B.G.over || (!B.G.busy && B.G.active === 0), null, { timeout: 60000 });
  // 覚醒させる（演出の途中を撮るので await しない）
  await page.evaluate(() => { B.G.P[1].hp = Math.floor(B.G.P[1].maxHp * 0.5) + 5; B.act(async () => { await B.damage(B.spellSrc(0), B.hero(1), 20, { fx: 'fire' }); await B.bossCheck(); }); });
  await page.waitForFunction(() => window.__ev.includes('bossPhase'), null, { timeout: 30000 });
  await page.waitForTimeout(1300);
  await snap('11-awaken');
  await page.waitForFunction(() => !B.G.busy, null, { timeout: 30000 });
  await page.waitForTimeout(400);
  await snap('12-after-awaken');
  // 撃破
  await page.evaluate(() => { B.act(async () => { await B.damage(B.spellSrc(0), B.hero(1), 9999, { fx: 'fire' }); }); });
  await page.waitForSelector('.b-break', { timeout: 20000 });
  await page.waitForTimeout(500);
  await snap('13-break');
  await page.waitForSelector('.results', { timeout: 20000 });
  await page.waitForTimeout(2500);
  await snap('14-result');
  console.log('ERRORS:', errs.length ? '\n' + errs.join('\n') : 'none');
  await browser.close();
})();
