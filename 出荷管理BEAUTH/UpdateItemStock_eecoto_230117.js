
/**
 * [eecoto]
 * 商品出荷数の更新
 *  一覧で選択されたレコードの案件に登録されている商品の出荷数を更新
 */
(() =>
{
    "use strict";

    const HC_ITEMSTOCK_APP_ID = HC.apps.商品在庫管理.id;
    const HC_MATTER_APP_ID = HC.apps.案件管理.id;

    const UpdateItemStockApp = async () =>
    {
        const client = new KintoneRestAPIClient();
        let resParam = { status: 1, message: '' };

        try
        {
            let records = await GetRecordsByList(client);
            if (records.length == 0)
            {
                return false;
            }

            let ids = [];
            let errorIds = [];
            for (let record of records)
            {

                // 出荷数更新用レコードを生成
                let reqRecords = await CreateReqRecords(record);

                if (reqRecords.errorRecordIds.length != 0) errorIds.push(...reqRecords.errorRecordIds);
                if (reqRecords.recordIds.length != 0) ids.push(...reqRecords.recordIds);

                // 出荷数の一括更新
                if (reqRecords.itemReqRecords != 0)
                {
                    resParam = await UpdateRecords(client, HC_ITEMSTOCK_APP_ID, reqRecords.itemReqRecords);
                }
            }

            if (ids.length > 0)
            {
                let statusReqRecords = GetStatasRecodes(ids);
                resParam = await UpdateRecords(client, kintone.app.getId(), statusReqRecords)
            }

            if (resParam.status == 1)
            {
                let text = '商品在庫管理アプリの出荷数を一括更新しました。\n' + ids.length + '/' + records.length;
                if (errorIds.length != 0) text += '\n 案件管理からデータが取得できなかったレコードID : \n' + errorIds.join(',');
                swal({
                    title: '出荷数の更新',
                    text: text,
                    icon: 'success',
                    timer: 10000
                }).then(function ()
                {
                    location.reload(true);
                });

            } else
            {
                swal({
                    title: '出荷数の更新',
                    text: '商品在庫管理アプリの出荷数一括更新に失敗しました。\n' + resParam.message,
                    icon: 'error',
                    timer: 10000
                }).then(function ()
                {
                    location.reload(true);
                });
            }

        } catch (ex)
        {
            console.log(ex)
            swal({
                title: '出荷数の更新',
                text: '商品在庫管理アプリの出荷数一括更新に失敗しました。\n' + ex,
                icon: 'error',
                timer: 10000
            }).then(function ()
            {
                location.reload(true);
            });
        }
    }

    /**
     * 一覧に表示されてるレコード取得
     */
    const GetRecordsByList = async (client) =>
    {
        return client.record.getAllRecordsWithCursor({
            app: kintone.app.getId(),
            query: kintone.app.getQueryCondition(),

        }).then(function (response)
        {
            return response;
        })
    };

    /**
     * 商品出荷数の更新用のレコード生成
    * @returns 
    */
    const CreateReqRecords = async record =>
    {

        let recordIds = [];
        let errorRecordIds = [];
        let itemReqRecords = [];

        let id = record['プロダクトID'].value;
        let quantity = record['数量'].value;

        // 案件管理レコードを取得
        let matterRecord = await GetMatter(id);

        if (matterRecord.length == 0)
        {
            errorRecordIds.push(record['$id'].value);
        }
        else
        {
            // 商品IDを取得
            for (let i = 1; i <= 10; i++)
            {
                let code = matterRecord[0]['商品コード_' + i].value;
                if (!code) continue;

                // 対象の商品コードを取得
                let itemRecordCode = code;

                // 商品在庫管理レコードを取得
                let itemRecord = await GetItem(itemRecordCode);
                //商品出荷数を更新
                if (itemRecord.length != 0)
                {
                    //商品のセット入数を取得
                    let individualNum = matterRecord[0]['セット入数_' + i].value

                    if (individualNum || individualNum != 0)
                    {
                        // 追加分の出荷数 (総セットバラ数)
                        let diffIndividualNum = quantity * individualNum;

                        // 出荷数に追加分を加算
                        let sumNum = Number(itemRecord[0]["出荷数"].value) + Number(diffIndividualNum);

                        // 納品履歴テーブル用の配列を作成（出荷バラ数を更新）
                        let tableHistory = CreateHistoryTable(itemRecord[0]["納品履歴"].value, Number(diffIndividualNum));

                        // 出荷数更新レコード
                        itemReqRecords.push({
                            "id": itemRecord[0]['$id'].value,
                            "record": {
                                "出荷数": {
                                    "value": sumNum
                                },
                                "納品履歴": {
                                    "value": tableHistory
                                }
                            }
                        })
                    }
                }
            }

            // 更新対象となったレコードId
            recordIds.push(record['$id'].value);
        }

        let res = {
            itemReqRecords,
            errorRecordIds,
            recordIds
        }
        return res;
    };


    /**
      * 案件管理レコードを取得
      * @param  itemRecordCode 
      */
    const GetMatter = async (id) =>
    {

        return await new KintoneRestAPIClient().record.getRecords({
            app: HC_MATTER_APP_ID,
            query: 'モール管理番号 = "@id"'.replace('@id', id),
        })
            .then(function (resp)
            {
                return resp.records;
            }).catch(function (err)
            {
                console.log(err);
            });
    };

    /**
      * 商品在庫管理から出荷数を取得
      * @param  itemRecordCode 
      */
    const GetItem = async (itemRecordCode) =>
    {

        return await new KintoneRestAPIClient().record.getRecords({
            app: HC_ITEMSTOCK_APP_ID,
            fields: ["出荷数", "納品履歴", "$id"],
            query: '商品コード = "@id"'.replace('@id', itemRecordCode),
        })
            .then(function (resp)
            {
                return resp.records;
            }).catch(function (err)
            {
                console.log(err);
            });
    };

    /**
      * 納品履歴テーブル用の配列を作成
      * @param  tableOriginal 
      * @param  shipAmount
      */
    const CreateHistoryTable = (tableOriginal, shipAmount) =>
    {
        let resTable = tableOriginal;
        let nextShip = shipAmount;

        // 賞味期限の短い順でソートする
        resTable.sort((a, b) =>
        {
            if (a.value["納品時の賞味期限"].value === null) { return 1; }
            if (b.value["納品時の賞味期限"].value === null) { return -1; }
            if (a.value["納品時の賞味期限"].value === b.in) { return 0; }
            return a.value["納品時の賞味期限"].value < b.value["納品時の賞味期限"].value ? -1 : 1;
        });

        // ソートしたテーブルの行数でループ
        for (let ii = 0; ii < resTable.length; ii++)
        {
            let sumShip = nextShip + Number(resTable[ii].value["出荷バラ数"].value);
            let diffShip = sumShip - Number(resTable[ii].value["納品バラ数"].value);
            if (diffShip <= 0)
            {
                resTable[ii].value["出荷バラ数"].value = sumShip;
                nextShip = 0;
            }
            else
            {
                resTable[ii].value["出荷バラ数"].value = resTable[ii].value["納品バラ数"].value;
                nextShip = diffShip;
            }
        }
        return resTable;
    };

    /**
     * ステータス更新レコードの生成
     * @param {*} ids 
     * @returns 
     */
    const GetStatasRecodes = ids =>
    {
        let reqRecords = [];
        for (let id of ids)
        {
            reqRecords.push({
                "id": id,
                "record": {
                    "運用ステータス": {
                        "value": '出荷数更新済み'
                    }
                }
            })
        }
        return reqRecords;
    };

    /**
     * レコード一括更新
     */
    const UpdateRecords = async (client, appId, reqRecords) =>
    {
        try
        {
            return client.record.updateAllRecords({
                app: appId,
                records: reqRecords
            })
                .then(async function (resp)
                {
                    console.log(resp);
                    return { status: 1 }

                }).catch(function (e)
                {
                    console.log(e);
                    return { status: 9, message: e }
                });

        }
        catch (ex)
        {
            console.log(ex);
            return { status: 9, message: e }
        }
    };


    kintone.events.on('app.record.index.show', function (event)
    {

        if (event.viewName === '出荷数更新')
        {
            if (document.getElementById('hc_button_1') !== null)
            {
                return;
            }

            var button2 = document.createElement('button');
            button2.id = 'hc_button_1';
            button2.classList.add('kintoneplugin-button-normal');
            button2.innerText = '商品在庫数を更新';
            kintone.app.getHeaderMenuSpaceElement().appendChild(button2);

            const spinner = new Kuc.Spinner({
                text: '処理中...',
                container: document.body
            });

            button2.onclick = function ()
            {
                swal({
                    title: '出荷数更新',
                    text: '一覧に表示されているレコードの商品在庫数を一括更新',
                    icon: 'info',
                    buttons: true

                }).then(async (isOkButton) =>
                {
                    if (isOkButton)
                    {
                        spinner.open();

                        try
                        {
                            await UpdateItemStockApp();
                        } catch (error)
                        {
                            console.log(error);
                        } finally
                        {
                            spinner.close();
                        }

                    } else
                    {
                        return false;
                    }
                });
            };

            var targetField = document.getElementById('hc_button_1');
            tippy(targetField, {
                content: '出荷が終わった商品の在庫数を一括更新',
                arrow: true
            });
        }
    });

})();

