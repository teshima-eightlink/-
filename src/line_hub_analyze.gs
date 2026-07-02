// @ts-nocheck
//==================================================
// LINE貼付ハブ ― 解析パート
//   ・共通設定（LINE_HUB_CONFIG）
//   ・LINE貼付シートの解析（analyzeLineHub_）
//   ・LINE本文の解析（parseLineText_ ほか）
//   ・軽量版案件一覧の照合（getLightweightMap_ / checkLightweight_）
//   ・日付・営業日・正規化のユーティリティ
//
//   ※ 修正管理パート（line_hub_fix.gs）・納品完了パート（line_hub_delivery.gs）
//     と同じGASプロジェクトに置いてください。グローバルを共有します。
//==================================================

const LINE_HUB_CONFIG = {
  SPREADSHEET_ID: "1T6DF1AInTvcd--77opQFZVZTvSeSvojqWPFhpRm_0l8",

  LINE_SHEET_NAME: "LINE貼付",
  FIX_SHEET_NAME: "修正管理",
  DONE_LOG_SHEET_NAME: "修正完了ログ",
  DELIVERY_LOG_SHEET_NAME: "納品完了ログ",

  LIGHTWEIGHT_SPREADSHEET_ID: "17okkRhyvkfrzVdTlC2Z5lmOXcm_wEweaqah8CNAHUMw",
  LIGHTWEIGHT_SHEET_NAME: "軽量版案件一覧",

  START_ROW: 2,
  FIX_DATA_START_ROW: 3,
  LIMIT_BUSINESS_DAYS: 10,

  TYPES: [
    "修正依頼",
    "修正完了",
    "TOP制作完了",
    "全ページ制作完了",
    "納品前最終チェック",
    "納品完了",
    "その他"
  ]
};

let LIGHTWEIGHT_MAP_CACHE_ = null;
let HOLIDAY_DATE_SET_CACHE_ = null;

//==================================================
// 基本
//==================================================

function getLineHubSpreadsheet_() {
  return SpreadsheetApp.openById(LINE_HUB_CONFIG.SPREADSHEET_ID);
}

//==================================================
// 種別プルダウンだけを更新（既存データに触れない）
//   TYPES を増やしたあと、これを1回実行すればA列の選択肢が更新されます。
//==================================================

function refreshTypeDropdown() {
  const ss = getLineHubSpreadsheet_();
  const sheet = ss.getSheetByName(LINE_HUB_CONFIG.LINE_SHEET_NAME);
  if (!sheet) throw new Error("LINE貼付シートがありません。");

  const typeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(LINE_HUB_CONFIG.TYPES, true)
    .setAllowInvalid(false)
    .build();

  sheet.getRange("A2:A").setDataValidation(typeRule);
  Logger.log("種別プルダウンを更新しました：" + LINE_HUB_CONFIG.TYPES.join(" / "));
}

//==================================================
// LINE貼付シートの初期セットアップ
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

