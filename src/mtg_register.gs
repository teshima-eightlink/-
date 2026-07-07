// @ts-nocheck
// ============================================
// MTG日程登録 → 伝説シート 打ち合わせ日登録GAS
//   照合キーを「顧客名」→「伝説シート BA列(顧客№)」に変更（表記ゆれ由来のエラー削減）
//   打ち合わせ列は Q列〜BAの手前まで（顧客№/メモ列を巻き込まないよう制限）
// ============================================

const MTG_REGISTER_CONFIG = {
  TARGET_SPREADSHEET_ID: "1JIXNvOuK_5qLcNaQw6vXg8ciaw7-VgKh6sBXoZAMEqA",
  TARGET_SHEET_NAME: "1年サポート",

  SOURCE_SHEET_NAME: "MTG日程登録",
  LATEST_RESERVATION_SHEET_NAME: "最新予約管理",
  MASTER_SHEET_NAME: "納品後案件",

  // 最新予約管理
  LATEST_CUSTOMER_NO_COL: 2,   // B列：顧客№
  LATEST_MEETING_DATE_COL: 4,  // D列：前回打ち合わせ日

  // MTG日程登録
  SOURCE_CHECK_COL: 1,            // A列：登録チェック
  SOURCE_PROJECT_NAME_COL: 2,     // B列：顧客名
  SOURCE_CUSTOMER_NO_COL: 3,      // C列：顧客№
  SOURCE_REGISTERED_COUNT_COL: 4, // D列：登録済回数
  SOURCE_MEETING_DATE_COL: 5,     // E列：MTG日程
  SOURCE_NEXT_COUNT_COL: 6,       // F列：登録予定回
  SOURCE_STATUS_COL: 7,           // G列：状態

  // 納品後案件（顧客名の表示にだけ使用。無くても動く）
  MASTER_PROJECT_NAME_COL: 1, // A列：顧客名
  MASTER_CUSTOMER_NO_COL: 2,  // B列：顧客№

  // 伝説シート（1年サポート）
  TARGET_PROJECT_NAME_COL: 3,    // C列：顧客名（表示用）
  TARGET_CUSTOMER_NO_COL: 53,    // BA列：顧客№（★照合キー）
  TARGET_MEETING_START_COL: 17,  // Q列：1回目
  TARGET_MEETING_END_COL: 52     // 打ち合わせ列の上限（BA=53の手前まで）
};


// ============================================
// 初期設定
// ============================================
function setMtgRegisterSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = MTG_REGISTER_CONFIG.SOURCE_SHEET_NAME;
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) sheet = ss.insertSheet(sheetName);
  sheet.clear();

  const headers = ["登録", "顧客名", "顧客№", "登録済回数", "MTG日程", "登録予定回", "状態"];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange("L1:M1").setValues([["抽出エラー種別", "抽出エラー詳細"]]);

  sheet.setFrozenRows(1);
  sheet.getRange("A1:G1").setFontWeight("bold").setHorizontalAlignment("center").setVerticalAlignment("middle").setBackground("#d9ead3");
  sheet.getRange("L1:M1").setFontWeight("bold").setHorizontalAlignment("center").setVerticalAlignment("middle").setBackground("#f4cccc");
  sheet.getRange("A:M").setVerticalAlignment("middle");

  sheet.setColumnWidth(1, 70);
  sheet.setColumnWidth(2, 240);
  sheet.setColumnWidth(3, 100);
  sheet.setColumnWidth(4, 100);
  sheet.setColumnWidth(5, 130);
  sheet.setColumnWidth(6, 120);
  sheet.setColumnWidth(7, 120);
  sheet.setColumnWidth(12, 180);
  sheet.setColumnWidth(13, 360);

  sheet.getRange("A:A").setHorizontalAlignment("center");
  sheet.getRange("D:D").setNumberFormat("0").setHorizontalAlignment("center");
  sheet.getRange("E:E").setNumberFormat("yyyy/mm/dd");
  sheet.getRange("F:G").setHorizontalAlignment("center");

  sheet.getRange(2, 1, sheet.getMaxRows() - 1, 1).insertCheckboxes();

  const filter = sheet.getFilter();
  if (filter) filter.remove();
  sheet.getRange("A1:M1").createFilter();

  SpreadsheetApp.getUi().alert("MTG日程登録シートの初期設定が完了しました。");
}


