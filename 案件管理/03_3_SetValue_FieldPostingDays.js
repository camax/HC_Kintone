/**
 * 掲載残日数の計算
 * 
 * ・掲載終了日の残日数
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
          event.record['掲載残日数'].value = joiningDayDuration.days;
        }
        
        return event;
      }

      kintone.events.on(['app.record.create.change.掲載終了日','app.record.edit.change.掲載終了日','app.record.create.show','app.record.edit.show', 'app.record.detail.show'], SetPostingDays);
})();