//==================================================
// LINE貼付解析：G列（解析日時）が空白の行だけ解析
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

  if (type === "納品完了") {
    // 案件名は「URLの直前の行」を基本に抽出（区切り線・メンションのみの行は飛ばす）
    const urlLineIdx = lines.findIndex(line => /https?:\/\//.test(line));
    let name = "";

    if (urlLineIdx >= 0) {
      for (let i = urlLineIdx - 1; i >= 0; i--) {
        const line = lines[i];
        if (isDividerLine_(line) || isMentionOnly_(line)) continue;
        name = cleanDeliveryProjectName_(line);
        if (name) break;
      }
    }

    if (!name) {
      const cand = lines.find(line => !isDividerLine_(line) && !isMentionOnly_(line) && !/https?:\/\//.test(line));
      name = cleanDeliveryProjectName_(cand || "");
    }

    staff = extractStaffFromText_(raw);
    projectName = name;
  } else if (type === "修正完了") {
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

// 納品完了メッセージ用：案件名の行から敬称・完了文言・記号を除去
function cleanDeliveryProjectName_(value) {
  let s = String(value || "").trim();

  s = s.replace(/^(@\S+\s*)+/, "").trim();      // 先頭の @メンション
  s = s.replace(/^【.+?】/, "").trim();          // 先頭の【タグ】
  s = s.replace(/[！!。、\s]+$/, "");             // 末尾の記号・空白
  s = s.replace(/(完了(です|しました|いたしました|でした)?)$/, "").trim(); // 末尾の完了文言
  s = s.replace(/(様|さま|さん)$/, "").trim();    // 末尾の敬称

  return s;
}

// 区切り線（ーーーーー、＝＝＝ など）だけの行か
function isDividerLine_(line) {
  return /^[ー－—\-＝=~〜_＿\s]+$/.test(String(line || ""));
}

// @メンションのみの行か
function isMentionOnly_(line) {
  return /^(@\S+\s*)+$/.test(String(line || "").trim());
}

// 本文から担当者情報（@メンション、無ければ【タグ】）を抽出
function extractStaffFromText_(text) {
  const raw = String(text || "");

  const mentions = raw.match(/@\S+/g);
  if (mentions && mentions.length > 0) {
    return mentions.join(" ");
  }

  const tagMatch = raw.match(/【(.+?)】/);
  return tagMatch ? tagMatch[1].trim() : "";
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

  const tantoCol = findHeaderIndex_(headers, [
    "制作担当",
    "制作担当者",
    "制作者",
    "担当",
    "担当者"
  ]);

  const cmsCol = findHeaderIndex_(headers, [
    "CMSログイン先",
    "CMSログイン",
    "CMS URL",
    "CMSURL",
    "管理画面URL",
    "管理画面",
    "ログインURL",
    "ログイン先",
    "WP管理画面",
    "wp-admin"
  ]);

  const byUrl = {};
  const byProject = {};

  for (let i = 1; i < values.length; i++) {
    const row = values[i];

    const projectName = projectCol >= 0 ? String(row[projectCol] || "").trim() : "";
    const url = urlCol >= 0 ? String(row[urlCol] || "").trim() : "";
    const tanto = tantoCol >= 0 ? String(row[tantoCol] || "").trim() : "";
    const cms = cmsCol >= 0 ? String(row[cmsCol] || "").trim() : "";

    const entry = { projectName, url, tanto, cms };

    const nProject = normalizeText_(projectName);
    const nUrl = normalizeUrl_(url);

    if (nUrl) byUrl[nUrl] = entry;
    if (nProject) byProject[nProject] = entry;
  }

  LIGHTWEIGHT_MAP_CACHE_ = { byUrl, byProject, error: "" };
  return LIGHTWEIGHT_MAP_CACHE_;
}

function checkLightweight_(projectName, url, lightweightMap) {
  const empty = { lightProjectName: "", lightUrl: "", lightTanto: "", lightCms: "" };

  if (lightweightMap.error) {
    return Object.assign({ result: lightweightMap.error }, empty);
  }

  const nProject = normalizeText_(projectName);
  const nUrl = normalizeUrl_(url);

  if (nUrl && lightweightMap.byUrl[nUrl]) {
    const hit = lightweightMap.byUrl[nUrl];
    return {
      result: "OK",
      lightProjectName: hit.projectName,
      lightUrl: hit.url,
      lightTanto: hit.tanto || "",
      lightCms: hit.cms || ""
    };
  }

  if (nProject && lightweightMap.byProject[nProject]) {
    const hit = lightweightMap.byProject[nProject];
    return {
      result: nUrl ? "URL要確認" : "URLなし・案件名一致",
      lightProjectName: hit.projectName,
      lightUrl: hit.url,
      lightTanto: hit.tanto || "",
      lightCms: hit.cms || ""
    };
  }

  if (!nUrl && !nProject) {
    return Object.assign({ result: "案件名・URLなし" }, empty);
  }

  return Object.assign({ result: nUrl ? "該当なし" : "URLなし・該当なし" }, empty);
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
