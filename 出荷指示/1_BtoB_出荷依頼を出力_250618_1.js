/**
 * BtoB 出荷依頼をCSVでダウンロードする
 */
(() => {
  'use strict';
  luxon.Settings.defaultLocale = 'ja';

  kintone.events.on(['app.record.create.submit', 'app.record.edit.submit'], function (event) {
    const record = event.record;

    const senderName = record['ご依頼主名']?.value || '';
    if (senderName === 'ハッピーキャンペーン柏センター') {
      record['ご依頼主電話番号'].value = '050-1722-7845';
    }

    const mediaName = record['掲載媒体名']?.value || '';
    if (mediaName === 'BEAUTH') {
      record['ご依頼主電話番号'].value = '050-1807-4570';
    }

    return event;
  });

  const client = new KintoneRestAPIClient();
  const APP_ID = kintone.app.getId();
  const APP_ID_ITEM_MASTER = HC.apps['商品マスタ'].id;
  const APP_ID_DELIVERY_MASTER = HC.apps['納品先マスタ'].id;

  let resParam = { status: 1, message: '' };

  let shippingFields = {
    指定出荷日: '指定出荷日',
    メーカー: 'メーカー名',
    商品名: '商品名',
    商品コード: '商品コード',
    JANコード: 'JAN',
    賞味期限: '賞味期限',
    納品バラ数合計: '個数',
    配送先名: '配送先名',
    配送先住所: '配送先住所',
    配送先郵便番号: '配送先郵便番号',
    配送先電話番号: '配送先電話番号',
    配送日: '発送日',
    配送番号: '伝票番号',
    配送会社: '配送業者',
    カートンNo: '',
    入数: '',
  };

  let dtNow = luxon.DateTime.local().toFormat('yyyy-MM-dd');

  const GetShippingRecords = async () => {
    try {
      let strQuery = kintone.app.getQuery();
      let [strCondition, strOrder] = strQuery.split(/order by|limit/i).map((part) => part.trim());
      return await client.record.getAllRecords({ app: APP_ID, condition: strCondition, orderBy: strOrder });
    } catch (error) {
      resParam.status = 9;
      resParam.message = 'BtoB 出荷依頼データの一覧を取得する処理に失敗しました。\n\n' + error.message;
    }
  };

  const JsonToCSV = (json) => {
    let header = '"' + Object.keys(shippingFields).join('","') + '"\n';

    let body = json
      .map((row) => {
        let strRow = Object.values(shippingFields)
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

  const exportCSV = (csvData, filename) => {
    var exportedFilenmae = (filename || 'exportCSV') + '.csv';
    var bom = new Uint8Array([0xef, 0xbb, 0xbf]);
    var blob = new Blob([bom, csvData], { type: 'text/csv;charset=utf-8' });

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

  const UpdateExportDate = async (records) => {
    try {
      let arrRecords = [];
      for (let ii = 0; ii < records.length; ii++) {
        arrRecords.push({ id: records[ii].レコード番号.value, record: { 出荷依頼CSVの出力日: { value: dtNow } } });
      }
      return await client.record.updateAllRecords({ app: APP_ID, records: arrRecords });
    } catch (error) {
      resParam.status = 9;
      resParam.message = 'BtoB 出荷依頼データのCSV出力日を更新する処理に失敗しました。\n\n' + error.message;
    }
  };

  const ExportShippingData_Main = async () => {
    try {
      resParam.status = 1;

      let allRecords = await GetShippingRecords();
      if (resParam.status != 1) return;

      let itemMasterRecords = await client.record.getAllRecords({ app: APP_ID_ITEM_MASTER });
      let deliveryMasterRecords = await client.record.getAllRecords({ app: APP_ID_DELIVERY_MASTER, condition: 'ID = "197"' });

      let allItems = [];
      for (let ii = 0; ii < allRecords.length; ii++) {
        let record = allRecords[ii];
        let items = record.商品情報.value;
        for (let jj = 0; jj < items.length; jj++) {
          let item = items[jj].value;
          let itemMaster = itemMasterRecords.find((master) => master.商品コード.value === item.商品コード.value);
          let itemInfo = allItems.find((info) => info.商品コード.value === item.商品コード.value && info.賞味期限.value === item.賞味期限.value);
          if (!itemInfo) {
            allItems.push({
              ...record,
              ...item,
              メーカー名: itemMaster['メーカー名'],
              配送先名: deliveryMasterRecords[0]['名称'],
              配送先住所: deliveryMasterRecords[0]['住所'],
              配送先郵便番号: deliveryMasterRecords[0]['郵便番号'],
              配送先電話番号: deliveryMasterRecords[0]['電話番号'],
            });
          } else {
            itemInfo.個数.value = Number(itemInfo.個数.value) + Number(item.個数.value);
          }
        }
      }

      allItems.sort((a, b) => {
        const dateComparison = luxon.DateTime.fromISO(a.指定出荷日.value) - luxon.DateTime.fromISO(b.指定出荷日.value);
        if (dateComparison !== 0) return dateComparison;

        const manufacturerComparison = a.メーカー名.value.localeCompare(b.メーカー名.value);
        if (manufacturerComparison !== 0) return manufacturerComparison;

        const productCodeComparison = a.商品コード.value.localeCompare(b.商品コード.value);
        if (productCodeComparison !== 0) return productCodeComparison;

        return luxon.DateTime.fromISO(a.賞味期限.value) - luxon.DateTime.fromISO(b.賞味期限.value);
      });

      let csvData = JsonToCSV(allItems);
      exportCSV(csvData, dtNow.replace(/-/g, '') + '_BtoB_出荷依頼');
      let resp = await UpdateExportDate(allRecords);
      if (resParam.status != 1) return;

      resParam.message = 'BtoB 出荷依頼データを出力しました。\n';
    } catch (ex) {
      console.log(ex);
      resParam.message = 'BtoB 出荷依頼データの出力に失敗しました。\n\n' + ex.message;
    } finally {
      await Swal.fire({
        title: 'BtoB 出荷依頼データを出力',
        text: resParam.message,
        willClose: () => {
          location.reload(true);
        },
      });
    }
  };

  const ExportShippingData_Test = async () => {
    try {
      console.log('[テスト処理] テストCSV出力開始');
      let allRecords = await GetShippingRecords();
      console.log('[テスト処理] レコード取得完了');
      if (resParam.status !== 1) {
        throw new Error('[テスト処理] レコード取得エラー: ' + resParam.message);
      }

      let csvData = '';
      if (allRecords.length === 0) {
        csvData = '"' + Object.keys(shippingFields).join('","') + '"\n';
        console.log('[テスト処理] データなし: ヘッダーのみ生成');
      } else {
        let itemMasterRecords = await client.record.getAllRecords({ app: APP_ID_ITEM_MASTER });
        console.log('[テスト処理] 商品マスタ取得完了');
        let deliveryMasterRecords = await client.record.getAllRecords({ app: APP_ID_DELIVERY_MASTER, condition: 'ID = "197"' });
        console.log('[テスト処理] 納品先マスタ取得完了');
        let allItems = [];
        for (let ii = 0; ii < allRecords.length; ii++) {
          let record = allRecords[ii];
          let items = record.商品情報.value;
          for (let jj = 0; jj < items.length; jj++) {
            let item = items[jj].value;
            let itemMaster = itemMasterRecords.find((master) => master.商品コード.value === item.商品コード.value);
            let itemInfo = allItems.find((info) => info.商品コード.value === item.商品コード.value && info.賞味期限.value === item.賞味期限.value);
            if (!itemInfo) {
              allItems.push({
                ...record,
                ...item,
                メーカー名: itemMaster ? itemMaster['メーカー名'] : '',
                配送先名: deliveryMasterRecords[0] ? deliveryMasterRecords[0]['名称'] : '',
                配送先住所: deliveryMasterRecords[0] ? deliveryMasterRecords[0]['住所'] : '',
                配送先郵便番号: deliveryMasterRecords[0] ? deliveryMasterRecords[0]['郵便番号'] : '',
                配送先電話番号: deliveryMasterRecords[0] ? deliveryMasterRecords[0]['電話番号'] : '',
              });
            } else {
              itemInfo.個数.value = Number(itemInfo.個数.value) + Number(item.個数.value);
            }
          }
        }
        allItems.sort((a, b) => {
          const dateComparison = luxon.DateTime.fromISO(a.指定出荷日.value) - luxon.DateTime.fromISO(b.指定出荷日.value);
          if (dateComparison !== 0) return dateComparison;
          const manufacturerComparison = a.メーカー名.value.localeCompare(b.メーカー名.value);
          if (manufacturerComparison !== 0) return manufacturerComparison;
          const productCodeComparison = a.商品コード.value.localeCompare(b.商品コード.value);
          if (productCodeComparison !== 0) return productCodeComparison;
          return luxon.DateTime.fromISO(a.賞味期限.value) - luxon.DateTime.fromISO(b.賞味期限.value);
        });
        csvData = JsonToCSV(allItems);
        console.log('[テスト処理] CSV生成完了');
      }
      console.log('[テスト処理] CSVデータ:', csvData);
      exportCSV(csvData, dtNow.replace(/-/g, '') + '_BtoB_出荷依頼_TEST');
      console.log('[テスト処理] CSVダウンロード実行完了');
      resParam.message = 'テスト用CSV出力処理が正常に完了しました。';
    } catch (ex) {
      console.error('[テスト処理-エラー] ExportShippingData_Test:', ex);
      resParam.message = '[テスト処理エラー] ' + ex.message;
    } finally {
      await Swal.fire({
        title: 'テスト用CSV出力結果',
        text: resParam.message,
      });
    }
  };

  kintone.events.on('app.record.index.show', function (event) {
    if (event.viewId != 6427848) return event;

    if (!document.getElementById('hc_button_exp')) {
      var button1 = document.createElement('button');
      button1.id = 'hc_button_exp';
      button1.classList.add('kintoneplugin-button-dialog-ok');
      button1.innerText = 'BtoB 出荷依頼データをDL';
      kintone.app.getHeaderMenuSpaceElement().appendChild(button1);

      button1.onclick = async () => {
        console.log('[本番処理] BtoB 出荷依頼データDL処理開始');
        await ExportShippingData_Main();
      };
    }

    if (!document.getElementById('hc_button_test_dl')) {
      var buttonTestDL = document.createElement('button');
      buttonTestDL.id = 'hc_button_test_dl';
      buttonTestDL.classList.add('kintoneplugin-button-dialog-ok');
      buttonTestDL.innerText = 'テスト: CSV DL';
      kintone.app.getHeaderMenuSpaceElement().appendChild(buttonTestDL);
      buttonTestDL.onclick = async () => {
        console.log('[テスト処理] テストボタン押下');
        await ExportShippingData_Test();
      };
    }
  });
})();
