// @ts-nocheck
//==================================================
// 納品完了入力
//   setupDeliveryInputSheet            最初だけ。入力シート・ログシート・顧客名プルダウンを作る
//   setupFollowSystemColumns           最初だけ。1年サポートにBA・BBを作る
//   syncDeliveryLightList              軽量版案件一覧の顧客名リストを更新（プルダウン更新）
//   lookupDeliveryCustomerNoFromNames  B列の顧客名から顧客Noを軽量版で逆引きしてC列へ
//   checkDeliveryInput                 顧客名・納品日を入れたら実行。内容確認用
//   runDeliveryComplete                「反映済」でない入力行をまとめて本番反映（チェック不要）
//   runDeliveryCompleteChecked         A列にチェックした未反映の行だけ本番反映
//   highlightSheetDeliveryLog          納品完了ログの「元進捗」に『シート上納品』を含む行を黄色に（既存にも適用）
//   cleanupOldDeliveryInputRowsByMonth 毎月10日トリガー想定。古い反映済をログ退避→削除
//
//   入力の流れ：B列で顧客名を選ぶ → 顧客No(C)は軽量版案件一覧から自動 → 納品日(D)を入れる
//               → checkDeliveryInput で確認 → runDeliveryComplete で反映（反映済以外を一括）
//
//   ※ onOpen は使わない。図形ボタン or Apps Script から手動実行。
//   ※ 別スプレッドシートの列は直接プルダウン元にできないため、
//     アクティブなブックに隠しシート「軽量版リスト（納品）」を作ってミラーします。
//==================================================

const DELIVERY_CONFIG = {
  // 大元「顧客サイト管理情報一覧」
  PROJECT_SS_ID: "1ROGUwwU2VhY_oRN6btT49jMAAnZNtzR1jr7TSFIlWiQ",
  PROJECT_SHEET_NAME: "案件一覧",

  // 1年サポート
  FOLLOW_SS_ID: "1JIXNvOuK_5qLcNaQw6vXg8ciaw7-VgKh6sBXoZAMEqA",
  FOLLOW_SHEET_NAME: "1年サポート",

  // 軽量版案件一覧（顧客名プルダウンの元＆顧客名→顧客Noの逆引き）
  LIGHT_SS_ID: "17okkRhyvkfrzVdTlC2Z5lmOXcm_wEweaqah8CNAHUMw",
  LIGHT_SHEET_NAME: "軽量版案件一覧",
  LIGHT_PROJECT_NAME_COL: 3,   // C列：顧客名（プルダウンの元）
  LIGHT_CUSTOMER_NO_COL: 2,    // B列：顧客No（0にすると見出しから自動検出）
  LIGHT_LIST_SHEET_NAME: "軽量版リスト（納品）", // アクティブブック内の隠しヘルパー

  INPUT_SHEET_NAME: "納品完了入力",
  LOG_SHEET_NAME: "納品完了ログ",

  COLOR_DELIVERED: "#00ffff", // スプシ標準色のシアン

  INPUT_COL: {
    CHECK: 1,                 // A：反映対象
    CUSTOMER_NAME: 2,         // B：顧客名（軽量版C列から選択）
    CUSTOMER_NO: 3,           // C：顧客No（軽量版から自動）
    DELIVERY_DATE: 4,         // D：納品日
    PROJECT_CUSTOMER_NAME: 5, // E：案件一覧の顧客名
    PROJECT_STATUS: 6,        // F：案件一覧の進捗
    FOLLOW_STATUS: 7,         // G：1年サポート一致状況
    MEMO: 8,                  // H：確認メモ
    REFLECT_STATUS: 9,        // I：反映ステータス
    LAST_PROCESSED_AT: 10     // J：最終処理日時
  },

  PROJECT_COL: {
    CUSTOMER_NO: 1,
    CUSTOMER_NAME: 4,
    DELIVERY_DATE: 11,
    STATUS: 13,
    URL: 15,        // O列：公開URL（1年サポートO列へ転記）
    REPORT: 38
  },

  FOLLOW_COL: {
    CUSTOMER_NAME: 3,
    DELIVERY_DATE: 12,
    SUPPORT_END: 13,
    URL: 15,        // O列：URL（案件一覧の公開URLを入れる）
    CUSTOMER_NO: 53,
    MEMO: 54
  }
};

