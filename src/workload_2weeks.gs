// @ts-nocheck
//==================================================
// 業務量ログ（2週間）
//   ・「○時間○分」で手入力 → GASで集計して値を書き込む方式
//   ・カスタム関数は使わない（#NAME? が起きない／時間トリガーでも動く）
//
//   実行：setupWorkload2WeeksSheet（初回作成）
//        syncWorkloadMeetings（打ち合わせをカレンダーから同期）
//        recalcWorkload2Weeks（合計・平均・サビ残・休日稼働を再計算）
//   ※ タスクの時間を入力したら「再計算」を実行してください（メニューからも可）。
//==================================================

const WORKLOAD_2W_CONFIG = {
  SHEET_NAME: "業務量ログ_2週間",
  CALENDAR_ID: "primary",
  WORK_START_HOUR: 9,
  WORK_END_HOUR: 18,
  EXCLUDE_KEYWORDS: ["休憩", "昼休み", "移動", "有給", "欠勤"],
  DAILY_WORK_MINUTES: 480 // 1日の所定（8時間）。これを超えた分がサビ残
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

//==================================================
// メニュー
//==================================================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("業務量ログ")
    .addItem("再計算", "recalcWorkload2Weeks")
    .addItem("打ち合わせを同期", "syncWorkloadMeetings")
    .addSeparator()
    .addItem("【初回】2週間シートを作成", "setupWorkload2WeeksSheet")
    .addToUi();
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
  sheet.getRange("D2").setValue("※B2だけ変更すれば日付・曜日が連動します（変更後は「再計算」を実行）");

  let row = 4;

  for (let week = 0; week < 2; week++) {
    sheet.getRange(row, 1, 1, 4).merge();
    sheet.getRange(row, 1).setValue(`${week + 1}週目`);
    sheet.getRange(row, 1, 1, 4)
      .setFontWeight("bold")
      .setBackground("#d9eaf7");
    row++;

    for (let i = 0; i < 7; i++) {
      const dayIndex = week * 7 + i;
      const blockStart = row;

      // 日付行（B列は開始日からの連動：ネイティブ数式なのでOK）
      sheet.getRange(row, 1).setValue("日付");
      sheet.getRange(row, 2)
        .setFormula(`=$B$2+${dayIndex}`)
        .setNumberFormat("yyyy/mm/dd（aaa）");
      sheet.getRange(row, 1, 1, 4)
        .setFontWeight("bold")
        .setBackground("#eadcf8");
      row++;

      // ヘッダー
      sheet.getRange(row, 1, 1, 4).setValues([[
        "項目",
        "やった時間",
        "やれなかった時間",
        "やれなかった内容"
      ]]);
      sheet.getRange(row, 1, 1, 4)
        .setFontWeight("bold")
        .setBackground("#d9ead3");
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

      // 合計行（値はGASで計算。ここでは仮置き）
      sheet.getRange(row, 1).setValue("合計");
      sheet.getRange(row, 2).setValue("0分");
      sheet.getRange(row, 3).setValue("0分");
      sheet.getRange(row, 1, 1, 4)
        .setFontWeight("bold")
        .setBackground("#fff2cc");

      row += 2;

      sheet.getRange(blockStart, 1, row - blockStart - 1, 4)
        .setBorder(true, true, true, true, true, true);
    }

    // 週の平均（値はGASで計算）
    sheet.getRange(row, 1).setValue(`${week + 1}週目 やれなかった時間 平均`);
    sheet.getRange(row, 2).setValue("0分");
    sheet.getRange(row, 1, 1, 2)
      .setFontWeight("bold")
      .setBackground("#fce5cd");

    row += 3;
  }

  // 2週間全体 平均
  sheet.getRange(row, 1).setValue("2週間全体 やれなかった時間 平均");
  sheet.getRange(row, 2).setValue("0分");
  sheet.getRange(row, 1, 1, 2)
    .setFontWeight("bold")
    .setBackground("#f4cccc");
  row++;

  // 業務時間外稼働（サビ残分）
  sheet.getRange(row, 1).setValue("業務時間外稼働（サビ残分）");
  sheet.getRange(row, 2).setValue("0分");
  sheet.getRange(row, 1, 1, 2)
    .setFontWeight("bold")
    .setBackground("#fce5cd");
  row++;

  // 休日稼働
  sheet.getRange(row, 1).setValue("休日稼働");
  sheet.getRange(row, 2).setValue("0分");
  sheet.getRange(row, 1, 1, 2)
    .setFontWeight("bold")
    .setBackground("#fce5cd");

  sheet.setFrozenRows(2);

  sheet.setColumnWidth(1, 150);
  sheet.setColumnWidth(2, 150);
  sheet.setColumnWidth(3, 170);
  sheet.setColumnWidth(4, 360);

  sheet.getRange("A1:D2").setFontWeight("bold");
  sheet.getRange("A1:D1").setBackground("#eadcf8");
  sheet.getRange("A:D").setWrap(true).setVerticalAlignment("top");

  // 打ち合わせ同期 → 再計算
  syncWorkloadMeetings();

  SpreadsheetApp.getActive().toast("2週間分の業務量ログを作成しました", "完了", 5);
}

//==================================================
// 打ち合わせ欄をカレンダーから同期
//==================================================

