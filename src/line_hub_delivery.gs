// @ts-nocheck
//==================================================
// LINE貼付ハブ ― 納品完了パート
//   ・納品完了ログの初期化・再構築
//   ・区分（TOP / 全ページ）の判定
//
//   ※ 解析パート（line_hub_analyze.gs）・修正管理パート（line_hub_fix.gs）
//     と同じGASプロジェクトに置いてください。グローバルを共有します。
//   ※ 実行は line_hub_fix.gs の runLineHub / setupLineHubSheets から呼ばれます。
//==================================================

//==================================================
// 初期セットアップ（納品完了ログ）
//==================================================

function setupDeliveryLogSheet_(ss) {
  let sheet = ss.getSheetByName(LINE_HUB_CONFIG.DELIVERY_LOG_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(LINE_HUB_CONFIG.DELIVERY_LOG_SHEET_NAME);

  sheet.getRange(1, 1, 1, 11).setValues([[
    "貼り付け日",
    "区分",
    "状態",
    "案件名",
    "URL",
    "制作担当",
    "CMSログイン先",
    "ドキュメント",
    "備考",
    "納品ID",
    "元LINE行"
  ]]);

  sheet.setFrozenRows(1);

  sheet.setColumnWidth(1, 110);
  sheet.setColumnWidth(2, 90);
  sheet.setColumnWidth(3, 110);
  sheet.setColumnWidth(4, 240);
  sheet.setColumnWidth(5, 260);
  sheet.setColumnWidth(6, 120);
  sheet.setColumnWidth(7, 240);
  sheet.setColumnWidth(8, 200);
  sheet.setColumnWidth(9, 260);

  sheet.getRange("A:K").setVerticalAlignment("top");
  sheet.getRange("A1:K1").setFontWeight("bold").setBackground("#fce5cd");
  sheet.getRange("A2:A").setNumberFormat("yyyy/MM/dd");

  // B列：区分（TOP/全ページ）
  const scopeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["TOP", "全ページ"], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange("B2:B").setDataValidation(scopeRule);

  // C列：状態（未対応/対応中/対応完了）
  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["未対応", "対応中", "対応完了"], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange("C2:C").setDataValidation(statusRule);

  sheet.getRange("E:E").setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
  sheet.getRange("G:G").setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
  sheet.getRange("H:I").setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);

  // J・K（納品ID・元LINE行）を非表示
  sheet.hideColumns(10, 2);
}

//==================================================
// 納品完了ログ再構築
//==================================================

function rebuildDeliveryLog_() {
  const ss = getLineHubSpreadsheet_();
  const lineSheet = ss.getSheetByName(LINE_HUB_CONFIG.LINE_SHEET_NAME);
  const sheet = ss.getSheetByName(LINE_HUB_CONFIG.DELIVERY_LOG_SHEET_NAME);
  if (!sheet) return;

  const lightweightMap = getLightweightMap_();

  // 既存の手入力（状態・ドキュメント・備考）を納品IDで保持
  const keepMap = {};
  const oldLastRow = sheet.getLastRow();

  if (oldLastRow >= 2) {
    const old = sheet.getRange(2, 1, oldLastRow - 1, 11).getValues();

    old.forEach(row => {
      const id = row[9]; // J：納品ID
      if (!id) return;

      keepMap[id] = {
        status: row[2],    // C：状態
        document: row[7],  // H：ドキュメント
        note: row[8]       // I：備考
      };
    });
  }

  const lastRow = lineSheet.getLastRow();

  if (lastRow < 2) {
    if (oldLastRow >= 2) {
      sheet.getRange(2, 1, oldLastRow - 1, 11).clearContent();
    }
    return;
  }

  const rows = lineSheet.getRange(2, 1, lastRow - 1, 8).getValues();
  const output = [];

  rows.forEach((row, index) => {
    const sourceRow = index + 2;
    const type = row[0];
    const raw = row[1];

    if (type !== "納品完了" || !raw) return;

    const parsed = parseLineText_(raw, type);
    const finalUrl = row[4] || parsed.url;

    const check = checkLightweight_(parsed.projectName, finalUrl, lightweightMap);

    // ★案件名・制作担当・CMSログイン先は軽量版案件一覧からURL照合で取得
    // （軽量版に無い場合、案件名は本文からの抽出をフォールバックに使う）
    const projectName = check.lightProjectName || row[3] || parsed.projectName;
    const tanto = check.lightTanto || "";
    const cms = check.lightCms || "";

    const scope = detectDeliveryScope_(raw);
    const pastedAt = row[6] || new Date();

    const id = `DLV-${String(sourceRow).padStart(5, "0")}`;
    const keep = keepMap[id] || {};

    output.push([
      pastedAt,               // A：貼り付け日
      scope,                  // B：区分
      keep.status || "未対応", // C：状態
      projectName,            // D：案件名 ★
      finalUrl,               // E：URL
      tanto,                  // F：制作担当 ★
      cms,                    // G：CMSログイン先 ★
      keep.document || "",    // H：ドキュメント
      keep.note || "",        // I：備考
      id,                     // J：納品ID（非表示）
      sourceRow               // K：元LINE行（非表示）
    ]);
  });

  if (oldLastRow >= 2) {
    sheet.getRange(2, 1, oldLastRow - 1, 11).clearContent();
  }

  if (output.length > 0) {
    sheet.getRange(2, 1, output.length, 11).setValues(output);
  }
}

/**
 * 本文から「TOP / 全ページ」の区分を判定する。
 * ・「全ページ」の記載あり → 全ページ
 * ・「TOP」の記載あり → TOP
 * ・どちらの記載もない → 全ページ
 */
function detectDeliveryScope_(text) {
  const raw = String(text || "");

  if (/全ページ|全ぺージ/.test(raw)) return "全ページ";
  if (/TOP|ＴＯＰ|トップ/i.test(raw)) return "TOP";
  return "全ページ";
}
