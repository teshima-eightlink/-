// @ts-nocheck
//==================================================
// 顧客No紐付けツール（初回移行用）
//   1年サポートの BA(顧客No) が空欄の行に、案件一覧の顧客Noを安全に紐付ける。
//   本体シートへは直接書かず、専用チェックシートで確認 → チェックしたものだけ反映。
//
//   runExtractCustomerNoCandidates … 候補を「顧客No候補チェック」へ出力
//   runApplyCustomerNo             … チェックONの行だけ 1年サポート BA へ反映
//
//   ※ onOpen は使わない。図形ボタン or Apps Script から手動実行。
//   ※ 大量データ対応：getDataRange は使わず、必要列だけ取得。
//   ※ 案件一覧/1年サポートは別ID。テストは同じダミーIDでOK。
//   ※ 将来：案件一覧→1年サポートへ新規行自動作成へ拡張しやすい構成。
//==================================================

const CUSTOMER_LINK_CONFIG = {
  // 案件一覧（別ID）
  PROJECT_SS_ID: "1vQmZWABfGcE4AGJV7CWIKJwYdxJ-V1-V",
  PROJECT_SHEET_NAME: "案件一覧",
  PROJECT_COL: {
    customerNo: 1,      // A 顧客No
    customerName: 4,    // D 顧客名
    representative: 5   // E 代表者名
  },

  // 1年サポート（別ID）
  FOLLOW_SS_ID: "1vQmZWABfGcE4AGJV7CWIKJwYdxJ-V1-V",
  FOLLOW_SHEET_NAME: "1年サポート",
  FOLLOW_COL: {
    customerName: 3,    // C 顧客名
    representative: 4,  // D 代表者名
    customerNo: 53      // BA 顧客No（空欄の行だけ対象）
  },

  // 入力用スプレッドシート（このスクリプトがバインドされたブック＝アクティブ）
  CHECK_SHEET_NAME: "顧客No候補チェック",
  LOG_SHEET_NAME: "顧客No付与ログ",

  DATA_START_ROW: 2,
  AUTO_CHECK_MARK: true // ◎（100/90点）を初期チェックONにする
};

//==================================================
// ① 候補抽出
//==================================================

function runExtractCustomerNoCandidates() {
  const ui = clTryUi_();

  const projectIndex = clBuildProjectIndex_(); // { byName, byRep }
  const targets = clReadFollowTargets_();       // BA空欄の行

  const rows = [];
  let cAuto = 0, cNeed = 0, cRep = 0, cNone = 0, cMulti = 0;

  targets.forEach(t => {
    const m = clMatch_(t, projectIndex);

    rows.push({
      check: (m.symbol === "◎") && CUSTOMER_LINK_CONFIG.AUTO_CHECK_MARK,
      followRow: t.row,
      followName: t.name,
      followRep: t.rep,
      candNo: m.no,
      candName: m.name,
      candRep: m.rep,
      score: m.score,
      verdict: clVerdictLabel_(m.symbol),
      reason: m.reason
    });

    if (m.symbol === "◎") cAuto++;
    else if (m.symbol === "○") cNeed++;
    else if (m.symbol === "△") cRep++;
    else if (m.symbol === "⚫") cMulti++;
    else cNone++;
  });

  clWriteCheckSheet_(rows);

  const msg =
    "抽出完了！\n\n" +
    "対象（BA空欄）：" + targets.length + "件\n" +
    "◎ 自動候補（100/90）：" + cAuto + "件\n" +
    "○ 要確認（顧客名一致）：" + cNeed + "件\n" +
    "△ 要確認（代表者一致）：" + cRep + "件\n" +
    "× 候補なし：" + cNone + "件\n" +
    "⚫ 候補複数（反映禁止）：" + cMulti + "件";

  if (ui) ui.alert("顧客No候補 抽出", msg, ui.ButtonSet.OK);
  else Logger.log(msg);
}

//==================================================
// ② 反映（チェックONかつ候補Noあり・候補複数でない・重複でない）
//==================================================