function syncWorkloadMeetings() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(WORKLOAD_2W_CONFIG.SHEET_NAME);

  if (!sheet) {
    throw new Error("業務量ログ_2週間 シートがありません。先に setupWorkload2WeeksSheet を実行してください。");
  }

  const calendar = CalendarApp.getCalendarById(WORKLOAD_2W_CONFIG.CALENDAR_ID);
  if (!calendar) {
    throw new Error("カレンダーが取得できません。CALENDAR_IDを確認してください。");
  }

  const lastRow = sheet.getLastRow();
  const values = sheet.getRange(1, 1, lastRow, 4).getValues();

  for (let rowIndex = 0; rowIndex < values.length; rowIndex++) {
    const row = rowIndex + 1;

    if (values[rowIndex][0] !== "日付") continue;

    const date = sheet.getRange(row, 2).getValue();
    if (!(date instanceof Date)) continue;

    const taskRow = row + 2; // 日付→ヘッダー→打ち合わせ
    if (sheet.getRange(taskRow, 1).getValue() !== "打ち合わせ") continue;

    const meeting = getMeetingSummaryFor2W_(calendar, date);

    sheet.getRange(taskRow, 2).setValue(
      formatWorkloadTime_(meeting.minutes) + `（${meeting.count}件）`
    );
    sheet.getRange(taskRow, 3).setValue("-");
    sheet.getRange(taskRow, 4).setValue("自動取得");
  }

  // 同期後に集計を更新
  recalcWorkload2Weeks();

  SpreadsheetApp.getActive().toast("打ち合わせ時間を同期しました", "完了", 5);
}

//==================================================
// 再計算：合計・平均・サビ残・休日稼働をGASで計算して書き込む
//==================================================

function recalcWorkload2Weeks() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(WORKLOAD_2W_CONFIG.SHEET_NAME);
  if (!sheet) {
    throw new Error("業務量ログ_2週間 シートがありません。");
  }

  const lastRow = sheet.getLastRow();
  const vals = sheet.getRange(1, 1, lastRow, 4).getValues();

  const days = []; // { date, doneMin, notDoneMin }

  // 各日ブロックを走査して合計を書き込む
  for (let i = 0; i < vals.length; i++) {
    if (vals[i][0] !== "日付") continue;

    const date = vals[i][1] instanceof Date ? vals[i][1] : null;

    // タスクはヘッダー(i+1)の次(i+2)から「合計」の手前まで
    let j = i + 2;
    let doneMin = 0;
    let notDoneMin = 0;

    while (j < vals.length && vals[j][0] !== "合計") {
      doneMin += timeTextToMinutes_(vals[j][1]);    // やった時間
      notDoneMin += timeTextToMinutes_(vals[j][2]); // やれなかった時間
      j++;
    }

    if (j < vals.length && vals[j][0] === "合計") {
      const totalRow = j + 1; // 0-based → シート行
      sheet.getRange(totalRow, 2).setValue(formatWorkloadTime_(doneMin));
      sheet.getRange(totalRow, 3).setValue(formatWorkloadTime_(notDoneMin));
    }

    days.push({ date, doneMin, notDoneMin });
    i = j; // 合計行まで進める
  }

  // 集計行（ラベルで探して書き込む）
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

  // 週平均（前7日＝1週目、次7日＝2週目）
  const weeks = [days.slice(0, 7), days.slice(7, 14)];
  weekAvgRows.forEach((r, idx) => {
    const wk = weeks[idx] || [];
    const avg = wk.length
      ? Math.round(wk.reduce((s, d) => s + d.notDoneMin, 0) / wk.length)
      : 0;
    sheet.getRange(r, 2).setValue(formatWorkloadTime_(avg));
  });

  // 2週間全体 平均
  if (twoWeekRow > 0) {
    const avg = days.length
      ? Math.round(days.reduce((s, d) => s + d.notDoneMin, 0) / days.length)
      : 0;
    sheet.getRange(twoWeekRow, 2).setValue(formatWorkloadTime_(avg));
  }

  // サビ残（各日の やった時間 が所定を超えた分の合計）
  if (overtimeRow > 0) {
    const limit = WORKLOAD_2W_CONFIG.DAILY_WORK_MINUTES;
    const ot = days.reduce((s, d) => s + (d.doneMin > limit ? d.doneMin - limit : 0), 0);
    sheet.getRange(overtimeRow, 2).setValue(formatWorkloadTime_(ot));
  }

  // 休日稼働（土日の やった時間 の合計）
  if (holidayRow > 0) {
    const hol = days.reduce((s, d) => {
      if (!d.date) return s;
      const day = d.date.getDay(); // 0=日, 6=土
      return s + ((day === 0 || day === 6) ? d.doneMin : 0);
    }, 0);
    sheet.getRange(holidayRow, 2).setValue(formatWorkloadTime_(hol));
  }

  SpreadsheetApp.getActive().toast("集計を再計算しました", "完了", 5);
}

//==================================================
// カレンダー集計
//==================================================

function getMeetingSummaryFor2W_(calendar, date) {
  const start = new Date(date);
  start.setHours(WORKLOAD_2W_CONFIG.WORK_START_HOUR, 0, 0, 0);

  const end = new Date(date);
  end.setHours(WORKLOAD_2W_CONFIG.WORK_END_HOUR, 0, 0, 0);

  const events = calendar.getEvents(start, end);

  let count = 0;
  let minutes = 0;

  events.forEach(event => {
    const title = event.getTitle() || "";

    const excluded = WORKLOAD_2W_CONFIG.EXCLUDE_KEYWORDS.some(keyword =>
      title.includes(keyword)
    );
    if (excluded) return;

    const duration = Math.round((event.getEndTime() - event.getStartTime()) / 1000 / 60);
    if (duration <= 0) return;

    count++;
    minutes += duration;
  });

  return { count, minutes };
}

//==================================================
// 時間テキストのユーティリティ（内部用・カスタム関数ではない）
//==================================================

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

  // 数字だけ入力された場合は「分」として扱う
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
