/****
 * UI制御
 */
(function () {
  'use strict';

  kintone.events.on(['app.record.create.show', 'app.record.edit.show'], async (event) => {
    // 非活性化
    event.record['掲載残日数']['disabled'] = true;
    event.record['掲載残日数_その他']['disabled'] = true;

    return event;
  });
})();
