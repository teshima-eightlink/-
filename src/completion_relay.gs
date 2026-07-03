// @ts-nocheck
//==================================================
// 制作完了リレー
//   外注さんが「外部共有用」スプシのK列(制作完了日)を入力
//     → 公開URLで大元「顧客サイト管理情報一覧(案件一覧)」と照合
//     → 大元 I列(制作完了日) へ書き込み
//     → 「制作完了ログ」に新しい完了だけ蓄積（LINEを見なくても分かる）
//
//   実行：runCompletionRelay（時間トリガーで自動）／setupCompletionLog（初回）
//        previewCompletionRelay（書き込みなしの確認）／installCompletionTrigger（自動化）
//
//   ※ 実行者は 3つのスプシ（外部共有用/大元/ログ）に read・write 権限が必要です。
//==================================================

const COMPLETION_CONFIG = {
  // ① 外注さん入力（外部共有用）
  EXTERNAL_SPREADSHEET_ID: "1jt8m3VycZr68DrrNDBVfcQm9GWpZJNyabXnFaGxK_xQ",
  EXTERNAL_SHEET_NAME: "外部共有用",
  EXT_NAME_COL: 1,   // A：顧客名
  EXT_URL_COL: 2,    // B：公開URL
  EXT_DONE_COL: 11,  // K：制作完了日

  // ② 大元「顧客サイト管理情報一覧」
  MASTER_SPREADSHEET_ID: "1ROGUwwU2VhY_oRN6btT49jMAAnZNtzR1jr7TSFIlWiQ",
  MASTER_SHEET_NAME: "案件一覧",
  MST_NAME_COL: 4,       // D：顧客名
  MST_DONE_COL: 9,       // I：制作完了日（ここへ書き込む）
  MST_URL_COL: 15,       // O：公開URL（照合キー）
  MST_DIRECTOR_COL: 7,   // G：ディレ（HP制作担当）
  MST_HEARING_COL: 8,    // H：ヒアリング（自部署担当）

  // ③ 制作完了ログ
  LOG_SPREADSHEET_ID: "17okkRhyvkfrzVdTlC2Z5lmOXcm_wEweaqah8CNAHUMw",
  LOG_SHEET_NAME: "制作完了ログ",

  START_ROW: 2
};

//==================================================
// 初期セットアップ（制作完了ログ シートを作成）
//==================================================

function setupCompletionLog() {
  const ss = SpreadsheetApp.openById(COMPLETION_CONFIG.LOG_SPREADSHEET_ID);
  let sheet = ss.getSheetByName(COMPLETION_CONFIG.LOG_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(COMPLETION_CONFIG.LOG_SHEET_NAME);

  sheet.getRange(1, 1, 1, 8).setValues([[
    "記録日時",
    "顧客名",
    "公開URL",
    "制作完了日",
    "HP制作担当",
    "自部署担当",
    "大元反映",
    "キー"
  ]]);

  sheet.setFrozenRows(1);

  sheet.setColumnWidth(1, 150); // 記録日時
  sheet.setColumnWidth(2, 240); // 顧客名
  sheet.setColumnWidth(3, 280); // 公開URL
  sheet.setColumnWidth(4, 120); // 制作完了日
  sheet.setColumnWidth(5, 140); // HP制作担当
  sheet.setColumnWidth(6, 140); // 自部署担当
  sheet.setColumnWidth(7, 200); // 大元反映

  sheet.getRange("A:H").setVerticalAlignment("top");
  sheet.getRange("A1:H1").setFontWeight("bold").setBackground("#d9ead3");
  sheet.getRange("A2:A").setNumberFormat("yyyy/MM/dd HH:mm");
  sheet.getRange("D2:D").setNumberFormat("yyyy/MM/dd");
  sheet.getRange("C:C").setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);

  sheet.hideColumns(8); // キー（重複防止用・非表示）

  Logger.log("「制作完了ログ」シートを準備しました。");
}

//==================================================
// メイン：制作完了リレー（時間トリガーで実行）
//==================================================

function runCompletionRelay() {
  processCompletion_(false);
}

// 書き込みなしのプレビュー（大元・ログに書かず、結果をログ出力するだけ）
function previewCompletionRelay() {
  processCompletion_(true);
}

