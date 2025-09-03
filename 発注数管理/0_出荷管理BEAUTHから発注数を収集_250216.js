/**
 * 出荷管理BEAUTHの値を発注数としてデータを収集する
 */
(() =>
{
    "use strict";

    const client = new KintoneRestAPIClient();
    const APP_ID = kintone.app.getId();

    const HC_APP_ID_SHIPPING_EECOTO = HC.apps.出荷管理EECOTO.id;
    const HC_APP_ID_MATTER = HC.apps.案件管理.id;
    const HC_APP_ID_SET_NUMBER = HC.apps.掲載セット数管理.id;



    let dtNow = luxon.DateTime.local();
    let resParam = { status: 1, message: '' }


    const spinner = new Kuc.Spinner({
        text: '処理中...',
        container: document.body
    });





    /**
     * Conditionを指定してレコードを一括取得
     * @param {*} appId 
     * @param {*} queCond 
     * @returns 
     */
    const GetAllRecords = async (appId, queCond = '') =>
    {
        try
        {
            return client.record.getAllRecords({ app: appId, condition: queCond })
                .then(function (resp)
                {
                    resParam.status = 1;
                    return resp;
                })
                .catch(function (e)
                {
                    console.log(e);
                    resParam.status = 9;
                    resParam.message = `アプリ[${appId}]からレコードの取得に失敗しました。\n` + e;
                    return;
                });
        }
        catch (ex)
        {
            console.log(ex);
            resParam.status = 9;
            resParam.message = `アプリ[${appId}]からレコードの取得に失敗しました。\n` + ex;
            return;
        }
    }

    /**
     * メイン処理
     * @returns 
     */
    const GatherShippingManageRecords_Main = async () =>
    {
        try
        {
            spinner.open();


            // 出荷管理のレコードを取得
            let shippingManageRecords = await GetAllRecords(HC_APP_ID_SHIPPING_EECOTO, '注文日 >= LAST_MONTH() and 数量 >= "1" and 発注数管理にカウント not in ("済")');
            console.log("出荷管理のレコード", shippingManageRecords);

            // 案件管理のレコードを取得
            let matterRecords = await GetAllRecords(HC_APP_ID_MATTER, '掲載媒体名 = "eecoto" and 案件グループID != ""');
            console.log("案件管理のレコード", matterRecords);

            // セット数管理のレコードを取得
            let setNumberRecords = await GetAllRecords(HC_APP_ID_SET_NUMBER);
            console.log("セット数管理のレコード", setNumberRecords);

            // 発注数管理のレコードを取得
            let orderNumberRecords = await GetAllRecords(APP_ID, '日付 >= LAST_MONTH()');
            console.log("発注数管理のレコード", orderNumberRecords);



            let arrAllOrderNums = [];	// [{案件グループID: "", [{注文日: "", 数量: ""}, ...]}, ...]

            /* 出荷管理のフィールド
            SKU：案件グループID
            注文日
            数量
            */

            // 出荷管理のレコードを案件グループIDでグループ化
            let groupedShippingRecords = Object.groupBy(shippingManageRecords, ({ SKU }) => SKU.value); // 案件グループIDでグループ化
            console.log("案件グループID(SKU)でグループ化された出荷管理のレコード", groupedShippingRecords);
            // 案件グループIDでループ
            for (const groupId in groupedShippingRecords)
            {
                let shippingRecs = groupedShippingRecords[groupId];

                // 注文日ごとの数量を取得
                let arrAmount = [];
                for (let ii = 0; ii < shippingRecs.length; ii++)
                {
                    let shippingRec = shippingRecs[ii];
                    let orderDate = shippingRec.注文日.value;
                    let orderQuantity = shippingRec.数量.value;
                    arrAmount.push({ 注文日: orderDate, 数量: orderQuantity });

                    // カウント済みにする
                    shippingRec.発注数管理にカウント.value = '済';
                }

                arrAllOrderNums.push({ 案件グループID: groupId, 注文日ごとの数量: arrAmount });
            }
            console.log("注文日ごとの数量", arrAllOrderNums);



            /* 発注数管理に必要なフィールド
            案件管理レコードID
            セット数管理ID
            最短賞味期限
            日付
            day_1～day_31
            最終申込日
            */

            let updateRecords = [];

            for (let ii = 0; ii < arrAllOrderNums.length; ii++)	
            {
                let shippingRec = arrAllOrderNums[ii];
                // 案件レコードを取得
                let matRec = matterRecords.find(rec => rec.案件グループID.value == shippingRec.案件グループID && rec.掲載媒体名.value == "eecoto");
                if (!matRec) continue;

                for (let jj = 0; jj < shippingRec.注文日ごとの数量.length; jj++)
                {
                    let dtOrder = luxon.DateTime.fromFormat(shippingRec.注文日ごとの数量[jj].注文日, 'yyyy-MM-dd');
                    let dtFirst = dtOrder.set({ day: 1 });

                    // 発注数管理から案件管理レコードID＆日付でレコードを取得
                    let orderNumberRec = orderNumberRecords.find(rec => rec.案件管理レコードID.value == matRec.$id.value && rec.日付.value == dtFirst.toFormat('yyyy-MM-dd'));
                    if (!orderNumberRec)
                    {
                        // 発注数管理のレコードが無い場合、新規作成
                        let respAdd = await client.record.addRecord({
                            app: APP_ID,
                            record: {
                                "案件管理レコードID": { value: matRec.$id.value },
                                "日付": { value: dtFirst.toFormat('yyyy-MM-dd') }
                            }
                        });

                        let respGet = await client.record.getRecord({
                            app: APP_ID,
                            id: respAdd.id
                        });
                        orderNumberRec = respGet.record;
                    }

                    // 発注数管理に申込数を加算
                    let numDay = dtOrder.get('day');
                    orderNumberRec[`day_${numDay}`].value = Number(orderNumberRec[`day_${numDay}`].value) + Number(shippingRec.注文日ごとの数量[jj].数量);

                    console.log("更新後の発注数管理のレコード", orderNumberRec);
                    updateRecords.push(orderNumberRec);
                }
            }

            // 発注数管理の更新用のデータを生成
            let upOrderNumData = [];
            for (let ii = 0; ii < updateRecords.length; ii++)
            {
                let rec = updateRecords[ii];
                upOrderNumData.push({
                    id: rec.$id.value,
                    record: {
                        ...Array.from({ length: 31 }, (_, i) => ({
                            [`day_${i + 1}`]: { value: rec[`day_${i + 1}`].value }
                        })).reduce((acc, curr) => ({ ...acc, ...curr }), {}),
                    }
                });
            }

            console.log("更新する発注数管理のレコード", upOrderNumData);
            // 発注数管理のレコードを更新
            let respUpdate = await client.record.updateAllRecords({
                app: APP_ID,
                records: upOrderNumData
            });

            // 出荷管理の更新用のデータを生成
            let upShippingData = [];
            for (let ii = 0; ii < shippingManageRecords.length; ii++)
            {
                let rec = shippingManageRecords[ii];
                if (rec.発注数管理にカウント.value !== '済') continue;
                upShippingData.push({
                    id: rec.$id.value,
                    record: {
                        "発注数管理にカウント": { value: '済' }
                    }
                });
            }

            console.log("更新する出荷管理のレコード", upShippingData);
            // 出荷管理のレコードを更新
            let respUpdateShipping = await client.record.updateAllRecords({
                app: HC_APP_ID_SHIPPING_EECOTO,
                records: upShippingData
            });

            resParam.message = 'BEAUTHの注文数を収集しました。';

        }
        catch (error)
        {
            console.log(error);
            resParam.message = 'BEAUTHの注文数の取得に失敗しました。';
        }
        finally
        {
            spinner.close();
            await Swal.fire({
                title: 'BEAUTHの注文数の収集',
                text: resParam.message,
            });
            location.reload(true);
        }
    }



    /**
     * 一覧表示イベント
     * @returns 
     */
    kintone.events.on('app.record.index.show', async (event) =>
    {
        if (event.viewId != 6428024) return event;

        // ボタン
        if (document.getElementById('hc_button_1') !== null) return;
        var button1 = document.createElement('button');
        button1.id = 'hc_button_1';
        button1.classList.add('kintoneplugin-button-normal');
        button1.innerText = '出荷管理BEAUTHから発注数を収集';
        kintone.app.getHeaderMenuSpaceElement().appendChild(button1);

        button1.onclick = async () =>
        {
            resParam = { status: 1, message: '' }
            await GatherShippingManageRecords_Main();
        };

        return event;
    });

})();