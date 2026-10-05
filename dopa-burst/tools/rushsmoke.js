// ボスラッシュ全20体を画面つきで数ターンずつ動かし、必殺技と覚醒も強制発動させてエラーが出ないか確認する
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-proxy-server'] });
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto('http://localhost:8765/index.html');
  await page.waitForTimeout(400);
  await page.evaluate(() => { const s = Meta.save; s.flags.welcome = true; s.flags.tutorialDone = true; s.login.last = todayStr(); s.stages['1-4'] = 7; Meta.persist(); Settings.tips = false; Game.enterHome(); });
  for (let n = 1; n <= 20; n++) {
    const id = 'br' + String(n).padStart(2, '0');
    const before = errs.length;
    await page.evaluate(id => { Modal.closeAll(); Time.speed = 12; Game.startRush(id); }, id);
    await page.waitForTimeout(150);
    await page.mouse.click(195, 420); // 登場演出をスキップ
    await page.waitForFunction(() => B.G && B.G.active === 0 && !B.G.busy, null, { timeout: 30000 });
    const r = await page.evaluate(async () => {
      Time.speed = 12;
      const step = () => B.act(async () => { await AI.takeTurn(B, 0); await B.endTurn(0); await B.beginTurn(1); await AI.takeTurn(B, 1); await B.endTurn(1); await B.beginTurn(0); });
      for (let t = 0; t < 7 && !B.G.over; t++) {
        if (t === 1) B.G.P[1].ultCd = 1;
        if (t === 2) B.G.P[1].hp = Math.min(B.G.P[1].hp, Math.floor(B.G.P[1].maxHp * 0.3));
        await step();
      }
      return { over: B.G.over, round: B.G.round, phase: B.G.P[1].phase, hp: B.G.P[1].hp };
    });
    console.log(id, JSON.stringify(r), errs.length > before ? 'ERR ' + errs.slice(before).join(' | ').slice(0, 300) : 'ok');
    await page.waitForTimeout(300);
  }
  console.log('TOTAL ERRORS', errs.length, errs.join(' || ').slice(0, 600));
  await browser.close();
})();