function processCompletion_(dryRun) {
  const ext = SpreadsheetApp.openById(COMPLETION_CONFIG.EXTERNAL_SPREADSHEET_ID)
    .getSheetByName(COMPLETION_CONFIG.EXTERNAL_SHEET_NAME);
  if (!ext) throw new Error("外部共有用シートが見つかりません。");

  const master = SpreadsheetApp.openById(COMPLETION_CONFIG.MASTER_SPREADSHEET_ID)
    .getSheetByName(COMPLETION_CONFIG.MASTER_SHEET_NAME);
  if (!master) throw new Error("大元「案件一覧」シートが見つかりません。");

  const logSS = SpreadsheetApp.openById(COMPLETION_CONFIG.LOG_SPREADSHEET_ID);
  let log = logSS.getSheetByName(COMPLETION_CONFIG.LOG_SHEET_NAME);
  if (!log) {
    setupCompletionLog();
    log = logSS.getSheetByName(COMPLETION_CONFIG.LOG_SHEET_NAME);
  }

  // 大元インデックス（公開URL・顧客名 → 行番号）
  const mLast = master.getLastRow();
  const mByUrl = {};
  const mByName = {};
  if (mLast >= COMPLETION_CONFIG.START_ROW) {
    const cols = Math.max(master.getLastColumn(), COMPLETION_CONFIG.MST_URL_COL);
    const mData = master.getRange(2, 1, mLast - 1, cols).getValues();
    mData.forEach((r, i) => {
      const rowNum = i + 2;
      const url = normUrlC_(r[COMPLETION_CONFIG.MST_URL_COL - 1]);
      const name = normNameC_(r[COMPLETION_CONFIG.MST_NAME_COL - 1]);
      if (url && !mByUrl[url]) mByUrl[url] = rowNum;
      if (name && !mByName[name]) mByName[name] = rowNum;
    });
  }

  // 既存ログのキー（重複防止）
  const seen = {};
  const lLast = log.getLastRow();
  if (lLast >= 2) {
    log.getRange(2, 8, lLast - 1, 1).getValues().forEach(k => {
      const key = String(k[0] || "").trim();
      if (key) seen[key] = true;
    });
  }

  // 外注入力を読む
  const eLast = ext.getLastRow();
  const report = [];
  if (eLast < COMPLETION_CONFIG.START_ROW) {
    Logger.log("外部共有用に対象行がありません。");
    return;
  }

  const cols = Math.max(ext.getLastColumn(), COMPLETION_CONFIG.EXT_DONE_COL);
  const eData = ext.getRange(2, 1, eLast - 1, cols).getValues();

  const now = new Date();
  const newLogRows = [];

  eData.forEach((r, i) => {
    const extRow = i + 2;
    const doneDate = r[COMPLETION_CONFIG.EXT_DONE_COL - 1];
    if (!doneDate) return; // 完了日が未入力の行はスキップ

    const rawUrl = String(r[COMPLETION_CONFIG.EXT_URL_COL - 1] || "").trim();
    const rawName = String(r[COMPLETION_CONFIG.EXT_NAME_COL - 1] || "").trim();
    const url = normUrlC_(rawUrl);
    const name = normNameC_(rawName);

    const key = url ? ("url:" + url) : (name ? ("name:" + name) : "");
    if (!key) return;

    // 大元と照合
    let mRow = url ? mByUrl[url] : null;
    if (!mRow && name) mRow = mByName[name];

    let director = "";
    let hearing = "";
    let reflect = "";

    if (mRow) {
      director = master.getRange(mRow, COMPLETION_CONFIG.MST_DIRECTOR_COL).getValue();
      hearing = master.getRange(mRow, COMPLETION_CONFIG.MST_HEARING_COL).getValue();
      const cur = master.getRange(mRow, COMPLETION_CONFIG.MST_DONE_COL).getValue();

      if (!cur) {
        if (!dryRun) master.getRange(mRow, COMPLETION_CONFIG.MST_DONE_COL).setValue(doneDate);
        reflect = "反映済";
      } else if (sameDateC_(cur, doneDate)) {
        reflect = "反映済（既存）";
      } else {
        reflect = "要確認（大元に別の完了日）";
      }
    } else {
      reflect = "該当なし（大元）";
    }

    report.push(`外部${extRow}行: ${rawName || rawUrl} → ${reflect}`);

    if (!seen[key]) {
      newLogRows.push([now, rawName, rawUrl, doneDate, director, hearing, reflect, key]);
      seen[key] = true;
    }
  });

  if (!dryRun && newLogRows.length > 0) {
    log.getRange(log.getLastRow() + 1, 1, newLogRows.length, 8).setValues(newLogRows);
  }

  const summary =
    (dryRun ? "【プレビュー（書き込みなし）】\n" : "【実行】\n") +
    "対象（完了日入力あり）：" + report.length + " 件\n" +
    "ログ新規追加：" + (dryRun ? "（プレビューのため未追加）" : newLogRows.length) + " 件\n" +
    report.join("\n");

  Logger.log(summary);
  try {
    SpreadsheetApp.getUi().alert("制作完了リレー", summary, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    // UIが無い実行方法（トリガー等）ではログのみ
  }
}

//==================================================
// 時間トリガー設定（1時間おきに runCompletionRelay）
//==================================================

function installCompletionTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === "runCompletionRelay") {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger("runCompletionRelay")
    .timeBased()
    .everyHours(1)
    .create();

  Logger.log("時間トリガーを設定しました（1時間おきに runCompletionRelay）。");
}

//==================================================
// ユーティリティ
//==================================================

function normUrlC_(url) {
  return String(url || "")
    .trim()
    .toLowerCase()
    .replace(/^http:\/\//, "https://")
    .replace(/^https:\/\/www\./, "https://")
    .replace(/#.*$/, "")
    .replace(/\/index\.(html?|php)$/, "")
    .replace(/[?&]$/, "")
    .replace(/\/+$/, "");
}

function normNameC_(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/　/g, "")
    .trim()
    .toLowerCase();
}

function sameDateC_(a, b) {
  const da = toDateC_(a);
  const db = toDateC_(b);
  if (!da || !db) return false;
  return da.getFullYear() === db.getFullYear()
    && da.getMonth() === db.getMonth()
    && da.getDate() === db.getDate();
}

function toDateC_(v) {
  if (v instanceof Date) return v;
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}
