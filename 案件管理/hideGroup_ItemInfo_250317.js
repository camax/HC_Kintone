(() =>
{
    "use strict";

    const EVENTS_HIDE = [
        'app.record.detail.show',
    ]

    kintone.events.on(EVENTS_HIDE, async (event) =>
    {
        let record = event.record;

        for (let ii = 1; ii <= 10; ii++)
        {
            if (!record['商品コード_' + ii].value)
            {
                // セット内容の商品名
                kintone.app.record.setFieldShown(`セット内容_商品名_${ii}`, false);
                // セット内容のセット入数
                kintone.app.record.setFieldShown(`セット内容_セット入数_${ii}`, false);
                // 商品情報のグループ
                kintone.app.record.setFieldShown(`商品_${ii}グループ`, false);
            }
        }

        return event;
    });

})();

