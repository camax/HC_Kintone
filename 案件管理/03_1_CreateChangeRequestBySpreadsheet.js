
/**
 * 案件管理をスプレッドシート形式で一覧表示し、
 * チェックボックスONについて、変更依頼管理へレコードを作成
 */

(() =>
{
    "use strict";

    const HC_CHANGE_REQUEST_APP_ID = HC.apps.変更依頼管理.id;
    const HC_DOMAIN = HC.domain.url;

    const client = new KintoneRestAPIClient();
    let resParam = { status: 1, message: '' }
    let spSheet;

    const spinner = new Kuc.Spinner({
        text: '処理中...',
        container: document.body
    });



    /**
     * レコード作成用のデータを生成
     * @param {*} data 
     * @returns 
     */
    const CreateRecData = (data) =>
    {
        let filterRes = data.filter(value => value[0] === true);
        if (filterRes.length === 0)
        {
            resParam.status = 9;
            resParam.message = "チェックボックスがONのレコードがありません。";
            return;
        }

        let reqGroupId = "CR-" + luxon.DateTime.local().toFormat('yyyyMMddHHmmss');

        let res = filterRes.map(val =>
        {
            return {
                '変更依頼グループID': { value: reqGroupId },
                '案件レコードID': { value: val[1] },
                '掲載終了日_変更後': { value: val[8] },
                '最短賞味期限_変更後': { value: val[9] },
                '初回発送日_変更後': { value: val[10] },
                'セット数_変更後': { value: val[11] }
            }
        });
        return res;
    }

    /**
     * 変更依頼管理にレコードを作成
     * @param {*} body 
     * @returns 
     */
    const AddChangeRequestRecords = async (body) =>
    {
        try
        {
            // レコード生成
            return client.record.addAllRecords({
                app: HC_CHANGE_REQUEST_APP_ID,
                records: body
            })
                .then(function (resp)
                {
                    console.log(resp);
                    return { status: 1, message: '変更依頼レコードを作成しました。' }
                })
                .catch(function (e)
                {
                    console.log(e);
                    return { status: 9, message: '変更依頼レコードの作成に失敗しました。\n' + e }
                });
        }
        catch (ex)
        {
            console.log(ex);
            return { status: 9, message: '変更依頼レコードの作成に失敗しました。\n' + ex }
        }
    };

    const CreateChangeRequestRecord_Main = async (data) =>
    {
        try
        {
            spinner.open();
            let recData = await CreateRecData(data);
            console.log(recData);
            if (resParam.status !== 1) return;

            resParam = await AddChangeRequestRecords(recData);
        }
        catch (error)
        {
            console.log(error);
        }
        finally
        {
            spinner.close();
            await swal({
                title: '変更依頼管理にレコード作成',
                text: resParam.message,
                timer: 10000
            });
            if (resParam.status === 1)
            {
                // 変更依頼管理を開く
                window.open("https://" + HC_DOMAIN + "/k/" + HC_CHANGE_REQUEST_APP_ID, '_blank');
            }
        }
    }

    /**
     * Main
     * @returns 
     */
    kintone.events.on('app.record.index.show', async function (event)
    {
        if (event.viewId != 6425844) return event;

        try
        {
            spinner.open();

            let recMatter = await client.record.getAllRecords({ app: kintone.app.getId(), condition: kintone.app.getQueryCondition() });
            //console.log(recMatter);

            let recArr = recMatter.map(rec =>
            {
                let arr = [
                    false,

                    rec.$id.value,
                    rec.案件グループID.value,
                    rec.掲載モール連携番号.value,
                    rec.モール管理番号.value,

                    rec.掲載媒体名.value,
                    rec.掲載ステータス.value,
                    rec.掲載商品名.value,

                    rec.掲載終了日.value,
                    rec.最短賞味期限.value,
                    rec.初回発送日.value,
                    rec.セット数.value,
                ];
                return arr;
            });
            //console.log(recArr);

            let ele = document.getElementById('spreadsheet');

            spSheet = jspreadsheet(ele, {
                data: recArr,
                columns: [
                    { title: ' ', type: 'checkbox', width: 36 },
                    { title: 'ID', type: 'numeric', width: 80, readOnly: true },
                    { title: '案件グループID', type: 'text', width: 150, readOnly: true },
                    { title: '掲載モール連携番号', type: 'text', width: 180, readOnly: true },
                    { title: 'モール管理番号', type: 'text', width: 200, readOnly: true },

                    { title: '掲載媒体名', type: 'text', width: 150, readOnly: true },
                    { title: '掲載ステータス', type: 'text', width: 100, readOnly: true },
                    { title: '掲載商品名', type: 'text', width: 300, align: 'left', readOnly: true },

                    { title: '掲載終了日', type: 'calendar', options: { format: 'YYYY/MM/DD' }, width: 100, readOnly: true },
                    { title: '最短賞味期限', type: 'calendar', options: { format: 'YYYY/MM/DD' }, width: 100, readOnly: true },
                    { title: '初回発送日', type: 'calendar', options: { format: 'YYYY/MM/DD' }, width: 100, readOnly: true },
                    { title: 'セット数', type: 'numeric', width: 80, readOnly: true }
                ],
                allowInsertColumn: false,
                allowInsertRow: false,
                allowDeleteColumn: false,
                allowDeleteRow: false,
                contextMenu: false,
                filters: true,
            });
        }
        catch (error)
        {
            console.log(error);
        }
        finally
        {
            spinner.close();
        }


        // ボタン
        if (document.getElementById('hc_button_1') !== null) return;
        var button1 = document.createElement('button');
        button1.id = 'hc_button_1';
        button1.classList.add('kintoneplugin-button-normal');
        button1.innerText = '変更依頼レコード作成';
        kintone.app.getHeaderMenuSpaceElement().appendChild(button1);

        button1.onclick = async () =>
        {
            resParam = { status: 1, message: '' }
            await CreateChangeRequestRecord_Main(spSheet.getData());
        };

        return event;
    });

})();