/**
 * スプレッドシート自動化のサンプル
 *
 * 使い方：
 *  1. 対象スプレッドシートの「拡張機能 > Apps Script」を開く
 *  2. このファイルの中身を貼り付けて保存
 *  3. fillTodayDate を実行（初回は権限の承認が必要）
 */

/**
 * A列が空欄の行に、今日の日付を書き込むサンプル。
 * 実際の要件に合わせて Claude が書き換えます。
 */
function fillTodayDate() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 1) return;

  const range = sheet.getRange(1, 1, lastRow, 1); // A列
  const values = range.getValues();
  const today = new Date();

  for (let i = 0; i < values.length; i++) {
    if (values[i][0] === '' || values[i][0] === null) {
      values[i][0] = today;
    }
  }
  range.setValues(values);
}

/**
 * シートを開いたときにカスタムメニューを追加するサンプル。
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('自動処理')
    .addItem('今日の日付を入れる', 'fillTodayDate')
    .addToUi();
}
