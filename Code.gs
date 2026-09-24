/**
 * 撮影管理シート × Googleカレンダー連携
 *
 * 【重要】列番号はスクリプトに固定していません。
 *   1行目の見出し（案件名・撮影日・詳細送付ID …）を毎回探して列を決めるため、
 *   列を挿入・移動しても動きます。逆に、見出しの文字列を変えると動かなくなります。
 *
 * 標準の列レイアウト（「依頼シート担当チェック済」追加後・全29列）
 *   A カメラマンマスタ      B 案件名          C 候補日メモ        D 撮影日          E 時間
 *   F 撮影場所            G カメラマン        H カメラマン住所      I カレンダー        J 状態
 *   K 撮影依頼シート作成 ☑   L 依頼シート担当チェック済 ☑             M 撮影依頼シート送付 ☑
 *   N 前日LINE ☑          O 当日LINE ☑       P 合流チェック ☑
 *   Q 撮影終了 ☑           R 納品 ☑          S UP ☑             T データ譲渡 ☑
 *   U 詳細送付ID          V 前日確認ID        W 撮影ID            X 納品ID
 *   Y 交通費              Z 担当カスタマー      AA ドキュメント       AB メモ            AC 予備
 *
 * 主な機能
 *   syncCameraTasks()     … カレンダー同期（メニュー）
 *   setSheetCameraTasks() … 初期設定（メニュー）
 *   moveFinishedDown()    … 「撮影終了」の行を下に移動＋未終了を撮影日時順に並べ替え
 *   applyFinishedStatus() … 撮影終了/納品/UP のいずれかにチェックで「状態」を「撮影終了」に更新
 *                           （「撮影終了を下に移動」メニューの実行時に呼ばれる）
 *   checkSyncCameraTasks()… 同期の診断（メニュー）
 *   handleCheckboxEdit()  … 編集時に撮影終了/納品/UP のチェックで「状態」を更新（インストール型トリガー）
 *   installEditTrigger()  … 上記トリガーを登録（初回のみ・メニュー）
 */

const CAMERA_SHEET_NAME = "撮影管理";
const CAMERA_CALENDAR_ID = "a318a9f9c5467e98191e3441af7c94084983ab5c40624dae2581dea4fc333520@group.calendar.google.com";

// 標準の見出し（setSheetCameraTasks で書き込む並び）
const CAMERA_HEADERS = [
  "カメラマンマスタ",
  "案件名",
  "候補日メモ",
  "撮影日",
  "時間",
  "撮影場所",
  "カメラマン",
  "カメラマン住所",
  "カレンダー",
  "状態",
  "撮影依頼シート作成",
  "依頼シート担当チェック済",
  "撮影依頼シート送付",
  "前日LINE",
  "当日LINE",
  "合流チェック",
  "撮影終了",
  "納品",
  "UP",
  "データ譲渡",
  "詳細送付ID",
  "前日確認ID",
  "撮影ID",
  "納品ID",
  "交通費",
  "担当カスタマー",
  "ドキュメント",
  "メモ",
  "予備"
];

// チェックボックスにする見出し（K〜T相当）
const CAMERA_CHECKBOX_HEADERS = [
  "撮影依頼シート作成",
  "依頼シート担当チェック済",
  "撮影依頼シート送付",
  "前日LINE",
  "当日LINE",
  "合流チェック",
  "撮影終了",
  "納品",
  "UP",
  "データ譲渡"
];

// 非表示にする見出し（各種ID）
const CAMERA_ID_HEADERS = ["詳細送付ID", "前日確認ID", "撮影ID", "納品ID"];


/**
 * 見出し行から「見出し名 → 列番号（1始まり）」の対応表を作る。
 * 同じ見出しが複数あるときは左側を優先する。
 */
function getColumnMap(sheet) {
  const lastColumn = sheet.getLastColumn();
  if (lastColumn < 1) return {};

  const headerValues = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const columnMap = {};

  headerValues.forEach(function(value, i) {
    const name = String(value === null || value === undefined ? "" : value).trim();

    if (name !== "" && !(name in columnMap)) {
      columnMap[name] = i + 1;
    }
  });

  return columnMap;
}


/**
 * 必須の見出しのうち、見つからなかったものを返す。
 */
function findMissingHeaders(columnMap, requiredHeaders) {
  return requiredHeaders.filter(function(name) {
    return !(name in columnMap);
  });
}


/**
 * 必須の見出しが足りなければ知らせて null を返す。そろっていれば対応表を返す。
 */
