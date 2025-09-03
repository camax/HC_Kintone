(() =>
{
    "use strict";

    const HC_MATTER_APP_ID = HC.apps.案件管理.id;
    const HC_PURCHASEORDER_APP_ID = HC.apps.発注書.id;
    const HC_BILL_APP_ID = HC.apps.請求書.id;
    const HC_POSTINGREQUEST_APP_ID = HC.apps.掲載依頼.id;
    const HC_DELIVERYDESTINATION_APP_ID = HC.apps.納品先マスタ.id;
    const HC_ESTIMATE_APP_ID = HC.apps.見積書.id;
    const HC_DOMAIN = HC.domain.url;


    /**
     * 発注番号を取得
     */
    const GetOrderNumber = async () =>
    {

        let dayName = luxon.DateTime.local().toFormat('yyyyMMdd');

        return await new KintoneRestAPIClient().record.getRecords({
            app: HC_PURCHASEORDER_APP_ID,
            fields: ["発注番号"],
            query: '発注番号 like "@id" order by 発注番号 desc limit 1 offset 0'.replace('@id', dayName)
        })
            .then(function (resp)
            {
                let resNum = "";
                try
                {
                    if (resp.records.length >= 1)
                    {
                        let curNumberSplit = resp.records[0]["発注番号"].value.split('-');
                        let newNum = parseInt(curNumberSplit[curNumberSplit.length - 1]) + 1;
                        resNum = "HCH-" + dayName + "-" + newNum;
                    }
                }
                finally
                {
                    if (resNum === "") resNum = "HCH-" + dayName + "-1";
                }
                return resNum;
            }).catch(function (err)
            {
                console.log(err);
            });
    }

    /**
     * 発注先を取得（納品先マスターのID）
     */
    const GetDeliveryDestination = async (event) =>
    {

        let PurchaseDest = event.record["発注先名"].value;
        if (!PurchaseDest) return null;

        return await new KintoneRestAPIClient().record.getRecords({
            app: HC_DELIVERYDESTINATION_APP_ID,
            fields: ["ID"],
            query: '発注先名 = "@id" order by ID asc limit 1 offset 0'.replace('@id', PurchaseDest)
        })
            .then(function (resp)
            {
                return resp.records[0]['ID'].value;
            }).catch(function (err)
            {
                console.log(err);
            });
    }

    /**
     * 発注書アプリにレコード生成
     * @returns 
     */
    const CreateRecodeToPurchaseOrderApp = async (event) =>
    {
        try
        {
            // 発注書レコード生成
            let tbRecords1 = []; // 発注商品金額表
            let tbRecords2 = []; // 予備分表
            let tbRecords3 = []; // 広告掲載協賛金表

            // レコード
            const record = event.record;

            for (let j = 1; j <= 10; j++)
            {

                let code = record['商品コード_' + j].value;
                let codeId = record['商品レコードID_' + j].value;
                if (!code && !codeId) continue;

                // 発注商品金額表
                let row1 = {
                    'value': {
                        '発注商品金額表_納品日': { 'value': record['納品日'].value },
                        '発注商品金額表_メーカー': { 'value': record['メーカー名_' + j].value },
                        '発注商品金額表_商品コード': { 'value': record['商品コード_' + j + '_ルックアップ'].value },
                        '発注商品金額表_商品名': { 'value': record['商品名_' + j].value },
                        '発注商品金額表_JANコード': { 'value': record['JAN_' + j].value },
                        '発注商品金額表_使用賞味期限': { 'value': record['賞味期限_' + j].value },
                        '発注商品金額表_ケース入数': { 'value': record['ケース入数_' + j].value },
                        '発注商品金額表_ケース数': { 'value': record['ケース数_' + j].value },
                        '発注商品金額表_単価': { 'value': record['仕入れバラ_税抜_' + j].value },
                        '発注商品金額表_数量': { 'value': record['バラ数_' + j].value },
                        '発注商品金額表_商品税率': { 'value': record['税率'].value }
                    }
                };
                tbRecords1.push(row1);

                // 予備分表
                let row2 = {
                    'value': {
                        '予備分表_納品日': { 'value': record['納品日'].value },
                        '予備分表_メーカー': { 'value': record['メーカー名_' + j].value },
                        '予備分表_商品名': { 'value': record['商品名_' + j].value },
                        '予備分表_JANコード': { 'value': record['JAN_' + j].value },
                        '予備分表_使用賞味期限': { 'value': record['賞味期限_' + j].value },
                        '予備分表_ケース入数': { 'value': record['ケース入数_' + j].value },
                        '予備分表_ケース数': { 'value': record['ケース数_' + j].value },
                        '予備分表_単価': { 'value': record['仕入れバラ_税抜_' + j].value },
                        '予備分表_数量': { 'value': record['予備分_' + j].value },
                        '予備分表_商品税率': { 'value': record['税率'].value },
                    }
                };
                tbRecords2.push(row2);

                // 広告掲載協賛金表
                let row4 = {
                    'value': {
                        '広告掲載協賛金表_商品名': { 'value': record['商品名_' + j].value },
                        '広告掲載協賛金表_ケース入数': { 'value': record['ケース入数_' + j].value },
                        '広告掲載協賛金表_ケース数': { 'value': record['ケース数_' + j].value },
                        '広告掲載協賛金表_単価': { 'value': record['仕入れバラ_税抜_' + j].value },
                        '広告掲載協賛金表_数量': { 'value': record['バラ数_' + j].value },
                    }
                };
                tbRecords3.push(row4);
            }

            // 発注番号
            let OrderNum = await GetOrderNumber();

            // 発注先（納品先マスタのID）
            let DeliveryDestID = await GetDeliveryDestination(event);

            let param = {
                app: HC_PURCHASEORDER_APP_ID,
                record: {
                    '発注商品金額表': { 'value': tbRecords1 },
                    '予備分表': { 'value': tbRecords2 },
                    '広告掲載協賛金表': { 'value': tbRecords3 },
                    '掲載依頼レコードID': { 'value': record['$id'].value },
                    '掲載依頼レコードURL': { 'value': "https://" + HC_DOMAIN + "/k/" + HC_POSTINGREQUEST_APP_ID + '/show#record=' + record['$id'].value },
                    '発注番号': { 'value': OrderNum },
                    '発注先ID': { 'value': DeliveryDestID },
                    '取引形式': { 'value': record['取引形式'].value }
                }
            }

            console.log(param)

            const client = new KintoneRestAPIClient();

            client.record.addRecord(param)
                .then(async function (resp)
                {
                    let reqRecord = {
                        '発注書レコードID': {
                            value: resp.id
                        },
                        '発注書レコードURL': {
                            value: "https://" + HC_DOMAIN + "/k/" + HC_PURCHASEORDER_APP_ID + '/show#record=' + resp.id
                        }
                    };
                    let param = {
                        app: kintone.app.getId(),
                        id: record['$id'].value,
                        record: reqRecord,
                    };

                    new KintoneRestAPIClient().record.updateRecord(param)

                        .then(async function (resp)
                        {
                            await swal({
                                title: '【発注書】レコード生成',
                                text: 'レコードを生成しました。\n発注書アプリから発注書を作成してください。\n',
                                icon: 'success',
                                timer: 10000
                            });

                        }).catch(async function (e)
                        {
                            console.log(e);
                            await swal({
                                title: '【発注書】レコード生成',
                                text: '発注書アプリにレコードを生成しましが、\n発注書発行ステータスの更新に失敗しました。\n',
                                icon: 'error',
                                timer: 10000
                            });
                        });

                }).catch(async function (e)
                {
                    console.log(e);
                    await swal({
                        title: '【発注書】レコード生成',
                        text: '発注書アプリのレコード生成に失敗しました。\n' + e,
                        icon: 'error',
                        timer: 10000
                    });
                });

        } catch (ex)
        {
            throw ex;
        }
    }

    /**
     * 請求番号を取得
     */
    const GetBillNumber = async () =>
    {

        let dayName = luxon.DateTime.local().toFormat('yyyyMMdd');

        return await new KintoneRestAPIClient().record.getRecords({
            app: HC_BILL_APP_ID,
            fields: ["請求番号"],
            query: '請求番号 like "@id" order by 請求番号 desc limit 1 offset 0'.replace('@id', dayName)
        })
            .then(function (resp)
            {
                let resNum = "";
                try
                {
                    if (resp.records.length >= 1)
                    {
                        let curNumberSplit = resp.records[0]["請求番号"].value.split('-');
                        let newNum = parseInt(curNumberSplit[curNumberSplit.length - 1]) + 1;
                        resNum = "HCS-" + dayName + "-" + newNum;
                    }
                }
                finally
                {
                    if (resNum === "") resNum = "HCS-" + dayName + "-1";
                }
                return resNum;
            }).catch(function (err)
            {
                console.log(err);
            });
    }

    /**
     * 請求書アプリにレコード生成
     * @returns 
     */
    const CreateRecodeToBillApp = async (event) =>
    {

        try
        {
            // 請求書レコード生成
            let tbRecords = [];

            // レコード
            const record = event.record;

            for (let j = 1; j <= 10; j++)
            {

                let code = record['商品コード_' + j].value;
                let codeId = record['商品レコードID_' + j].value;
                if (!code && !codeId) continue;

                // その他卸先 商品表
                let row1 = {
                    'value': {
                        'その他_商品名': { 'value': record['商品名_' + j].value },
                        'その他_JANコード': { 'value': record['JAN_' + j].value },
                        'その他_使用賞味期限': { 'value': record['賞味期限_' + j].value },
                        'その他_ケース入数': { 'value': record['ケース入数_' + j].value },
                        'その他_ケース数': { 'value': record['ケース数_' + j].value },
                        'その他_単価': { 'value': record['仕入れバラ_税抜_' + j].value },
                        'その他_数量': { 'value': record['バラ数_' + j].value },
                        'その他_商品税率': { 'value': record['税率'].value }
                    }
                };
                tbRecords.push(row1);
            }

            // 請求番号
            let BillNum = await GetBillNumber();

            // 納品先ID
            let DeliveryDestID = await GetDeliveryDestination(event);

            let param = {
                app: HC_BILL_APP_ID,
                record: {
                    'その他_商品表': { 'value': tbRecords },
                    '掲載依頼レコードID': { 'value': record['$id'].value },
                    '掲載依頼レコードURL': { 'value': "https://" + HC_DOMAIN + "/k/" + HC_POSTINGREQUEST_APP_ID + '/show#record=' + record['$id'].value },
                    '請求番号': { 'value': BillNum },
                    '納品先ID': { 'value': DeliveryDestID }
                }
            }

            console.log(param)

            const client = new KintoneRestAPIClient();

            client.record.addRecord(param)
                .then(async function (resp)
                {

                    let reqRecord = {
                        '請求書レコードID': {
                            value: resp.id
                        },
                        '請求書レコードURL': {
                            value: "https://" + HC_DOMAIN + "/k/" + HC_BILL_APP_ID + '/show#record=' + resp.id
                        }
                    };
                    let param = {
                        app: kintone.app.getId(),
                        id: record['$id'].value,
                        record: reqRecord,
                    };

                    new KintoneRestAPIClient().record.updateRecord(param)

                        .then(async function (resp)
                        {
                            await swal({
                                title: '【請求書】レコード生成',
                                text: 'レコードを生成しました。\n請求書アプリから請求書を作成してください。\n',
                                icon: 'success',
                                timer: 10000
                            });

                        }).catch(async function (e)
                        {
                            console.log(e);
                            await swal({
                                title: '【請求書】レコード生成',
                                text: '請求書アプリにレコードを生成しましが、\n請求書発行ステータスの更新に失敗しました。\n',
                                icon: 'error',
                                timer: 10000
                            });
                        });

                }).catch(async function (e)
                {
                    console.log(e);
                    await swal({
                        title: '【請求書】レコード生成',
                        text: '請求書アプリのレコード生成に失敗しました。\n' + e,
                        icon: 'error',
                        timer: 10000
                    });
                });

        } catch (ex)
        {
            throw ex;
        }

    }

    /**
     * 見積書アプリにレコード生成
     * @returns 
     */
    const CreateRecodeToEstimationApp = async (event) =>
    {
        try
        {
            let record = event.record;

            // 案件グループIDが空欄の場合
            if (!record["案件グループID"].value)
            {
                await swal({
                    title: '【見積書】レコード生成',
                    text: '案件グループIDが空欄です。\n先に案件レコードを作成してください。\n',
                    icon: 'error',
                    timer: 10000
                });
                return event;
            }

            // 案件レコードを取得
            let mattRecs = await new KintoneRestAPIClient().record.getRecords({
                app: HC_MATTER_APP_ID,
                query: '案件グループID = "@gid" order by ID desc limit 100 offset 0'.replace('@gid', record["案件グループID"].value)
            });
            console.log(mattRecs);
            let excMatt = mattRecs.records.find((rec) => rec["掲載媒体名"].value == "モラタメ");
            console.log(excMatt);

            // モラタメの案件レコードがない場合
            if (!excMatt)
            {
                await swal({
                    title: '【見積書】レコード生成',
                    text: 'モラタメの案件レコードがありません。\n',
                    icon: 'error',
                    timer: 10000
                });
                return event;
            }

            // 見積書レコード用のデータ
            let estData = {
                '掲載依頼レコードID': { value: record.$id.value },
                '案件管理レコードID': { value: excMatt.$id.value },
                '見積番号': { value: 'HCE-' + excMatt.$id.value },
                'HC担当者': { value: excMatt.担当者.value },
                '発注商品金額表': {
                    value: [{
                        'value': {
                            '発注商品金額表_発注形式': { value: excMatt.取引形式.value },
                            '発注商品金額表_SEQ': { value: excMatt.SEQ_モラタメ.value },
                            '発注商品金額表_案件名': { value: excMatt.掲載商品名.value },
                            '発注商品金額表_セット卸単価': { value: (Number(excMatt.卸価格_セット_モラタメ.value) / Number(excMatt.セット数.value)) },
                            '発注商品金額表_セット数': { value: excMatt.セット数.value },
                            '発注商品金額表_商品税率': { value: excMatt.税率.value },
                            '発注商品金額表_商品コード': { value: excMatt.商品コード_1.value }
                        }
                    }]
                },
            }

            let param = {
                app: HC_ESTIMATE_APP_ID,
                record: estData
            }

            const client = new KintoneRestAPIClient();

            client.record.addRecord(param)
                .then(async function (resp)
                {
                    await swal({
                        title: '【見積書】レコード生成',
                        text: '見積書アプリにレコードを生成しました。\n',
                        icon: 'success',
                        timer: 10000
                    });
                }).catch(async function (e)
                {
                    console.log(e);
                    await swal({
                        title: '【見積書】レコード生成',
                        text: '見積書アプリのレコード生成に失敗しました。\n' + e,
                        icon: 'error',
                        timer: 10000
                    });
                });

        } catch (ex)
        {
            throw ex;
        }
    }


    /**
      * プロセス管理アクション実行時
     */
    kintone.events.on(["app.record.detail.process.proceed"], async function (event)
    {
        var record = event.record;
        var nextStatus = event.nextStatus.value;

        record['発注書or請求書or見積書発行'].value;
        let res;
        switch (nextStatus)
        {
            // 【発注書・請求書・見積書】にレコードを生成する
            case "発注書・請求書・見積書レコードの発行済み":
                if (record['発注書or請求書or見積書発行'].value.includes("発注書"))
                {
                    await CreateRecodeToPurchaseOrderApp(event);
                }
                if (record['発注書or請求書or見積書発行'].value.includes("請求書"))
                {
                    await CreateRecodeToBillApp(event);
                }
                if (record['発注書or請求書or見積書発行'].value.includes("見積書"))
                {
                    await CreateRecodeToEstimationApp(event);
                }

                break;
        }

        return event;
    });

})();