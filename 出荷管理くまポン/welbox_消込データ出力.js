/**
 * WELBOX消込データCSVを出力する
 */
(() => {
  'use strict';
  luxon.Settings.defaultLocale = 'ja';

  const client = new KintoneRestAPIClient();
  const APP_ID = kintone.app.getId();

  const spinner = new Kuc.Spinner({
    text: '処理中...',
    container: document.body,
  });

  const csvFields = [
    { title: 'オーダーID', field: '購入番号', type: 'kintone' },
    { title: '配送業者コード', type: 'custom' },
    { title: 'その他配送業者', value: '', type: 'fixed' },
    { title: '配送方法', type: 'custom' },
    { title: '送り状No', field: '伝票No', type: 'kintone' },
    { title: '荷物お問い合わせURL', value: '', type: 'fixed' },
    { title: '出荷日', field: '発送日', type: 'kintone' },
    { title: '出荷指示日', value: '', type: 'fixed' },
    { title: '会員メッセージ備考', value: '', type: 'fixed' },
  ];

  // 今日
  let dtNow = luxon.DateTime.local();
  let resParam = { status: 1, message: '' };

  /**
   * 一覧に表示されているレコードを全て取得する
   * @returns
   */
  const GetShippingRecords = async () => {
    console.log('[WELBOX] GetShippingRecords start');
    try {
      let strQuery = kintone.app.getQuery();
      let [strCondition, strOrder] = strQuery.split(/order by|limit/i).map((part) => part.trim());
      console.log('[WELBOX] Query condition:', strCondition);
      console.log('[WELBOX] Query order:', strOrder);
      return await client.record.getAllRecords({ app: APP_ID, condition: strCondition, orderBy: strOrder });
    } catch (error) {
      resParam.status = 9;
      resParam.message = 'WELBOX消込データCSVの一覧を取得する処理に失敗しました.\n\n' + error.message;
    }
  };

  /**
   * 出力用のデータを生成
   * @param {*} records
   * @returns
   */
  const GenerateOutputData = (records) => {
    let arrData = [];
    for (let ii = 0; ii < records.length; ii++) {
      let record = records[ii];
      let dataEntry = {};
      for (const fieldDef of csvFields) {
        if (fieldDef.type === 'kintone') {
          dataEntry[fieldDef.title] = record[fieldDef.field] ? record[fieldDef.field].value : '';
        } else if (fieldDef.type === 'fixed') {
          dataEntry[fieldDef.title] = fieldDef.value;
        } else if (fieldDef.type === 'custom') {
          const shipper = record['配送業者'] ? record['配送業者'].value : '';
          if (fieldDef.title === '配送業者コード') {
            dataEntry[fieldDef.title] = shipper === '佐川急便' ? '2' : shipper === 'ゆうパケット' ? '3' : '';
          } else if (fieldDef.title === '配送方法') {
            dataEntry[fieldDef.title] = shipper === '佐川急便' ? '宅配' : shipper === 'ゆうパケット' ? '郵便' : '';
          }
        }
      }
      arrData.push(dataEntry);
    }

    return arrData;
  };

  /**
   * カンマ区切りのCSV形式に変換
   * @param {*} arrObj
   * @returns
   */
  const TransformToCSV = (arrObj) => {
    let header = '"' + csvFields.map((f) => f.title).join('","') + '"\n';

    let body = arrObj
      .map((row) => {
        let strRow = csvFields
          .map((fieldDef) => {
            let val = row[fieldDef.title]; // Use the title as key in the generated row object
            // ダブルクォーテーションをダブルクォーテーションx2に変換
            if (val) {
              val = String(val).replace(/"/g, '""');
            }
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
    let exportedFilenmae = (filename || 'exportCSV') + '.csv';

    //BLOBに変換
    let bom = new Uint8Array([0xef, 0xbb, 0xbf]);
    let blob = new Blob([bom, csvData], { type: 'text/csv;charset=utf-8' });

    //anchorを生成してclickイベントを呼び出す。
    let link = document.createElement('a');
    if (link.download !== undefined) {
      let url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', exportedFilenmae);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  /**
   * 運用ステータスを「消込データ出力済み」に変更
   * @param {*} records
   * @returns
   */
  const UpdateStatus = async (records) => {
    try {
      let arrRecords = [];
      for (let ii = 0; ii < records.length; ii++) {
        arrRecords.push({ id: records[ii].$id.value, record: { 運用ステータス: { value: '消込データ出力済み' } } });
      }
      return await client.record.updateAllRecords({ app: APP_ID, records: arrRecords });
    } catch (error) {
      resParam.status = 9;
      resParam.message = '運用ステータスを「消込データ出力済み」に変更する処理に失敗しました.\n\n' + error.message;
    }
  };

  /**
   * WELBOX消込データCSVを出力する Main
   * @returns
   */
  const ExportShippingReport_Main = async () => {
    console.log('[WELBOX] ExportShippingReport_Main started');
    try {
      spinner.open();

      resParam.status = 1;

      // 一覧に表示されているレコードを取得
      let reportRecords = await GetShippingRecords();
      console.log('[WELBOX] Retrieved records:', reportRecords ? reportRecords.length : 0);
      if (resParam.status != 1) return;

      if (reportRecords.length === 0) {
        resParam.message = '出力対象のレコードがありませんでした.';
        return;
      }

      // 出力用のデータを生成
      let arrData = GenerateOutputData(reportRecords);
      console.log('[WELBOX] Output data generated:', arrData.length);

      // カンマ区切りのCSV形式に変換
      let csvData = TransformToCSV(arrData);

      console.log('[WELBOX] Exporting CSV...');
      // CSVで書き出し
      exportCSV(csvData, dtNow.toFormat('yyyyMMdd') + '_WELBOX_消込用');

      // 運用ステータスを「消込データ出力済み」に変更
      let resp = await UpdateStatus(reportRecords);
      console.log('[WELBOX] Record status updated.');
      if (resParam.status != 1) return;

      resParam.message = 'WELBOX消込データCSVを出力しました.';
    } catch (ex) {
      console.log(ex);
      resParam.message = 'WELBOX消込データCSVの出力に失敗しました.\n\n' + ex.message;
    } finally {
      spinner.close();
      Swal.fire({
        title: 'WELBOX消込データCSVを出力',
        text: resParam.message,
      }).then(() => {
        location.reload(true);
      });
    }
  };

  kintone.events.on('app.record.index.show', async function (event) {
    if (String(event.viewId) !== '6428595') return event;

    // ボタン
    if (!document.getElementById('welbox_export_button')) {
      let button = document.createElement('button');
      button.id = 'welbox_export_button';
      button.classList.add('kintoneplugin-button-dialog-ok');
      button.innerText = 'WELBOX_消し込みCSVを出力';
      kintone.app.getHeaderMenuSpaceElement().appendChild(button);

      button.onclick = async () => {
        await ExportShippingReport_Main();
      };
    }
  });
})();
