// 未知なる軸のカードと初心者サポートを狙って動かし、撮影する
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const OUT = process.env.OUT || '/tmp/shots';
const URL = process.env.URL || 'http://localhost:8765/index.html';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-proxy-server'] });
  const vp = (process.env.VP || '390x844').split('x').map(Number);
  const ctx = await browser.newContext({ viewport: { width: vp[0], height: vp[1] }, deviceScaleFactor: 2, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message + '\n' + e.stack));
  const FD = process.env.FONTDIR;
  await page.route(/fonts\.googleapis\.com/, r => FD ? r.fulfill({ contentType: 'text/css', body: fs.readFileSync(FD + '/fonts.css', 'utf8') }) : r.abort());
  await page.route(/fonts\.gstatic\.com/, r => { try { r.fulfill({ contentType: 'font/woff2', body: fs.readFileSync(FD + '/' + r.request().url().replace('https://fonts.gstatic.com/', '').replace(/\//g, '_')) }); } catch (e) { r.abort(); } });
  await page.goto(URL);
  await page.waitForTimeout(500);
  const tag = 'ax-' + vp.join('x');
  const snap = async n => page.screenshot({ path: `${OUT}/${tag}-${n}.png` });
  await page.evaluate(() => { Meta.save.flags.welcome = true; Meta.save.flags.tutorialDone = true; Meta.save.login.last = todayStr(); Meta.persist(); Game.enterHome(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => { Settings.speed = 1; Time.speed = 1; Game.startStage('3-1'); });
  await page.waitForTimeout(400);
  await page.mouse.click(vp[0] / 2, vp[1] / 2);
  await page.waitForTimeout(2300);
  const idle = () => page.waitForFunction(() => !B.G.busy, null, { timeout: 30000 });
  // 敵の盤面と手札を細工
  await page.evaluate(async () => {
    const E = B.G.P[1];
    E.board = [null, null, null, null, null];
    B.view = null; // 置くだけなので演出なし
    await B.summon(1, 'b_ogre', 1); await B.summon(1, 'n_dog', 2); await B.summon(1, 's_snowman', 3);
    B.view = View;
    const P = B.G.P[0];
    P.hand = ['c_bomb', 'w_mouse', 'mi_copycat', 'r_boxer', 'so_leopard', 'w_gate', 'mi_thief', 'c_tower'].map(id => ({ uid: B._uid++, id }));
    P.energy = 30; P.maxEnergy = 10;
    BUI.sync();
  });
  await page.waitForTimeout(400);
  await snap('01-hand');
  const play = (id, kind, lane) => page.evaluate(([id, kind, lane]) => {
    const c = B.G.P[0].hand.find(x => x.id === id);
    const ts = B.targetsFor(0, c);
    const t = ts.find(x => x.kind === kind && (lane == null || x.lane === lane || (x.u && x.u.lane === lane))) || ts[0];
    BUI.play(c, t);
  }, [id, kind, lane]);
  await play('c_bomb', 'lane', 0); await idle();
  await play('w_mouse', 'lane', 4); await idle();
  await play('mi_copycat', 'lane', 1); await page.waitForTimeout(900); await snap('02-transform'); await idle();
  await play('r_boxer', 'lane', 3); await page.waitForTimeout(500); await snap('03-payhp'); await idle();
  await page.waitForTimeout(300);
  await snap('04-predict');
  // ヒント
  await page.evaluate(() => BUI.hint());
  await page.waitForTimeout(500);
  await snap('05-hint');
  await page.evaluate(() => BUI.deselect());
  await play('mi_thief', 'lane', 2); await page.waitForTimeout(2300); await snap('06-steal'); await idle();
  // フィーバー（PP+3のみ）
  await page.evaluate(() => { B.G.P[0].fever = 100; BUI.sync(); });
  await page.evaluate(() => BUI.fever());
  await page.waitForTimeout(1200);
  await snap('07-fever');
  await idle();
  await page.evaluate(() => BUI.sync());
  await page.waitForTimeout(300);
  await snap('08-after-fever');
  // アタック → 敵ターン → 自分のターン（カウントダウン）
  await page.evaluate(() => BUI.endTurn());
  await page.waitForTimeout(3000);
  await snap('09-attack');
  await page.waitForFunction(() => B.G.over || (!B.G.busy && B.G.active === 0), null, { timeout: 90000 });
  await page.waitForTimeout(400);
  await snap('10-next-turn');
  // ログを開く
  await page.evaluate(() => BUI.toggleLog(true));
  await page.waitForTimeout(400);
  await snap('11-log');
  await page.evaluate(() => BUI.toggleLog(false));
  // 遊び方
  await page.evaluate(() => UI.howto());
  await page.waitForTimeout(400);
  await page.evaluate(() => { const m = document.querySelector('.modal'); m.scrollTop = m.scrollHeight; });
  await page.waitForTimeout(200);
  await snap('12-howto');
  await page.evaluate(() => Modal.closeAll());
  // 自動ヒント（9秒放置）
  if (!(await page.evaluate(() => B.G.over))) {
    await page.waitForTimeout(9800);
    await snap('13-autohint');
  }
  // ステージ画面（ワールド6）と図鑑
  await page.evaluate(() => { Meta.save.stages['2-4'] = 1; Meta.persist(); Screens.show('stages', 6); });
  await page.waitForTimeout(400);
  await snap('14-world6');
  await page.evaluate(() => { COLLECTIBLE.forEach(c => { Meta.save.cards[c.id] = 1; }); Screens.show('dex'); });
  await page.waitForTimeout(300);
  await page.evaluate(() => { const s = document.querySelector('#scr-dex .scroll'); s.scrollTop = s.scrollHeight; });
  await page.waitForTimeout(300);
  await snap('15-dex');
  console.log('ERRORS:', errs.length ? '\n' + errs.join('\n') : 'none');
  await browser.close();
})();