function runApplyCustomerNo() {
  const ui = clTryUi_();

  const sheet = clGetCheckSheet_(false);
  if (!sheet) {
    if (ui) ui.alert("「" + CUSTOMER_LINK_CONFIG.CHECK_SHEET_NAME + "」がありません。先に候補抽出を実行してください。");
    return;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    if (ui) ui.alert("候補がありません。");
    return;
  }

  const n = lastRow - 1;
  const data = sheet.getRange(2, 1, n, 10).getValues(); // A..J

  const followSheet = clGetFollowSheet_();
  const existingNos = clExistingFollowNos_(followSheet); // 既に BA にある顧客No

  // 今回バッチ内での顧客No重複カウント
  const batchCount = {};
  data.forEach(r => {
    if (r[0] === true) {
      const no = clNormalizeNo_(r[4]); // E
      if (no) batchCount[no] = (batchCount[no] || 0) + 1;
    }
  });

  const toApply = [];
  const skipped = [];

  data.forEach((r, i) => {
    const row = i + 2;
    if (r[0] !== true) return; // A チェックOFF

    const followRow = r[1];              // B 1年サポート行番号
    const followName = r[2];             // C 顧客名
    const candNo = clNormalizeNo_(r[4]); // E 候補顧客No（手入力も可）

    // E列（候補顧客No）が空なら反映しない。
    //   ⚫候補複数 / ×候補なし は自動ではE列が空なので、この時点で除外される。
    //   人が正しいNoをE列に入れた行だけ反映対象になる（＝手動解決を許可）。
    if (!candNo) { skipped.push(row + "行:候補顧客Noなし（⚫/×は正しいNoをE列に入力）"); return; }
    if (!followRow) { skipped.push(row + "行:1年サポート行番号なし"); return; }
    if (existingNos[candNo]) { skipped.push(row + "行:顧客No重複（既にBAに存在）"); return; }
    if (batchCount[candNo] > 1) { skipped.push(row + "行:顧客No重複（今回複数行）"); return; }

    toApply.push({ checkRow: row, followRow: followRow, no: candNo, name: followName });
  });

  if (toApply.length === 0) {
    if (ui) ui.alert("反映できる行がありません。\n\nスキップ：" + skipped.length + "件");
    return;
  }

  // 反映前ダイアログ
  let msg = toApply.length + "件反映します。\n\n";
  toApply.slice(0, 20).forEach(a => {
    msg += a.no + "　" + (a.name || "") + "\n";
  });
  if (toApply.length > 20) msg += "ほか " + (toApply.length - 20) + "件\n";
  msg += "\nOK？";

  if (ui) {
    const res = ui.alert("顧客No反映 確認", msg, ui.ButtonSet.OK_CANCEL);
    if (res !== ui.Button.OK) {
      ui.alert("反映をキャンセルしました。");
      return;
    }
  }

  const logSheet = clGetLogSheet_();
  const now = new Date();
  const user = clGetUser_();
  const logRows = [];

  toApply.forEach(a => {
    followSheet.getRange(a.followRow, CUSTOMER_LINK_CONFIG.FOLLOW_COL.customerNo).setValue(a.no); // BA

    // チェックシート側の記録
    sheet.getRange(a.checkRow, 1).setValue(false);                               // A チェックを外す
    sheet.getRange(a.checkRow, 10).setValue("反映済 " + clFormatDateTime_(now)); // J メモ

    existingNos[a.no] = true; // 同一実行内の二重反映防止
    logRows.push([now, a.followRow, a.no, a.name || "", user, "反映済"]);
  });

  logSheet.getRange(logSheet.getLastRow() + 1, 1, logRows.length, 6).setValues(logRows);

  const done =
    "反映完了！\n\n" +
    "反映：" + toApply.length + "件\n" +
    "スキップ：" + skipped.length + "件";

  if (ui) ui.alert("顧客No反映", done, ui.ButtonSet.OK);
  else Logger.log(done);
}

//==================================================
// 照合ロジック
//==================================================

