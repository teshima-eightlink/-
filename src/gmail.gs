/**
 * Gmail 連携のサンプル
 *
 * 使い方：
 *  1. https://script.google.com で新しいプロジェクトを作成
 *  2. このファイルの中身を貼り付けて保存
 *  3. notifyUnreadByLabel を実行（初回は権限の承認が必要）
 *  4. 定期実行したい場合は「トリガー」で時間主導型に設定
 */

/**
 * 指定ラベルの未読メール件数をログに出すサンプル。
 * Slack通知などへの拡張も Claude が対応します。
 */
function notifyUnreadByLabel() {
  const labelName = '要対応'; // 対象ラベル名（適宜変更）
  const threads = GmailApp.search('label:' + labelName + ' is:unread');

  Logger.log('未読スレッド数: ' + threads.length);
  threads.forEach(function (thread) {
    Logger.log('- ' + thread.getFirstMessageSubject());
  });
}