function requireColumns(sheet, requiredHeaders, title) {
  const columnMap = getColumnMap(sheet);
  const missing = findMissingHeaders(columnMap, requiredHeaders);

  if (missing.length > 0) {
    SpreadsheetApp.getUi().alert(
      title,
      "1行目に次の見出しが見つかりません。見出しの文字列を確認してください。\n\n" +
      missing.map(function(name) { return "・" + name; }).join("\n"),
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    return null;
  }

  return columnMap;
}


/**
 * 列番号（1始まり）を A / B / AA のような列名に変換する。
 */
function columnLetter(column) {
  let letter = "";
  let n = column;


  while (n > 0) {
    letter = String.fromCharCode(65 + ((n - 1) % 26)) + letter;
    n = Math.floor((n - 1) / 26);
  }


  return letter;
}


function syncCameraTasks() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CAMERA_SHEET_NAME);


  if (!sheet) {
    SpreadsheetApp.getUi().alert("エラー: 「" + CAMERA_SHEET_NAME + "」シートが見つかりません。");
    return;
  }


  const calendar = CalendarApp.getCalendarById(CAMERA_CALENDAR_ID);


  if (!calendar) {
    SpreadsheetApp.getUi().alert(
      "エラー: カレンダーが見つかりません。\n" +
      "カレンダーID（" + CAMERA_CALENDAR_ID + "）が正しいか、または閲覧・編集権限があるか確認してください。"
    );
    return;
  }


  // 列番号は見出しから引く（列を挿入してもずれないようにするため）
  const columnMap = requireColumns(sheet, [
    "案件名",
    "撮影日",
    "時間",
    "撮影場所",
    "カメラマン",
    "カメラマン住所",
    "カレンダー",
    "状態",
    "データ譲渡",
    "詳細送付ID",
    "前日確認ID",
    "撮影ID",
    "納品ID"
  ], "同期を中止しました");


  if (!columnMap) return;


  const idColumns = CAMERA_ID_HEADERS.map(function(name) { return columnMap[name]; });


  const data = sheet.getDataRange().getValues();


  for (let i = 1; i < data.length; i++) {
    const row = i + 1;


    const project = data[i][columnMap["案件名"] - 1];
    const shootDate = data[i][columnMap["撮影日"] - 1];
    const shootTime = data[i][columnMap["時間"] - 1];
    const shootLocation = data[i][columnMap["撮影場所"] - 1];
    const cameraman = data[i][columnMap["カメラマン"] - 1];
    const cameramanAddress = data[i][columnMap["カメラマン住所"] - 1];
    const calendarAction = data[i][columnMap["カレンダー"] - 1];
    const status = data[i][columnMap["状態"] - 1];
    const dataTransfer = data[i][columnMap["データ譲渡"] - 1];


    const detailEventId = data[i][columnMap["詳細送付ID"] - 1];
    const reminderEventId = data[i][columnMap["前日確認ID"] - 1];
    const shootEventId = data[i][columnMap["撮影ID"] - 1];
    const deliveryEventId = data[i][columnMap["納品ID"] - 1];


    if (calendarAction === "削除する" || status === "中止") {
      deleteEventByIdOrTitle(calendar, detailEventId, project, "｜撮影詳細送付");
      deleteEventByIdOrTitle(calendar, reminderEventId, project, "｜前日確認");
      deleteEventByIdOrTitle(calendar, shootEventId, project, "｜撮影");
      deleteEventByIdOrTitle(calendar, deliveryEventId, project, "｜データ納品");


      sheet.getRange(row, columnMap["カレンダー"]).setValue("削除済");
      sheet.getRange(row, columnMap["状態"]).setValue("中止");
      clearEventIds(sheet, row, idColumns);
      continue;
    }


    if (!project || !shootDate || !shootTime || !cameraman || calendarAction !== "登録・更新する") {
      continue;
    }


    const shootDateTime = combineDateAndTime(shootDate, shootTime);


    let detailDate = new Date(shootDateTime);
    detailDate.setDate(detailDate.getDate() - 7);
    while (isHolidayOrWeekend(detailDate)) detailDate.setDate(detailDate.getDate() - 1);


    let reminderDate = new Date(shootDateTime);
    reminderDate.setDate(reminderDate.getDate() - 1);
    while (isHolidayOrWeekend(reminderDate)) reminderDate.setDate(reminderDate.getDate() - 1);


    let deliveryDate = new Date(shootDateTime);
    deliveryDate.setDate(deliveryDate.getDate() + 7);
    while (isHolidayOrWeekend(deliveryDate)) deliveryDate.setDate(deliveryDate.getDate() + 1);


    const detailTitle = `📷${project}｜撮影詳細送付`;
    const reminderTitle = `📷${project}｜前日確認`;
    const shootTitle = `📷${project}｜撮影`;
    const deliveryTitle = `📷${project}｜データ納品`;


    const description =
      `案件名：${project}\n` +
      `撮影場所：${shootLocation || ""}\n` +
      `カメラマン：${cameraman}\n` +
      `カメラマン住所：${cameramanAddress || ""}\n` +
      `データ譲渡：${dataTransfer === true ? "済" : ""}\n` +
      `撮影日時：${Utilities.formatDate(shootDateTime, Session.getScriptTimeZone(), "yyyy/MM/dd HH:mm")}`;


    // 先に更新対象の予定を特定しておく。
    // こうしないと、自分自身を「その日にすでにある予定」として数えてしまい、
    // 同期のたびに開始時刻が30分ずつ前へずれていく。
    const detailTarget = resolveEvent(calendar, detailEventId, detailTitle, project);
    const reminderTarget = resolveEvent(calendar, reminderEventId, reminderTitle, project);
    const shootTarget = resolveEvent(calendar, shootEventId, shootTitle, project);
    const deliveryTarget = resolveEvent(calendar, deliveryEventId, deliveryTitle, project);


    const detailStart = calculateTaskTime(calendar, detailDate, "｜撮影詳細送付", detailTarget ? detailTarget.getId() : null);
    const detailEvent = applyEvent(
      calendar,
      detailTarget,
      detailTitle,
      detailStart,
      new Date(detailStart.getTime() + 30 * 60 * 1000),
      description
    );


    const reminderStart = calculateTaskTime(calendar, reminderDate, "｜前日確認", reminderTarget ? reminderTarget.getId() : null);
    const reminderEvent = applyEvent(
      calendar,
      reminderTarget,
      reminderTitle,
      reminderStart,
      new Date(reminderStart.getTime() + 30 * 60 * 1000),
      description
    );


    const shootEvent = applyEvent(
      calendar,
      shootTarget,
      shootTitle,
      shootDateTime,
      new Date(shootDateTime.getTime() + 60 * 60 * 1000),
      description
    );


    const deliveryStart = calculateTaskTime(calendar, deliveryDate, "｜データ納品", deliveryTarget ? deliveryTarget.getId() : null);
    const deliveryEvent = applyEvent(
      calendar,
      deliveryTarget,
      deliveryTitle,
      deliveryStart,
      new Date(deliveryStart.getTime() + 30 * 60 * 1000),
      description
    );


    writeEventIds(sheet, row, idColumns, [
      detailEvent.getId(),
      reminderEvent.getId(),
      shootEvent.getId(),
      deliveryEvent.getId()
    ]);


    sheet.getRange(row, columnMap["カレンダー"]).setValue("登録済");
  }
}


