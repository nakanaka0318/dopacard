// 交換所・先読みヒント・敵の思考ログを確認する
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const OUT = process.env.OUT || '/tmp/shots';
const URL = process.env.URL || 'http://localhost:8765/index.html';
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-proxy-server'] });
  const vp = (process.env.VP || '390x844').split('x').map(Number);
  const page = await (await browser.newContext({ viewport: { width: vp[0], height: vp[1] }, deviceScaleFactor: 2, hasTouch: true })).newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message + '\n' + e.stack));
  const FD = process.env.FONTDIR;
  await page.route(/fonts\.googleapis\.com/, r => FD ? r.fulfill({ contentType: 'text/css', body: fs.readFileSync(FD + '/fonts.css', 'utf8') }) : r.abort());
  await page.route(/fonts\.gstatic\.com/, r => { try { r.fulfill({ contentType: 'font/woff2', body: fs.readFileSync(FD + '/' + r.request().url().replace('https://fonts.gstatic.com/', '').replace(/\//g, '_')) }); } catch (e) { r.abort(); } });
  await page.goto(URL);
  await page.waitForTimeout(500);
  const tag = 'sh-' + vp.join('x');
  const snap = n => page.screenshot({ path: `${OUT}/${tag}-${n}.png` });
  await page.evaluate(() => { Meta.save.flags.welcome = true; Meta.save.flags.tutorialDone = true; Meta.save.login.last = todayStr(); Meta.save.coins = 9000; Meta.persist(); Game.enterHome(); });
  await page.waitForTimeout(500);
  await snap('01-home');
  await page.click('[data-go="shop"]', { force: true });
  await page.waitForTimeout(400);
  await snap('02-shop');
  // R を交換
  await page.evaluate(() => { UI._shopR = 'R'; UI.shop(); });
  await page.waitForTimeout(200);
  await page.click('.shop-item .shop-buy:not(:disabled)', { force: true });
  await page.waitForTimeout(400);
  await snap('03-confirm');
  await page.click('[data-a="buy"]', { force: true });
  await page.waitForTimeout(1200);
  await snap('04-bought');
  // UR を交換（演出）
  await page.evaluate(() => { UI._shopR = 'UR'; UI.shop(); });
  await page.waitForTimeout(200);
  await page.click('.shop-item .shop-buy:not(:disabled)', { force: true });
  await page.waitForTimeout(300);
  await page.click('[data-a="buy"]', { force: true });
  await page.waitForTimeout(1500);
  await snap('05-ur-reveal');
  await page.click('.reveal', { force: true });
  await page.waitForTimeout(500);
  await snap('06-after');
  const st = await page.evaluate(() => ({ coins: Meta.save.coins, owned: COLLECTIBLE.filter(c => c.rarity === 'UR' && Meta.owned(c.id)).length }));
  console.log('state', JSON.stringify(st));
  // バトル：先読みヒントと敵の思考ログ
  await page.evaluate(() => { Settings.speed = 3; Time.speed = 3; Game.startStage('2-4'); });
  await page.waitForTimeout(400);
  await page.mouse.click(vp[0] / 2, vp[1] / 2);
  await page.waitForTimeout(1800);
  for (let t = 0; t < 3; t++) {
    await page.waitForFunction(() => B.G.over || (!B.G.busy && B.G.active === 0), null, { timeout: 60000 });
    if (await page.evaluate(() => B.G.over)) break;
    await page.evaluate(() => BUI.hint());
    await page.waitForTimeout(600);
    if (t === 1) await snap('07-hint');
    // ヒント通りに打つ
    for (let k = 0; k < 5; k++) {
      const ok = await page.evaluate(async () => {
        if (!BUI.canAct()) return false;
        const plan = await AI.plan(B, 0, { depth: 2, beam: 3, width: 8 });
        const a = plan.actions[0];
        if (!a) return false;
        await BUI.play(a.card, AI.mapTarget(a.tgt, B.G));
        return true;
      });
      if (!ok) break;
    }
    await page.evaluate(() => BUI.endTurn());
    await page.waitForTimeout(500);
  }
  await page.waitForFunction(() => B.G.over || (!B.G.busy && B.G.active === 0), null, { timeout: 60000 });
  await page.evaluate(() => BUI.toggleLog(true));
  await page.waitForTimeout(400);
  await snap('08-log');
  console.log('ERRORS:', errs.length ? '\n' + errs.join('\n') : 'none');
  await browser.close();
})();