// ============================================
// 最新予約管理から抽出（顧客№で伝説シートBAと照合）
// ============================================
function extractMeetingDatesFromLatestReservation() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  const latestSheet = ss.getSheetByName(MTG_REGISTER_CONFIG.LATEST_RESERVATION_SHEET_NAME);
  const masterSheet = ss.getSheetByName(MTG_REGISTER_CONFIG.MASTER_SHEET_NAME); // 任意
  const targetSS = SpreadsheetApp.openById(MTG_REGISTER_CONFIG.TARGET_SPREADSHEET_ID);
  const densetsuSheet = targetSS.getSheetByName(MTG_REGISTER_CONFIG.TARGET_SHEET_NAME);

  let registerSheet = ss.getSheetByName(MTG_REGISTER_CONFIG.SOURCE_SHEET_NAME);

  if (!latestSheet) { ui.alert("最新予約管理シートが見つかりません。"); return; }
  if (!densetsuSheet) { ui.alert("伝説シートの「1年サポート」が見つかりません。"); return; }
  if (!registerSheet) {
    setMtgRegisterSheet();
    registerSheet = ss.getSheetByName(MTG_REGISTER_CONFIG.SOURCE_SHEET_NAME);
  }

  const latestLastRow = latestSheet.getLastRow();
  if (latestLastRow < 2) { ui.alert("最新予約管理にデータがありません。"); return; }

  // 納品後案件（任意）：顧客№ → 顧客名（表示用）
  const customerNameMap = new Map();
  if (masterSheet) {
    const mLast = masterSheet.getLastRow();
    if (mLast >= 2) {
      const noCol = masterSheet.getRange(2, MTG_REGISTER_CONFIG.MASTER_CUSTOMER_NO_COL, mLast - 1, 1).getValues();
      const nameCol = masterSheet.getRange(2, MTG_REGISTER_CONFIG.MASTER_PROJECT_NAME_COL, mLast - 1, 1).getValues();
      for (let i = 0; i < noCol.length; i++) {
        const no = normalizeNo_(noCol[i][0]);
        const nm = nameCol[i][0];
        if (no && nm && !customerNameMap.has(no)) customerNameMap.set(no, nm);
      }
    }
  }

  // 伝説シート：顧客№(BA) → { row, name(C), meetingValues(Q〜BA手前) }
  const densetsuMap = new Map();
  const dLast = densetsuSheet.getLastRow();
  if (dLast >= 2 && densetsuSheet.getMaxColumns() >= MTG_REGISTER_CONFIG.TARGET_CUSTOMER_NO_COL) {
    const num = dLast - 1;
    const noCol = densetsuSheet.getRange(2, MTG_REGISTER_CONFIG.TARGET_CUSTOMER_NO_COL, num, 1).getValues();
    const nameCol = densetsuSheet.getRange(2, MTG_REGISTER_CONFIG.TARGET_PROJECT_NAME_COL, num, 1).getValues();

    const startCol = MTG_REGISTER_CONFIG.TARGET_MEETING_START_COL;
    const endCol = Math.min(densetsuSheet.getLastColumn(), MTG_REGISTER_CONFIG.TARGET_MEETING_END_COL);
    const meetingValues = (endCol >= startCol)
      ? densetsuSheet.getRange(2, startCol, num, endCol - startCol + 1).getValues()
      : null;

    for (let i = 0; i < num; i++) {
      const no = normalizeNo_(noCol[i][0]);
      if (!no) continue;
      if (densetsuMap.has(no)) continue; // 顧客№重複は先勝ち
      densetsuMap.set(no, {
        row: i + 2,
        name: String(nameCol[i][0] || ""),
        meetingValues: meetingValues ? meetingValues[i] : []
      });
    }
  }

  const latestValues = latestSheet
    .getRange(2, 1, latestLastRow - 1, MTG_REGISTER_CONFIG.LATEST_MEETING_DATE_COL)
    .getValues();

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);

  const rows = [];
  const errorRows = [];

  latestValues.forEach((row, index) => {
    const sourceRow = index + 2;
    const customerNoRaw = row[MTG_REGISTER_CONFIG.LATEST_CUSTOMER_NO_COL - 1];
    const meetingDate = row[MTG_REGISTER_CONFIG.LATEST_MEETING_DATE_COL - 1];

    if (!customerNoRaw || !meetingDate) return;

    // 前日以前のみ抽出
    const meeting = new Date(meetingDate); meeting.setHours(0, 0, 0, 0);
    if (meeting > yesterday) return;

    const no = normalizeNo_(customerNoRaw);
    const densetsuData = densetsuMap.get(no);

    if (!densetsuData) {
      errorRows.push([
        "伝説シート未登録（顧客№）",
        `${sourceRow}行目：顧客№「${customerNoRaw}」が伝説シートのBA列にありません`
      ]);
      return;
    }

    const projectName = customerNameMap.get(no) || densetsuData.name;

    const meetingValues = densetsuData.meetingValues;
    const meetingKey = normalizeDate_(meetingDate);

    const alreadyRegistered = meetingValues.some(v => v && normalizeDate_(v) === meetingKey);
    if (alreadyRegistered) return; // 登録済は抽出しない

    const registeredCount = meetingValues.filter(v => v !== "").length;
    const nextCount = registeredCount + 1;

    rows.push([
      false,
      projectName,
      customerNoRaw,
      registeredCount,
      meetingDate,
      `${nextCount}回目`,
      "登録可能"
    ]);
  });

  const lastRow = registerSheet.getLastRow();
  if (lastRow >= 2) {
    registerSheet.getRange(2, 1, lastRow - 1, 7).clearContent();
    registerSheet.getRange(2, 12, lastRow - 1, 2).clearContent();
  }

  if (rows.length > 0) {
    registerSheet.getRange(2, 1, rows.length, 7).setValues(rows);
    registerSheet.getRange(2, 1, rows.length, 1).insertCheckboxes();
    registerSheet.getRange(2, 4, rows.length, 1).setNumberFormat("0");
    registerSheet.getRange(2, 5, rows.length, 1).setNumberFormat("yyyy/mm/dd");
  }

  if (errorRows.length > 0) {
    registerSheet.getRange(2, 12, errorRows.length, 2).setValues(errorRows);
  }

  let message = `${rows.length}件をMTG日程登録シートへ抽出しました。`;
  if (errorRows.length > 0) {
    message += `\n\n※抽出できなかった案件が${errorRows.length}件あります。\nL:M列に出力しました。`;
  }
  ui.alert(message);
}


