/**
 * 追加発注の発注書の発行を確認し、
 * セット数管理のセット数に増減数量を反映させる
 */
(() =>
{
    "use strict";

    const HC_ORDER_APP_ID = HC.apps.発注書.id;

    const client = new KintoneRestAPIClient();

    let resParam = {
        code: 0,
        message: ""
    }


    /**
     * 発注書のレコードを取得
     * @param {*} recNums 
     * @returns 
     */
    const getOrderRecords = async (recNums) =>
    {
        try
        {
            let queStr = '発注番号 = "@num"'.replace('@num', recNums[0]);
            for (let ii = 1; ii < recNums.length; ii++)
            {
                queStr += ' or 発注番号 = "@num"'.replace('@num', recNums[ii]);
            }
            let resp = await client.record.getRecords({
                app: HC_ORDER_APP_ID,
                query: queStr,
            });
            return resp.records;
        }
        catch (error)
        {
            resParam.code = 1;
            resParam.message = "発注書アプリから発注番号が一致するレコードの取得に失敗しました。\n\n" + error.message;
        }
    };

    /**
     * セット数管理のレコードを一括更新
     * @param {*} recData 
     * @returns 
     */
    const UpdateSetNumRecords = async (recData) =>
    {
        try
        {
            let resp = await client.record.updateAllRecords({
                app: kintone.app.getId(),
                records: recData
            });
            return resp;
        }
        catch (error)
        {
            resParam.code = 1;
            resParam.message = "セット数管理のレコード更新に失敗しました。\n\n" + error.message;
        }
    };


    /**
     * 追加発注の発注書の発行を確認し、セット数管理のセット数に増減数量を反映させるメイン処理
     * @param {*} record 
     * @returns 
     */
    const Main_CheckAndUpdate = async (records) =>
    {
        // 更新用のデータ
        let updateData = [];

        for (let ii = 0; ii < records.length; ii++)
        {
            let rec = records[ii];

            // 追加発注のテーブル行
            let orderRows = rec["総セット数変更履歴"].value.filter(row =>
            {
                if (!row.value["変更日"].value && Number(row.value["増減数量"].value) >= 1 &&
                    row.value["変更元"].value == "" && row.value["変更先"].value != "" &&
                    row.value["追加発注の発注書"].value) return row;
            });
            if (!orderRows.length) continue;

            // 追加発注の発注書番号
            let orderNums = orderRows.map(row => { return row.value["追加発注の発注書"].value });
            orderNums = [...new Set(orderNums)];

            // 追加発注の発注書を取得（複数）
            let orderRecs = await getOrderRecords(orderNums);
            console.log(orderRecs);
            if (!orderRecs.length) continue;

            for (let ii = 0; ii < orderRecs.length; ii++)
            {
                // 発注書の発行を確認
                if (!orderRecs[ii]["発注書ドライブ保存日"].value) continue;

                for (let jj = 0; jj < rec["総セット数変更履歴"].value.length; jj++)
                {
                    if (rec["総セット数変更履歴"].value[jj].value["追加発注の発注書"].value == orderRecs[ii]["発注番号"].value)
                    {
                        rec["総セット数変更履歴"].value[jj].value["変更日"].value = orderRecs[ii]["発注書ドライブ保存日"].value;
                        // セット数を反映
                        let mallName = "";
                        switch (rec["総セット数変更履歴"].value[jj].value["変更先"].value)
                        {
                            case "リロクラブ":
                                mallName = "リロ";
                                break;
                            case "ベネフィットワン":
                                mallName = "ベネ";
                                break;
                            case "Tポイント商品交換":
                                mallName = "Tポイント";
                                break;
                            case "社内販売ネットモール":
                                mallName = "社販";
                                break;
                            default:
                                mallName = rec["総セット数変更履歴"].value[jj].value["変更先"].value;
                        }
                        rec["セット数_" + mallName].value = Number(rec["セット数_" + mallName].value) + Number(rec["総セット数変更履歴"].value[jj].value["増減数量"].value);
                    }
                }
            }

            // 更新用データを格納
            updateData.push({
                'id': rec.$id.value,
                'record': {
                    '案件管理にセット数を反映': { value: [] },
                    '総セット数変更履歴': { value: rec["総セット数変更履歴"].value },
                    'セット数_au': { value: rec["セット数_au"].value },
                    'セット数_Tサンプル': { value: rec["セット数_Tサンプル"].value },
                    'セット数_くまポン': { value: rec["セット数_くまポン"].value },
                    'セット数_eecoto': { value: rec["セット数_eecoto"].value },
                    'セット数_リロ': { value: rec["セット数_リロ"].value },
                    'セット数_ベネ': { value: rec["セット数_ベネ"].value },
                    'セット数_おためし': { value: rec["セット数_おためし"].value },
                    'セット数_Tポイント': { value: rec["セット数_Tポイント"].value },
                    'セット数_社販': { value: rec["セット数_社販"].value }
                }
            });
        }

        console.log(updateData);
        if (updateData.length == 0)
        {
            resParam.code = 0;
            resParam.message = "追加発注の発行書で発注済みのものはありませんでした。";
            return;
        }

        // セット数管理のレコードを一括更新
        let resUpdate = await UpdateSetNumRecords(updateData);
        console.log(resUpdate);

        resParam.code = 0;
        resParam.message = "追加発注の発注書の発行を確認し、\n各モールのセット数に増減数量を反映しました。";

        return;
    }

    kintone.events.on('app.record.index.show', function (event)
    {
        if (event.viewId != 6425644) return event;
        if (document.getElementById('hc_button_1') !== null) return event;

        var button1 = document.createElement('button');
        button1.id = 'hc_button_1';
        button1.innerText = '発注書の発行確認';
        kintone.app.getHeaderMenuSpaceElement().appendChild(button1);

        if (event.records.length)
        {
            button1.classList.add('kintoneplugin-button-normal');
        }
        else
        {
            button1.classList.add('kintoneplugin-button-disabled');
            button1.disabled = true;
        }

        const spinner = new Kuc.Spinner({
            text: '処理中...',
            container: document.body
        });

        button1.onclick = function ()
        {
            swal({
                title: '追加発注',
                text: '追加発注の発注書の発行を確認し\n各モールのセット数に増減数量を反映させます。',
                icon: 'info',
                buttons: true

            }).then(async (isOkButton) =>
            {
                if (isOkButton)
                {
                    spinner.open();

                    try
                    {
                        await Main_CheckAndUpdate(event.records);
                    } catch (error)
                    {
                        console.log(error);
                    } finally
                    {
                        spinner.close();
                        let iconRes = 'success';
                        if (resParam.code != 0) iconRes = 'error';
                        await swal({
                            title: '追加発注',
                            text: resParam.message,
                            icon: iconRes
                        })
                        location.reload();
                    }
                }
                else
                {
                    return false;
                }
            });
        };
    });

})();

