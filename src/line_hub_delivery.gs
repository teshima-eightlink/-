// @ts-nocheck
//==================================================
// LINE貼付ハブ ― 制作チェックパート
//   ・「制作チェック」シートの初期化・再構築
//   ・区分（TOP / 全ページ）の判定
//
//   対象種別：TOP制作完了 / 全ページ制作完了 / 納品前最終チェック / 納品完了
//     （LINE_HUB_CONFIG.DELIVERY_TYPES で管理）
//
//   ※ 解析パート（line_hub_analyze.gs）・修正管理パート（line_hub_fix.gs）
//     と同じGASプロジェクトに置いてください。グローバルを共有します。
//   ※ 実行は line_hub_fix.gs の runLineHub / setupLineHubSheets から呼ばれます。
//==================================================

//==================================================
// ボタン用（制作チェックシートだけを安全に追加）
//   既存の LINE貼付・修正管理・修正完了ログには一切触れません。
//==================================================

function setupDeliveryLogOnly() {
  const ss = getLineHubSpreadsheet_();
  setupDeliveryLogSheet_(ss);
  Logger.log("「制作チェック」シートを準備しました（既存シートは変更していません）。");
}

//==================================================
// 初期セットアップ（制作チェック）
//==================================================

function setupDeliveryLogSheet_(ss) {
  let sheet = ss.getSheetByName(LINE_HUB_CONFIG.DELIVERY_LOG_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(LINE_HUB_CONFIG.DELIVERY_LOG_SHEET_NAME);

  sheet.getRange(1, 1, 1, 12).setValues([[
    "貼り付け日",
    "種別",
    "区分",
    "状態",
    "案件名",
    "URL",
    "制作担当",
    "CMSログイン先",
    "ドキュメント",
    "備考",
    "レコードID",
    "元LINE行"
  ]]);

  sheet.setFrozenRows(1);

  sheet.setColumnWidth(1, 110);  // 貼り付け日
  sheet.setColumnWidth(2, 130);  // 種別
  sheet.setColumnWidth(3, 90);   // 区分
  sheet.setColumnWidth(4, 110);  // 状態
  sheet.setColumnWidth(5, 240);  // 案件名
  sheet.setColumnWidth(6, 260);  // URL
  sheet.setColumnWidth(7, 120);  // 制作担当
  sheet.setColumnWidth(8, 240);  // CMSログイン先
  sheet.setColumnWidth(9, 200);  // ドキュメント
  sheet.setColumnWidth(10, 260); // 備考

  sheet.getRange("A:L").setVerticalAlignment("top");
  sheet.getRange("A1:L1").setFontWeight("bold").setBackground("#fce5cd");
  sheet.getRange("A2:A").setNumberFormat("yyyy/MM/dd");

  // B列：種別（制作チェック対象の種別）
  const typeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(LINE_HUB_CONFIG.DELIVERY_TYPES, true)
    .setAllowInvalid(true)
    .build();
  sheet.getRange("B2:B").setDataValidation(typeRule);

  // C列：区分（TOP/全ページ）
  const scopeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["TOP", "全ページ"], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange("C2:C").setDataValidation(scopeRule);

  // D列：状態（未対応/対応中/対応完了）
  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["未対応", "対応中", "対応完了"], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange("D2:D").setDataValidation(statusRule);

  sheet.getRange("E:E").setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
  sheet.getRange("F:F").setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
  sheet.getRange("H:H").setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
  sheet.getRange("I:J").setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);

  // K・L（レコードID・元LINE行）を非表示
  sheet.hideColumns(11, 2);
}

//==================================================
// 制作チェック再構築
//==================================================

function rebuildDeliveryLog_() {
  const ss = getLineHubSpreadsheet_();
  const lineSheet = ss.getSheetByName(LINE_HUB_CONFIG.LINE_SHEET_NAME);
  const sheet = ss.getSheetByName(LINE_HUB_CONFIG.DELIVERY_LOG_SHEET_NAME);
  if (!sheet) return;

  const lightweightMap = getLightweightMap_();

  // 既存の手入力（状態・ドキュメント・備考）をレコードIDで保持
  const keepMap = {};
  const oldLastRow = sheet.getLastRow();

  if (oldLastRow >= 2) {
    const old = sheet.getRange(2, 1, oldLastRow - 1, 12).getValues();

    old.forEach(row => {
      const id = row[10]; // K：レコードID
      if (!id) return;

      keepMap[id] = {
        status: row[3],    // D：状態
        document: row[8],  // I：ドキュメント
        note: row[9]       // J：備考
      };
    });
  }

  const lastRow = lineSheet.getLastRow();

  if (lastRow < 2) {
    if (oldLastRow >= 2) {
      sheet.getRange(2, 1, oldLastRow - 1, 12).clearContent();
    }
    return;
  }

  const rows = lineSheet.getRange(2, 1, lastRow - 1, 8).getValues();
  const output = [];

  rows.forEach((row, index) => {
    const sourceRow = index + 2;
    const type = row[0];
    const raw = row[1];

    if (!isDeliveryType_(type) || !raw) return;

    const parsed = parseLineText_(raw, type);
    const finalUrl = row[4] || parsed.url;

    const check = checkLightweight_(parsed.projectName, finalUrl, lightweightMap);

    // ★案件名・制作担当・CMSログイン先は軽量版案件一覧からURL照合で取得
    // （軽量版に無い場合、案件名は本文からの抽出をフォールバックに使う）
    const projectName = check.lightProjectName || row[3] || parsed.projectName;
    const tanto = check.lightTanto || "";
    const cms = check.lightCms || "";

    const scope = resolveScope_(type, raw);
    const pastedAt = row[6] || new Date();

    const id = `CHK-${String(sourceRow).padStart(5, "0")}`;
    const keep = keepMap[id] || {};

    output.push([
      pastedAt,               // A：貼り付け日
      type,                   // B：種別
      scope,                  // C：区分
      keep.status || "未対応", // D：状態
      projectName,            // E：案件名 ★
      finalUrl,               // F：URL
      tanto,                  // G：制作担当 ★
      cms,                    // H：CMSログイン先 ★
      keep.document || "",    // I：ドキュメント
      keep.note || "",        // J：備考
      id,                     // K：レコードID（非表示）
      sourceRow               // L：元LINE行（非表示）
    ]);
  });

  if (oldLastRow >= 2) {
    sheet.getRange(2, 1, oldLastRow - 1, 12).clearContent();
  }

  if (output.length > 0) {
    sheet.getRange(2, 1, output.length, 12).setValues(output);
  }
}

/**
 * 区分（TOP / 全ページ）を決定する。
 * ・種別が「TOP制作完了」→ TOP
 * ・種別が「全ページ制作完了」→ 全ページ
 * ・それ以外（納品前最終チェック・納品完了）→ 本文から判定
 */
function resolveScope_(type, raw) {
  if (type === "TOP制作完了") return "TOP";
  if (type === "全ページ制作完了") return "全ページ";
  return detectDeliveryScope_(raw);
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
