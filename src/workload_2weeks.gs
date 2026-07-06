// @ts-nocheck
//==================================================
// 業務量ログ（2週間）
//   ・打ち合わせ用カレンダー＋業務ログ用カレンダーから自動集計
//   ・カレンダーは「全期間を1回だけ」取得、シートは一括読み書き（高速）
//   ・カスタム関数は使わない（#NAME? が起きない）
//
//   メニュー「業務量ログ」から：
//     更新（カレンダー同期＋集計） / 再計算（手入力を反映） / 【初回】シート作成
//   ※ 業務ログ用カレンダーのタイトルに含むキーワードで項目に振り分けます。
//==================================================

const WORKLOAD_2W_CONFIG = {
  SHEET_NAME: "業務量ログ_2週間",

  MEETING_CALENDAR_ID: "primary",
  WORK_LOG_CALENDAR_ID: "250d56987c5dc48caa13cf1327ddb2ae3e85dba487f780ab3a7101a698a3f58b@group.calendar.google.com",

  EXCLUDE_KEYWORDS: ["休憩", "昼休み", "移動", "有給", "欠勤"],
  DAILY_WORK_MINUTES: 480 // 1日の所定（8時間）。超えた分がサビ残
};

const WORKLOAD_TASKS = [
  "打ち合わせ",
  "打ち合わせ準備",
  "修正関連",
  "LINE対応",
  "納品前チェック",
  "撮影関連",
  "社内連絡",
  "その他",
  "改善業務"
];

// 業務ログ用カレンダーのタイトル → 項目 振り分けルール
const WORKLOAD_CATEGORY_RULES = {
  "LINE対応": ["LINE", "line", "ライン", "らいん"],
  "修正関連": ["修正"],
  "打ち合わせ準備": ["準備"],
  "納品前チェック": ["納品前"],
  "撮影関連": ["撮影"],
  "社内連絡": ["社内"],
  "その他": ["その他"],
  "改善業務": ["改善", "GAS", "マニュアル"]
};

//==================================================
// メニュー
//   ※ onOpen（シンプルトリガー）は他のGASと衝突するため使わない。
//     buildWorkloadMenu を「インストール型トリガー（開いたとき）」で呼ぶ。
//     → 初回だけ installWorkloadMenu を実行してトリガーを登録してください。
//==================================================

function buildWorkloadMenu() {
  SpreadsheetApp.getUi()
    .createMenu("業務量ログ")
    .addItem("更新（カレンダー同期＋集計）", "updateWorkload")
    .addItem("再計算（手入力を反映）", "recalcWorkload2Weeks")
    .addSeparator()
    .addItem("【初回】2週間シートを作成", "setupWorkload2WeeksSheet")
    .addToUi();
}

