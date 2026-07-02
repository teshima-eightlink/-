// @ts-nocheck
//==================================================
// LINE貼付ハブ ― 修正管理パート
//   ・修正管理シート／修正完了ログの初期化・再構築
//   ・表示・色・フィルター
//
//   ※ 実行ボタン（runLineHub ほか）は解析パート（line_hub_analyze.gs）に
//     まとめています。
//   ※ 解析パート（line_hub_analyze.gs）・制作チェックパート（line_hub_delivery.gs）
//     と同じGASプロジェクトに置いてください。グローバルを共有します。
//==================================================

//==================================================
// 初期セットアップ（修正管理・修正完了ログ）
//==================================================

function setupFixManagementSheet_(ss) {
  let sheet = ss.getSheetByName(LINE_HUB_CONFIG.FIX_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(LINE_HUB_CONFIG.FIX_SHEET_NAME);

  sheet.getRange("A1").setValue("すべて");

  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList([
      "すべて",
      "お客さんに報告",
      "IT部対応待ち",
      "IT部要確認",
      "URL確認",
      "紐付け確認",
      "判定要確認",
      "完了・報告済"
    ], true)
    .setAllowInvalid(false)
    .build();

  sheet.getRange("A1").setDataValidation(statusRule);
  sheet.getRange("A1:M1").setBackground("#fff2cc").setFontWeight("bold");
  sheet.setRowHeight(1, 42);

  sheet.getRange(2, 1, 1, 13).setValues([[
    "状態",
    "案件名",
    "依頼内容",
    "完了内容",
    "依頼日",
    "期限",
    "最終完了日",
    "報告済",
    "メモ",
    "URL",
    "管理ID",
    "URL確認",
    "紐付け確認"
  ]]);

  sheet.setFrozenRows(2);
  sheet.setRowHeight(2, 36);

  sheet.setColumnWidth(1, 150);
  sheet.setColumnWidth(2, 260);
  sheet.setColumnWidth(3, 430);
  sheet.setColumnWidth(4, 430);
  sheet.setColumnWidth(5, 120);
  sheet.setColumnWidth(6, 120);
  sheet.setColumnWidth(7, 120);
  sheet.setColumnWidth(8, 90);
  sheet.setColumnWidth(9, 260);

  sheet.getRange("A:M").setVerticalAlignment("top");
  sheet.getRange("A2:M2").setFontWeight("bold").setBackground("#cfe2f3");
  sheet.getRange("E3:G").setNumberFormat("yyyy/MM/dd");
  sheet.getRange("H3:H").insertCheckboxes();

  sheet.hideColumns(10, 4);

  createFixManagementFilter_();
}

function setupDoneLogSheet_(ss) {
  let sheet = ss.getSheetByName(LINE_HUB_CONFIG.DONE_LOG_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(LINE_HUB_CONFIG.DONE_LOG_SHEET_NAME);

  sheet.getRange(1, 1, 1, 9).setValues([[
    "完了ID",
    "案件名",
    "URL",
    "完了内容",
    "完了担当者",
    "完了日時",
    "紐付け先管理ID",
    "状態",
    "元LINE行"
  ]]);

  sheet.setFrozenRows(1);

  sheet.setColumnWidth(1, 120);
  sheet.setColumnWidth(2, 260);
  sheet.setColumnWidth(3, 260);
  sheet.setColumnWidth(4, 420);
  sheet.setColumnWidth(5, 120);
  sheet.setColumnWidth(6, 140);
  sheet.setColumnWidth(7, 140);
  sheet.setColumnWidth(8, 140);

  sheet.getRange("A:I").setVerticalAlignment("top");
  sheet.getRange("A1:I1").setFontWeight("bold").setBackground("#ead1dc");
}

//==================================================
// 修正完了ログ作成
//==================================================

function rebuildDoneLog_() {
  const ss = getLineHubSpreadsheet_();
  const lineSheet = ss.getSheetByName(LINE_HUB_CONFIG.LINE_SHEET_NAME);
  const doneSheet = ss.getSheetByName(LINE_HUB_CONFIG.DONE_LOG_SHEET_NAME);
  const lightweightMap = getLightweightMap_();

  const oldLinkMap = {};
  const oldLastRow = doneSheet.getLastRow();

  if (oldLastRow >= 2) {
    const oldValues = doneSheet.getRange(2, 1, oldLastRow - 1, 9).getValues();

    oldValues.forEach(row => {
      const doneId = row[0];
      if (!doneId) return;

      oldLinkMap[doneId] = {
        linkedId: row[6],
        status: row[7]
      };
    });
  }

  const lastRow = lineSheet.getLastRow();

  if (lastRow < 2) {
    if (oldLastRow >= 2) {
      doneSheet.getRange(2, 1, oldLastRow - 1, 9).clearContent();
    }
    return;
  }

  const rows = lineSheet.getRange(2, 1, lastRow - 1, 8).getValues();
  const output = [];

  rows.forEach((row, index) => {
    const sourceRow = index + 2;
    const type = row[0];
    const raw = row[1];

    if (type !== "修正完了" || !raw) return;

    const parsed = parseLineText_(raw, type);

    const finalUrl = row[4] || parsed.url;
    parsed.url = finalUrl;

    const check = checkLightweight_(parsed.projectName, finalUrl, lightweightMap);
    const projectName = check.lightProjectName || row[3] || parsed.projectName;

    const doneId = `DONE-${String(sourceRow).padStart(5, "0")}`;
    const old = oldLinkMap[doneId] || {};

    output.push([
      doneId,
      projectName,
      finalUrl,
      parsed.content,
      parsed.staff,
      row[6] || new Date(),
      old.linkedId || "",
      old.status || "未紐付け",
      sourceRow
    ]);
  });

  if (oldLastRow >= 2) {
    doneSheet.getRange(2, 1, oldLastRow - 1, 9).clearContent();
  }

  if (output.length > 0) {
    doneSheet.getRange(2, 1, output.length, 9).setValues(output);
  }
}

//==================================================
// 修正管理再構築
//==================================================

function rebuildFixManagement_() {
  const ss = getLineHubSpreadsheet_();
  const lineSheet = ss.getSheetByName(LINE_HUB_CONFIG.LINE_SHEET_NAME);
  const fixSheet = ss.getSheetByName(LINE_HUB_CONFIG.FIX_SHEET_NAME);
  const doneSheet = ss.getSheetByName(LINE_HUB_CONFIG.DONE_LOG_SHEET_NAME);
  const lightweightMap = getLightweightMap_();

  const keepMap = {};
  const fixLastRow = fixSheet.getLastRow();

  if (fixLastRow >= 3) {
    const old = fixSheet.getRange(3, 1, fixLastRow - 2, 13).getValues();

    old.forEach(row => {
      const id = row[10];
      if (!id) return;

      keepMap[id] = {
        deadline: row[5],
        reported: row[7],
        memo: row[8]
      };
    });
  }

  const lineLastRow = lineSheet.getLastRow();

  if (lineLastRow < 2) {
    if (fixLastRow >= 3) {
      fixSheet.getRange(3, 1, fixLastRow - 2, 13).clearContent();
    }
    applyStatusFilter_();
    return;
  }

  const lineRows = lineSheet.getRange(2, 1, lineLastRow - 1, 8).getValues();
  const requests = [];

  lineRows.forEach((row, index) => {
    const sourceRow = index + 2;
    const type = row[0];
    const raw = row[1];

    if (type !== "修正依頼" || !raw) return;

    const requestAt = row[6] || new Date();
    const parsed = parseLineText_(raw, type);
    const parsedDeadline = parseDeadlineFromTitle_(raw, requestAt);
    const manualDeadline = row[2];
    const autoDeadline = addBusinessDays_(requestAt, LINE_HUB_CONFIG.LIMIT_BUSINESS_DAYS);
    const deadline = manualDeadline || parsedDeadline || autoDeadline;

    const url = row[4] || parsed.url;
    parsed.url = url;

    const check = checkLightweight_(parsed.projectName, url, lightweightMap);
    const projectName = check.lightProjectName || row[3] || parsed.projectName;

    const managementId = `REQ-${String(sourceRow).padStart(5, "0")}`;

    requests.push({
      id: managementId,
      projectName,
      url,
      requestContent: parsed.content,
      requestAt,
      deadline,
      key: makeFixKey_(projectName, url),
      sourceRow
    });
  });

  const doneLogs = getDoneLogs_(doneSheet);

  const requestMap = {};
  requests.forEach(req => {
    if (!requestMap[req.key]) requestMap[req.key] = [];
    requestMap[req.key].push(req);
  });

  doneLogs.forEach(done => {
    if (done.linkedId) return;

    const candidates = (requestMap[done.key] || []).filter(req => {
      const keep = keepMap[req.id] || {};
      return keep.reported !== true;
    });

    if (candidates.length === 1) {
      done.linkedId = candidates[0].id;
      done.status = "自動紐付け";
    } else if (candidates.length >= 2) {
      done.status = "紐付け確認";
    } else {
      done.status = "紐付け先なし";
    }
  });

  writeDoneLogLinks_(doneSheet, doneLogs);

  const doneByRequestId = {};
  const ambiguousKeySet = {};

  doneLogs.forEach(done => {
    if (done.status === "紐付け確認") {
      ambiguousKeySet[done.key] = true;
    }

    if (!done.linkedId) return;

    if (!doneByRequestId[done.linkedId]) {
      doneByRequestId[done.linkedId] = [];
    }

    doneByRequestId[done.linkedId].push(done);
  });

  const now = new Date();

  const output = requests.map(req => {
    const keep = keepMap[req.id] || {};
    const deadline = req.deadline || keep.deadline || "";
    const reported = keep.reported === true;
    const doneItems = doneByRequestId[req.id] || [];
    const lightCheck = checkLightweight_(req.projectName, req.url, lightweightMap);
    const hasAmbiguousDone = ambiguousKeySet[req.key] === true;

    let doneText = "";
    let latestDoneAt = "";

    if (doneItems.length > 0) {
      doneText = doneItems.map(done => {
        const staff = done.staff ? `【${done.staff}】` : "【担当者不明】";
        return `${staff}\n${done.content}`;
      }).join("\n\n---\n\n");

      latestDoneAt = doneItems.reduce((latest, done) => {
        if (!done.doneAt) return latest;
        const doneDate = new Date(done.doneAt);
        if (!latest) return doneDate;
        return doneDate > latest ? doneDate : latest;
      }, "");
    }

    let status = "";

    if (lightCheck.result !== "OK") {
      status = "URL確認";
    } else if (!req.projectName || !req.url) {
      status = "判定要確認";
    } else if (hasAmbiguousDone) {
      status = "紐付け確認";
    } else if (doneItems.length > 0 && reported) {
      status = "完了・報告済";
    } else if (doneItems.length > 0) {
      status = "お客さんに報告";
    } else if (req.requestAt && isOverFixDeadline_(req.requestAt, deadline, now)) {
      status = "IT部要確認";
    } else {
      status = "IT部対応待ち";
    }

    return [
      status,
      req.projectName,
      req.requestContent,
      doneText,
      req.requestAt,
      deadline,
      latestDoneAt,
      reported,
      keep.memo || "",
      req.url,
      req.id,
      lightCheck.result,
      hasAmbiguousDone ? "要確認" : ""
    ];
  });

  if (fixLastRow >= 3) {
    fixSheet.getRange(3, 1, fixLastRow - 2, 13).clearContent();
  }

  if (output.length > 0) {
    fixSheet.getRange(3, 1, output.length, 13).setValues(output);
    fixSheet.getRange(3, 8, output.length, 1).insertCheckboxes();
    applyFixStatusColors_(fixSheet, output.length);
  }

  const reflectNow = new Date();
  const reflectValues = lineRows.map(row => {
    const type = row[0];
    const reflect = (type === "修正依頼" || type === "修正完了" || isDeliveryType_(type));
    return reflect ? [reflectNow] : [row[7]];
  });

  lineSheet.getRange(2, 8, reflectValues.length, 1).setValues(reflectValues);

  applyStatusFilter_();
}

//==================================================
// 修正完了ログ関連
//==================================================

function getDoneLogs_(doneSheet) {
  const lastRow = doneSheet.getLastRow();
  if (lastRow < 2) return [];

  const rows = doneSheet.getRange(2, 1, lastRow - 1, 9).getValues();

  return rows.map(row => ({
    id: row[0],
    projectName: row[1],
    url: row[2],
    content: row[3],
    staff: row[4],
    doneAt: row[5],
    linkedId: row[6],
    status: row[7],
    sourceRow: row[8],
    key: makeFixKey_(row[1], row[2])
  }));
}

function writeDoneLogLinks_(doneSheet, doneLogs) {
  if (doneLogs.length === 0) return;

  const values = doneLogs.map(done => [
    done.linkedId || "",
    done.status || ""
  ]);

  doneSheet.getRange(2, 7, values.length, 2).setValues(values);
}

//==================================================
// 表示・色・フィルター
//==================================================

function formatLineHubRows_() {
  const ss = getLineHubSpreadsheet_();
  const lineSheet = ss.getSheetByName(LINE_HUB_CONFIG.LINE_SHEET_NAME);
  const fixSheet = ss.getSheetByName(LINE_HUB_CONFIG.FIX_SHEET_NAME);
  const doneSheet = ss.getSheetByName(LINE_HUB_CONFIG.DONE_LOG_SHEET_NAME);

  if (lineSheet) {
    const lastRow = Math.max(lineSheet.getLastRow(), 2);
    lineSheet.getRange("B:B").setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
    lineSheet.getRange("C:C").setNumberFormat("yyyy/MM/dd");
    lineSheet.setRowHeights(2, lastRow - 1, 36);
  }

  if (fixSheet) {
    const lastRow = Math.max(fixSheet.getLastRow(), 3);
    fixSheet.getRange("C:D").setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
    fixSheet.getRange("I:I").setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
    fixSheet.getRange("E:G").setNumberFormat("yyyy/MM/dd");
    fixSheet.setRowHeights(3, lastRow - 2, 72);
  }

  if (doneSheet) {
    const lastRow = Math.max(doneSheet.getLastRow(), 2);
    doneSheet.getRange("D:D").setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
    doneSheet.setRowHeights(2, lastRow - 1, 36);
  }

  const deliverySheet = ss.getSheetByName(LINE_HUB_CONFIG.DELIVERY_LOG_SHEET_NAME);
  if (deliverySheet) {
    const lastRow = Math.max(deliverySheet.getLastRow(), 2);
    deliverySheet.getRange("E:E").setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP); // 案件名
    deliverySheet.getRange("G:G").setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP); // URL
    deliverySheet.getRange("H:H").setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP); // CMSログイン先
    deliverySheet.setRowHeights(2, lastRow - 1, 36);
  }
}