/**
 * 列が連続しているか。連続していれば1回の読み書きでまとめて扱える。
 */
function isSequentialColumns(columns) {
  return columns.every(function(column, i) {
    return i === 0 || column === columns[i - 1] + 1;
  });
}


/**
 * 4つの予定IDを書き込む。ID列が離れていても動くようにしている。
 */
function writeEventIds(sheet, row, columns, ids) {
  if (isSequentialColumns(columns)) {
    sheet.getRange(row, columns[0], 1, columns.length).setValues([ids]);
    return;
  }


  columns.forEach(function(column, i) {
    sheet.getRange(row, column).setValue(ids[i]);
  });
}


/**
 * 4つの予定IDを消す。
 */
function clearEventIds(sheet, row, columns) {
  if (isSequentialColumns(columns)) {
    sheet.getRange(row, columns[0], 1, columns.length).clearContent();
    return;
  }


  columns.forEach(function(column) {
    sheet.getRange(row, column).clearContent();
  });
}


/**
 * 予定IDらしき文字列か。
 * 列ずれなどで交通費・案件名といった別の値が渡ってきたときに
 * getEventById を呼ばないようにするための入口チェック。
 * CalendarApp が返すIDは "xxxxxxxx@google.com" の形。
 */
function isLikelyEventId(value) {
  if (typeof value !== "string") return false;

  const id = value.trim();
  return id !== "" && id.indexOf("@") !== -1;
}


/**
 * 予定を安全に取得する。見つからなければ null。
 *
 * ※ getEventById は「予定が削除済み」「別カレンダーの予定」「IDが壊れている」場合に
 *   null ではなく例外（このカレンダーの予定は存在しないか、既に削除されています。）を投げる。
 *   ここで受け止めておけば、古いIDが残っていても同期は止まらず新規作成にフォールバックする。
 */
function getEventByIdSafe(calendar, eventId) {
  if (!isLikelyEventId(eventId)) return null;

  try {
    return calendar.getEventById(eventId);
  } catch (err) {
    return null;
  }
}


/**
 * タイトルが完全一致する予定を探す。見つからなければ null。
 * ID列が空になってしまった行を再同期したときに、同じ予定を作り直さず付け直すために使う。
 */
function findEventByTitle(calendar, project, title) {
  if (!project) return null;


  const events = calendar.getEvents(
    new Date("2020/01/01"),
    new Date("2035/12/31"),
    { search: `📷${project}` }
  );


  const matched = events.filter(event => event.getTitle() === title);
  return matched.length > 0 ? matched[0] : null;
}


/**
 * 更新対象の予定を特定する。見つからなければ null（＝新規作成する）。
 * IDで見つからない場合は、同じタイトルの予定を探して付け直す
 * （ID列が空になった行を再同期したときに、同じ予定を二重に作らないため）。
 */
function resolveEvent(calendar, eventId, title, project) {
  const event = getEventByIdSafe(calendar, eventId);
  if (event) return event;


  return findEventByTitle(calendar, project, title);
}


/**
 * 予定に内容を書き込む。event が null なら新規作成する。
 */
function applyEvent(calendar, event, title, startTime, endTime, description) {
  if (event) {
    try {
      event.setTitle(title);
      event.setTime(startTime, endTime);
      event.setDescription(description);
      return event;
    } catch (err) {
      // 取得できても、直後に削除済みだと更新時に例外になる。新規作成にフォールバックする。
    }
  }


  return calendar.createEvent(title, startTime, endTime, { description: description });
}


function deleteEventByIdOrTitle(calendar, eventId, project, titleKeyword) {
  let deleted = false;


  const event = getEventByIdSafe(calendar, eventId);


  if (event) {
    try {
      event.deleteEvent();
      deleted = true;
    } catch (err) {
      // すでに削除済みなら何もしなくてよい
      deleted = true;
    }
  }


  if (!deleted && project) {
    const events = calendar.getEvents(
      new Date("2020/01/01"),
      new Date("2035/12/31"),
      { search: `📷${project}` }
    );


    events
      .filter(event => event.getTitle().includes(titleKeyword))
      .forEach(event => event.deleteEvent());
  }
}


