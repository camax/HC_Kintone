/**
 * 総セット数変更履歴テーブルの列を編集不可にする
 * 各モールのセット数を編集不可にする
 */
(() =>
{
    "use strict";


    kintone.events.on(["app.record.create.show", "app.record.edit.show"], (event) =>
    {
        event.record.総セット数変更履歴.value.forEach((row) =>
        {
            row.value.変更日.disabled = true;
            row.value.追加発注の発注書.disabled = true;
        });

        event.record.セット数_au.disabled = true;
        event.record.セット数_Tサンプル.disabled = true;
        event.record.セット数_くまポン.disabled = true;
        event.record.セット数_FiNC.disabled = true;
        event.record.セット数_eecoto.disabled = true;
        event.record.セット数_リロ.disabled = true;
        event.record.セット数_ベネ.disabled = true;
        event.record.セット数_おためし.disabled = true;
        event.record.セット数_Tポイント.disabled = true;
        event.record.セット数_社販.disabled = true;
        event.record.セット数_モラタメ.disabled = true;
        event.record.セット数_坂戸以外.disabled = true;

        return event;
    });


    kintone.events.on(["app.record.create.change.総セット数変更履歴", "app.record.edit.change.総セット数変更履歴"], (event) =>
    {
        // 行を削除した時はエラーが出ないようにevent.changes.rowが存在しているかどうか確認。
        if (event.changes.row)
        {
            event.changes.row.value.変更日.disabled = true;
            event.changes.row.value.追加発注の発注書.disabled = true;
        }
        return event;
    });


})();