//==================================================
// 初回セットアップ
// 納品完了入力シート・ログシート・顧客名プルダウンを作成（初回のみ実行）
// ※ ログシートは再実行しても消えません
//==================================================
function setupDeliveryInputSheet() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let input = ss.getSheetByName(DELIVERY_CONFIG.INPUT_SHEET_NAME);

  if (input && input.getLastRow() > 1) {
    const result = ui.alert(
      "確認",
      "既存の納品完了入力シートがあります。\n初期化すると入力内容が消えます（ログは消えません）。\n\n初期化しますか？",
      ui.ButtonSet.OK_CANCEL
    );

    if (result !== ui.Button.OK) {
      ui.alert("初期化をキャンセルしました。");
      return;
    }
  }

  if (!input) input = ss.insertSheet(DELIVERY_CONFIG.INPUT_SHEET_NAME);
  input.clear();
  input.getRange(2, 1, input.getMaxRows() - 1, DELIVERY_CONFIG.INPUT_COL.LAST_PROCESSED_AT).clearDataValidations();

  input.getRange(1, 1, 1, 10).setValues([[
    "反映対象",
    "顧客名",
    "顧客No",
    "納品日",
    "案件一覧：顧客名",
    "案件一覧：現在の進捗",
    "1年サポート一致状況",
    "確認メモ",
    "反映ステータス",
    "最終処理日時"
  ]]);

  input.getRange("A2:A300").insertCheckboxes();

  const dateRule = SpreadsheetApp.newDataValidation()
    .requireDate()
    .setAllowInvalid(false)
    .build();

  // 納品日はD列
  input.getRange("D2:D300").setDataValidation(dateRule);
  input.getRange("D2:D300").setNumberFormat("yyyy/mm/dd");
  input.getRange("J2:J300").setNumberFormat("yyyy/mm/dd HH:mm");

  input.setFrozenRows(1);
  input.getRange(1, 1, 1, 10).setFontWeight("bold").setBackground("#d9ead3");

  input.setColumnWidth(1, 90);  // A 反映対象
  input.setColumnWidth(2, 240); // B 顧客名
  input.setColumnWidth(3, 120); // C 顧客No
  input.setColumnWidth(4, 120); // D 納品日
  input.setColumnWidth(5, 220); // E 案件一覧：顧客名
  input.setColumnWidth(6, 160); // F 案件一覧：進捗
  input.setColumnWidth(7, 180); // G 1年サポート一致状況
  input.setColumnWidth(8, 420); // H 確認メモ
  input.setColumnWidth(9, 160); // I 反映ステータス
  input.setColumnWidth(10, 180); // J 最終処理日時

  // ログシートは存在保証のみ（中身は消さない）
  setupLogSheetHeader_();

  // 顧客名プルダウン（軽量版案件一覧からミラー）
  let listMsg;
  try {
    const n = syncDeliveryLightList_();
    applyDeliveryNameDropdown_(input);
    listMsg = "顧客名プルダウン：" + n + "件（軽量版案件一覧C列より）";
  } catch (e) {
    listMsg = "⚠ 顧客名リストの同期に失敗しました：" + e.message + "\n（顧客Noは直接入力も可能です）";
  }

  ui.alert("初回セットアップ完了！\n\n" + listMsg);
}

//==================================================
// 1年サポート初期設定
// BA：顧客No / BB：メモ の見出しを作成（初回のみ実行）
//==================================================
function setupFollowSystemColumns() {
  const ss = SpreadsheetApp.openById(DELIVERY_CONFIG.FOLLOW_SS_ID);
  const sheet = ss.getSheetByName(DELIVERY_CONFIG.FOLLOW_SHEET_NAME);
  if (!sheet) throw new Error("1年サポートシートが見つかりません。");

  sheet.getRange(1, DELIVERY_CONFIG.FOLLOW_COL.CUSTOMER_NO).setValue("顧客No");
  sheet.getRange(1, DELIVERY_CONFIG.FOLLOW_COL.MEMO).setValue("メモ");

  SpreadsheetApp.getUi().alert("1年サポートのBA/BB見出しを作成しました！");
}

//==================================================
// 軽量版案件一覧 → 顧客名リストを同期（B列プルダウンの元）
//==================================================
function syncDeliveryLightList() {
  const n = syncDeliveryLightList_();
  const input = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DELIVERY_CONFIG.INPUT_SHEET_NAME);
  if (input) applyDeliveryNameDropdown_(input);
  SpreadsheetApp.getUi().alert("軽量版案件一覧の顧客名リストを同期しました（" + n + "件）。");
}

function syncDeliveryLightList_() {
  const map = getDeliveryLightMap_();
  if (map.error) throw new Error(map.error);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let listSheet = ss.getSheetByName(DELIVERY_CONFIG.LIGHT_LIST_SHEET_NAME);
  if (!listSheet) listSheet = ss.insertSheet(DELIVERY_CONFIG.LIGHT_LIST_SHEET_NAME);

  listSheet.clear();
  listSheet.getRange(1, 1, 1, 2).setValues([["顧客名", "顧客No"]]);

  if (map.list.length > 0) {
    listSheet.getRange(2, 1, map.list.length, 2).setValues(map.list.map(e => [e.name, e.no]));
  }

  listSheet.hideSheet();
  return map.list.length;
}

//==================================================
// 軽量版案件一覧を読み込み、顧客名→顧客No の逆引きを作る
//==================================================
function getDeliveryLightMap_() {
  const ss = SpreadsheetApp.openById(DELIVERY_CONFIG.LIGHT_SS_ID);
  const sheet = ss.getSheetByName(DELIVERY_CONFIG.LIGHT_SHEET_NAME);
  if (!sheet) return { error: "軽量版案件一覧シートが見つかりません。", list: [], byName: new Map() };

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2) return { error: "", list: [], byName: new Map() };

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || "").trim());

  let nameCol = DELIVERY_CONFIG.LIGHT_PROJECT_NAME_COL;
  if (!nameCol) nameCol = dlFindHeaderCol_(headers, ["顧客名", "案件名", "サイト名", "屋号名", "会社名"]) || 3;

  let noCol = DELIVERY_CONFIG.LIGHT_CUSTOMER_NO_COL;
  if (!noCol) noCol = dlFindHeaderCol_(headers, ["顧客No", "顧客№", "顧客ＮＯ", "顧客NO", "顧客番号", "№", "No"]);
  if (!noCol) {
    return {
      error: "軽量版案件一覧で「顧客No」の列を特定できませんでした。\nコード上部の LIGHT_CUSTOMER_NO_COL に列番号（A=1,B=2,…）を指定してください。",
      list: [], byName: new Map()
    };
  }

  const width = Math.max(nameCol, noCol);
  const data = sheet.getRange(2, 1, lastRow - 1, width).getValues();

  const list = [];
  const byName = new Map();
  data.forEach(r => {
    const name = String(r[nameCol - 1] || "").trim();
    const no = String(r[noCol - 1] == null ? "" : r[noCol - 1]).trim();
    if (!name) return;
    const key = dlNormalizeName_(name);
    if (!key || byName.has(key)) return; // 顧客名重複は先勝ち
    const entry = { name, no };
    byName.set(key, entry);
    list.push(entry);
  });

  return { error: "", list, byName };
}