/*
 * setSheetCameraTasks()
 * 撮影管理シートの初期設定・見た目調整をまとめて行う関数
 *
 * ※ この関数だけは「標準レイアウト（29列）」を前提に見出しを書き込む。
 *   既存の見出しと違う場合は、上書きする前に確認を出す。
 *
 * 主な処理：
 * ・1行目に見出しを設定（全29列）
 * ・見出し行の背景色、太字、中央寄せを設定
 * ・撮影日/時間の見出しをセットに見えるよう背景色変更
 * ・全行の高さを統一
 * ・「カレンダー」にプルダウンを設定
 * ・「状態」にプルダウンを設定
 * ・各チェック項目にチェックボックスを設定
 * ・「撮影日」に日付形式と日付入力ルールを設定
 * ・「時間」に時刻形式を設定
 * ・「カメラマンマスタ」と「カメラマン住所」は切り詰め表示
 * ・状態ごとの色設定を反映
 * ・フィルター、保護、非表示列を再設定
 */
function setSheetCameraTasks() {
  const ROW_HEIGHT = 36;
  const ui = SpreadsheetApp.getUi();


  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CAMERA_SHEET_NAME);


  if (!sheet) {
    ui.alert("エラー: 「" + CAMERA_SHEET_NAME + "」シートが見つかりません。");
    return;
  }


  // 既存の見出しと食い違う場合、列を挿入せずに実行すると見出しと中身がずれるので確認する
  const mismatches = findHeaderMismatches(sheet);


  if (mismatches.length > 0) {
    const answer = ui.alert(
      "見出しが標準レイアウトと違います",
      "次の列の見出しを書き換えます。列の挿入をまだ行っていない場合、見出しと中身がずれます。\n" +
      "（この関数は見出しを書き換えるだけで、データの移動はしません）\n\n" +
      mismatches.join("\n") + "\n\n続けますか？",
      ui.ButtonSet.YES_NO
    );


    if (answer !== ui.Button.YES) {
      ui.alert("中止しました。");
      return;
    }
  }


  const headerRange = sheet.getRange(1, 1, 1, CAMERA_HEADERS.length);
  headerRange.setValues([CAMERA_HEADERS]);


  headerRange
    .setBackground("#f3f3f3")
    .setFontWeight("bold")
    .setHorizontalAlignment("center");


  const columnMap = getColumnMap(sheet);


  // 撮影日・時間だけセットに見えるように見出し背景色変更
  sheet.getRange(1, columnMap["撮影日"], 1, 2).setBackground("#d9ead3");


  const lastRow = Math.max(sheet.getLastRow(), 2);
  const totalRows = lastRow - 1;


  // 行の高さを統一
  sheet.setRowHeights(1, sheet.getMaxRows(), ROW_HEIGHT);


  // カレンダー（同期）
  const syncRange = sheet.getRange(2, columnMap["カレンダー"], totalRows, 1);
  const syncDropdownRule = SpreadsheetApp.newDataValidation()
    .requireValueInList([
      "登録・更新する",
      "登録済",
      "削除する",
      "削除済"
    ])
    .setAllowInvalid(false)
    .build();
  syncRange.setDataValidation(syncDropdownRule);


  // 状態
  const statusRange = sheet.getRange(2, columnMap["状態"], totalRows, 1);
  const statusDropdownRule = SpreadsheetApp.newDataValidation()
    .requireValueInList([
      "中止",
      "撮影終了"
    ])
    .setAllowInvalid(false)
    .build();
  statusRange.setDataValidation(statusDropdownRule);


  // 各チェック項目（チェックボックス）
  CAMERA_CHECKBOX_HEADERS.forEach(function(name) {
    sheet.getRange(2, columnMap[name], totalRows, 1).insertCheckboxes();
  });


  // 撮影日
  const dateRange = sheet.getRange(2, columnMap["撮影日"], totalRows, 1);
  dateRange.setNumberFormat("yyyy/mm/dd");


  const dateRule = SpreadsheetApp.newDataValidation()
    .requireDate()
    .setAllowInvalid(true)
    .build();
  dateRange.setDataValidation(dateRule);


  // 時間
  const timeRange = sheet.getRange(2, columnMap["時間"], totalRows, 1);
  timeRange.setNumberFormat("hh:mm");


  // 通常は9:00〜19:00の30分刻みプルダウン
  // ただし時間外撮影もあるため手入力は許可
  const timeOptions = [];


  for (let h = 9; h <= 19; h++) {
    timeOptions.push(("0" + h).slice(-2) + ":00");


    if (h !== 19) {
      timeOptions.push(("0" + h).slice(-2) + ":30");
    }
  }


  const timeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(timeOptions, true)
    .setAllowInvalid(true)
    .build();


  timeRange.setDataValidation(timeRule);


  // カメラマンマスタ・カメラマン住所は「切り詰める」
  sheet.getRange(1, columnMap["カメラマンマスタ"], sheet.getMaxRows(), 1)
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);


  sheet.getRange(1, columnMap["カメラマン住所"], sheet.getMaxRows(), 1)
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);


  // 撮影日・時間
  sheet.getRange(2, columnMap["撮影日"], totalRows, 2)
    .setHorizontalAlignment("center");


  // 撮影場所・カメラマン・カメラマン住所
  sheet.getRange(2, columnMap["撮影場所"], totalRows, 3)
    .setHorizontalAlignment("left");


  // カレンダー・状態・各チェック項目
  sheet.getRange(2, columnMap["カレンダー"], totalRows, 12)
    .setHorizontalAlignment("center");


  // 交通費・担当カスタマー・ドキュメント・メモ・予備
  sheet.getRange(2, columnMap["交通費"], totalRows, 5)
    .setHorizontalAlignment("left");


  setStatusColors(sheet, totalRows, columnMap);
  updateFilterAndProtection(sheet);


  ui.alert("完了: 見出し、プルダウン、チェックボックス、行高、保護、非表示、フィルターを設定しました！");
}