// ============================================
// チェックした案件を登録
// ============================================
function registerCheckedMeetingDates() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const sourceSheet = ss.getSheetByName(MTG_REGISTER_CONFIG.SOURCE_SHEET_NAME);

  if (!sourceSheet) { ui.alert("MTG日程登録シートが見つかりません。"); return; }

  const lastRow = sourceSheet.getLastRow();
  if (lastRow < 2) { ui.alert("登録対象がありません。"); return; }

  const values = sourceSheet.getRange(2, 1, lastRow - 1, MTG_REGISTER_CONFIG.SOURCE_STATUS_COL).getValues();

  const checkedRows = [];
  values.forEach((row, index) => {
    const checked = row[MTG_REGISTER_CONFIG.SOURCE_CHECK_COL - 1];
    const status = row[MTG_REGISTER_CONFIG.SOURCE_STATUS_COL - 1];
    if (checked === true && status === "登録可能") checkedRows.push(index + 2);
  });

  if (checkedRows.length === 0) { ui.alert("登録可能でチェックされた案件がありません。"); return; }

  const previews = checkedRows.map(row => ({ row, ...getMeetingDatePreview_(row) }));
  const validPreviews = previews.filter(p => p.status === "success");

  if (validPreviews.length === 0) { ui.alert("入力できる案件がありません。"); return; }

  const projectList = validPreviews.map(p => `${p.projectName}（${p.nextCountLabel}）`).join("\n");
  const confirm = ui.alert("確認", `案件名\n${projectList}\n\n以上${validPreviews.length}件を入力していいですか？`, ui.ButtonSet.YES_NO);
  if (confirm !== ui.Button.YES) return;

  const results = validPreviews.map(p => registerOneMeetingDate_(p.row));
  const successCount = results.filter(r => r.status === "success").length;
  const skippedCount = results.filter(r => r.status === "skipped").length;
  const errorCount = results.filter(r => r.status === "error").length;

  validPreviews.forEach(p => {
    sourceSheet.getRange(p.row, MTG_REGISTER_CONFIG.SOURCE_CHECK_COL).setValue(false);
  });

  ui.alert(`登録完了\n\n登録：${successCount}件\nスキップ：${skippedCount}件\nエラー：${errorCount}件`);
}


