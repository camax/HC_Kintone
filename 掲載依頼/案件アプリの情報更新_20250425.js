(function () {
  'use strict';

  // ——— 更新先アプリID ———
  var DEST_APP_ID = 514;

  // ——— 反映するフィールド一覧 ———
  var fields = ['掲載開始日', '初回発送日', '最短賞味期限', 'タメ最終日', 'テストページ', '校了予定日', '掲載準備日'];

  // ——— レコード保存成功時イベント ———
  var events = ['app.record.create.submit.success', 'app.record.edit.submit.success'];

  kintone.events.on(events, function (event) {
    var rec = event.record;
    // ソースアプリと同じレコードIDで更新する想定
    var recordId = event.recordId;

    // 更新用レコードオブジェクトを組み立て
    var destRecord = {};
    fields.forEach(function (code) {
      destRecord[code] = {
        value: rec[code].value,
      };
    });

    // REST API 呼び出し
    return kintone
      .api(kintone.api.url('/k/v1/record', true), 'PUT', {
        app: DEST_APP_ID,
        id: recordId,
        record: destRecord,
      })
      .then(function (resp) {
        console.log('更新先アプリに反映しました:', resp);
        return event;
      })
      .catch(function (err) {
        console.error('更新先アプリへの反映に失敗しました:', err);
        return event;
      });
  });
})();