/**
 * 現在の見出しと標準レイアウトの食い違いを返す（空欄どうしは無視する）。
 */
function findHeaderMismatches(sheet) {
  const lastColumn = Math.max(sheet.getLastColumn(), CAMERA_HEADERS.length);
  const headerValues = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const mismatches = [];


  CAMERA_HEADERS.forEach(function(expected, i) {
    const actual = String(headerValues[i] === null || headerValues[i] === undefined ? "" : headerValues[i]).trim();


    if (actual !== expected) {
      mismatches.push(
        columnLetter(i + 1) + "列：「" + (actual || "空欄") + "」 → 「" + expected + "」"
      );
    }
  });


  return mismatches;
}


function setStatusColors(sheet, totalRows, columnMap) {
  const map = columnMap || getColumnMap(sheet);
  const syncColumn = map["カレンダー"];
  const statusColumn = map["状態"];


  const syncRange = sheet.getRange(2, syncColumn, totalRows, 1);
  const statusRange = sheet.getRange(2, statusColumn, totalRows, 1);


  const existingRules = sheet.getConditionalFormatRules();


  const keptRules = existingRules.filter(rule => {
    const ranges = rule.getRanges();


    return !ranges.some(range => {
      const col = range.getColumn();
      const lastCol = col + range.getNumColumns() - 1;


      return col <= statusColumn && lastCol >= syncColumn;
    });
  });


  const newRules = [
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("登録・更新する")
      .setBackground("#ffe599")
      .setRanges([syncRange])
      .build(),


    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("登録済")
      .setBackground("#b6d7a8")
      .setRanges([syncRange])
      .build(),


    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("削除する")
      .setBackground("#d9d9d9")
      .setRanges([syncRange])
      .build(),


    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("削除済")
      .setBackground("#b7b7b7")
      .setRanges([syncRange])
      .build(),


    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("中止")
      .setBackground("#b7b7b7")
      .setRanges([statusRange])
      .build(),


    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("撮影終了")
      .setBackground("#9fc5e8")
      .setRanges([statusRange])
      .build()
  ];


  sheet.setConditionalFormatRules(keptRules.concat(newRules));
}


function updateFilterAndProtection(sheet) {
  const lastRow = Math.max(sheet.getLastRow(), 1);
  const maxColumns = Math.max(sheet.getLastColumn(), CAMERA_HEADERS.length);
  const columnMap = getColumnMap(sheet);


  if (sheet.getFilter()) {
    sheet.getFilter().remove();
  }


  // B列以降にフィルター
  sheet.getRange(1, 2, lastRow, maxColumns - 1).createFilter();


  // 列の表示状態をいったんリセットしてから、カメラマンマスタと各種IDを非表示
  sheet.showColumns(1, sheet.getMaxColumns());


  if (columnMap["カメラマンマスタ"]) {
    sheet.hideColumns(columnMap["カメラマンマスタ"]);
  }


  CAMERA_ID_HEADERS.forEach(function(name) {
    if (columnMap[name]) {
      sheet.hideColumns(columnMap[name]);
    }
  });


  const protections = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);


  protections.forEach(p => {
    if (
      p.getDescription() === "A列カメラマンマスタ保護" ||
      p.getDescription() === "O列自動保護"
    ) {
      p.remove();
    }
  });


  const masterColumn = columnMap["カメラマンマスタ"] || 1;
  const masterRange = sheet.getRange(1, masterColumn, sheet.getMaxRows(), 1);
  const protection = masterRange.protect().setDescription("A列カメラマンマスタ保護");


  const editors = protection.getEditors();
  protection.removeEditors(editors);


  if (protection.canDomainEdit()) {
    protection.setDomainEdit(false);
  }
}


/**
 * 撮影終了・納品・UP のいずれかにチェックが入っている行の
 * 「状態」を「撮影終了」に更新する。
 * ※ onEdit（自動トリガー）は他のGASと競合するため使わず、
 *   「撮影終了を下に移動」メニューの実行時にも呼ばれる。
 *
 * 書き戻すのは「状態」列だけ。チェックボックスまで setValues で上書きすると
 * 入力規則やリッチテキストを壊す可能性があるため。
 */
function applyFinishedStatus(sheet, columnMap) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;


  const map = columnMap || getColumnMap(sheet);
  const finishedHeaders = ["撮影終了", "納品", "UP"];


  if (!map["状態"] || findMissingHeaders(map, finishedHeaders).length > 0) return;


  const totalRows = lastRow - 1;


  const statusRange = sheet.getRange(2, map["状態"], totalRows, 1);
  const statusValues = statusRange.getValues();


  // チェック列が離れていても読めるよう、左端から右端までまとめて読む
  const checkColumns = finishedHeaders.map(function(name) { return map[name]; });
  const firstColumn = Math.min.apply(null, checkColumns);
  const lastColumn = Math.max.apply(null, checkColumns);
  const checkValues = sheet.getRange(2, firstColumn, totalRows, lastColumn - firstColumn + 1).getValues();


  let changed = false;


  for (let i = 0; i < totalRows; i++) {
    const isFinished = checkColumns.some(function(column) {
      return checkValues[i][column - firstColumn] === true;
    });


    if (isFinished && statusValues[i][0] !== "撮影終了") {
      statusValues[i][0] = "撮影終了";
      changed = true;
    }
  }


  if (changed) {
    statusRange.setValues(statusValues);
  }
}