// 案件一覧を「正規化顧客名／正規化代表者名」で索引化
function clBuildProjectIndex_() {
  const sheet = clGetProjectSheet_();
  const start = CUSTOMER_LINK_CONFIG.DATA_START_ROW;
  const lastRow = sheet.getLastRow();

  const byName = {};
  const byRep = {};
  if (lastRow < start) return { byName, byRep };

  const num = lastRow - start + 1;
  const col = CUSTOMER_LINK_CONFIG.PROJECT_COL;

  const noCol = sheet.getRange(start, col.customerNo, num, 1).getValues();
  const nameCol = sheet.getRange(start, col.customerName, num, 1).getValues();
  const repCol = sheet.getRange(start, col.representative, num, 1).getValues();

  for (let i = 0; i < num; i++) {
    const no = clNormalizeNo_(noCol[i][0]);
    if (!no) continue;

    const name = String(nameCol[i][0] || "");
    const rep = String(repCol[i][0] || "");
    const nName = clNormalizeName_(name);
    const nRep = clNormalizeName_(rep);

    const entry = { no, name, rep, normName: nName, normRep: nRep };

    if (nName) {
      if (!byName[nName]) byName[nName] = [];
      byName[nName].push(entry);
    }
    if (nRep) {
      if (!byRep[nRep]) byRep[nRep] = [];
      byRep[nRep].push(entry);
    }
  }

  return { byName, byRep };
}

// 1年サポートの BA 空欄の行を取得
function clReadFollowTargets_() {
  const sheet = clGetFollowSheet_();
  const start = CUSTOMER_LINK_CONFIG.DATA_START_ROW;
  const lastRow = sheet.getLastRow();
  const col = CUSTOMER_LINK_CONFIG.FOLLOW_COL;

  const targets = [];
  if (lastRow < start) return targets;
  if (sheet.getMaxColumns() < col.customerNo) return targets;

  const num = lastRow - start + 1;
  const nameCol = sheet.getRange(start, col.customerName, num, 1).getValues();
  const repCol = sheet.getRange(start, col.representative, num, 1).getValues();
  const noCol = sheet.getRange(start, col.customerNo, num, 1).getValues();

  for (let i = 0; i < num; i++) {
    const existing = clNormalizeNo_(noCol[i][0]);
    if (existing) continue; // BAに既に顧客No → 対象外

    const name = String(nameCol[i][0] || "");
    const rep = String(repCol[i][0] || "");
    if (!name && !rep) continue; // 空行

    targets.push({ row: start + i, name, rep });
  }

  return targets;
}

// 1行分のマッチ判定
//   100点：顧客名・代表者が完全一致（◎）
//    90点：正規化後に顧客名・代表者が一致（◎）
//    70点：顧客名一致のみ（○）
//    50点：代表者一致のみ（△）
//   候補なし（×）／候補複数（⚫・反映禁止）
function clMatch_(target, index) {
  const fName = clNormalizeName_(target.name);
  const fRep = clNormalizeName_(target.rep);

  const nameMatches = fName ? (index.byName[fName] || []) : [];

  if (nameMatches.length >= 2) {
    return clMulti_(nameMatches, "顧客名が複数一致");
  }

  if (nameMatches.length === 1) {
    const p = nameMatches[0];
    const rawNameEq = String(target.name).trim() === String(p.name).trim();
    const rawRepEq = String(target.rep).trim() === String(p.rep).trim();
    const normRepEq = fRep && p.normRep && fRep === p.normRep;

    let score, symbol, reason;
    if (rawNameEq && rawRepEq) {
      score = 100; symbol = "◎"; reason = "完全一致（顧客名・代表者）";
    } else if (normRepEq) {
      score = 90; symbol = "◎"; reason = "正規化一致（顧客名・代表者）";
    } else {
      score = 70; symbol = "○"; reason = fRep ? "顧客名一致のみ（代表者不一致）" : "顧客名一致のみ（代表者なし）";
    }
    return { no: p.no, name: p.name, rep: p.rep, score, symbol, reason };
  }

  // 顧客名一致なし → 代表者で照合
  const repMatches = fRep ? (index.byRep[fRep] || []) : [];

  if (repMatches.length >= 2) {
    return clMulti_(repMatches, "代表者が複数一致");
  }

  if (repMatches.length === 1) {
    const p = repMatches[0];
    return { no: p.no, name: p.name, rep: p.rep, score: 50, symbol: "△", reason: "代表者一致のみ（顧客名不一致）" };
  }

  return { no: "", name: "", rep: "", score: 0, symbol: "×", reason: "候補なし" };
}

