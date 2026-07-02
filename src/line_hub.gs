// @ts-nocheck

const LINE_HUB_CONFIG = {
  SPREADSHEET_ID: "1T6DF1AInTvcd--77opQFZVZTvSeSvojqWPFhpRm_0l8",

  LINE_SHEET_NAME: "LINE貼付",
  FIX_SHEET_NAME: "修正管理",
  DONE_LOG_SHEET_NAME: "修正完了ログ",

  LIGHTWEIGHT_SPREADSHEET_ID: "17okkRhyvkfrzVdTlC2Z5lmOXcm_wEweaqah8CNAHUMw",
  LIGHTWEIGHT_SHEET_NAME: "軽量版案件一覧",

  START_ROW: 2,
  FIX_DATA_START_ROW: 3,
  LIMIT_BUSINESS_DAYS: 10,

  TYPES: ["修正依頼", "修正完了", "その他"]
};

let LIGHTWEIGHT_MAP_CACHE_ = null;
let HOLIDAY_DATE_SET_CACHE_ = null;

//==================================================
// ボタン用
//==================================================

function runLineHub() {
  analyzeLineHub_();
  rebuildDoneLog_();
  rebuildFixManagement_();
}

function runStatusFilter() {
  applyStatusFilter_();
}

function runFormatLineHubRows() {
  formatLineHubRows_();
}

function setupLineHubSheets() {
  const ss = getLineHubSpreadsheet_();

  setupLinePasteSheet_(ss);
  setupFixManagementSheet_(ss);
  setupDoneLogSheet_(ss);
  formatLineHubRows_();
  applyStatusFilter_();
}

//==================================================
// 基本
//==================================================

function getLineHubSpreadsheet_() {
  return SpreadsheetApp.openById(LINE_HUB_CONFIG.SPREADSHEET_ID);
}

//==================================================
// 初期セットアップ
//==================================================