/**
 * セルが「空」とみなせるか。
 * 未チェックのチェックボックス（false）も空扱いにする。
 */
function isBlankCellValue(value) {
  if (value === null || value === undefined || value === "") return true;
  if (value === false) return true;
  if (typeof value === "string") return value.trim() === "";
  return false;
}


/**
 * 並べ替え対象の範囲がすべて空なら true（＝完全な空行）。
 */
function isBlankRowValues(rowValues) {
  return rowValues.every(function(value) {
    return isBlankCellValue(value);
  });
}


/**
 * 撮影日と時間から並べ替え用のタイムスタンプ（ミリ秒）を作る。
 * 撮影日が未入力・日付として読めない場合は null を返す。
 * 時間が空のときは 0:00 として扱う。
 */
function getShootTimestamp(shootDate, shootTime) {
  if (isBlankCellValue(shootDate)) return null;
  if (!(shootDate instanceof Date) && typeof shootDate !== "string") return null;

  try {
    const time = combineDateAndTime(shootDate, shootTime).getTime();
    return isNaN(time) ? null : time;
  } catch (err) {
    return null;
  }
}


/**
 * 状態が「撮影終了」の行を下（一番下）へ移動しつつ、
 * 撮影終了になっていない行を撮影日＋時間の早い順に並べ替える。
 *
 * 並び順
 *   1. 未終了（撮影日時の昇順。撮影日が未入力の行は UNDATED_FIRST の設定に従う）
 *   2. 区切りの空行（1行）
 *   3. 撮影終了（元の並び順を維持）
 *   4. 残りの空行
 *
 * ・A列（カメラマンマスタ）は固定したまま、B列から右だけをまとめて並べ替える
 *
 * 【重要】値の入れ替え（getValues → setValues）では
 *   背景色・文字色・罫線・メモ・チェックボックスの入力規則・
 *   「ドキュメント」列のスマートチップ／リンクが元の行に残ってしまい、
 *   中身と書式がばらける（チップはただの文字列になってリンクが切れる）。
 *   そのためシート標準の並べ替え（Range.sort＝セルごと移動）を使う。
 *   並べ替えキーは右端に一時列を2つ作って持たせ、終わったら必ず削除する。
 */
function moveFinishedDown() {
  // 撮影日が未入力の未終了行を上に置く（false にすると未終了の一番下に置く）
  const UNDATED_FIRST = true;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CAMERA_SHEET_NAME);


  if (!sheet) {
    SpreadsheetApp.getUi().alert("エラー: 「" + CAMERA_SHEET_NAME + "」シートが見つかりません。");
    return;
  }


  const columnMap = requireColumns(sheet, ["撮影日", "時間", "状態"], "並べ替えを中止しました");
  if (!columnMap) return;


  // まず撮影終了・納品・UP のチェックを状態に反映してから並べ替える
  applyFinishedStatus(sheet, columnMap);


  const START_COL = 2;   // B列（A列のカメラマンマスタは動かさない）
  const lastColumn = sheet.getLastColumn();


  if (lastColumn < START_COL) return;


  const NUM_COLS = lastColumn - START_COL + 1;
  const DATE_IDX = columnMap["撮影日"] - START_COL;
  const TIME_IDX = columnMap["時間"] - START_COL;
  const STATUS_IDX = columnMap["状態"] - START_COL;


  const lastRow = sheet.getLastRow();
  if (lastRow < 3) return; // 並べ替え対象が2行未満なら何もしない


  const values = sheet.getRange(2, START_COL, lastRow - 1, NUM_COLS).getValues();


  // 第1キー：グループ
  const GROUP_ACTIVE = 0;    // 未終了
  const GROUP_SEPARATOR = 1; // 区切りの空行
  const GROUP_FINISHED = 2;  // 撮影終了
  const GROUP_BLANK = 3;     // 残りの空行


  // 第2キー：未終了は撮影日時のミリ秒。撮影日が未入力の行は実在する日時から
  // 十分離れた番兵を使い、元の並び順を保ったまま上（または下）へまとめる。
  const UNDATED_BASE = UNDATED_FIRST ? -100000000000000 : 100000000000000;


  const groups = [];
  const orders = [];
  let undatedSeq = 0;
  let finishedSeq = 0;
  let blankSeq = 0;
  let finishedCount = 0;
  let separatorIdx = -1;


  values.forEach(function(rowValues, i) {
    if (isBlankRowValues(rowValues)) {
      // 最初の空行を「未終了と撮影終了の区切り」に使い、残りは一番下へ
      if (separatorIdx < 0) {
        separatorIdx = i;
        groups.push(GROUP_SEPARATOR);
        orders.push(0);
      } else {
        groups.push(GROUP_BLANK);
        orders.push(blankSeq++);
      }
      return;
    }


    if (rowValues[STATUS_IDX] === "撮影終了") {
      finishedCount++;
      groups.push(GROUP_FINISHED);
      orders.push(finishedSeq++);
      return;
    }


    const timestamp = getShootTimestamp(rowValues[DATE_IDX], rowValues[TIME_IDX]);
    groups.push(GROUP_ACTIVE);
    orders.push(timestamp === null ? UNDATED_BASE + (undatedSeq++) : timestamp);
  });


  let numRows = lastRow - 1;


  // 撮影終了があるのに空行が1行もない場合は、区切り用の空行を1行だけ確保する
  if (finishedCount > 0 && separatorIdx < 0) {
    if (sheet.getMaxRows() < lastRow + 1) {
      sheet.insertRowsAfter(sheet.getMaxRows(), 1);
    }
    numRows += 1;
    groups.push(GROUP_SEPARATOR);
    orders.push(0);
  }


  // すでに並び順が正しければ何もしない（無駄な並べ替えを避ける）
  let alreadySorted = true;
  for (let i = 1; i < groups.length; i++) {
    if (groups[i] < groups[i - 1] ||
        (groups[i] === groups[i - 1] && orders[i] < orders[i - 1])) {
      alreadySorted = false;
      break;
    }
  }


  if (alreadySorted) {
    ss.toast("並べ替えの必要はありませんでした。", "撮影管理", 3);
    return;
  }


  // 一時的なキー列を右端に2列追加（A列を動かさないため B列から右だけを並べ替える）
  const maxCols = sheet.getMaxColumns();
  sheet.insertColumnsAfter(maxCols, 2);
  const groupCol = maxCols + 1;
  const orderCol = maxCols + 2;


  const filter = sheet.getFilter();
  const filterRow = filter ? filter.getRange().getRow() : 0;
  const filterCol = filter ? filter.getRange().getColumn() : 0;
  const filterNumRows = filter ? filter.getRange().getNumRows() : 0;
  const filterNumCols = filter ? filter.getRange().getNumColumns() : 0;


  try {
    sheet.getRange(2, groupCol, numRows, 2).setValues(groups.map(function(group, i) {
      return [group, orders[i]];
    }));


    const sortRange = sheet.getRange(2, START_COL, numRows, orderCol - START_COL + 1);
    const sortSpec = [
      { column: groupCol, ascending: true },
      { column: orderCol, ascending: true }
    ];


    try {
      sortRange.sort(sortSpec);
    } catch (err) {
      // フィルターがあると並べ替えできない場合があるので、外してから再実行する
      if (!filter) throw err;
      filter.remove();
      sortRange.sort(sortSpec);
    }
  } finally {
    sheet.deleteColumns(groupCol, 2);


    // フォールバックでフィルターを外していたら元の範囲で作り直す
    if (filter && !sheet.getFilter()) {
      const cols = Math.min(filterNumCols, sheet.getMaxColumns() - filterCol + 1);
      sheet.getRange(filterRow, filterCol, filterNumRows, cols).createFilter();
    }
  }


  ss.toast("撮影終了を下に移動し、未終了を撮影日時順に並べ替えました。", "撮影管理", 5);
}