function clMulti_(list, reasonHead) {
  const detail = (list || []).slice(0, 5).map(p => p.no + ":" + p.name).join(" / ");
  const more = (list && list.length > 5) ? " ほか" + (list.length - 5) + "件" : "";
  return {
    no: "", name: "", rep: "", score: 0, symbol: "⚫",
    reason: "候補複数（" + reasonHead + "）→ 正しいNoをE列に手入力してチェック：" + detail + more
  };
}

function clVerdictLabel_(symbol) {
  switch (symbol) {
    case "◎": return "◎ 自動候補";
    case "○": return "○ 要確認";
    case "△": return "△ 要確認";
    case "⚫": return "⚫ 候補複数";
    default: return "× 候補なし";
  }
}

//==================================================
// チェックシート出力
//==================================================

function clWriteCheckSheet_(rows) {
  const sheet = clGetCheckSheet_(true);
  sheet.clear();

  sheet.getRange(1, 1, 1, 10).setValues([[
    "反映",
    "1年サポート行番号",
    "顧客名",
    "代表者名",
    "候補顧客No",
    "候補顧客名",
    "候補代表者名",
    "一致率",
    "判定",
    "判定理由・メモ"
  ]]);

  sheet.setFrozenRows(1);
  sheet.getRange("A1:J1").setFontWeight("bold").setBackground("#d9ead3");

  sheet.setColumnWidth(1, 60);
  sheet.setColumnWidth(2, 120);
  sheet.setColumnWidth(3, 220);
  sheet.setColumnWidth(4, 160);
  sheet.setColumnWidth(5, 110);
  sheet.setColumnWidth(6, 220);
  sheet.setColumnWidth(7, 160);
  sheet.setColumnWidth(8, 80);
  sheet.setColumnWidth(9, 120);
  sheet.setColumnWidth(10, 320);

  const n = rows.length;
  if (n === 0) return;

  const body = rows.map(r => [
    r.followRow,
    r.followName,
    r.followRep,
    r.candNo,
    r.candName,
    r.candRep,
    r.score > 0 ? (r.score + "%") : "",
    r.verdict,
    r.reason
  ]);

  sheet.getRange(2, 2, n, 9).setValues(body);           // B..J
  sheet.getRange(2, 1, n, 1).insertCheckboxes();        // A チェックボックス
  sheet.getRange(2, 1, n, 1).setValues(rows.map(r => [!!r.check]));

  clApplyVerdictColors_(sheet, rows);
}

function clApplyVerdictColors_(sheet, rows) {
  const bg = rows.map(r => {
    let color = null;
    if (r.verdict.indexOf("◎") >= 0) color = "#d9ead3";      // 緑
    else if (r.verdict.indexOf("○") >= 0) color = "#fff2cc"; // 黄
    else if (r.verdict.indexOf("△") >= 0) color = "#fce5cd"; // オレンジ
    else if (r.verdict.indexOf("⚫") >= 0) color = "#f4cccc"; // 赤（複数）
    else color = "#efefef";                                   // 灰（なし）
    return [color];
  });
  sheet.getRange(2, 9, rows.length, 1).setBackgrounds(bg); // 判定列だけ色付け
}

//==================================================
// シート取得
//==================================================

function clGetProjectSheet_() {
  const ss = SpreadsheetApp.openById(CUSTOMER_LINK_CONFIG.PROJECT_SS_ID);
  const sheet = ss.getSheetByName(CUSTOMER_LINK_CONFIG.PROJECT_SHEET_NAME);
  if (!sheet) throw new Error("案件一覧シートが見つかりません。");
  return sheet;
}