function createFixManagementFilter_() {
  const ss = getLineHubSpreadsheet_();
  const sheet = ss.getSheetByName(LINE_HUB_CONFIG.FIX_SHEET_NAME);
  if (!sheet) return;

  const existingFilter = sheet.getFilter();
  if (existingFilter) existingFilter.remove();

  const lastRow = Math.max(sheet.getLastRow(), 3);
  sheet.getRange(2, 1, lastRow - 1, 13).createFilter();
}

function applyStatusFilter_() {
  const ss = getLineHubSpreadsheet_();
  const sheet = ss.getSheetByName(LINE_HUB_CONFIG.FIX_SHEET_NAME);
  if (!sheet) return;

  const lastRow = sheet.getLastRow();
  if (lastRow < 3) return;

  const filterValue = String(sheet.getRange("A1").getValue() || "すべて").trim();

  let filter = sheet.getFilter();
  if (!filter) {
    createFixManagementFilter_();
    filter = sheet.getFilter();
  }

  if (!filter) return;

  filter.removeColumnFilterCriteria(1);

  if (filterValue && filterValue !== "すべて" && filterValue !== "全件") {
    const criteria = SpreadsheetApp.newFilterCriteria()
      .whenTextEqualTo(filterValue)
      .build();

    filter.setColumnFilterCriteria(1, criteria);
  }

  sheet.getRange(3, 1, lastRow - 2, 13).sort([
    { column: 6, ascending: true },
    { column: 5, ascending: true }
  ]);
}

function applyFixStatusColors_(sheet, rowCount) {
  if (rowCount <= 0) return;

  const startRow = 3;
  const colCount = 13;
  const statuses = sheet.getRange(startRow, 1, rowCount, 1).getValues();

  const backgrounds = statuses.map(row => {
    const status = row[0];
    let color = null;

    if (status === "お客さんに報告") {
      color = "#fff2cc";
    } else if (status === "IT部要確認") {
      color = "#fce5cd";
    } else if (status === "紐付け確認" || status === "判定要確認" || status === "URL確認") {
      color = "#f4cccc";
    } else if (status === "完了・報告済") {
      color = "#d9ead3";
    }

    return Array(colCount).fill(color);
  });

  sheet.getRange(startRow, 1, rowCount, colCount).setBackgrounds(backgrounds);
}
