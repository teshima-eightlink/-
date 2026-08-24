/**
 * 撮影管理シート × Googleカレンダー連携
 *
 * 列レイアウト（項目追加後・全28列）
 *   A カメラマンマスタ      B 案件名          C 候補日メモ        D 撮影日          E 時間
 *   F 撮影場所            G カメラマン        H カメラマン住所      I カレンダー        J 状態
 *   K 撮影依頼シート作成 ☑   L 撮影依頼シート送付 ☑ M 前日LINE ☑        N 当日LINE ☑      O 合流チェック ☑
 *   P 撮影終了 ☑           Q 納品 ☑          R UP ☑             S データ譲渡 ☑
 *   T 詳細送付ID          U 前日確認ID        V 撮影ID            W 納品ID
 *   X 交通費              Y 担当カスタマー      Z ドキュメント        AA メモ            AB 予備
 *
 * 主な機能
 *   syncCameraTasks()     … カレンダー同期（メニュー）
 *   setSheetCameraTasks() … 初期設定（メニュー）
 *   moveFinishedDown()    … 「撮影終了」の行を下に移動＋未終了を撮影日時順に並べ替え
 *                           （B〜AB をセルごとまとめて移動）
 *   applyFinishedStatus() … 撮影終了/納品/UP のいずれかにチェックで J列を「撮影終了」に更新
 *                           （「撮影終了を下に移動」メニューの実行時に呼ばれる）
 *   checkSyncCameraTasks()… 同期の診断（メニュー）
 *   handleCheckboxEdit()  … 編集時にP〜Rのチェックで J列を「撮影終了」に（インストール型トリガー）
 *   installEditTrigger()  … 上記トリガーを登録（初回のみ・メニュー）
 */

function syncCameraTasks() {
  const SHEET_NAME = "撮影管理";
  const CALENDAR_ID = "a318a9f9c5467e98191e3441af7c94084983ab5c40624dae2581dea4fc333520@group.calendar.google.com";
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);


  if (!sheet) {
    SpreadsheetApp.getUi().alert("エラー: 「" + SHEET_NAME + "」シートが見つかりません。");
    return;
  }


  const calendar = CalendarApp.getCalendarById(CALENDAR_ID);


  if (!calendar) {
    SpreadsheetApp.getUi().alert(
      "エラー: カレンダーが見つかりません。\n" +
      "カレンダーID（" + CALENDAR_ID + "）が正しいか、または閲覧・編集権限があるか確認してください。"
    );
    return;
  }


// 他の人が実行するとA列保護でエラーになるため、同期時は保護・フィルター再設定しない
// updateFilterAndProtection(sheet);


