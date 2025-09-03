/**
 * 発注・受発注ステータスを設定
 * 受発注日と納品予定日が入力されるとステータスは「受発注」
 */

(function () {
    "use strict";

    /**
     * 発注・受発注ステータスを設定
     * @param {kinton event object} event 
     */
    const SetOrderStatus = event => {
        let date1 = event.record['受発注日'].value;
        let date2 = event.record['納品日'].value;

        if (date1 != undefined && date2 != undefined) {
            event.record['発注・受発注ステータス'].value = "受発注";
        } 
        return event;
    }

    let eventsList = []
    eventsList.push('app.record.create.change.受発注日');
    eventsList.push('app.record.edit.change.受発注日');
    eventsList.push('app.record.create.change.納品日');
    eventsList.push('app.record.edit.change.納品日');
    kintone.events.on(eventsList, SetOrderStatus);
    
})();