// インストール型トリガーを登録（初回のみ実行）
//   ・buildWorkloadMenu … 開いたときにメニューを作る
//   ・handleWorkloadEdit … B/C列を編集したら合計を自動再計算
//   ※ onOpen / onEdit という名前は使わないので他のGASと衝突しません。
function installWorkloadMenu() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 既存の同名トリガーを削除（重複防止）
  ScriptApp.getProjectTriggers().forEach(t => {
    const fn = t.getHandlerFunction();
    if (fn === "buildWorkloadMenu" || fn === "handleWorkloadEdit") {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger("buildWorkloadMenu")
    .forSpreadsheet(ss)
    .onOpen()
    .create();

  ScriptApp.newTrigger("handleWorkloadEdit")
    .forSpreadsheet(ss)
    .onEdit()
    .create();

  buildWorkloadMenu(); // いま開いているシートにもすぐ表示
  SpreadsheetApp.getActive().toast("メニューと自動再計算を設定しました", "完了", 5);
}

// 【編集時に自動実行】B列(やった時間)・C列(やれなかった時間)を編集したら合計を再計算
//   ※ 関数名は onEdit ではないため他のGASと衝突しません。
function handleWorkloadEdit(e) {
  if (!e || !e.range) return;

  const sheet = e.range.getSheet();
  if (sheet.getName() !== WORKLOAD_2W_CONFIG.SHEET_NAME) return;

  const startCol = e.range.getColumn();
  const endCol = startCol + e.range.getNumColumns() - 1;

  // 編集範囲に B(2) / C(3) を含むときだけ再計算
  if (endCol < 2 || startCol > 3) return;

  recalcWorkload2Weeks();
}

//==================================================
// 初回セットアップ
//==================================================

function setupWorkload2WeeksSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(WORKLOAD_2W_CONFIG.SHEET_NAME);

  if (!sheet) sheet = ss.insertSheet(WORKLOAD_2W_CONFIG.SHEET_NAME);
  sheet.clear();

  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);

  sheet.getRange("A1").setValue("業務量ログ（2週間）");
  sheet.getRange("A2").setValue("開始日");
  sheet.getRange("B2").setValue(startDate).setNumberFormat("yyyy/mm/dd（aaa）");
  sheet.getRange("D2").setValue("※B2だけ変更すれば日付・曜日が連動します（変更後は「更新」を実行）");

  let row = 4;

  for (let week = 0; week < 2; week++) {
    sheet.getRange(row, 1, 1, 4).merge();
    sheet.getRange(row, 1).setValue(`${week + 1}週目`);
    sheet.getRange(row, 1, 1, 4).setFontWeight("bold").setBackground("#d9eaf7");
    row++;

    for (let i = 0; i < 7; i++) {
      const dayIndex = week * 7 + i;
      const blockStart = row;

      // 日付行（B列は開始日連動：ネイティブ数式なのでOK）
      sheet.getRange(row, 1).setValue("日付");
      sheet.getRange(row, 2)
        .setFormula(`=$B$2+${dayIndex}`)
        .setNumberFormat("yyyy/mm/dd（aaa）");
      sheet.getRange(row, 1, 1, 4).setFontWeight("bold").setBackground("#eadcf8");
      row++;

      // ヘッダー
      sheet.getRange(row, 1, 1, 4).setValues([[
        "項目", "やった時間", "やれなかった時間", "やれなかった内容"
      ]]);
      sheet.getRange(row, 1, 1, 4).setFontWeight("bold").setBackground("#d9ead3");
      row++;

      // タスク行
      WORKLOAD_TASKS.forEach(task => {
        sheet.getRange(row, 1).setValue(task);
        if (task === "打ち合わせ") {
          sheet.getRange(row, 2).setValue("0分（0件）");
          sheet.getRange(row, 3).setValue("-");
          sheet.getRange(row, 4).setValue("自動取得");
        }
        row++;
      });

      // 合計行（値はGASで計算。仮置き）
      sheet.getRange(row, 1).setValue("合計");
      sheet.getRange(row, 2).setValue("0分");
      sheet.getRange(row, 3).setValue("0分");
      sheet.getRange(row, 1, 1, 4).setFontWeight("bold").setBackground("#fff2cc");

      row += 2;
      sheet.getRange(blockStart, 1, row - blockStart - 1, 4)
        .setBorder(true, true, true, true, true, true);
    }

    sheet.getRange(row, 1).setValue(`${week + 1}週目 やれなかった時間 平均`);
    sheet.getRange(row, 2).setValue("0分");
    sheet.getRange(row, 1, 1, 2).setFontWeight("bold").setBackground("#fce5cd");
    row += 3;
  }

  sheet.getRange(row, 1).setValue("2週間全体 やれなかった時間 平均");
  sheet.getRange(row, 2).setValue("0分");
  sheet.getRange(row, 1, 1, 2).setFontWeight("bold").setBackground("#f4cccc");
  row++;

  sheet.getRange(row, 1).setValue("業務時間外稼働（サビ残分）");
  sheet.getRange(row, 2).setValue("0分");
  sheet.getRange(row, 1, 1, 2).setFontWeight("bold").setBackground("#fce5cd");
  row++;

  sheet.getRange(row, 1).setValue("休日稼働");
  sheet.getRange(row, 2).setValue("0分");
  sheet.getRange(row, 1, 1, 2).setFontWeight("bold").setBackground("#fce5cd");

  sheet.setFrozenRows(2);
  sheet.setColumnWidth(1, 150);
  sheet.setColumnWidth(2, 150);
  sheet.setColumnWidth(3, 170);
  sheet.setColumnWidth(4, 360);

  sheet.getRange("A1:D2").setFontWeight("bold");
  sheet.getRange("A1:D1").setBackground("#eadcf8");
  sheet.getRange("A:D").setWrap(true).setVerticalAlignment("top");

  updateWorkload();

  SpreadsheetApp.getActive().toast("2週間分の業務量ログを作成しました", "完了", 5);
}

