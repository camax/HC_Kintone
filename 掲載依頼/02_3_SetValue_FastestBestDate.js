/**
 * 最短消費期限を設定
 */

(function () {
    "use strict";

    /**
     * 最短消費期限を設定
     * @param {kinton event object} event 
     */
    const SetFastestBestDate = event => {
        let  fastestDate = null;
        for (let i = 1; i <= 10; i++){
            let date = event.record['賞味期限_' + i].value;

            if (fastestDate == null) {
                fastestDate = date;
            } else {
                if (fastestDate > date) {
                    fastestDate = date;
                }
            }
        }
        event.record['最短賞味期限'].value = fastestDate;

        return event;
    }

    let eventsList = []
    for (let i = 1; i <= 10; i++){
        eventsList.push('app.record.create.change.賞味期限_'+i);
        eventsList.push('app.record.edit.change.賞味期限_'+i);
    }
    eventsList.push('app.record.create.show');
    eventsList.push('app.record.edit.show');
    kintone.events.on(eventsList, SetFastestBestDate);
    
})();