function dlFindHeaderCol_(headers, candidates) {
  for (let i = 0; i < headers.length; i++) {
    const h = dlNormalizeName_(headers[i]);
    for (let j = 0; j < candidates.length; j++) {
      if (h === dlNormalizeName_(candidates[j])) return i + 1;
    }
  }
  return 0;
}

//==================================================
// B列（顧客名）に軽量版リストのプルダウンを設定
//==================================================
function applyDeliveryNameDropdown_(input) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const listSheet = ss.getSheetByName(DELIVERY_CONFIG.LIGHT_LIST_SHEET_NAME);
  if (!listSheet) return;
  const listLast = listSheet.getLastRow();
  if (listLast < 2) return;

  const src = listSheet.getRange(2, 1, listLast - 1, 1); // 顧客名列
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(src, true)
    .setAllowInvalid(true)
    .build();

  const rows = input.getMaxRows() - 1;
  if (rows > 0) {
    input.getRange(2, DELIVERY_CONFIG.INPUT_COL.CUSTOMER_NAME, rows, 1).setDataValidation(rule);
  }
}

//==================================================
// 顧客名 → 顧客No 逆引き（C列が空の行だけ補完。手入力Noは尊重）
//==================================================
function lookupDeliveryCustomerNoFromNames() {
  const ui = SpreadsheetApp.getUi();
  const input = getInputSheet_();
  let r;
  try {
    r = resolveCustomerNosFromNames_(input);
  } catch (e) {
    ui.alert(e.message);
    return;
  }
  ui.alert(
    "顧客Noの自動入力（軽量版案件一覧より）\n\n" +
    "自動入力：" + r.filled + "件\n" +
    "軽量版に顧客名が見つからない：" + r.notFound + "件"
  );
}

function resolveCustomerNosFromNames_(input) {
  const result = { filled: 0, notFound: 0 };

  const lastRow = input.getLastRow();
  if (lastRow < 2) return result;

  const num = lastRow - 1;
  const names = input.getRange(2, DELIVERY_CONFIG.INPUT_COL.CUSTOMER_NAME, num, 1).getValues();
  const nos = input.getRange(2, DELIVERY_CONFIG.INPUT_COL.CUSTOMER_NO, num, 1).getValues();

  const light = getDeliveryLightMap_();
  if (light.error) throw new Error(light.error);

  const out = [];
  let changed = false;

  for (let i = 0; i < num; i++) {
    const name = String(names[i][0] || "").trim();
    const curNo = String(nos[i][0] == null ? "" : nos[i][0]).trim();

    if (curNo) { out.push([curNo]); continue; } // 既にNoがあれば触らない
    if (!name) { out.push([""]); continue; }

    const hit = light.byName.get(dlNormalizeName_(name));
    if (hit && hit.no) {
      out.push([hit.no]);
      result.filled++;
      changed = true;
    } else {
      out.push([""]);
      result.notFound++;
    }
  }

  if (changed) {
    input.getRange(2, DELIVERY_CONFIG.INPUT_COL.CUSTOMER_NO, num, 1).setValues(out);
  }

  return result;
}

//==================================================
// 入力内容確認
// 顧客名→顧客Noを補完し、案件一覧・1年サポートを照合して表示
//==================================================
function checkDeliveryInput() {
  const ui = SpreadsheetApp.getUi();
  const input = getInputSheet_();

  // まず顧客名から顧客Noを補完
  let resolved = { filled: 0, notFound: 0 };
  try {
    resolved = resolveCustomerNosFromNames_(input);
  } catch (e) {
    ui.alert("顧客名リストの取得に失敗しました：" + e.message + "\n（顧客Noを直接入力すれば続行できます）");
  }

  const inputItems = getInputRowsWithCustomerNo_(input);

  if (inputItems.length === 0) {
    ui.alert(
      "顧客Noが特定できた行がありません。\n\n" +
      "軽量版に顧客名が見つからない：" + resolved.notFound + "件\n" +
      "→ B列の顧客名を選び直すか、C列に顧客Noを直接入力してください。"
    );
    return;
  }

  const projectMap = getProjectMap_();
  const followMap = getFollowMap_();

  let checked = 0;
  let projectNg = 0;
  let followNg = 0;
  let dateNg = 0;
  let sheetDeliveryWarning = 0;
  let duplicateNg = 0;
  let nameMismatch = 0;

  inputItems.forEach(item => {
    const now = new Date();
    const project = projectMap[item.customerNo];

    if (!project) {
      input.getRange(item.row, DELIVERY_CONFIG.INPUT_COL.PROJECT_CUSTOMER_NAME, 1, 6).setValues([[
        "",
        "",
        "未確認",
        "案件一覧に顧客Noが見つかりません。番号を確認してください。",
        "NG：案件一覧未一致",
        now
      ]]);
      projectNg++;
      return;
    }

    const follow = followMap[item.customerNo];
    let memo = "";

    if (!item.deliveryDate) {
      memo += "納品日が未入力です。";
      dateNg++;
    }

    if (project.duplicate) {
      memo += " ⚠ 案件一覧で顧客Noが重複しています。";
      duplicateNg++;
    }

    if (follow && follow.duplicate) {
      memo += " ⚠ 1年サポートで顧客Noが重複しています。";
      duplicateNg++;
    }

    if (isSheetDelivery_(project.status)) {
      memo += " ⚠ シート上納品";
      sheetDeliveryWarning++;
    }

    if (!follow) {
      memo += " 1年サポート側に顧客Noがありません。";
      followNg++;
    }

    if (follow && dlNamesConflict_(project.customerName, follow.customerName)) {
      memo += " ⛔ 顧客名不一致（案件一覧:" + project.customerName + " / 1年サポート:" + follow.customerName + "）→ 反映時はこの行を更新しません。";
      nameMismatch++;
    }

    input.getRange(item.row, DELIVERY_CONFIG.INPUT_COL.PROJECT_CUSTOMER_NAME).setValue(project.customerName);
    input.getRange(item.row, DELIVERY_CONFIG.INPUT_COL.PROJECT_STATUS).setValue(project.status);
    input.getRange(item.row, DELIVERY_CONFIG.INPUT_COL.FOLLOW_STATUS).setValue(follow ? "顧客No一致" : "未一致");
    input.getRange(item.row, DELIVERY_CONFIG.INPUT_COL.MEMO).setValue(memo.trim());
    input.getRange(item.row, DELIVERY_CONFIG.INPUT_COL.REFLECT_STATUS).setValue("確認済");
    input.getRange(item.row, DELIVERY_CONFIG.INPUT_COL.LAST_PROCESSED_AT).setValue(now);

    checked++;
  });

  ui.alert(
    "確認完了！\n\n" +
    `確認済：${checked}件\n` +
    `顧客No自動入力：${resolved.filled}件\n` +
    `軽量版に顧客名なし：${resolved.notFound}件\n` +
    `案件一覧未一致：${projectNg}件\n` +
    `1年サポート未一致：${followNg}件\n` +
    `納品日未入力：${dateNg}件\n` +
    `シート上納品警告：${sheetDeliveryWarning}件\n` +
    `顧客No重複警告：${duplicateNg}件\n` +
    `顧客名不一致（反映停止）：${nameMismatch}件`
  );
}