const data = sheet.getDataRange().getValues();


  for (let i = 1; i < data.length; i++) {
    const row = i + 1;


    const project = data[i][1];            // B：案件名
    const shootDate = data[i][3];          // D：撮影日
    const shootTime = data[i][4];          // E：時間
    const shootLocation = data[i][5];      // F：撮影場所
    const cameraman = data[i][6];          // G：カメラマン
    const cameramanAddress = data[i][7];   // H：カメラマン住所
    const calendarAction = data[i][8];     // I：同期
    const status = data[i][9];             // J：状態
    const shootDone = data[i][15];         // P：撮影終了
    const deliveryDone = data[i][16];      // Q：納品
    const uploadDone = data[i][17];        // R：UP
    const dataTransfer = data[i][18];      // S：データ譲渡


    const detailEventId = data[i][19];     // T：詳細送付ID
    const reminderEventId = data[i][20];   // U：前日確認ID
    const shootEventId = data[i][21];      // V：撮影ID
    const deliveryEventId = data[i][22];   // W：納品ID


    if (calendarAction === "削除する" || status === "中止") {
      deleteEventByIdOrTitle(calendar, detailEventId, project, "｜撮影詳細送付");
      deleteEventByIdOrTitle(calendar, reminderEventId, project, "｜前日確認");
      deleteEventByIdOrTitle(calendar, shootEventId, project, "｜撮影");
      deleteEventByIdOrTitle(calendar, deliveryEventId, project, "｜データ納品");


      sheet.getRange(row, 9).setValue("削除済");   // I：同期
      sheet.getRange(row, 10).setValue("中止");     // J：状態（削除済になったら中止）
      sheet.getRange(row, 20, 1, 4).clearContent(); // T〜W：各種ID
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
      `状態：${status || ""}\n` +
      `撮影終了：${shootDone === true ? "済" : ""}\n` +
      `納品：${deliveryDone === true ? "済" : ""}\n` +
      `UP：${uploadDone === true ? "済" : ""}\n` +
      `データ譲渡：${dataTransfer === true ? "済" : ""}\n` +
      `撮影日時：${Utilities.formatDate(shootDateTime, Session.getScriptTimeZone(), "yyyy/MM/dd HH:mm")}`;


    const detailStart = calculateTaskTime(calendar, detailDate, "｜撮影詳細送付", detailEventId);
    const detailEvent = createOrUpdateEvent(
      calendar,
      detailEventId,
      detailTitle,
      detailStart,
      new Date(detailStart.getTime() + 30 * 60 * 1000),
      description
    );


    const reminderStart = calculateTaskTime(calendar, reminderDate, "｜前日確認", reminderEventId);
    const reminderEvent = createOrUpdateEvent(
      calendar,
      reminderEventId,
      reminderTitle,
      reminderStart,
      new Date(reminderStart.getTime() + 30 * 60 * 1000),
      description
    );


    const shootEvent = createOrUpdateEvent(
      calendar,
      shootEventId,
      shootTitle,
      shootDateTime,
      new Date(shootDateTime.getTime() + 60 * 60 * 1000),
      description
    );


    const deliveryStart = calculateTaskTime(calendar, deliveryDate, "｜データ納品", deliveryEventId);
    const deliveryEvent = createOrUpdateEvent(
      calendar,
      deliveryEventId,
      deliveryTitle,
      deliveryStart,
      new Date(deliveryStart.getTime() + 30 * 60 * 1000),
      description
    );


    sheet.getRange(row, 20, 1, 4).setValues([[
      detailEvent.getId(),
      reminderEvent.getId(),
      shootEvent.getId(),
      deliveryEvent.getId()
    ]]);


    sheet.getRange(row, 9).setValue("登録済");
  }
}


function createOrUpdateEvent(calendar, eventId, title, startTime, endTime, description) {
  let event = null;


  if (eventId) {
    event = calendar.getEventById(eventId);
  }


  if (event) {
    event.setTitle(title);
    event.setTime(startTime, endTime);
    event.setDescription(description);
    return event;
  }


  return calendar.createEvent(title, startTime, endTime, { description: description });
}


