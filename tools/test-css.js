/**
 * WAF対応版CSSが、元のCSSと同じ見た目になるかを検証する
 *
 * 変数を展開しコメントを削除した paste/symptom-css.txt が、
 * theme/assets/css/symptom.css と同じ描画結果になるかを、
 * 実際にChromiumで描画して計算後のスタイルを突き合わせて確認する。
 *
 * 使い方: node tools/test-css.js
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'preview/kubikori-katakori.html'), 'utf8');
const safeCss = fs.readFileSync(path.join(root, 'paste/symptom-css.txt'), 'utf8');

// 比較するプロパティ（色・余白・線・レイアウト）
const PROPS = [
  'background-color', 'color', 'border-top-width', 'border-left-width',
  'border-top-color', 'border-left-color', 'border-radius',
  'margin-top', 'margin-bottom', 'padding-top', 'padding-left',
  'display', 'font-weight', 'font-size', 'text-align', 'gap',
];

async function collect(page) {
  return page.evaluate((props) => {
    const out = {};
    document.querySelectorAll('.symptom__inner *').forEach((el, i) => {
      const cs = getComputedStyle(el);
      const key = `${i}:${el.tagName}.${el.className}`;
      out[key] = props.map((p) => cs.getPropertyValue(p)).join('|');
      const before = getComputedStyle(el, '::before');
      const after = getComputedStyle(el, '::after');
      out[key + '::before'] = props.map((p) => before.getPropertyValue(p)).join('|') + '|' + before.content;
      out[key + '::after'] = props.map((p) => after.getPropertyValue(p)).join('|') + '|' + after.content;
    });
    return out;
  }, PROPS);
}

(async () => {
  const browser = await chromium.launch();

  // 元のCSSのまま
  const p1 = await browser.newPage({ viewport: { width: 1000, height: 900 } });
  await p1.setContent(html);
  const original = await collect(p1);

  // 症状ページのCSSをWAF対応版に差し替える
  const swapped = html.replace(
    /<style id="abc-symptom-css">[\s\S]*?<\/style>/,
    `<style id="abc-symptom-css">${safeCss}</style>`
  );
  if (swapped === html) {
    console.error('✗ CSSの差し替えに失敗しました（style タグが見つかりません）');
    process.exit(1);
  }
  const p2 = await browser.newPage({ viewport: { width: 1000, height: 900 } });
  await p2.setContent(swapped);
  const safe = await collect(p2);

  await browser.close();

  const keys = Object.keys(original);
  const diffs = keys.filter((k) => original[k] !== safe[k]);

  console.log(`比較した要素・擬似要素: ${keys.length}件`);
  console.log(`比較したプロパティ: ${PROPS.length}種類\n`);

  if (diffs.length === 0) {
    console.log('✓ 元のCSSとWAF対応版で、描画結果は完全に一致しました');
    process.exit(0);
  }

  console.log(`✗ ${diffs.length}件の差異があります:`);
  diffs.slice(0, 10).forEach((k) => {
    console.log(`\n  ${k}\n    元   : ${original[k]}\n    対応版: ${safe[k]}`);
  });
  process.exit(1);
})();