//==================================================
// 納品完了反映
// チェック済みの案件だけ 案件一覧・1年サポートへ反映
//==================================================
function runDeliveryComplete() {
  runDeliveryReflect_(false); // 反映済以外を全部反映（チェック不要）
}

// 「反映対象(A)」にチェックした未反映の行だけ反映する
function runDeliveryCompleteChecked() {
  runDeliveryReflect_(true); // チェックした行だけ反映
}

function runDeliveryReflect_(checkedOnly) {
  const ui = SpreadsheetApp.getUi();
  const input = getInputSheet_();

  // まず顧客名から顧客Noを補完
  try {
    resolveCustomerNosFromNames_(input);
  } catch (e) {
    ui.alert("顧客名リストの取得に失敗しました：" + e.message + "\n（顧客Noを直接入力すれば続行できます）");
  }

  // 「反映済」でない入力行。checkedOnly のときは A列チェック行だけに絞る
  let items = getPendingInputRows_(input);
  if (checkedOnly) items = items.filter(it => it.checked === true);

  if (items.length === 0) {
    ui.alert(checkedOnly
      ? "チェックされた未反映の行がありません。\n（A列にチェックを入れてから実行してください）"
      : "反映する行がありません。\n（すべて反映済み、または入力がありません）");
    return;
  }

  const projectMap = getProjectMap_();
  const followMap = getFollowMap_();

  const updateItems = [];
  const projectNotFound = [];
  const followNotFound = [];
  const noDateItems = [];
  const sheetDeliveryWarnings = [];
  const duplicateItems = [];
  const noCustomerNoItems = [];
  const nameMismatchItems = [];

  items.forEach(item => {
    if (!item.customerNo) {
      noCustomerNoItems.push(item);
      setInputNg_(input, item.row, "NG：顧客No未特定", "顧客名から顧客Noを特定できません。B列の顧客名を確認するか、C列に顧客Noを直接入力してください。");
      return;
    }

    const project = projectMap[item.customerNo];

    if (!project) {
      projectNotFound.push(item);
      setInputNg_(input, item.row, "NG：案件一覧未一致", "案件一覧に顧客Noが見つかりません。番号を確認してください。");
      return;
    }

    const follow = followMap[item.customerNo];

    if (project.duplicate) {
      duplicateItems.push({
        row: item.row,
        customerNo: item.customerNo,
        customerName: project.customerName,
        reason: "案件一覧で顧客No重複"
      });
      setInputNg_(input, item.row, "NG：案件一覧で顧客No重複", "案件一覧で同じ顧客Noが複数あります。更新を停止しました。");
      return;
    }

    if (follow && follow.duplicate) {
      duplicateItems.push({
        row: item.row,
        customerNo: item.customerNo,
        customerName: project.customerName,
        reason: "1年サポートで顧客No重複"
      });
      setInputNg_(input, item.row, "NG：1年サポートで顧客No重複", "1年サポートで同じ顧客Noが複数あります。更新を停止しました。");
      return;
    }

    if (follow && dlNamesConflict_(project.customerName, follow.customerName)) {
      nameMismatchItems.push({
        row: item.row,
        customerNo: item.customerNo,
        projectName: project.customerName,
        followName: follow.customerName
      });
      setInputNg_(input, item.row, "NG：顧客名不一致",
        "顧客Noは一致しますが顧客名が違います（案件一覧:" + project.customerName + " / 1年サポート:" + follow.customerName + "）。取り違え防止のため更新を停止しました。");
      return;
    }

    if (!item.deliveryDate) {
      noDateItems.push({
        row: item.row,
        customerNo: item.customerNo,
        customerName: project.customerName
      });
      setInputNg_(input, item.row, "NG：納品日未入力", "納品日を入力してください。");
      return;
    }

    if (!follow) followNotFound.push(project);
    if (isSheetDelivery_(project.status)) sheetDeliveryWarnings.push(project);

    updateItems.push({
      inputRow: item.row,
      customerNo: item.customerNo,
      customerName: project.customerName,
      deliveryDate: item.deliveryDate,
      project,
      follow
    });
  });

  if (updateItems.length === 0) {
    ui.alert(
      "更新できる行がありませんでした。\n\n" +
      `顧客No未特定：${noCustomerNoItems.length}件\n` +
      `顧客名不一致：${nameMismatchItems.length}件\n` +
      `案件一覧未一致：${projectNotFound.length}件\n` +
      `納品日未入力：${noDateItems.length}件\n` +
      `顧客No重複：${duplicateItems.length}件`
    );
    return;
  }

  const message = buildConfirmMessage_(updateItems, projectNotFound, followNotFound, noDateItems, sheetDeliveryWarnings, duplicateItems, noCustomerNoItems, nameMismatchItems);

  const result = ui.alert("納品完了反映 確認", message, ui.ButtonSet.OK_CANCEL);

  if (result !== ui.Button.OK) {
    ui.alert("反映をキャンセルしました。");
    return;
  }

  applyDeliveryUpdates_(updateItems, input);

  ui.alert(
    "反映完了！\n\n" +
    `更新：${updateItems.length}件\n` +
    `顧客No未特定：${noCustomerNoItems.length}件\n` +
    `顧客名不一致（停止）：${nameMismatchItems.length}件\n` +
    `案件一覧未一致：${projectNotFound.length}件\n` +
    `納品日未入力：${noDateItems.length}件\n` +
    `1年サポート未一致：${followNotFound.length}件\n` +
    `顧客No重複：${duplicateItems.length}件`
  );
}