function deleteEventByIdOrTitle(calendar, eventId, project, titleKeyword) {
  let deleted = false;


  if (eventId) {
    const event = calendar.getEventById(eventId);
    if (event) {
      event.deleteEvent();
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
 * 主な処理：
 * ・1行目に見出しを設定（全28列）
 * ・見出し行の背景色、太字、中央寄せを設定
 * ・D列/E列（撮影日・時間）をセットに見えるよう背景色変更
 * ・全行の高さを統一
 * ・I列「同期」にプルダウンを設定
 * ・J列「状態」にプルダウンを設定
 * ・K〜S列（各チェック項目・撮影終了・納品・UP・データ譲渡）にチェックボックスを設定
 * ・D列「撮影日」に日付形式と日付入力ルールを設定
 * ・E列「時間」に時刻形式を設定
 * ・A列「カメラマンマスタ」とH列「カメラマン住所」は切り詰め表示
 * ・状態ごとの色設定を反映
 * ・フィルター、保護、非表示列を再設定
 */
function setSheetCameraTasks() {
  const SHEET_NAME = "撮影管理";
  const ROW_HEIGHT = 36;


  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);


  if (!sheet) {
    SpreadsheetApp.getUi().alert("エラー: 「" + SHEET_NAME + "」シートが見つかりません。");
    return;
  }


  const headers = [[
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
  ]];


  const headerRange = sheet.getRange(1, 1, 1, 28);
  headerRange.setValues(headers);


  headerRange
    .setBackground("#f3f3f3")
    .setFontWeight("bold")
    .setHorizontalAlignment("center");


  // D/Eだけセットに見えるように見出し背景色変更
  sheet.getRange(1, 4, 1, 2).setBackground("#d9ead3");


  const lastRow = Math.max(sheet.getLastRow(), 2);
  const totalRows = lastRow - 1;


  // 行の高さを統一
  sheet.setRowHeights(1, sheet.getMaxRows(), ROW_HEIGHT);


  // I列：同期
  const iRange = sheet.getRange(2, 9, totalRows, 1);
  const iDropdownRule = SpreadsheetApp.newDataValidation()
    .requireValueInList([
      "登録・更新する",
      "登録済",
      "削除する",
      "削除済"
    ])
    .setAllowInvalid(false)
    .build();
  iRange.setDataValidation(iDropdownRule);


  // J列：状態
  const jRange = sheet.getRange(2, 10, totalRows, 1);
  const jDropdownRule = SpreadsheetApp.newDataValidation()
    .requireValueInList([
      "中止",
      "撮影終了"
    ])
    .setAllowInvalid(false)
    .build();
  jRange.setDataValidation(jDropdownRule);


  // K〜S列：撮影依頼シート作成・送付・前日LINE・当日LINE・合流チェック・撮影終了・納品・UP・データ譲渡（チェックボックス）
  sheet.getRange(2, 11, totalRows, 9).insertCheckboxes();


  // D列：撮影日
  const dRange = sheet.getRange(2, 4, totalRows, 1);
  dRange.setNumberFormat("yyyy/mm/dd");


  const dDateRule = SpreadsheetApp.newDataValidation()
    .requireDate()
    .setAllowInvalid(true)
    .build();
  dRange.setDataValidation(dDateRule);


  // E列：時間
  const eRange = sheet.getRange(2, 5, totalRows, 1);
  eRange.setNumberFormat("hh:mm");


  // 通常は9:00〜19:00の30分刻みプルダウン
  // ただし時間外撮影もあるため手入力は許可
  const timeOptions = [];


  for (let h = 9; h <= 19; h++) {
    timeOptions.push(("0" + h).slice(-2) + ":00");


    if (h !== 19) {
      timeOptions.push(("0" + h).slice(-2) + ":30");
    }
  }


const eTimeRule = SpreadsheetApp.newDataValidation()
  .requireValueInList(timeOptions, true)
  .setAllowInvalid(true)
  .build();


eRange.setDataValidation(eTimeRule);
  // A列・H列は「切り詰める」
  sheet.getRange(1, 1, sheet.getMaxRows(), 1)
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);


  sheet.getRange(1, 8, sheet.getMaxRows(), 1)
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);


  // D～E（撮影日・時間）
  sheet.getRange(2, 4, totalRows, 2)
    .setHorizontalAlignment("center");


  // F～H（撮影場所・カメラマン・カメラマン住所）
  sheet.getRange(2, 6, totalRows, 3)
    .setHorizontalAlignment("left");


  // I～S（同期・状態・各チェック項目）
  sheet.getRange(2, 9, totalRows, 11)
    .setHorizontalAlignment("center");


  // X～AB（交通費・担当カスタマー・ドキュメント・メモ・予備）
  sheet.getRange(2, 24, totalRows, 5)
    .setHorizontalAlignment("left");


  setStatusColors(sheet, totalRows);
  updateFilterAndProtection(sheet);


  SpreadsheetApp.getUi().alert("完了: 見出し、プルダウン、チェックボックス、行高、保護、非表示、フィルターを設定しました！");
}


function setStatusColors(sheet, totalRows) {
  const iRange = sheet.getRange(2, 9, totalRows, 1);
  const jRange = sheet.getRange(2, 10, totalRows, 1);


  const existingRules = sheet.getConditionalFormatRules();


  const keptRules = existingRules.filter(rule => {
    const ranges = rule.getRanges();


    return !ranges.some(range => {
      const col = range.getColumn();
      const lastCol = col + range.getNumColumns() - 1;


      return col <= 10 && lastCol >= 9;
    });
  });


  const newRules = [
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("登録・更新する")
      .setBackground("#ffe599")
      .setRanges([iRange])
      .build(),


    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("登録済")
      .setBackground("#b6d7a8")
      .setRanges([iRange])
      .build(),


    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("削除する")
      .setBackground("#d9d9d9")
      .setRanges([iRange])
      .build(),


    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("削除済")
      .setBackground("#b7b7b7")
      .setRanges([iRange])
      .build(),


    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("中止")
      .setBackground("#b7b7b7")
      .setRanges([jRange])
      .build(),


    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("撮影終了")
      .setBackground("#9fc5e8")
      .setRanges([jRange])
      .build()
  ];


  sheet.setConditionalFormatRules(keptRules.concat(newRules));
}


