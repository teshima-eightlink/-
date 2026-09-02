/**
 * 確認項目のタイルが、どの画面幅でも最終行に空きマスを作らないか検証する
 *
 * 空きマスが出ると、そこだけ背景色の塊に見えてしまうため、
 * 列数が項目数（6）を必ず割り切ることを確認する。
 *
 * 使い方: node tools/test-grid.js
 */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const browser = await chromium.launch();
  let ng = 0;
  const widths = [1400, 1200, 1000, 950, 900, 820, 768, 600, 480, 375, 320];
  console.log('幅      列数  行数  空きマス');
  for (const w of widths) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 } });
    await page.goto('file:///home/user/-/preview/kubikori-katakori.html');
    const r = await page.locator('.symptom__check-inner').evaluate((el) => {
      const cols = getComputedStyle(el).gridTemplateColumns.split(' ').length;
      const n = el.children.length;
      const rows = Math.ceil(n / cols);
      return { cols, n, rows, empty: cols * rows - n };
    });
    console.log(`${String(w).padEnd(7)} ${String(r.cols).padEnd(5)} ${String(r.rows).padEnd(5)} ${r.empty}${r.empty === 0 ? ' ✓' : ' ✗'}`);
    ng += r.empty === 0 ? 0 : 1;
    await page.close();
  }
  await browser.close();
  console.log(ng === 0 ? '\n✓ すべての幅で空きマスはありません' : `\n✗ ${ng}件の幅で空きマスが出ます`);
  process.exit(ng > 0 ? 1 : 0);
})();
