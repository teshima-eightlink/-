// @ts-nocheck
//==================================================
// シート内容をワンクリックでクリップボードにコピー
//   ・「入力欄」シートにボタンを置き、各シートの内容をコピー
//   ・GASから直接クリップボードには書けないため、ポップアップを開いて自動コピー
//   ・コピー範囲は COPY_CONFIG.RANGES で設定（空なら使用範囲すべて）
//
//   ボタンに割り当てる関数：
//     copyKanseiHoukoku / copyKanseiHoukokuNew /
//     copyLoginInfo / copyLoginInfoNew / copyAfterFollow
//==================================================

const COPY_CONFIG = {
  // シート名 → コピーする範囲（A1表記）。"" にすると そのシートの使用範囲すべて。
  //   例： "A1:B30" のように指定
  RANGES: {
    "完成報告": "A1:A65",
    "完成報告（新規アドレス）": "A1:A95",
    "ログイン情報": "A1:A60",
    "ログイン情報 （新規アドレス）": "A1:A89",
    "アフターフォロー": "A1:A90"
  }
};

//==================================================
// 各ボタン用（図形ボタンにこの関数を割り当て）
//==================================================
function copyKanseiHoukoku()    { copyToClipboard_("完成報告"); }
function copyKanseiHoukokuNew() { copyToClipboard_("完成報告（新規アドレス）"); }
function copyLoginInfo()        { copyToClipboard_("ログイン情報"); }
function copyLoginInfoNew()     { copyToClipboard_("ログイン情報 （新規アドレス）"); }
function copyAfterFollow()      { copyToClipboard_("アフターフォロー"); }

//==================================================
// 指定シートの内容をコピー用ポップアップで開く
//==================================================
function copyToClipboard_(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    SpreadsheetApp.getUi().alert("「" + sheetName + "」シートが見つかりません。\nシート名を確認してください。");
    return;
  }

  const a1 = (COPY_CONFIG.RANGES && COPY_CONFIG.RANGES[sheetName]) ? String(COPY_CONFIG.RANGES[sheetName]).trim() : "";
  const text = buildClipboardText_(sheet, a1);

  if (!text) {
    SpreadsheetApp.getUi().alert("「" + sheetName + "」にコピーする内容がありません。");
    return;
  }

  showClipboardDialog_("「" + sheetName + "」をコピー", text);
}

//==================================================
// 範囲の表示値をテキスト化（タブ区切り／改行）
//==================================================
function buildClipboardText_(sheet, a1) {
  const range = a1 ? sheet.getRange(a1) : sheet.getDataRange();
  const rows = range.getDisplayValues();

  // 末尾の空行を除去
  while (rows.length && rows[rows.length - 1].every(c => String(c).trim() === "")) {
    rows.pop();
  }

  return rows.map(r => r.join("\t")).join("\n");
}

//==================================================
// コピー用ポップアップ（開くと自動でクリップボードへ）
//==================================================
function showClipboardDialog_(title, text) {
  const safe = String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const html = `
    <div style="font-family:sans-serif;font-size:13px;color:#333">
      <p id="msg" style="margin:0 0 10px">下の「コピー」ボタンを押してください（または枠内で Ctrl/⌘+C）</p>
      <textarea id="t" style="width:100%;height:225px;box-sizing:border-box;font-family:monospace;font-size:12px">${safe}</textarea>
      <div style="margin-top:12px;text-align:center">
        <button onclick="doCopy()" style="padding:10px 30px;font-size:15px;font-weight:bold;cursor:pointer;background:#1a73e8;color:#fff;border:none;border-radius:6px">📋 コピー</button>
      </div>
      <script>
        function selectAll(){
          var t = document.getElementById('t');
          t.focus(); t.select(); t.setSelectionRange(0, 999999);
          return t;
        }
        function doCopy(){
          var t = selectAll();
          function ok(){ document.getElementById('msg').textContent = '✅ コピーしました！そのまま貼り付けできます（このウィンドウは閉じてOK）'; }
          function manual(){ document.getElementById('msg').textContent = '枠内を全選択しました。Ctrl/⌘+C でコピーしてください'; }
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(t.value).then(ok, tryExec);
          } else {
            tryExec();
          }
          function tryExec(){
            var done = false;
            try { done = document.execCommand('copy'); } catch (e) {}
            done ? ok() : manual();
          }
        }
        // 開いた時点では選択だけ（自動コピーは失敗表示の元になるのでしない）
        window.onload = selectAll;
      </script>
    </div>
  `;

  const output = HtmlService.createHtmlOutput(html).setWidth(480).setHeight(380);
  SpreadsheetApp.getUi().showModalDialog(output, title);
}
