/**
 * BtoB伝票番号取込済から、対象月を選び、ピッキング費用の明細を出力する
 */
(() => {
  'use strict';
  luxon.Settings.defaultLocale = 'ja';

  const client = new KintoneRestAPIClient();
  const APP_ID = kintone.app.getId();
  const FILE_NAME = '_BtoB_ピッキング明細';

  const spinner = new Kuc.Spinner({
    text: '処理中...',
    container: document.body,
  });

  let resParam = { status: 1, message: '' };

  // ピッキング明細のCSVの項目
  let pickingFields = {
    掲載商品名: '掲載商品名',
    商品コード: '商品コード', // 商品情報テーブル
    JAN: 'JAN', // 商品情報テーブル
    商品名: '商品名', // 商品情報テーブル
    セット入数: 'セット入数', // 商品情報テーブル
    注文数: '注文数',
    個数: '個数', // 商品情報テーブル
    ピッキング単価: 'ピッキング単価', // 商品情報テーブル
    注文数xピッキング単価: '注文数xピッキング単価', // 商品情報テーブル
    発送形式: '発送形式',
    発送日: '発送日',
  };

  let targetDuration = [];
  let dtNow = luxon.DateTime.local();

  /**
   * 対象のレコードを取得する
   * @param {*} duration
   * @returns
   */
  const GetTargetRecords = async (duration) => {
    try {
      let strCondition = `伝票番号CSVの取込日 != "" and
				発送日 != "" and
				伝票番号 != "" and
				BtoB = "1" and
				納品タイプ != "直納" and
				発送日 >= "${duration[0]}" and
				発送日 <= "${duration[1]}"`;
      let strOrder = `発送日 asc`;
      return await client.record.getAllRecords({ app: APP_ID, condition: strCondition, orderBy: strOrder });
    } catch (error) {
      resParam.status = 9;
      resParam.message = '対象のレコードを取得する処理に失敗しました。\n\n' + error.message;
    }
  };

  /**
   * レコードから商品ごとのデータに変換
   * @param {*} records
   * @returns
   */
  const FlattenRecords = (records) => {
    let flatData = [];
    for (const record of records) {
      if (record.商品情報.value.length == 0) continue;

      let commonRow = {};
      for (const key in record) {
        if (record.hasOwnProperty(key)) {
          commonRow[key] = record[key];
        }
      }

      for (let ii = 0; ii < record.商品情報.value.length; ii++) {
        let item = record.商品情報.value[ii].value;
        let itemRow = {};
        for (const key in item) {
          itemRow[key] = item[key];
        }
        flatData.push(Object.assign({}, commonRow, itemRow));
      }
    }
    return flatData;
  };

  /**
   * JSONをカンマ区切りのCSV形式に変換
   */
  const JsonToCSV = (json) => {
    let header = '"' + Object.keys(pickingFields).join('","') + '"\n';

    let body = json
      .map((row) => {
        let strRow = Object.values(pickingFields)
          .map((item) => {
            if (item === '') return '';

            let val = '';

            if (item === 'ピッキング単価') {
              const format = row['発送形式']?.value || '';
              if (format === 'ボール発送') {
                val = '10';
              } else if (format === '2ボール結束発送') {
                val = '20';
              } else {
                val = row[item]?.value || '0';
              }
            } else if (item === '注文数xピッキング単価') {
              const qty = Number(row['注文数']?.value || 0);
              const format = row['発送形式']?.value || '';
              let unit = 0;
              if (format === 'ボール発送') unit = 10;
              else if (format === '2ボール結束発送') unit = 20;
              else unit = Number(row['ピッキング単価']?.value || 0);
              val = String(qty * unit);
            } else {
              val = row[item]?.value || '';
            }

            if (val) val = String(val).replace(/\"/g, '""');
            return val;
          })
          .join('","');
        return '"' + strRow + '"';
      })
      .join('\n');

    return header + body;
  };

  /**
   * CSVファイルを出力
   */
  const exportCSV = (csvData, filename) => {
    //出力ファイル名
    var exportedFilenmae = (filename || 'exportCSV') + '.csv';

    //BLOBに変換
    var bom = new Uint8Array([0xef, 0xbb, 0xbf]); //ここでUTF-8を指定
    var blob = new Blob([bom, csvData], { type: 'text/csv;charset=utf-8' });

    //anchorを生成してclickイベントを呼び出す。
    var link = document.createElement('a');
    if (link.download !== undefined) {
      var url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', exportedFilenmae);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  /**
   * ピッキング明細を出力する Main
   * @param {*}
   * @returns
   */
  const ExportPickingDetails_Main = async () => {
    try {
      spinner.open();

      resParam.status = 1;

      console.log('対象の月', targetDuration);
      if (targetDuration.length == 0) {
        resParam.status = 9;
        resParam.message = '対象の月が選択されていません。';
        return;
      }

      // 対象のレコードを取得
      let records = await GetTargetRecords(targetDuration);
      console.log('対象のレコード', records);
      if (resParam.status != 1) return;
      if (records.length == 0) {
        resParam.message = '対象のレコードがありません。';
        return;
      }

      //  レコードから商品ごとのデータに変換
      let flatData = await FlattenRecords(records);
      console.log('商品ごとのレコード', flatData);
      if (resParam.status != 1) return;
      if (flatData.length == 0) {
        resParam.message = '商品ごとのレコードがありません。';
        return;
      }

      // 商品ごとのデータをカンマ区切りのCSV形式に変換
      let csvData = JsonToCSV(flatData);
      //console.log("CSVデータ", csvData);

      // CSVを出力
      await exportCSV(csvData, dtNow.toFormat('yyyyMMdd') + FILE_NAME + '_' + targetDuration[0].toFormat('yyyy年MM月'));

      resParam.message = 'BtoBピッキング明細を出力しました。';
    } catch (ex) {
      console.log(ex);
      resParam.message = 'BtoBピッキング明細の出力に失敗しました。\n\n' + ex.message;
    } finally {
      spinner.close();

      await Swal.fire({
        title: 'BtoBピッキング明細を出力',
        text: resParam.message,
      });
    }
  };

  kintone.events.on('app.record.index.show', async function (event) {
    if (event.viewId != 6427852) return event;

    // ボタン
    if (!document.getElementById('hc_button_picking')) {
      var button1 = document.createElement('button');
      button1.id = 'hc_button_picking';
      button1.classList.add('kintoneplugin-button-dialog-ok');
      button1.innerText = 'BtoBピッキング明細を出力';
      kintone.app.getHeaderMenuSpaceElement().appendChild(button1);

      button1.onclick = async () => {
        let optMonth = { 今月: '今月', 先月: '先月', 先々月: '先々月' };

        const { value: selMonth } = await Swal.fire({
          title: '出力対象の月を選択',
          input: 'select',
          inputOptions: optMonth,
          inputPlaceholder: '月を選択してください',
          showCancelButton: true,
          inputValidator: (value) => {
            return new Promise((resolve) => {
              if (value) {
                resolve();
              } else {
                resolve('選択してください');
              }
            });
          },
        });

        if (!selMonth) {
          resParam.message = '月の選択がキャンセルされました。';
          await Swal.fire({
            title: 'BtoBピッキング明細を出力',
            text: resParam.message,
            timer: 5000,
            timerProgressBar: true,
            willClose: () => {},
          });
          return;
        }

        targetDuration = [];
        switch (selMonth) {
          case '今月':
            targetDuration = [luxon.DateTime.local().startOf('month'), luxon.DateTime.local().endOf('month')];
            break;
          case '先月':
            targetDuration = [luxon.DateTime.local().minus({ months: 1 }).startOf('month'), luxon.DateTime.local().minus({ months: 1 }).endOf('month')];
            break;
          case '先々月':
            targetDuration = [luxon.DateTime.local().minus({ months: 2 }).startOf('month'), luxon.DateTime.local().minus({ months: 2 }).endOf('month')];
            break;
        }

        await ExportPickingDetails_Main();
      };
    }
  });
})();