function combineDateAndTime(dateVal, timeVal) {
  const baseDate = new Date(dateVal);
  let hours = 0;
  let minutes = 0;


  if (timeVal instanceof Date) {
    hours = timeVal.getHours();
    minutes = timeVal.getMinutes();


  } else if (typeof timeVal === "string") {


    const normalized = timeVal
      .trim()
      .replace(/：/g, ":")
      .replace(/時/g, ":")
      .replace(/分/g, "")
      .replace(/[０-９]/g, function(s) {
        return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
      });


    if (normalized.includes(":")) {
      const parts = normalized.split(":");
      hours = parseInt(parts[0], 10);
      minutes = parseInt(parts[1] || "0", 10);
    }


  } else if (typeof timeVal === "number") {


    const totalMinutes = Math.round(timeVal * 24 * 60);
    hours = Math.floor(totalMinutes / 60);
    minutes = totalMinutes % 60;


  }


  return new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
    hours,
    minutes
  );
}


function calculateTaskTime(calendar, targetDate, titleKeyword, ownEventId) {
  const startOfDay = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
    0,
    0,
    0
  );


  const endOfDay = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
    23,
    59,
    59
  );


  const existingEvents = calendar.getEvents(startOfDay, endOfDay);


  const count = existingEvents.filter(event => {
    if (ownEventId && event.getId() === ownEventId) return false;
    return event.getTitle().includes(titleKeyword);
  }).length;


  const resultDate = new Date(startOfDay);
  const startMinutes = (9 * 60 + 30) - (count * 30);


  resultDate.setMinutes(startMinutes);
  return resultDate;
}


function isHolidayOrWeekend(date) {
  const day = date.getDay();


  if (day === 0 || day === 6) {
    return true;
  }


  const holidayCalendar = CalendarApp.getCalendarById(
    "ja.japanese#holiday@group.v.calendar.google.com"
  );


  const events = holidayCalendar.getEventsForDay(date);


  return events.length > 0;
}


/**
 * 診断用：syncCameraTasks で各行が登録されるか／されない理由を確認する。
 * カレンダーの接続確認、見出しから引いた列番号、行ごとの判定結果を出す。
 */