function clGetFollowSheet_() {
  const ss = SpreadsheetApp.openById(CUSTOMER_LINK_CONFIG.FOLLOW_SS_ID);
  const sheet = ss.getSheetByName(CUSTOMER_LINK_CONFIG.FOLLOW_SHEET_NAME);
  if (!sheet) throw new Error("1年サポートシートが見つかりません。");
  return sheet;
}

function clGetCheckSheet_(create) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CUSTOMER_LINK_CONFIG.CHECK_SHEET_NAME);
  if (!sheet && create) sheet = ss.insertSheet(CUSTOMER_LINK_CONFIG.CHECK_SHEET_NAME);
  return sheet;
}

function clGetLogSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CUSTOMER_LINK_CONFIG.LOG_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CUSTOMER_LINK_CONFIG.LOG_SHEET_NAME);
    sheet.getRange(1, 1, 1, 6).setValues([[
      "日時", "1年サポート行番号", "顧客No", "顧客名", "実行者", "結果"
    ]]);
    sheet.setFrozenRows(1);
    sheet.getRange("A1:F1").setFontWeight("bold").setBackground("#ead1dc");
    sheet.getRange("A:A").setNumberFormat("yyyy/mm/dd HH:mm");
  }
  return sheet;
}

function clExistingFollowNos_(followSheet) {
  const set = {};
  const start = CUSTOMER_LINK_CONFIG.DATA_START_ROW;
  const lastRow = followSheet.getLastRow();
  const col = CUSTOMER_LINK_CONFIG.FOLLOW_COL.customerNo;
  if (lastRow < start) return set;
  if (followSheet.getMaxColumns() < col) return set;

  const values = followSheet.getRange(start, col, lastRow - start + 1, 1).getValues();
  values.forEach(r => {
    const v = clNormalizeNo_(r[0]);
    if (v) set[v] = true;
  });
  return set;
}

//==================================================
// 共通ユーティリティ（正規化など・再利用可能）
//==================================================

// 顧客名・代表者名の表記ゆれ正規化（共通関数）
//   NFKC / 空白・改行除去 / 小文字化 / ハイフン統一 / 会社表記の吸収
function clNormalizeName_(value) {
  let s = String(value == null ? "" : value).normalize("NFKC");

  // 改行を除去
  s = s.replace(/[\r\n]+/g, "");

  // ハイフン類を統一（カタカナ長音「ー」は対象外）
  s = s.replace(/[‐-‒–—―−ｰ－]/g, "-");

  // 会社表記の吸収
  s = s.replace(/(株式会社|有限会社|合同会社|合名会社|合資会社|一般社団法人|一般財団法人|公益社団法人|公益財団法人|医療法人社団|医療法人|社会福祉法人|特定非営利活動法人|ＮＰＯ法人|NPO法人)/g, "");
  s = s.replace(/[（(]\s*(株|有|同|名|資|社|財|医|福)\s*[）)]/g, "");
  s = s.replace(/[㈱㈲㈳㈴㈵㈶]/g, "");

  // 空白（半角・全角）を除去
  s = s.replace(/[\s　]+/g, "");

  return s.trim().toLowerCase();
}

// 顧客No 正規化
function clNormalizeNo_(value) {
  let s = String(value == null ? "" : value).normalize("NFKC").replace(/[\s　]+/g, "").trim();
  if (/^\d+\.0+$/.test(s)) s = s.replace(/\.0+$/, ""); // 123.0 → 123
  return s;
}

function clGetUser_() {
  try {
    return Session.getActiveUser().getEmail() || "";
  } catch (e) {
    return "";
  }
}

function clFormatDateTime_(value) {
  return Utilities.formatDate(new Date(value), Session.getScriptTimeZone(), "yyyy/MM/dd HH:mm");
}

function clTryUi_() {
  try {
    return SpreadsheetApp.getUi();
  } catch (e) {
    return null;
  }
}
