// 複数デッキ：古いセーブからの移行 → 新しいデッキを作って保存 → ステージ前に切り替え → そのデッキでバトル
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const OUT = process.env.OUT || '/tmp/shots';
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-proxy-server'] });
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true })).newPage();
  const errs = [];
  page.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && !/fonts\.g|ERR_FAILED/.test(m.text())) errs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  const FD = process.env.FONTDIR;
  await page.route(/fonts\.googleapis\.com/, r => FD ? r.fulfill({ contentType: 'text/css', body: fs.readFileSync(FD + '/fonts.css', 'utf8') }) : r.abort());
  await page.route(/fonts\.gstatic\.com/, r => { try { r.fulfill({ contentType: 'font/woff2', body: fs.readFileSync(FD + '/' + r.request().url().replace('https://fonts.gstatic.com/', '').replace(/\//g, '_')) }); } catch (e) { r.abort(); } });
  // 古い形式のセーブ（decksなし）を仕込む
  await page.goto('http://localhost:8765/index.html');
  await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('dopaburst_save_v1') || 'null') || Meta.defaults();
    delete d.decks; delete d.deckIdx;
    d.flags = { welcome: true, tutorialDone: true }; d.login = { last: todayStr(), day: 1 };
    for (const c of COLLECTIBLE) d.cards[c.id] = MAXCOPY(c.rarity);
    localStorage.setItem('dopaburst_save_v1', JSON.stringify(d));
  });
  await page.reload();
  await page.waitForTimeout(500);
  const snap = n => page.screenshot({ path: `${OUT}/dk-${n}.png` });
  const mig = await page.evaluate(() => ({ decks: Meta.save.decks.filter(Boolean).map(d => d.name + ':' + d.cards.length), idx: Meta.save.deckIdx, same: Meta.save.deck.join() === Meta.save.decks[0].cards.join() }));
  console.log('migrated', JSON.stringify(mig));
  await page.evaluate(() => Game.enterHome());
  await page.waitForTimeout(300);
  await page.evaluate(() => Screens.show('deck'));
  await page.waitForTimeout(300);
  await snap('01-deck');
  // スロット2（空）を選んで、ブレイズ中心のおまかせで組んで保存
  await page.click('.ds-chip[data-slot="1"]');
  await page.waitForTimeout(200);
  await page.click('[data-f="blaze"]');
  await page.click('[data-a="auto"]');
  await page.waitForTimeout(200);
  await page.click('[data-d="rename"]');
  await page.fill('.name-in', '炎の速攻');
  await page.click('.modal [data-a="ok"]');
  await page.waitForTimeout(200);
  await page.click('[data-a="save"]');
  await page.waitForTimeout(400);
  await snap('02-deck2-saved');
  const st = await page.evaluate(() => ({ idx: Meta.save.deckIdx, name: Meta.activeDeck().name, blaze: Meta.save.deck.filter(id => CARDS[id].tribe === 'blaze').length }));
  console.log('after save', JSON.stringify(st));
  // 未保存の変更があるままスロット切替 → 確認ダイアログ
  await page.click('.deck-list .dl-row');
  await page.click('.ds-chip[data-slot="0"]');
  await page.waitForTimeout(300);
  console.log('confirm shown', await page.evaluate(() => !!$('.modal .menu-col')));
  await page.click('.modal [data-a="d"]');
  await page.waitForTimeout(300);
  // ステージ前に切り替え
  await page.evaluate(() => { Screens.show('stages'); UI.stageDetail('1-2'); });
  await page.waitForTimeout(400);
  await snap('03-stage-chip');
  await page.click('[data-deckpick]');
  await page.waitForTimeout(300);
  await snap('04-picker');
  await page.click('.dp-row[data-i="0"]');
  await page.waitForTimeout(300);
  console.log('picked', await page.evaluate(() => Meta.activeDeck().name + ' / chip=' + $('.deck-chip b').textContent));
  await page.click('.stage-modal [data-a="go"]');
  await page.waitForTimeout(800);
  const used = await page.evaluate(() => B.G.cfg.player.deck.slice().sort().join() === Meta.save.decks[0].cards.slice().sort().join());
  console.log('battle uses picked deck', used);
  console.log('ERRORS:', errs.length ? '\n' + errs.join('\n') : 'none');
  await browser.close();
})();