//==================================================
// 更新：カレンダー同期（打ち合わせ＋業務ログ）＋集計
//   カレンダーは全期間を1回ずつ取得、シートは一括書き込み
//==================================================

function updateWorkload() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getWorkloadSheet_();
  const tz = ss.getSpreadsheetTimeZone();

  const lastRow = sheet.getLastRow();
  const vals = sheet.getRange(1, 1, lastRow, 4).getValues();
  const blocks = parseWorkloadBlocks_(vals);
  if (blocks.length === 0) return;

  const first = blocks[0].date;
  const last = blocks[blocks.length - 1].date;
  if (!first || !last) throw new Error("日付が取得できません。B2を確認してください。");

  const rangeStart = new Date(first); rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(last); rangeEnd.setHours(23, 59, 59, 999);

  const meetCal = CalendarApp.getCalendarById(WORKLOAD_2W_CONFIG.MEETING_CALENDAR_ID);
  if (!meetCal) throw new Error("打ち合わせ用カレンダーが取得できません。");
  const workCal = CalendarApp.getCalendarById(WORKLOAD_2W_CONFIG.WORK_LOG_CALENDAR_ID);
  if (!workCal) throw new Error("業務ログ用カレンダーが取得できません。WORK_LOG_CALENDAR_ID を確認してください。");

  const meetingByDay = bucketMeetings_(meetCal, rangeStart, rangeEnd, tz);
  const worklogByDay = bucketWorklogs_(workCal, rangeStart, rangeEnd, tz);

  const days = [];

  blocks.forEach(b => {
    const key = b.date ? Utilities.formatDate(b.date, tz, "yyyy-MM-dd") : "";
    const meet = meetingByDay[key] || { count: 0, minutes: 0 };
    const work = worklogByDay[key] || {};

    let totalDone = 0;
    let totalNot = 0;
    const rows = []; // [B, C] を firstTaskRow から順に

    b.taskNames.forEach((name, idx) => {
      let doneMin = 0;
      let doneText;
      let cVal = b.taskC[idx];

      if (name === "打ち合わせ") {
        doneMin = meet.minutes;
        doneText = formatWorkloadTime_(meet.minutes) + `（${meet.count}件）`;
        cVal = "-";
      } else {
        doneMin = work[name] || 0;
        doneText = formatWorkloadTime_(doneMin);
      }

      totalDone += doneMin;
      totalNot += timeTextToMinutes_(cVal);
      rows.push([doneText, cVal]);
    });

    rows.push([formatWorkloadTime_(totalDone), formatWorkloadTime_(totalNot)]); // 合計

    if (b.totalRow) {
      sheet.getRange(b.firstTaskRow, 2, rows.length, 2).setValues(rows);
    }

    days.push({ date: b.date, doneMin: totalDone, notDoneMin: totalNot });
  });

  writeWorkloadAggregates_(sheet, vals, days);
  SpreadsheetApp.getActive().toast("カレンダーから更新しました", "完了", 5);
}

//==================================================
// 再計算：カレンダーは見ず、いまのセル値だけで集計し直す
//   （やれなかった時間などを手入力した後に使う）
//==================================================

