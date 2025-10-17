/**
 * 総セット数変更履歴テーブルに入力されている値を、各モールのセット数に反映させる
 * 「各モールのセット数を更新」ボタンで開始
 * 総セット数変更履歴テーブルの「変更日」が未入力のもの
 */
(() =>
{
    "use strict";

    const client = new KintoneRestAPIClient();
    const APP_ID = kintone.app.getId();

    let resParam = { status: 0, message: '' }


    /**
     * 変更履歴テーブルに入力された増減数を各モールのセット数に反映する
     * @param {*} rec 
     * @returns 
     */
    const ApplySetNumFromTable_Main = async (rec) =>
    {
        try
        {
            let ChangeFlag = false;

            // 総セット数変更履歴テーブルから、変更日が未入力に対して、セット数増減を反映
            rec.総セット数変更履歴.value.forEach((row) =>
            {
                if (!row.value.変更日.value)
                {
                    ChangeFlag = true;
                    row.value.変更日.value = luxon.DateTime.local().toFormat('yyyy-MM-dd');

                    switch (row.value.変更元.value)
                    {
                        case "au":
                            rec.セット数_au.value = Number(rec.セット数_au.value) - Number(row.value.増減数量.value);
                            break;
                        case "Tサンプル":
                            rec.セット数_Tサンプル.value = Number(rec.セット数_Tサンプル.value) - Number(row.value.増減数量.value);
                            break;
                        case "くまポン":
                            rec.セット数_くまポン.value = Number(rec.セット数_くまポン.value) - Number(row.value.増減数量.value);
                            break;
                        case "eecoto":
                            rec.セット数_eecoto.value = Number(rec.セット数_eecoto.value) - Number(row.value.増減数量.value);
                            break;
                        case "リロクラブ":
                            rec.セット数_リロ.value = Number(rec.セット数_リロ.value) - Number(row.value.増減数量.value);
                            break;
                        case "ベネフィットワン":
                            rec.セット数_ベネ.value = Number(rec.セット数_ベネ.value) - Number(row.value.増減数量.value);
                            break;
                        case "おためし":
                            rec.セット数_おためし.value = Number(rec.セット数_おためし.value) - Number(row.value.増減数量.value);
                            break;
                        case "Tポイント商品交換":
                            rec.セット数_Tポイント.value = Number(rec.セット数_Tポイント.value) - Number(row.value.増減数量.value);
                            break;
                        case "社内販売ネットモール":
                            rec.セット数_社販.value = Number(rec.セット数_社販.value) - Number(row.value.増減数量.value);
                            break;
                        case "モラタメ":
                            rec.セット数_モラタメ.value = Number(rec.セット数_モラタメ.value) - Number(row.value.増減数量.value);
                            break;
                        case "坂戸以外":
                            rec.セット数_坂戸以外.value = Number(rec.セット数_坂戸以外.value) - Number(row.value.増減数量.value);
                            break;
                        default:
                            break;
                    }

                    switch (row.value.変更先.value)
                    {
                        case "au":
                            rec.セット数_au.value = Number(rec.セット数_au.value) + Number(row.value.増減数量.value);
                            break;
                        case "Tサンプル":
                            rec.セット数_Tサンプル.value = Number(rec.セット数_Tサンプル.value) + Number(row.value.増減数量.value);
                            break;
                        case "くまポン":
                            rec.セット数_くまポン.value = Number(rec.セット数_くまポン.value) + Number(row.value.増減数量.value);
                            break;
                        case "eecoto":
                            rec.セット数_eecoto.value = Number(rec.セット数_eecoto.value) + Number(row.value.増減数量.value);
                            break;
                        case "リロクラブ":
                            rec.セット数_リロ.value = Number(rec.セット数_リロ.value) + Number(row.value.増減数量.value);
                            break;
                        case "ベネフィットワン":
                            rec.セット数_ベネ.value = Number(rec.セット数_ベネ.value) + Number(row.value.増減数量.value);
                            break;
                        case "おためし":
                            rec.セット数_おためし.value = Number(rec.セット数_おためし.value) + Number(row.value.増減数量.value);
                            break;
                        case "Tポイント商品交換":
                            rec.セット数_Tポイント.value = Number(rec.セット数_Tポイント.value) + Number(row.value.増減数量.value);
                            break;
                        case "社内販売ネットモール":
                            rec.セット数_社販.value = Number(rec.セット数_社販.value) + Number(row.value.増減数量.value);
                            break;
                        case "モラタメ":
                            rec.セット数_モラタメ.value = Number(rec.セット数_モラタメ.value) + Number(row.value.増減数量.value);
                            break;
                        case "坂戸以外":
                            rec.セット数_坂戸以外.value = Number(rec.セット数_坂戸以外.value) + Number(row.value.増減数量.value);
                            break;
                        default:
                            break;
                    }
                }
            });


            if (ChangeFlag == false)
            {
                resParam.message = "更新するデータがありません。";
                return;
            }

            // レコードを更新
            let recData = {
                総セット数変更履歴: { value: rec.総セット数変更履歴.value },
                セット数_au: { value: rec.セット数_au.value },
                セット数_Tサンプル: { value: rec.セット数_Tサンプル.value },
                セット数_くまポン: { value: rec.セット数_くまポン.value },
                セット数_eecoto: { value: rec.セット数_eecoto.value },
                セット数_リロ: { value: rec.セット数_リロ.value },
                セット数_ベネ: { value: rec.セット数_ベネ.value },
                セット数_おためし: { value: rec.セット数_おためし.value },
                セット数_Tポイント: { value: rec.セット数_Tポイント.value },
                セット数_社販: { value: rec.セット数_社販.value },
                セット数_モラタメ: { value: rec.セット数_モラタメ.value },
                セット数_坂戸以外: { value: rec.セット数_坂戸以外.value },
            }
            await client.record.updateRecord({ app: APP_ID, id: rec.$id.value, record: recData });
            resParam.message = "セット数を更新しました。\n";

        }
        catch (error)
        {
            resParam.status = 1;
            resParam.message = "セット数の更新に失敗しました。\n\n" + error.message;
        }
        finally
        {
            // メッセージを表示
            let iconRes = 'success';
            if (resParam.status != 0) iconRes = 'error';
            await swal({
                title: '各モールのセット数を更新',
                text: resParam.message,
                icon: iconRes
            })
            // 再表示
            location.reload();
        }
    }



    kintone.events.on('app.record.detail.show', function (event)
    {
        let record = event.record;

        let spButton = kintone.app.record.getSpaceElement('space_ApplySetNum');
        if (!spButton) return event;

        var button1 = document.createElement('button');
        button1.id = 'hc_button_1';
        button1.innerText = '各モールのセット数を更新';

        // 有無を確認（変更日が空欄）
        let arrFlag = event.record["総セット数変更履歴"].value.filter(row => { if (!row.value["変更日"].value) return row; });
        if (arrFlag.length)
        {
            button1.classList.add('kintoneplugin-button-dialog-ok');
        }
        else
        {
            button1.classList.add('kintoneplugin-button-disabled');
            button1.disabled = true;
        }

        button1.onclick = async () =>
        {
            await ApplySetNumFromTable_Main(record);
        };
        spButton.appendChild(button1);

        return event;
    });

})();