function updateFilterAndProtection(sheet) {
  const lastRow = Math.max(sheet.getLastRow(), 1);
  const maxColumns = Math.max(sheet.getLastColumn(), 28);


  if (sheet.getFilter()) {
    sheet.getFilter().remove();
  }


  // B列以降にフィルター
  sheet.getRange(1, 2, lastRow, maxColumns - 1).createFilter();


  // 列の表示状態をいったんリセットしてから、A列とT〜W列（各種ID）を非表示
  sheet.showColumns(1, sheet.getMaxColumns());
  sheet.hideColumns(1);
  sheet.hideColumns(20, 4);


  const protections = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);


  protections.forEach(p => {
    if (
      p.getDescription() === "A列カメラマンマスタ保護" ||
      p.getDescription() === "O列自動保護"
    ) {
      p.remove();
    }
  });


  const aRange = sheet.getRange(1, 1, sheet.getMaxRows(), 1);
  const protection = aRange.protect().setDescription("A列カメラマンマスタ保護");


  const editors = protection.getEditors();
  protection.removeEditors(editors);


  if (protection.canDomainEdit()) {
    protection.setDomainEdit(false);
  }
}


/**
 * 撮影終了・納品・UP（P〜R列）のいずれかにチェックが入っている行の
 * J列（状態）を「撮影終了」に更新する。
 * ※ onEdit（自動トリガー）は他のGASと競合するため使わず、
 *   「撮影終了を下に移動」メニューの実行時にも呼ばれる。
 *
 * 書き戻すのは J列だけ。P〜R のチェックボックスまで setValues で上書きすると
 * 入力規則やリッチテキストを壊す可能性があるため。
 */