function recalcWorkload2Weeks() {
  const sheet = getWorkloadSheet_();
  const lastRow = sheet.getLastRow();
  const vals = sheet.getRange(1, 1, lastRow, 4).getValues();
  const blocks = parseWorkloadBlocks_(vals);

  const days = [];

  blocks.forEach(b => {
    let totalDone = 0;
    let totalNot = 0;

    b.taskNames.forEach((name, idx) => {
      const r = (b.firstTaskRow - 1) + idx; // vals のインデックス
      totalDone += timeTextToMinutes_(vals[r][1]);
      totalNot += timeTextToMinutes_(vals[r][2]);
    });

    if (b.totalRow) {
      sheet.getRange(b.totalRow, 2).setValue(formatWorkloadTime_(totalDone));
      sheet.getRange(b.totalRow, 3).setValue(formatWorkloadTime_(totalNot));
    }

    days.push({ date: b.date, doneMin: totalDone, notDoneMin: totalNot });
  });

  writeWorkloadAggregates_(sheet, vals, days);
  SpreadsheetApp.getActive().toast("集計を再計算しました", "完了", 5);
}

//==================================================
// 集計行（週平均・2週平均・サビ残・休日稼働）を書き込む
//==================================================

function writeWorkloadAggregates_(sheet, vals, days) {
  const weekAvgRows = [];
  let twoWeekRow = -1;
  let overtimeRow = -1;
  let holidayRow = -1;

  for (let i = 0; i < vals.length; i++) {
    const a = String(vals[i][0] || "");
    if (a.indexOf("週目") >= 0 && a.indexOf("平均") >= 0) weekAvgRows.push(i + 1);
    else if (a.indexOf("2週間全体") >= 0) twoWeekRow = i + 1;
    else if (a.indexOf("業務時間外稼働") >= 0) overtimeRow = i + 1;
    else if (a.indexOf("休日稼働") >= 0) holidayRow = i + 1;
  }

  const weeks = [days.slice(0, 7), days.slice(7, 14)];
  weekAvgRows.forEach((r, idx) => {
    const wk = weeks[idx] || [];
    sheet.getRange(r, 2).setValue(formatWorkloadTime_(avgNotDoneWeekdays_(wk)));
  });

  if (twoWeekRow > 0) {
    sheet.getRange(twoWeekRow, 2).setValue(formatWorkloadTime_(avgNotDoneWeekdays_(days)));
  }

  if (overtimeRow > 0) {
    const limit = WORKLOAD_2W_CONFIG.DAILY_WORK_MINUTES;
    const ot = days.reduce((s, d) => s + (d.doneMin > limit ? d.doneMin - limit : 0), 0);
    sheet.getRange(overtimeRow, 2).setValue(formatWorkloadTime_(ot));
  }

  if (holidayRow > 0) {
    const hol = days.reduce((s, d) => {
      if (!d.date) return s;
      const day = d.date.getDay();
      return s + ((day === 0 || day === 6) ? d.doneMin : 0);
    }, 0);
    sheet.getRange(holidayRow, 2).setValue(formatWorkloadTime_(hol));
  }
}

// やれなかった時間の平均：平日（土日を除く）だけで平均する
//   ※ 全7日で割りたい場合は、weekday判定を外して list.length で割ってください。
function avgNotDoneWeekdays_(list) {
  const weekdays = list.filter(d =>
    d.date && d.date.getDay() !== 0 && d.date.getDay() !== 6
  );
  if (weekdays.length === 0) return 0;
  return Math.round(weekdays.reduce((s, d) => s + d.notDoneMin, 0) / weekdays.length);
}

//==================================================
// シート構造の解析（1回の getValues 結果から日ブロックを抽出）
//==================================================

