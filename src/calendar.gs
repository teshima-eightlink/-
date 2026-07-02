/**
 * カレンダー連携のサンプル
 *
 * 使い方：
 *  1. https://script.google.com で新しいプロジェクトを作成
 *  2. このファイルの中身を貼り付けて保存
 *  3. listTodayEvents を実行（初回は権限の承認が必要）
 */

/**
 * 今日の予定をログに出すサンプル。
 */
function listTodayEvents() {
  const cal = CalendarApp.getDefaultCalendar();
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  const events = cal.getEvents(start, end);
  Logger.log('今日の予定: ' + events.length + '件');
  events.forEach(function (e) {
    Logger.log('- ' + e.getTitle() + ' (' + e.getStartTime() + ')');
  });
}
