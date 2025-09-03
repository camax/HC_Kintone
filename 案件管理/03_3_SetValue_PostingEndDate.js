(function () {
    "use strict";

    /**
     * クチコミ最終日を設定
     * ・初回発送日が15日以下の場合
        　  初回発送日の翌月15日
     　・初回発送日が16日移行
        　  初回発送日の翌月末日
     * @param {kinton event object} event 
     */
    const SetLastReviewsDate = event => {
        let shippingDate = event.record['初回発送日'].value;
        console.log(shippingDate)
        if(shippingDate){
            let dt = new Date(shippingDate);
            let lastReviewsDate = null;
            if(dt.getDate() > 15){
                lastReviewsDate = new Date(dt.getFullYear(), (dt.getMonth() + 2), 0);
            } else {
                lastReviewsDate = new Date(dt.getFullYear(), (dt.getMonth() + 1), 15);
                console.log(lastReviewsDate)
            }
            console.log(lastReviewsDate)
            console.log(lastReviewsDate.getFullYear() + "-" + (lastReviewsDate.getMonth() + 1) + "-" + lastReviewsDate.getDate())
            event.record['クチコミ終了日'].value = lastReviewsDate.getFullYear() + "-" + (lastReviewsDate.getMonth() + 1) + "-" + lastReviewsDate.getDate();
            //event.record['クチコミ終了日'].value = lastReviewsDate
        }
        return event;
    }

    kintone.events.on(['app.record.create.change.初回発送日','app.record.edit.change.初回発送日'], SetLastReviewsDate);
    
})();