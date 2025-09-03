/**
 * 掲載終了日の残日数を算出
 */

(function() {
    "use strict";

    /**
     * 経過年月日を計算する
     * @param {string} dateStr 日付文字列
     * @returns {object} 計算結果のオブジェクト
     */
     const calculateDuration = function(dateStr) {

      const currentDate = luxon.DateTime.local().startOf('day');
      const date = luxon.DateTime.fromISO(dateStr).startOf('day');

      // 経過期間を計算する
      const duration = currentDate.diff(date, ['days']);

      return duration.toObject();
    };

   
      const SetPostingDays = event => {

        const joiningDayValue = event.record['掲載終了日'].value;
        if (joiningDayValue) {
          const joiningDayDuration = calculateDuration(joiningDayValue);
          event.record['掲載残日数'].value = Number(joiningDayDuration.days)*-1;
        }

        const joiningDayValueByKumapon = event.record['掲載終了日_その他'].value;
        if (joiningDayValueByKumapon) {
          const joiningDayDuration = calculateDuration(joiningDayValueByKumapon);
          event.record['掲載残日数_その他'].value = Number(joiningDayDuration.days)*-1;
        }
        
        return event;
      }

      kintone.events.on(['app.record.create.change.掲載終了日','app.record.edit.change.掲載終了日','app.record.create.change.掲載終了日_その他','app.record.edit.change.掲載終了日_その他', 'app.record.create.show','app.record.edit.show', 'app.record.detail.show'], SetPostingDays);
})();