// ============================================
// 事前確認用
// ============================================
function getMeetingDatePreview_(sourceRow) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = ss.getSheetByName(MTG_REGISTER_CONFIG.SOURCE_SHEET_NAME);

  if (!sourceSheet) return { status: "error", message: "MTG日程登録シートが見つかりません。" };

  const projectName = sourceSheet.getRange(sourceRow, MTG_REGISTER_CONFIG.SOURCE_PROJECT_NAME_COL).getValue();
  const customerNo = sourceSheet.getRange(sourceRow, MTG_REGISTER_CONFIG.SOURCE_CUSTOMER_NO_COL).getValue();
  const meetingDate = sourceSheet.getRange(sourceRow, MTG_REGISTER_CONFIG.SOURCE_MEETING_DATE_COL).getValue();
  const nextCountLabel = sourceSheet.getRange(sourceRow, MTG_REGISTER_CONFIG.SOURCE_NEXT_COUNT_COL).getValue();
  const status = sourceSheet.getRange(sourceRow, MTG_REGISTER_CONFIG.SOURCE_STATUS_COL).getValue();

  if (!projectName || !customerNo || !meetingDate) {
    return { status: "error", message: `MTG日程登録 ${sourceRow}行目：顧客名・顧客№・MTG日程のいずれかが空です。` };
  }
  if (status !== "登録可能") {
    return { status: "error", message: `「${projectName}」は登録可能ではありません。` };
  }

  return {
    status: "success",
    projectName,
    customerNo,
    meetingDate,
    nextCountLabel: nextCountLabel || "登録予定回未入力"
  };
}


// ============================================
// 1行分登録（顧客№で伝説シートBAを照合）
// ============================================
function registerOneMeetingDate_(sourceRow) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = ss.getSheetByName(MTG_REGISTER_CONFIG.SOURCE_SHEET_NAME);
  const targetSS = SpreadsheetApp.openById(MTG_REGISTER_CONFIG.TARGET_SPREADSHEET_ID);
  const targetSheet = targetSS.getSheetByName(MTG_REGISTER_CONFIG.TARGET_SHEET_NAME);

  if (!sourceSheet) return { status: "error", message: "MTG日程登録シートが見つかりません。" };
  if (!targetSheet) return { status: "error", message: "伝説シートの「1年サポート」が見つかりません。" };

  const projectName = sourceSheet.getRange(sourceRow, MTG_REGISTER_CONFIG.SOURCE_PROJECT_NAME_COL).getValue();
  const customerNo = sourceSheet.getRange(sourceRow, MTG_REGISTER_CONFIG.SOURCE_CUSTOMER_NO_COL).getValue();
  const meetingDate = sourceSheet.getRange(sourceRow, MTG_REGISTER_CONFIG.SOURCE_MEETING_DATE_COL).getValue();

  if (!customerNo || !meetingDate) {
    return { status: "skipped", message: `MTG日程登録 ${sourceRow}行目：顧客№またはMTG日程が空です。` };
  }

  const targetRow = findTargetRowByCustomerNo_(targetSheet, customerNo);
  if (!targetRow) {
    return { status: "error", message: `伝説シートのBA列に顧客№「${customerNo}」が見つかりません。` };
  }

  const meetingCol = findNextMeetingColumn_(targetSheet, targetRow, meetingDate);
  if (!meetingCol) {
    return { status: "skipped", message: `「${projectName || customerNo}」は同じMTG日程が既に登録済み、または空き列がありません。` };
  }

  targetSheet.getRange(targetRow, meetingCol).setValue(meetingDate);
  return { status: "success", message: `「${projectName || customerNo}」のMTG日程を登録しました。` };
}


// ============================================
// 伝説シート：BA列(顧客№)の行を探す
// ============================================
function findTargetRowByCustomerNo_(targetSheet, customerNo) {
  const lastRow = targetSheet.getLastRow();
  if (lastRow < 2) return null;
  if (targetSheet.getMaxColumns() < MTG_REGISTER_CONFIG.TARGET_CUSTOMER_NO_COL) return null;

  const nos = targetSheet
    .getRange(2, MTG_REGISTER_CONFIG.TARGET_CUSTOMER_NO_COL, lastRow - 1, 1)
    .getValues()
    .flat();

  const key = normalizeNo_(customerNo);
  for (let i = 0; i < nos.length; i++) {
    if (normalizeNo_(nos[i]) === key) return i + 2;
  }
  return null;
}