//==================================================
// 月次クリーンアップ（毎月10日トリガー想定）
//   ・今月・先月分（納品日ベース）は入力シートに残す
//   ・それ以前の「反映済」行はログへ退避して入力シートから削除
//   ※ トリガー実行を想定し ui.alert は使わない
//==================================================
function cleanupOldDeliveryInputRowsByMonth() {
  const input = getInputSheet_();
  const logSheet = getLogSheet_();

  const lastRow = input.getLastRow();
  if (lastRow < 2) return;

  const numRows = lastRow - 1;
  const values = input.getRange(2, 1, numRows, 10).getValues();

  const now = new Date();
  const keepFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1); // 先月1日
  const user = getExecUser_();

  const archiveRows = [];
  const deleteRows = [];

  for (let i = 0; i < numRows; i++) {
    const row = i + 2;
    const customerNo = values[i][DELIVERY_CONFIG.INPUT_COL.CUSTOMER_NO - 1];
    const deliveryDate = values[i][DELIVERY_CONFIG.INPUT_COL.DELIVERY_DATE - 1];
    const customerName = values[i][DELIVERY_CONFIG.INPUT_COL.PROJECT_CUSTOMER_NAME - 1];
    const projectStatus = values[i][DELIVERY_CONFIG.INPUT_COL.PROJECT_STATUS - 1];
    const reflectStatus = values[i][DELIVERY_CONFIG.INPUT_COL.REFLECT_STATUS - 1];
    const lastProcessed = values[i][DELIVERY_CONFIG.INPUT_COL.LAST_PROCESSED_AT - 1];

    if (reflectStatus !== "反映済") continue;      // 反映済でない行は残す
    if (!(deliveryDate instanceof Date)) continue; // 納品日が無い行は残す
    if (deliveryDate >= keepFrom) continue;        // 今月・先月分は残す

    archiveRows.push([
      now,
      customerNo,
      customerName,
      deliveryDate,
      "",              // 案件一覧更新
      "",              // 1年サポート更新
      projectStatus,   // 元進捗
      "",              // 新進捗
      user,
      "退避（クリーンアップ）",
      row,
      "入力シートから削除（最終処理 " + (lastProcessed instanceof Date ? formatDateTime_(lastProcessed) : "") + "）"
    ]);
    deleteRows.push(row);
  }

  if (archiveRows.length > 0) {
    logSheet.getRange(logSheet.getLastRow() + 1, 1, archiveRows.length, 12).setValues(archiveRows);
  }

  // 下の行から削除（行番号ずれ防止）
  deleteRows.sort((a, b) => b - a).forEach(r => input.deleteRow(r));

  const msg = "クリーンアップ：反映済 " + deleteRows.length + " 行を退避・削除しました";
  Logger.log(msg);
  try {
    SpreadsheetApp.getActiveSpreadsheet().toast(msg, "納品完了", 5);
  } catch (e) {}
}

