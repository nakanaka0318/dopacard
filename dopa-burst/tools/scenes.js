// 特殊演出を狙って発生させ、スクリーンショットを撮る
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
  const tag = 'sc-' + vp.join('x');
  const snap = async n => page.screenshot({ path: `${OUT}/${tag}-${n}.png` });
  // セーブを作ってホームへ（モーダルは飛ばす）
  await page.evaluate(() => { Meta.save.flags.welcome = true; Meta.save.login.last = todayStr(); Meta.persist(); Game.enterHome(); });
  await page.waitForTimeout(400);
  // チュートリアル付きの1-1
  await page.evaluate(() => { Settings.speed = 1; Time.speed = 1; Game.startStage('1-1'); });
  await page.waitForTimeout(400);
  await page.mouse.click(vp[0] / 2, vp[1] / 2);
  await page.waitForTimeout(2200);
  await snap('01-tutorial');
  // 手札とエナジーを細工して演出を発生させる
  const give = async (ids, energy) => page.evaluate(([ids, energy]) => {
    const P = B.G.P[0];
    P.hand = ids.map(id => ({ uid: B._uid++, id }));
    P.energy = energy; P.maxEnergy = Math.max(P.maxEnergy, 10);
    BUI.sync();
  }, [ids, energy]);
  const playIdx = (i, tgtKind) => page.evaluate(([i, tgtKind]) => {
    const c = B.G.P[0].hand[i];
    const ts = B.targetsFor(0, c);
    const t = ts.find(x => x.kind === tgtKind) || ts[0];
    BUI.play(c, t);
  }, [i, tgtKind]);
  const idle = () => page.waitForFunction(() => !B.G.busy, null, { timeout: 30000 });

  await give(['n_dog', 'n_dog', 'n_dog', 'l_slot', 'l_joker', 'b_dragon', 's_bolt', 'su_cake'], 30);
  await playIdx(0); await idle();
  await playIdx(0, 'merge'); await page.waitForTimeout(400); await snap('02-merge'); await idle();
  await playIdx(0, 'merge'); await page.waitForTimeout(700); await snap('03-awaken'); await idle();
  // カードを選択した状態（合体先の表示）
  await page.evaluate(() => BUI.select(B.G.P[0].hand[0].uid));
  await page.waitForTimeout(300);
  await snap('04-select-spell');
  await page.evaluate(() => BUI.deselect());
  await playIdx(0); await page.waitForTimeout(1500); await snap('05-slot'); await idle(); await page.waitForTimeout(300);
  await playIdx(0); await page.waitForTimeout(1300); await snap('06-roulette'); await idle();
  await playIdx(0); await page.waitForTimeout(1000); await snap('07-cutin'); await idle();
  await snap('08-board');
  // フィーバー
  await page.evaluate(() => { B.G.P[0].fever = 100; BUI.sync(); });
  await page.waitForTimeout(200);
  await snap('09-fever-ready');
  await page.evaluate(() => BUI.fever());
  await page.waitForTimeout(900);
  await snap('10-fever');
  await idle();
  // 攻撃してクリティカルを強制
  await page.evaluate(() => { R._n = R.next; R.next = () => 0.01; });
  await page.evaluate(() => BUI.endTurn());
  await page.waitForTimeout(2600);
  await snap('11-attack');
  await page.evaluate(() => { R.next = R._n; });
  await page.waitForFunction(() => B.G.over || (!B.G.busy && B.G.active === 0), null, { timeout: 60000 });
  await page.waitForTimeout(500);
  // 長押しプレビュー
  const u = await page.$('.row-p .unit');
  if (u) {
    const bb = await u.boundingBox();
    await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(650);
    await snap('12-longpress');
    await page.mouse.up();
  }
  // 勝利させてリザルト（ボーナスチャンスを強制）
  if (!(await page.evaluate(() => B.G.over))) {
    await page.evaluate(() => { const w = Meta.winExtras.bind(Meta); Meta.winExtras = o => { w(o); o.chance = true; }; B.G.P[1].hp = 5; BUI.sync(); });
    await page.evaluate(() => BUI.endTurn());
  }
  await page.waitForFunction(() => document.querySelector('.results'), null, { timeout: 60000 });
  await page.waitForTimeout(4500);
  await snap('13-results');
  const cb = await page.$('[data-chance]');
  if (cb) { await cb.click({ force: true }); await page.waitForTimeout(3500); await snap('14-bonus'); }
  // ランク戦の開始画面
  await page.evaluate(() => { Modal.closeAll(); Game.startRank(); });
  await page.waitForTimeout(800);
  await snap('15-rank-vs');
  console.log('ERRORS:', errs.length ? '\n' + errs.join('\n') : 'none');
  await browser.close();
})();
