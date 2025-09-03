(function ()
{
  "use strict";

  /**
   * 編集時のイベント
   * ステータス変更ユーザーフィールドを非活性化
   */
  kintone.events.on([
    'app.record.create.show',
    'app.record.edit.show',
    'app.record.index.edit.show'
  ], (event) =>
  {
    event.record.ステータス変更ユーザー.disabled = true;
    return event;
  });


  /**
   * 掲載ステータス変更イベント
   * ステータス変更ユーザーに値をセット
   */
  kintone.events.on([
    'app.record.create.change.掲載ステータス',
    'app.record.edit.change.掲載ステータス',
    'app.record.index.edit.change.掲載ステータス'
  ], (event) =>
  {
    event.record.ステータス変更ユーザー.value = [{ code: kintone.getLoginUser().code }];
    return event;
  });

})();