//==================================================
// 確認メッセージ作成
//==================================================
function buildConfirmMessage_(updateItems, projectNotFound, followNotFound, noDateItems, sheetDeliveryWarnings, duplicateItems, noCustomerNoItems, nameMismatchItems) {
  noCustomerNoItems = noCustomerNoItems || [];
  nameMismatchItems = nameMismatchItems || [];
  let message = "";

  message += "以下の内容で納品完了を反映します。\n\n";

  message += "【件数】\n";
  message += `更新予定：${updateItems.length}件\n`;
  message += `顧客No未特定：${noCustomerNoItems.length}件\n`;
  message += `顧客名不一致（停止）：${nameMismatchItems.length}件\n`;
  message += `案件一覧未一致：${projectNotFound.length}件\n`;
  message += `納品日未入力：${noDateItems.length}件\n`;
  message += `1年サポート未一致：${followNotFound.length}件\n`;
  message += `シート上納品警告：${sheetDeliveryWarnings.length}件\n`;
  message += `顧客No重複：${duplicateItems.length}件\n\n`;

  message += "【更新内容】\n";
  message += "案件一覧：K列 納品日 / M列 納品完了 / AL列 完了 / 行をシアン\n";
  message += "1年サポート：L列 納品日 / M列 サポート終了日 / O列 URL / BB列 メモ\n\n";

  message += "【更新予定案件】\n";
  updateItems.slice(0, 15).forEach(item => {
    message += `・${item.customerNo}　${item.customerName}　${formatDateOnly_(item.deliveryDate)}\n`;
  });
  if (updateItems.length > 15) message += `ほか ${updateItems.length - 15} 件\n`;
  message += "\n";

  if (sheetDeliveryWarnings.length > 0) {
    message += "【注意：シート上納品】\n";
    sheetDeliveryWarnings.slice(0, 10).forEach(p => {
      message += `・${p.customerNo}　${p.customerName}\n`;
    });
    message += "\n";
  }

  if (followNotFound.length > 0) {
    message += "【注意：1年サポート未一致】\n";
    message += "※案件一覧は更新しますが、1年サポートは更新しません。\n";
    followNotFound.slice(0, 10).forEach(p => {
      message += `・${p.customerNo}　${p.customerName}\n`;
    });
    message += "\n";
  }

  if (duplicateItems.length > 0) {
    message += "【更新停止：顧客No重複】\n";
    duplicateItems.slice(0, 10).forEach(item => {
      message += `・入力行${item.row}　${item.customerNo} ${item.customerName}：${item.reason}\n`;
    });
    message += "\n";
  }

  if (nameMismatchItems.length > 0) {
    message += "【更新停止：顧客名不一致】\n";
    message += "※顧客Noは一致していますが顧客名が違います。取り違え防止のため更新しません。\n";
    nameMismatchItems.slice(0, 10).forEach(item => {
      message += `・入力行${item.row}　${item.customerNo}：案件一覧「${item.projectName}」/ 1年サポート「${item.followName}」\n`;
    });
    message += "\n";
  }

  if (noCustomerNoItems.length > 0 || projectNotFound.length > 0 || noDateItems.length > 0) {
    message += "【更新しない行】\n";
    noCustomerNoItems.slice(0, 10).forEach(item => {
      message += `・入力行${item.row}　${item.customerName || ""}：顧客No未特定\n`;
    });
    projectNotFound.slice(0, 10).forEach(item => {
      message += `・入力行${item.row}　${item.customerNo}：案件一覧未一致\n`;
    });
    noDateItems.slice(0, 10).forEach(item => {
      message += `・入力行${item.row}　${item.customerNo} ${item.customerName}：納品日未入力\n`;
    });
    message += "\n";
  }

  message += "このまま更新しますか？";
  return message;
}

//==================================================
// 実更新処理
//==================================================
function applyDeliveryUpdates_(items, input) {
  const projectSS = SpreadsheetApp.openById(DELIVERY_CONFIG.PROJECT_SS_ID);
  const projectSheet = projectSS.getSheetByName(DELIVERY_CONFIG.PROJECT_SHEET_NAME);
  if (!projectSheet) throw new Error("案件一覧シートが見つかりません。");

  const followSS = SpreadsheetApp.openById(DELIVERY_CONFIG.FOLLOW_SS_ID);
  const followSheet = followSS.getSheetByName(DELIVERY_CONFIG.FOLLOW_SHEET_NAME);
  if (!followSheet) throw new Error("1年サポートシートが見つかりません。");

  const logSheet = getLogSheet_();
  const now = new Date();
  const user = getExecUser_();
  const projectLastCol = projectSheet.getLastColumn(); // ループ外で1回だけ

  const logRows = []; // ログはまとめて一括追記

  items.forEach(item => {
    const deliveryDate = item.deliveryDate;

    // 案件一覧：行をシアン＋納品日/状態/報告
    projectSheet.getRange(item.project.row, 1, 1, projectLastCol).setBackground(DELIVERY_CONFIG.COLOR_DELIVERED);
    projectSheet.getRange(item.project.row, DELIVERY_CONFIG.PROJECT_COL.DELIVERY_DATE).setValue(deliveryDate);
    projectSheet.getRange(item.project.row, DELIVERY_CONFIG.PROJECT_COL.STATUS).setValue("納品完了");
    projectSheet.getRange(item.project.row, DELIVERY_CONFIG.PROJECT_COL.REPORT).setValue("完了");

    let followResult = "未更新：顧客No未一致";

    if (item.follow) {
      // L:M（納品日・サポート終了日）は隣接なので1回で書く
      followSheet.getRange(item.follow.row, DELIVERY_CONFIG.FOLLOW_COL.DELIVERY_DATE, 1, 2)
        .setValues([[deliveryDate, addYears_(deliveryDate, 1)]]);

      // 公開URLがあれば O列 に転記（空の場合は既存を消さない）
      if (item.project.url) {
        followSheet.getRange(item.follow.row, DELIVERY_CONFIG.FOLLOW_COL.URL).setValue(item.project.url);
      }

      followSheet.getRange(item.follow.row, DELIVERY_CONFIG.FOLLOW_COL.MEMO)
        .setValue("納品完了入力から更新：" + formatDateTime_(now));

      followResult = "更新済";
    }

    // 入力シート：E:G と I:J は隣接なのでまとめて書き込み（反映済 & 日時）
    input.getRange(item.inputRow, DELIVERY_CONFIG.INPUT_COL.PROJECT_CUSTOMER_NAME, 1, 3)
      .setValues([[item.customerName, "納品完了", item.follow ? "顧客No一致・更新済" : "未一致・未更新"]]);
    input.getRange(item.inputRow, DELIVERY_CONFIG.INPUT_COL.REFLECT_STATUS, 1, 2)
      .setValues([["反映済", now]]);

    // 元の進捗が「シート上納品」なら、反映後も確認メモに残す
    if (isSheetDelivery_(item.project.status)) {
      const memoCell = input.getRange(item.inputRow, DELIVERY_CONFIG.INPUT_COL.MEMO);
      const cur = String(memoCell.getValue() || "");
      if (cur.indexOf("シート上納品") < 0) {
        memoCell.setValue(cur ? ("シート上納品 / " + cur) : "シート上納品");
      }
    }

    logRows.push([
      now, item.customerNo, item.customerName, deliveryDate,
      "更新済", followResult, item.project.status, "納品完了",
      user, "完了", item.inputRow, ""
    ]);
  });

  // ログ一括追記
  if (logRows.length > 0) {
    logSheet.getRange(logSheet.getLastRow() + 1, 1, logRows.length, 12).setValues(logRows);
  }
}

