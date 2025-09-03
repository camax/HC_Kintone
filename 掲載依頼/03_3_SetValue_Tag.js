(function ()
{
  "use strict";

  /**
   * 編集時のイベント
   */
  kintone.events.on([
    'app.record.create.show',
    'app.record.edit.show',
    'app.record.index.edit.show'
  ], (event) =>
  {
    event.record.タグ.disabled = true;
    return event;
  });


  /**
   * 変更イベント
   */
  kintone.events.on([
    'app.record.create.change.タグ選択',
    'app.record.edit.change.タグ選択',
    'app.record.index.edit.change.タグ選択'
  ], (event) =>
  {
    event.record.タグ.value = event.record["タグ選択"].value.join(", ");
    return event;
  });

})();