function parseWorkloadBlocks_(vals) {
  const blocks = [];

  for (let i = 0; i < vals.length; i++) {
    if (vals[i][0] !== "日付") continue;

    const date = vals[i][1] instanceof Date ? vals[i][1] : null;

    const taskNames = [];
    const taskC = [];
    let j = i + 2; // 日付(i)→ヘッダー(i+1)→タスク開始(i+2)

    while (j < vals.length && vals[j][0] !== "合計") {
      taskNames.push(vals[j][0]);
      taskC.push(vals[j][2]);
      j++;
    }

    const totalRow = (j < vals.length && vals[j][0] === "合計") ? j + 1 : null;

    blocks.push({
      date: date,
      taskNames: taskNames,
      taskC: taskC,
      firstTaskRow: i + 3, // シート行（タスク先頭）
      totalRow: totalRow
    });

    i = j; // 合計行まで進める
  }

  return blocks;
}

//==================================================
// カレンダー集計（全期間を1回取得して日付ごとにバケット）
//==================================================

function bucketMeetings_(calendar, rangeStart, rangeEnd, tz) {
  const events = calendar.getEvents(rangeStart, rangeEnd);
  const by = {};

  events.forEach(event => {
    const title = event.getTitle() || "";
    if (WORKLOAD_2W_CONFIG.EXCLUDE_KEYWORDS.some(k => title.includes(k))) return;

    const duration = Math.round((event.getEndTime() - event.getStartTime()) / 60000);
    if (duration <= 0) return;

    const key = Utilities.formatDate(event.getStartTime(), tz, "yyyy-MM-dd");
    if (!by[key]) by[key] = { count: 0, minutes: 0 };
    by[key].count++;
    by[key].minutes += duration;
  });

  return by;
}

function bucketWorklogs_(calendar, rangeStart, rangeEnd, tz) {
  const events = calendar.getEvents(rangeStart, rangeEnd);
  const by = {};

  events.forEach(event => {
    const title = event.getTitle() || "";
    const category = detectWorkloadCategory_(title);
    if (!category) return;

    const duration = Math.round((event.getEndTime() - event.getStartTime()) / 60000);
    if (duration <= 0) return;

    const key = Utilities.formatDate(event.getStartTime(), tz, "yyyy-MM-dd");
    if (!by[key]) by[key] = {};
    by[key][category] = (by[key][category] || 0) + duration;
  });

  return by;
}

function detectWorkloadCategory_(title) {
  const normalizedTitle = normalizeWorkloadText_(title);

  for (const category of Object.keys(WORKLOAD_CATEGORY_RULES)) {
    const keywords = WORKLOAD_CATEGORY_RULES[category];
    const matched = keywords.some(keyword =>
      normalizedTitle.includes(normalizeWorkloadText_(keyword))
    );
    if (matched) return category;
  }

  return "";
}

function normalizeWorkloadText_(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .toLowerCase();
}

//==================================================
// 補助
//==================================================

function getWorkloadSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(WORKLOAD_2W_CONFIG.SHEET_NAME);
  if (!sheet) {
    throw new Error("業務量ログ_2週間 シートがありません。先に setupWorkload2WeeksSheet を実行してください。");
  }
  return sheet;
}

// 「○時間○分」/「○分」/ 数字 → 分
function timeTextToMinutes_(value) {
  if (Array.isArray(value)) {
    return value.flat().reduce((sum, v) => sum + timeTextToMinutes_(v), 0);
  }

  const text = String(value == null ? "" : value).trim();
  if (!text || text === "-") return 0;

  let minutes = 0;
  const hourMatch = text.match(/(\d+)\s*時間/);
  const minuteMatch = text.match(/(\d+)\s*分/);

  if (hourMatch) minutes += Number(hourMatch[1]) * 60;
  if (minuteMatch) minutes += Number(minuteMatch[1]);

  if (!hourMatch && !minuteMatch && /^\d+$/.test(text)) {
    minutes += Number(text);
  }

  return minutes;
}

// 分 → 「○時間○分」
function formatWorkloadTime_(minutes) {
  minutes = Number(minutes || 0);
  if (minutes <= 0) return "0分";

  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  if (h > 0 && m > 0) return `${h}時間${m}分`;
  if (h > 0) return `${h}時間`;
  return `${m}分`;
}