//==================================================
// 軽量版：案件一覧マップ取得（必要列だけ読む）
//==================================================
function getProjectMap_() {
  const ss = SpreadsheetApp.openById(DELIVERY_CONFIG.PROJECT_SS_ID);
  const sheet = ss.getSheetByName(DELIVERY_CONFIG.PROJECT_SHEET_NAME);
  if (!sheet) throw new Error("案件一覧シートが見つかりません。");

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return {};

  const numRows = lastRow - 1;

  const customerNos = sheet.getRange(2, DELIVERY_CONFIG.PROJECT_COL.CUSTOMER_NO, numRows, 1).getValues();
  const customerNames = sheet.getRange(2, DELIVERY_CONFIG.PROJECT_COL.CUSTOMER_NAME, numRows, 1).getValues();
  const deliveryDates = sheet.getRange(2, DELIVERY_CONFIG.PROJECT_COL.DELIVERY_DATE, numRows, 1).getValues();
  const statuses = sheet.getRange(2, DELIVERY_CONFIG.PROJECT_COL.STATUS, numRows, 1).getValues();
  const urls = sheet.getRange(2, DELIVERY_CONFIG.PROJECT_COL.URL, numRows, 1).getValues();

  const map = {};

  for (let i = 0; i < numRows; i++) {
    const customerNo = normalizeCustomerNo_(customerNos[i][0]);
    if (!customerNo) continue;

    if (map[customerNo]) {
      map[customerNo].duplicate = true;
      continue;
    }

    map[customerNo] = {
      row: i + 2,
      customerNo,
      customerName: customerNames[i][0],
      status: statuses[i][0],
      deliveryDate: deliveryDates[i][0],
      url: urls[i][0],
      duplicate: false
    };
  }

  return map;
}

//==================================================
// 軽量版：1年サポートマップ取得（必要列だけ読む）
//==================================================
function getFollowMap_() {
  const ss = SpreadsheetApp.openById(DELIVERY_CONFIG.FOLLOW_SS_ID);
  const sheet = ss.getSheetByName(DELIVERY_CONFIG.FOLLOW_SHEET_NAME);
  if (!sheet) throw new Error("1年サポートシートが見つかりません。");

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return {};
  if (sheet.getMaxColumns() < DELIVERY_CONFIG.FOLLOW_COL.CUSTOMER_NO) return {}; // BA列が無いなら照合なし

  const numRows = lastRow - 1;

  const customerNames = sheet.getRange(2, DELIVERY_CONFIG.FOLLOW_COL.CUSTOMER_NAME, numRows, 1).getValues();
  const deliveryDates = sheet.getRange(2, DELIVERY_CONFIG.FOLLOW_COL.DELIVERY_DATE, numRows, 1).getValues();
  const customerNos = sheet.getRange(2, DELIVERY_CONFIG.FOLLOW_COL.CUSTOMER_NO, numRows, 1).getValues();

  const map = {};

  for (let i = 0; i < numRows; i++) {
    const customerNo = normalizeCustomerNo_(customerNos[i][0]);
    if (!customerNo) continue;

    if (map[customerNo]) {
      map[customerNo].duplicate = true;
      continue;
    }

    map[customerNo] = {
      row: i + 2,
      customerNo,
      customerName: customerNames[i][0],
      deliveryDate: deliveryDates[i][0],
      duplicate: false
    };
  }

  return map;
}

//==================================================
// 入力系
//==================================================
function getInputSheet_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DELIVERY_CONFIG.INPUT_SHEET_NAME);
  if (!sheet) throw new Error("納品完了入力シートがありません。setupDeliveryInputSheet を実行してください。");
  return sheet;
}

function getInputRowsWithCustomerNo_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, DELIVERY_CONFIG.INPUT_COL.DELIVERY_DATE).getValues();

  return values
    .map((r, i) => ({
      row: i + 2,
      checked: r[DELIVERY_CONFIG.INPUT_COL.CHECK - 1],
      customerName: String(r[DELIVERY_CONFIG.INPUT_COL.CUSTOMER_NAME - 1] || "").trim(),
      customerNo: normalizeCustomerNo_(r[DELIVERY_CONFIG.INPUT_COL.CUSTOMER_NO - 1]),
      deliveryDate: r[DELIVERY_CONFIG.INPUT_COL.DELIVERY_DATE - 1]
    }))
    .filter(item => item.customerNo);
}