function checkSyncCameraTasks() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CAMERA_SHEET_NAME);


  if (!sheet) {
    ui.alert("エラー: 「" + CAMERA_SHEET_NAME + "」シートが見つかりません。シート名を確認してください。");
    return;
  }


  const lines = [];


  // 1) カレンダー接続チェック
  const calendar = CalendarApp.getCalendarById(CAMERA_CALENDAR_ID);
  if (!calendar) {
    lines.push("■カレンダー：接続NG（IDが違う or 権限なし）");
    lines.push("  → カレンダー設定でこのアカウントに共有・編集権限があるか確認してください。");
  } else {
    lines.push("■カレンダー：接続OK（" + calendar.getName() + "）");
  }


  // 2) 見出しから引いた列
  const columnMap = getColumnMap(sheet);
  const requiredHeaders = [
    "案件名", "撮影日", "時間", "撮影場所", "カメラマン", "カメラマン住所",
    "カレンダー", "状態", "データ譲渡", "詳細送付ID", "前日確認ID", "撮影ID", "納品ID"
  ];
  const missing = findMissingHeaders(columnMap, requiredHeaders);


  if (missing.length > 0) {
    lines.push("■見出し：NG（次の見出しが1行目に見つかりません）");
    missing.forEach(name => lines.push("  → 「" + name + "」"));
    lines.push("  ※ 見出しが見つからないと同期は実行されません。");
  } else {
    lines.push("■見出し：OK");
    lines.push("  " + requiredHeaders.map(function(name) {
      return name + "=" + columnLetter(columnMap[name]) + "列";
    }).join(" / "));
  }


  if (missing.length > 0) {
    const message = lines.join("\n");
    Logger.log(message);
    ui.alert("同期診断結果", message, ui.ButtonSet.OK);
    return;
  }


  // 3) 行ごとの判定
  const data = sheet.getDataRange().getValues();
  lines.push("■データ行数：" + (data.length - 1));


  let okCount = 0;


  for (let i = 1; i < data.length; i++) {
    const row = i + 1;
    const project = data[i][columnMap["案件名"] - 1];
    const shootDate = data[i][columnMap["撮影日"] - 1];
    const shootTime = data[i][columnMap["時間"] - 1];
    const cameraman = data[i][columnMap["カメラマン"] - 1];
    const calendarAction = data[i][columnMap["カレンダー"] - 1];


    // 完全な空行はスキップ表示しない
    if (!project && !shootDate && !shootTime && !cameraman && !calendarAction) continue;


    const reasons = [];
    if (calendarAction !== "登録・更新する") reasons.push("カレンダー列が「登録・更新する」でない（現在:「" + (calendarAction || "空欄") + "」）");
    if (!project) reasons.push("案件名 が空");
    if (!shootDate) reasons.push("撮影日 が空");
    if (!shootTime) reasons.push("時間 が空");
    if (!cameraman) reasons.push("カメラマン が空");


    if (reasons.length === 0) {
      okCount++;
      lines.push(row + "行目：✅ 登録対象（案件:" + project + "）");
    } else {
      lines.push(row + "行目：⛔ スキップ → " + reasons.join(" / "));
    }
  }


  lines.push("■登録対象の行数：" + okCount);


  const message = lines.join("\n");
  Logger.log(message);
  ui.alert("同期診断結果", message, ui.ButtonSet.OK);
}


/**
 * 【編集時に自動実行】撮影終了・納品・UP のいずれかにチェックが入ったら、
 * その行の「状態」を「撮影終了」に自動変更する。
 *
 * ※ 関数名は onEdit ではないため、他のGASの onEdit と衝突しません。
 *   この関数は「インストール型トリガー」で編集時に呼ばれます。
 *   → 初回のみメニュー「【初回のみ】編集時の自動反映を設定」を実行してください。
 */
function handleCheckboxEdit(e) {
  if (!e || !e.range) return;

  const sheet = e.range.getSheet();
  if (sheet.getName() !== CAMERA_SHEET_NAME) return;

  const columnMap = getColumnMap(sheet);
  const finishedHeaders = ["撮影終了", "納品", "UP"];

  if (!columnMap["状態"] || findMissingHeaders(columnMap, finishedHeaders).length > 0) return;

  const checkColumns = finishedHeaders.map(function(name) { return columnMap[name]; });

  const startRow = e.range.getRow();
  const startCol = e.range.getColumn();
  const numRows = e.range.getNumRows();
  const endCol = startCol + e.range.getNumColumns() - 1;

  // 編集範囲に撮影終了・納品・UP のいずれかを含むか
  const touched = checkColumns.some(function(column) {
    return column >= startCol && column <= endCol;
  });

  if (!touched) return;

  for (let r = 0; r < numRows; r++) {
    const row = startRow + r;
    if (row < 2) continue;

    const isFinished = checkColumns.some(function(column) {
      return sheet.getRange(row, column).getValue() === true;
    });

    if (isFinished) {
      const statusCell = sheet.getRange(row, columnMap["状態"]);
      if (statusCell.getValue() !== "撮影終了") {
        statusCell.setValue("撮影終了");
      }
    }
  }
}


/**
 * 編集時の自動反映（handleCheckboxEdit）をインストール型トリガーとして登録する。
 * 初回のみ実行すればOK。重複しないよう既存の同名トリガーは削除してから作り直す。
 */
function installEditTrigger() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  // 既存の handleCheckboxEdit トリガーを削除（重複防止）
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === "handleCheckboxEdit") {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger("handleCheckboxEdit")
    .forSpreadsheet(ss)
    .onEdit()
    .create();

  ui.alert("設定完了", "編集時の自動反映を有効にしました。\n撮影終了・納品・UP にチェックを入れると、状態が自動で「撮影終了」になります。", ui.ButtonSet.OK);
}


function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("撮影管理")
    .addItem("カレンダー同期", "syncCameraTasks")
    .addItem("撮影終了を下に移動＋撮影日時順に並べ替え", "moveFinishedDown")
    .addSeparator()
    .addItem("同期の診断（登録されない原因を確認）", "checkSyncCameraTasks")
    .addItem("【初期設定】シートの環境を整える", "setSheetCameraTasks")
    .addItem("【初回のみ】編集時の自動反映を設定", "installEditTrigger")
    .addToUi();
}