// ============================================
// Q列〜BA手前で最初の空き列を探す
// 同じ日付があれば登録しない（空きが無ければ登録しない＝BA位置を保護）
// ============================================
function findNextMeetingColumn_(targetSheet, targetRow, meetingDate) {
  const startCol = MTG_REGISTER_CONFIG.TARGET_MEETING_START_COL;
  const endCol = Math.min(targetSheet.getLastColumn(), MTG_REGISTER_CONFIG.TARGET_MEETING_END_COL);

  if (endCol < startCol) return startCol; // 打ち合わせ列がまだ無い→1回目(Q)に入れる

  const values = targetSheet.getRange(targetRow, startCol, 1, endCol - startCol + 1).getValues()[0];
  const meetingKey = normalizeDate_(meetingDate);

  // 同じ日付が既にある → 登録しない
  for (let i = 0; i < values.length; i++) {
    if (values[i] && normalizeDate_(values[i]) === meetingKey) return null;
  }
  // 最初の空き列
  for (let i = 0; i < values.length; i++) {
    if (!values[i]) return startCol + i;
  }
  // 空きなし（BAを押し出さないよう列挿入はしない）
  return null;
}


// ============================================
// 表記ゆれ対策
// ============================================
function normalizeNo_(value) {
  let s = String(value == null ? "" : value).normalize("NFKC").replace(/[\s　]+/g, "").trim();
  if (/^\d+\.0+$/.test(s)) s = s.replace(/\.0+$/, ""); // 123.0 → 123
  return s;
}

function normalizeDate_(value) {
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy/MM/dd");
  }
  return String(value || "").trim();
}


// ============================================
// 抽出済みを全件登録
// ============================================
function registerAllExtractedMeetingDates() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const sourceSheet = ss.getSheetByName(MTG_REGISTER_CONFIG.SOURCE_SHEET_NAME);

  if (!sourceSheet) { ui.alert("MTG日程登録シートが見つかりません。"); return; }

  const lastRow = sourceSheet.getLastRow();
  if (lastRow < 2) { ui.alert("登録対象がありません。"); return; }

  const values = sourceSheet.getRange(2, 1, lastRow - 1, MTG_REGISTER_CONFIG.SOURCE_STATUS_COL).getValues();

  const targetRows = [];
  values.forEach((row, index) => {
    const projectName = row[MTG_REGISTER_CONFIG.SOURCE_PROJECT_NAME_COL - 1];
    const customerNo = row[MTG_REGISTER_CONFIG.SOURCE_CUSTOMER_NO_COL - 1];
    const meetingDate = row[MTG_REGISTER_CONFIG.SOURCE_MEETING_DATE_COL - 1];
    const status = row[MTG_REGISTER_CONFIG.SOURCE_STATUS_COL - 1];
    if (projectName && customerNo && meetingDate && status === "登録可能") targetRows.push(index + 2);
  });

  if (targetRows.length === 0) { ui.alert("登録可能な案件がありません。"); return; }

  const previews = targetRows.map(row => ({ row, ...getMeetingDatePreview_(row) }));
  const validPreviews = previews.filter(p => p.status === "success");

  const projectList = validPreviews.map(p => `${p.projectName}（${p.nextCountLabel}）`).join("\n");
  const confirm = ui.alert(
    "確認",
    `抽出されている登録可能な案件をすべて入力します。\n\n案件名\n${projectList}\n\n以上${validPreviews.length}件を入力していいですか？`,
    ui.ButtonSet.YES_NO
  );
  if (confirm !== ui.Button.YES) return;

  const results = validPreviews.map(p => registerOneMeetingDate_(p.row));
  const successCount = results.filter(r => r.status === "success").length;
  const skippedCount = results.filter(r => r.status === "skipped").length;
  const errorCount = results.filter(r => r.status === "error").length;

  ui.alert(`登録完了\n\n登録：${successCount}件\nスキップ：${skippedCount}件\nエラー：${errorCount}件`);
}
