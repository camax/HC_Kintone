/**
 * セット数に増減数量を案件レコードに反映させる
 */
(() =>
{
    "use strict";

    const HC_MATTER_APP_ID = HC.apps.案件管理.id;

    const client = new KintoneRestAPIClient();

    let resParam = {
        code: 0,
        message: ""
    }


    /**
     * 案件管理のレコードを取得
     * @param {*} groupId 
     * @returns 
     */
    const getMatterRecords = async (groupId) =>
    {
        try
        {
            let queStr = '案件グループID = "@num"'.replace('@num', groupId);
            let resp = await client.record.getRecords({
                app: HC_MATTER_APP_ID,
                query: queStr,
            });
            return resp.records;
        }
        catch (error)
        {
            resParam.code = 1;
            resParam.message = "案件管理アプリから案件グループIDが一致するレコードの取得に失敗しました。\n\n" + error.message;
        }
    };

    /**
     * 案件管理のレコードを一括更新
     * @param {*} recData 
     * @returns 
     */
    const UpdateMatterRecords = async (recData) =>
    {
        try
        {
            let resp = await client.record.updateAllRecords({
                app: HC_MATTER_APP_ID,
                records: recData
            });
            return resp;
        }
        catch (error)
        {
            resParam.code = 1;
            resParam.message = "案件管理のレコード更新に失敗しました。\n\n" + error.message;
        }
    };

    /**
     * セット数管理のレコードを更新
     * @param {*} recData 
     * @returns 
     */
    const UpdateSetNumRecord = async (recData) =>
    {
        try
        {
            let resp = await client.record.updateRecord({
                app: kintone.app.getId(),
                id: recData.id,
                record: recData.record
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
     * 案件管理のセット数にセット数管理のセット数を反映させるメイン処理
     * @param {*} record 
     * @returns 
     */
    const Main_UpdateMatterSetNum = async (records) =>
    {
        for (let ii = 0; ii < records.length; ii++)
        {
            let setRec = records[ii];

            let matterGroupId = setRec['案件グループID'].value;
            console.log(matterGroupId);
            if (!matterGroupId) continue;

            // 案件グループIDから案件レコードを取得（複数）
            let matterRecords = await getMatterRecords(matterGroupId);
            console.log(matterRecords);
            if (!matterRecords.length) continue;

            // 更新用のデータ
            let updateData = [];

            // 案件レコードのセット数を変更
            matterRecords.forEach(matRec =>
            {
                matRec['セット数'].value = setRec['セット数_' + matRec['掲載媒体名'].value].value;

                // 案件管理の更新用データを格納
                updateData.push({
                    'id': matRec.$id.value,
                    'record': {
                        'セット数': { value: setRec['セット数_' + matRec['掲載媒体名'].value].value },
                        'ステータス変更ユーザー': { value: [{ code: kintone.getLoginUser().code }] }
                    }
                });
            });

            console.log(updateData);
            if (updateData.length == 0) continue;

            // 案件管理のレコードを一括更新
            let resUpdateM = await UpdateMatterRecords(updateData);
            console.log(resUpdateM);

            if (resParam.code) continue;

            // セット数管理の更新用データ
            let updateDataSetNum = {
                'id': setRec.$id.value,
                'record': { '案件管理にセット数を反映': { 'value': ["反映済み"] } }
            };
            // セット数管理のレコードを更新
            let resUpdateS = await UpdateSetNumRecord(updateDataSetNum);
            console.log(resUpdateS);
        }

        if (resParam.code) return;

        resParam.code = 0;
        resParam.message = "案件管理にセット数を反映しました。";

        return;
    }

    kintone.events.on('app.record.index.show', function (event)
    {
        if (event.viewId != 6425660) return event;
        if (document.getElementById('hc_button_1') !== null) return event;

        var button1 = document.createElement('button');
        button1.id = 'hc_button_1';
        button1.innerText = '案件管理のセット数を更新';
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
                title: '案件管理のセット数を更新します。',
                icon: 'info',
                buttons: true

            }).then(async (isOkButton) =>
            {
                if (isOkButton)
                {
                    spinner.open();

                    try
                    {
                        await Main_UpdateMatterSetNum(event.records);
                    } catch (error)
                    {
                        console.log(error);
                    } finally
                    {
                        spinner.close();
                        let iconRes = 'success';
                        if (resParam.code != 0) iconRes = 'error';
                        await swal({
                            title: '案件管理のセット数を更新',
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