function setupLinePasteSheet_(ss) {
  let sheet = ss.getSheetByName(LINE_HUB_CONFIG.LINE_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(LINE_HUB_CONFIG.LINE_SHEET_NAME);

  sheet.getRange(1, 1, 1, 8).setValues([[
    "種別",
    "LINE原文",
    "期限",
    "案件名",
    "URL",
    "URL確認",
    "解析日時",
    "管理反映日時"
  ]]);

  sheet.setFrozenRows(1);

  sheet.setColumnWidth(1, 120);
  sheet.setColumnWidth(2, 520);
  sheet.setColumnWidth(3, 120);
  sheet.setColumnWidth(4, 260);
  sheet.setColumnWidth(5, 260);
  sheet.setColumnWidth(6, 140);
  sheet.setColumnWidth(7, 140);
  sheet.setColumnWidth(8, 140);

  sheet.getRange("A:H").setVerticalAlignment("top");
  sheet.getRange("A1:H1").setFontWeight("bold").setBackground("#d9ead3");

  const typeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(LINE_HUB_CONFIG.TYPES, true)
    .setAllowInvalid(false)
    .build();

  sheet.getRange("A2:A").setDataValidation(typeRule);

  const dateRule = SpreadsheetApp.newDataValidation()
    .requireDate()
    .setAllowInvalid(false)
    .build();

  sheet.getRange("C2:C")
    .setNumberFormat("yyyy/MM/dd")
    .setDataValidation(dateRule);
}

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
// LINE貼付解析：G列が空白の行だけ解析
//==================================================

function analyzeLineHub_() {
  const ss = getLineHubSpreadsheet_();
  const sheet = ss.getSheetByName(LINE_HUB_CONFIG.LINE_SHEET_NAME);
  if (!sheet) throw new Error("LINE貼付シートがありません。setupLineHubSheets を実行してください。");

  const lightweightMap = getLightweightMap_();

  const lastRow = sheet.getLastRow();
  if (lastRow < LINE_HUB_CONFIG.START_ROW) return;

  const numRows = lastRow - LINE_HUB_CONFIG.START_ROW + 1;
  const values = sheet.getRange(2, 1, numRows, 8).getValues();

  const analyzedAt = new Date();

  values.forEach((row, index) => {
    const type = row[0];
    const raw = row[1];
    const analyzedDate = row[6];

    if (!raw) return;
    if (analyzedDate) return;

    const manualDeadline = row[2];
    const manualUrl = row[4];

    const requestAt = analyzedAt;
    const parsed = parseLineText_(raw, type);
    const parsedDeadline = parseDeadlineFromTitle_(raw, requestAt);
    const autoDeadline = type === "修正依頼"
      ? addBusinessDays_(requestAt, LINE_HUB_CONFIG.LIMIT_BUSINESS_DAYS)
      : "";

    const finalDeadline = manualDeadline || parsedDeadline || autoDeadline;
    const finalUrl = manualUrl || parsed.url;
    parsed.url = finalUrl;

    const check = checkLightweight_(parsed.projectName, finalUrl, lightweightMap);

    if (check.lightProjectName) {
      parsed.projectName = check.lightProjectName;
    }

    const rowNumber = index + 2;

    sheet.getRange(rowNumber, 3, 1, 5).setValues([[
      finalDeadline,
      parsed.projectName,
      finalUrl,
      check.result,
      analyzedAt
    ]]);
  });
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
    return (type === "修正依頼" || type === "修正完了") ? [reflectNow] : [row[7]];
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

//==================================================
// LINE解析
//==================================================

function parseLineText_(text, type) {
  const raw = String(text || "").trim();

  const lines = raw
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line !== "");

  const urlMatch = raw.match(/https?:\/\/[^\s　]+/);
  const url = urlMatch ? urlMatch[0].trim() : "";

  let staff = "";
  let projectName = "";

  if (type === "修正完了") {
    const firstLine = lines[0] || "";
    const staffMatch = firstLine.match(/【(.+?)】/);
    staff = staffMatch ? staffMatch[1].trim() : firstLine.replace(/[【】]/g, "").trim();
    projectName = "";
  } else {
    staff = "";
    projectName = cleanProjectName_(lines[0] || "");
    if (/https?:\/\//.test(projectName)) projectName = "";
  }

  let content = "";

  if (url) {
    const urlIndex = raw.indexOf(url);
    content = raw.substring(urlIndex + url.length).trim();
  } else {
    content = lines.slice(1).join("\n").trim();
  }

  return { staff, projectName, url, content };
}

function parseDeadlineFromTitle_(text, requestAt) {
  const raw = String(text || "");
  const firstLine = raw.split(/\r?\n/)[0] || "";
  const baseDate = requestAt ? new Date(requestAt) : new Date();

  if (/本日中/.test(firstLine)) {
    return stripTime_(baseDate);
  }

  const businessMatch = firstLine.match(/(\d+)営業日以内/);
  if (businessMatch) {
    return addBusinessDays_(baseDate, Number(businessMatch[1]));
  }

  const dateMatch = firstLine.match(/(\d{1,2})月(\d{1,2})日/);
  if (dateMatch) {
    const year = baseDate.getFullYear();
    const month = Number(dateMatch[1]);
    const day = Number(dateMatch[2]);
    return new Date(year, month - 1, day);
  }

  return "";
}

function cleanProjectName_(value) {
  return String(value || "")
    .replace(/^【.+?】/, "")
    .replace(/（柘植さん）/g, "")
    .replace(/\(柘植さん\)/g, "")
    .replace(/様$/g, "")
    .replace(/さま$/g, "")
    .trim();
}

//==================================================
// 軽量版照合
//==================================================

function getLightweightMap_() {
  if (LIGHTWEIGHT_MAP_CACHE_) return LIGHTWEIGHT_MAP_CACHE_;

  const ss = SpreadsheetApp.openById(LINE_HUB_CONFIG.LIGHTWEIGHT_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(LINE_HUB_CONFIG.LIGHTWEIGHT_SHEET_NAME);

  if (!sheet) {
    LIGHTWEIGHT_MAP_CACHE_ = { byUrl: {}, byProject: {}, error: "軽量版シートなし" };
    return LIGHTWEIGHT_MAP_CACHE_;
  }

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    LIGHTWEIGHT_MAP_CACHE_ = { byUrl: {}, byProject: {}, error: "" };
    return LIGHTWEIGHT_MAP_CACHE_;
  }

  const headers = values[0].map(h => String(h || "").trim());

  const projectCol = findHeaderIndex_(headers, [
    "顧客名",
    "案件名",
    "サイト名",
    "屋号名",
    "会社名"
  ]);

  const urlCol = findHeaderIndex_(headers, [
    "公開URL",
    "既存サイト",
    "既存サイトURL",
    "サイトURL",
    "URL",
    "ホームページURL",
    "HP URL",
    "HPURL"
  ]);

  const byUrl = {};
  const byProject = {};

  for (let i = 1; i < values.length; i++) {
    const row = values[i];

    const projectName = projectCol >= 0 ? String(row[projectCol] || "").trim() : "";
    const url = urlCol >= 0 ? String(row[urlCol] || "").trim() : "";

    const nProject = normalizeText_(projectName);
    const nUrl = normalizeUrl_(url);

    if (nUrl) byUrl[nUrl] = { projectName, url };
    if (nProject) byProject[nProject] = { projectName, url };
  }

  LIGHTWEIGHT_MAP_CACHE_ = { byUrl, byProject, error: "" };
  return LIGHTWEIGHT_MAP_CACHE_;
}

function checkLightweight_(projectName, url, lightweightMap) {
  if (lightweightMap.error) {
    return { result: lightweightMap.error, lightProjectName: "", lightUrl: "" };
  }

  const nProject = normalizeText_(projectName);
  const nUrl = normalizeUrl_(url);

  if (nUrl && lightweightMap.byUrl[nUrl]) {
    const hit = lightweightMap.byUrl[nUrl];
    return { result: "OK", lightProjectName: hit.projectName, lightUrl: hit.url };
  }

  if (nProject && lightweightMap.byProject[nProject]) {
    const hit = lightweightMap.byProject[nProject];
    return {
      result: nUrl ? "URL要確認" : "URLなし・案件名一致",
      lightProjectName: hit.projectName,
      lightUrl: hit.url
    };
  }

  if (!nUrl && !nProject) {
    return { result: "案件名・URLなし", lightProjectName: "", lightUrl: "" };
  }

  return {
    result: nUrl ? "該当なし" : "URLなし・該当なし",
    lightProjectName: "",
    lightUrl: ""
  };
}

function findHeaderIndex_(headers, candidates) {
  for (const name of candidates) {
    const index = headers.indexOf(name);
    if (index >= 0) return index;
  }
  return -1;
}

//==================================================
// 日付・営業日
//==================================================

function isOverFixDeadline_(requestAt, deadline, now) {
  const baseDeadline = deadline || addBusinessDays_(requestAt, LINE_HUB_CONFIG.LIMIT_BUSINESS_DAYS);
  if (!baseDeadline) return false;

  const today = stripTime_(now || new Date());
  const limitDate = stripTime_(baseDeadline);

  return today > limitDate;
}

function addBusinessDays_(startDate, days) {
  const date = stripTime_(startDate);
  let count = 0;

  while (count < days) {
    date.setDate(date.getDate() + 1);
    if (isBusinessDay_(date)) count++;
  }

  return date;
}

function isBusinessDay_(date) {
  const day = date.getDay();
  if (day === 0 || day === 6) return false;

  const holidaySet = getHolidayDateSet_();
  const key = Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd");

  return !holidaySet[key];
}

function getHolidayDateSet_() {
  if (HOLIDAY_DATE_SET_CACHE_) return HOLIDAY_DATE_SET_CACHE_;

  const holidaySet = {};
  const calendar = CalendarApp.getCalendarById("ja.japanese#holiday@group.v.calendar.google.com");

  if (!calendar) {
    HOLIDAY_DATE_SET_CACHE_ = holidaySet;
    return HOLIDAY_DATE_SET_CACHE_;
  }

  const today = new Date();
  const start = new Date(today.getFullYear() - 1, 0, 1);
  const end = new Date(today.getFullYear() + 2, 11, 31);

  const events = calendar.getEvents(start, end);

  events.forEach(event => {
    const key = Utilities.formatDate(event.getStartTime(), Session.getScriptTimeZone(), "yyyy-MM-dd");
    holidaySet[key] = true;
  });

  HOLIDAY_DATE_SET_CACHE_ = holidaySet;
  return HOLIDAY_DATE_SET_CACHE_;
}

function stripTime_(date) {
  if (!date) return "";

  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

//==================================================
// 正規化
//==================================================

function makeFixKey_(projectName, url) {
  return `${normalizeText_(projectName)}__${normalizeUrl_(url)}`;
}

function normalizeText_(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[‐-‒–—―ーｰ]/g, "-")
    .replace(/[（）]/g, m => m === "（" ? "(" : ")")
    .replace(/\s+/g, "")
    .replace(/　/g, "")
    .trim()
    .toLowerCase();
}

function normalizeUrl_(url) {
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