// 「反映済」でない入力行をまとめて取得（チェック不要）
//   空行は対象外。反映済みでなく、何か入力がある行だけ返す
function getPendingInputRows_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, DELIVERY_CONFIG.INPUT_COL.REFLECT_STATUS).getValues();

  return values
    .map((r, i) => ({
      row: i + 2,
      checked: r[DELIVERY_CONFIG.INPUT_COL.CHECK - 1] === true,
      customerName: String(r[DELIVERY_CONFIG.INPUT_COL.CUSTOMER_NAME - 1] || "").trim(),
      customerNo: normalizeCustomerNo_(r[DELIVERY_CONFIG.INPUT_COL.CUSTOMER_NO - 1]),
      deliveryDate: r[DELIVERY_CONFIG.INPUT_COL.DELIVERY_DATE - 1],
      reflectStatus: String(r[DELIVERY_CONFIG.INPUT_COL.REFLECT_STATUS - 1] || "").trim()
    }))
    .filter(item =>
      item.reflectStatus !== "反映済" &&
      (item.customerNo || item.customerName || item.deliveryDate)
    );
}

//==================================================
// ログ
//==================================================
function getLogSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(DELIVERY_CONFIG.LOG_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(DELIVERY_CONFIG.LOG_SHEET_NAME);
    setupLogSheetHeader_();
  }
  return sheet;
}

function setupLogSheetHeader_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let log = ss.getSheetByName(DELIVERY_CONFIG.LOG_SHEET_NAME);
  if (!log) log = ss.insertSheet(DELIVERY_CONFIG.LOG_SHEET_NAME);

  // 既存ログは消さない：見出しが無いときだけ作る
  if (log.getLastRow() === 0) {
    log.getRange(1, 1, 1, 12).setValues([[
      "日時",
      "顧客No",
      "顧客名",
      "納品日",
      "案件一覧更新",
      "1年サポート更新",
      "元進捗",
      "新進捗",
      "実行者",
      "結果",
      "入力行",
      "メモ"
    ]]);

    log.getRange(1, 1, 1, 12).setFontWeight("bold").setBackground("#d9ead3");
  }

  // 「元進捗(G列)」に『シート上納品』を含む行を黄色にする条件付き書式
  applyLogSheetDeliveryFormat_(log);
}

// 納品完了ログの G列（元進捗）に「シート上納品」を含むセルを黄色にする条件付き書式
//   ※ 既存行・今後の行の両方に自動適用（ログシートはスクリプト管理のため書式は上書き）
function applyLogSheetDeliveryFormat_(log) {
  const range = log.getRange("G2:G"); // G列＝元進捗
  const rule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextContains("シート上納品")
    .setBackground("#ffff00") // 黄色
    .setRanges([range])
    .build();
  log.setConditionalFormatRules([rule]);
}

// 既存の納品完了ログにも黄色ハイライトを付けたいときに手動実行
function highlightSheetDeliveryLog() {
  const log = getLogSheet_();
  applyLogSheetDeliveryFormat_(log);
  SpreadsheetApp.getUi().alert("納品完了ログの「元進捗」に『シート上納品』を含む行を黄色にしました（既存＋今後）。");
}

function appendDeliveryLog_(logSheet, now, item, followResult, user, resultText) {
  logSheet.appendRow([
    now,
    item.customerNo,
    item.customerName,
    item.deliveryDate,
    "更新済",
    followResult,
    item.project.status,
    "納品完了",
    user,
    resultText,
    item.inputRow,
    ""
  ]);
}

//==================================================
// 共通
//==================================================
function setInputNg_(input, row, status, memo) {
  input.getRange(row, DELIVERY_CONFIG.INPUT_COL.REFLECT_STATUS).setValue(status);
  input.getRange(row, DELIVERY_CONFIG.INPUT_COL.MEMO).setValue(memo);
  input.getRange(row, DELIVERY_CONFIG.INPUT_COL.LAST_PROCESSED_AT).setValue(new Date());
}

function normalizeCustomerNo_(value) {
  let s = String(value == null ? "" : value)
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .trim();
  if (/^\d+\.0+$/.test(s)) s = s.replace(/\.0+$/, ""); // 123.0 → 123
  return s;
}

function dlNormalizeName_(value) {
  return String(value == null ? "" : value)
    .normalize("NFKC")
    .replace(/[\s　]+/g, "")
    .replace(/(株式会社|㈱|（株）|\(株\)|有限会社|㈲|（有）|\(有\))/g, "")
    .toLowerCase()
    .trim();
}

// 案件一覧の進捗に「シート上納品」が含まれるか
function isSheetDelivery_(status) {
  return String(status == null ? "" : status).indexOf("シート上納品") >= 0;
}

// 顧客名の食い違い判定（両方に名前があり、正規化しても違えば true）
function dlNamesConflict_(a, b) {
  const na = dlNormalizeName_(a);
  const nb = dlNormalizeName_(b);
  if (!na || !nb) return false; // 片方でも空なら比較しない
  return na !== nb;
}

function addYears_(value, years) {
  const d = new Date(value);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

function getExecUser_() {
  try {
    return Session.getActiveUser().getEmail() || "";
  } catch (e) {
    return "";
  }
}

function formatDateOnly_(value) {
  if (!value) return "";
  return Utilities.formatDate(new Date(value), "Asia/Tokyo", "yyyy/MM/dd");
}

function formatDateTime_(value) {
  return Utilities.formatDate(new Date(value), "Asia/Tokyo", "yyyy/MM/dd HH:mm:ss");
}