function applyFinishedStatus(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;


  const totalRows = lastRow - 1;


  const statusRange = sheet.getRange(2, 10, totalRows, 1);      // J：状態
  const statusValues = statusRange.getValues();
  const checkValues = sheet.getRange(2, 16, totalRows, 3).getValues(); // P〜R


  let changed = false;


  for (let i = 0; i < totalRows; i++) {
    const status = statusValues[i][0];
    const shootDone = checkValues[i][0] === true; // P：撮影終了
    const delivered = checkValues[i][1] === true; // Q：納品
    const uploaded = checkValues[i][2] === true;  // R：UP


    if ((shootDone || delivered || uploaded) && status !== "撮影終了") {
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
 * B〜AB のすべてが空なら true（＝完全な空行）。
 */
function isBlankRowValues(rowValues) {
  return rowValues.every(function(value) {
    return isBlankCellValue(value);
  });
}


/**
 * D列（撮影日）とE列（時間）から並べ替え用のタイムスタンプ（ミリ秒）を作る。
 * 撮影日が未入力・日付として読めない場合は null を返す。
 * E列（時間）が空のときは 0:00 として扱う。
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
 * 撮影終了になっていない行を D列（撮影日）＋E列（時間）の早い順に並べ替える。
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
 *   Z列「ドキュメント」のスマートチップ／リンクが元の行に残ってしまい、
 *   中身と書式がばらける（チップはただの文字列になってリンクが切れる）。
 *   そのためシート標準の並べ替え（Range.sort＝セルごと移動）を使う。
 *   並べ替えキーは右端に一時列を2つ作って持たせ、終わったら必ず削除する。
 */
function moveFinishedDown() {
  const SHEET_NAME = "撮影管理";

  // 撮影日が未入力の未終了行を上に置く（false にすると未終了の一番下に置く）
  const UNDATED_FIRST = true;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);


  if (!sheet) {
    SpreadsheetApp.getUi().alert("エラー: 「" + SHEET_NAME + "」シートが見つかりません。");
    return;
  }


  // まず撮影終了・納品・UP のチェックを状態に反映してから並べ替える
  applyFinishedStatus(sheet);


  const START_COL = 2;   // B列
  const NUM_COLS = 27;   // B〜AB列（2〜28）
  const DATE_IDX = 2;    // D列（B起点で 4-2=2）
  const TIME_IDX = 3;    // E列（B起点で 5-2=3）
  const STATUS_IDX = 8;  // J列（B起点で 10-2=8）


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
 * カレンダーの接続確認と、行ごとの判定結果をポップアップ＆ログに出す。
 */
function checkSyncCameraTasks() {
  const SHEET_NAME = "撮影管理";
  const CALENDAR_ID = "a318a9f9c5467e98191e3441af7c94084983ab5c40624dae2581dea4fc333520@group.calendar.google.com";
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);


  if (!sheet) {
    ui.alert("エラー: 「" + SHEET_NAME + "」シートが見つかりません。シート名を確認してください。");
    return;
  }


  const lines = [];


  // 1) カレンダー接続チェック
  const calendar = CalendarApp.getCalendarById(CALENDAR_ID);
  if (!calendar) {
    lines.push("■カレンダー：接続NG（IDが違う or 権限なし）");
    lines.push("  → カレンダー設定でこのアカウントに共有・編集権限があるか確認してください。");
  } else {
    lines.push("■カレンダー：接続OK（" + calendar.getName() + "）");
  }


  // 2) 行ごとの判定
  const data = sheet.getDataRange().getValues();
  lines.push("■データ行数：" + (data.length - 1));


  let okCount = 0;


  for (let i = 1; i < data.length; i++) {
    const row = i + 1;
    const project = data[i][1];        // B
    const shootDate = data[i][3];      // D
    const shootTime = data[i][4];      // E
    const cameraman = data[i][6];      // G
    const calendarAction = data[i][8]; // I


    // 完全な空行はスキップ表示しない
    if (!project && !shootDate && !shootTime && !cameraman && !calendarAction) continue;


    const reasons = [];
    if (calendarAction !== "登録・更新する") reasons.push("I列が「登録・更新する」でない（現在:「" + (calendarAction || "空欄") + "」）");
    if (!project) reasons.push("B列 案件名 が空");
    if (!shootDate) reasons.push("D列 撮影日 が空");
    if (!shootTime) reasons.push("E列 時間 が空");
    if (!cameraman) reasons.push("G列 カメラマン が空");


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
 * 【編集時に自動実行】撮影終了・納品・UP（P〜R列）のいずれかにチェックが入ったら、
 * その行の J列（状態）を「撮影終了」に自動変更する。
 *
 * ※ 関数名は onEdit ではないため、他のGASの onEdit と衝突しません。
 *   この関数は「インストール型トリガー」で編集時に呼ばれます。
 *   → 初回のみメニュー「【初回のみ】編集時の自動反映を設定」を実行してください。
 */
function handleCheckboxEdit(e) {
  if (!e || !e.range) return;

  const sheet = e.range.getSheet();
  if (sheet.getName() !== "撮影管理") return;

  const startRow = e.range.getRow();
  const startCol = e.range.getColumn();
  const numRows = e.range.getNumRows();
  const endCol = startCol + e.range.getNumColumns() - 1;

  // 編集範囲に P(16)撮影終了 / Q(17)納品 / R(18)UP のいずれかを含むか
  if (endCol < 16 || startCol > 18) return;

  for (let r = 0; r < numRows; r++) {
    const row = startRow + r;
    if (row < 2) continue;

    const shootDone = sheet.getRange(row, 16).getValue() === true; // P：撮影終了
    const delivered = sheet.getRange(row, 17).getValue() === true; // Q：納品
    const uploaded = sheet.getRange(row, 18).getValue() === true;  // R：UP

    if (shootDone || delivered || uploaded) {
      const statusCell = sheet.getRange(row, 10); // J：状態
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

  ui.alert("設定完了", "編集時の自動反映を有効にしました。\nP〜R（撮影終了・納品・UP）にチェックを入れると、J列が自動で「撮影終了」になります。", ui.ButtonSet.OK);
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
