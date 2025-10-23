/**
 * エラーログ用のCSV文字列を生成
 * @param {*} errors
 * @returns
 */
const createErrorCSV = (errors) => {
  const headers = ['案件ID', '商品名', 'メーカー名', 'モール管理番号', '原因'];
  let csv = headers.map((header) => `"${header}"`).join(',') + '\r\n';

  for (let row of errors) {
    csv += headers.map((key) => `"${row[key] || ''}"`).join(',') + '\r\n';
  }

  return csv;
};

/**
 * SDGsからHCへの発注書（CSV）作成
 * PJT_IDごとの申込数を出力
 */
(() => {
  'use strict';
  luxon.Settings.defaultLocale = 'ja';

  const client = new KintoneRestAPIClient();
  const HC_APPLICATION_APP_ID = kintone.app.getId();
  const HC_MATTER_APP_ID = HC.apps.案件管理.id;
  const HC_HOLIDAY_APP_ID = HC.apps.休業日カレンダー.id;

  const spinner = new Kuc.Spinner({
    text: '処理中...',
    container: document.body,
  });

  // 対象の掲載媒体名
  const SDGs_GROUP_MALL_NAME = ['au', 'Pontaパス', 'Tサンプル', 'Vサンプル'];
  // リードタイムが長い発注先
  const LONG_LEAD_TIME = ['加藤産業', 'ＵＨＡ味覚糖'];

  // CSVのヘッダー
  const CSV_HEADER = {
    PJT_ID: 'PJT_ID', // モール管理番号（Vサンプルは頭のVを除去する）
    配送業者: '配送業者', // 案件管理の配送業者
    商品名: '商品名', // 掲載商品名
    発送日: '発送日', // 休業日カレンダーを参照（10日+次の火曜日、休業日なら後ろ倒し）
    個数: '個数', // 申込数
  };

  let dtNow = luxon.DateTime.local();

  let resParam = { status: 0, message: '' };

  /**
   * 条件にあうすべてのレコードを取得
   * @param {*} id
   * @param {*} condition
   * @param {*} order
   * @returns
   */
  const getAllRecordsWithCondition = async (id, condition = null, order = null) => {
    try {
      const records = await client.record.getAllRecords({ app: id, condition: condition, orderBy: order });
      return records;
    } catch (error) {
      resParam = {
        status: 9,
        message: 'レコードの取得中にエラーが発生しました:\n\n' + error.message,
      };
      return [];
    }
  };

  /**
   * CSV用のデータを生成
   * @param {*} objArray
   * @returns
   */
  const convertToCSV = (objArray) => {
    const array = typeof objArray !== 'object' ? JSON.parse(objArray) : objArray;

    /** 1. Objectの Key を headerとして取り出す */
    let str =
      `${Object.keys(CSV_HEADER)
        .map((header) => `"${header}"`)
        .join(',')}` + '\r\n';

    // 2. 各オブジェクトの値をCSVの行として追加する
    return array.reduce((str, next) => {
      str +=
        `${Object.values(CSV_HEADER)
          .map((header) => `"${next[header] !== null ? next[header] : ''}"`)
          .join(',')}` + '\r\n';
      return str;
    }, str);
  };

  /**
   * CSVを出力
   * @param {*} arrJsonForCSV
   */
  const downloadCSV = (data, name) => {
    /** Blob Object を作成する Type. CSV */
    const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
    const blob = new Blob([bom, data], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `${name}.csv`);
    a.click();
    a.remove();
  };

  /**
   * CSV用のデータを生成
   * @param {*} orderData
   * @param {*} matterRecords
   * @param {*} holidayRecords
   * @returns
   */
  const createCSVData = (orderData, matterRecords, holidayRecords) => {
    let csvData = [];
    let errorLogs = []; // ← ここを追加

    for (let order of orderData) {
      let matterRec = matterRecords.find((rec) => rec.$id.value == order.案件管理レコードID);
      if (!matterRec) continue;

      console.log('🎯 該当案件ID:', matterRec.$id.value, 'の発注先:', matterRec.発注先?.value);
      if (!matterRec.発注先.value) {
        errorLogs.push({
          案件ID: matterRec.$id.value,
          商品名: matterRec.掲載商品名.value,
          メーカー名: matterRec.メーカー名?.value,
          モール管理番号: matterRec.モール管理番号?.value,
          原因: '発注先が未設定',
        });
        continue; // スキップ
      }

      // 発送日を求める
      let dueDate = luxon.DateTime.local().startOf('day');
      dueDate = dueDate.plus({ days: 10 });

      if (LONG_LEAD_TIME.some((company) => matterRec.発注先.value.includes(company))) {
        dueDate = dueDate.plus({ days: 7 });
      }
      for (let ii = 0; ii < 6; ii++) {
        if (dueDate.weekday == 2) break;
        dueDate = dueDate.plus({ days: 1 });
      }
      // 休業日の場合、後ろ倒し
      for (let ii = 0; ii < 10; ii++) {
        if (holidayRecords.find((rec) => rec.日付.value == dueDate.toFormat('yyyy-MM-dd'))) {
          dueDate = dueDate.plus({ days: 1 });
        } else {
          break;
        }
      }

      let tmpObj = {
        掲載媒体名: order.掲載媒体名,
        PJT_ID: order.掲載媒体名 == 'Vサンプル' || order.掲載媒体名 == 'Tサンプル' ? matterRec.モール管理番号.value.replace('V', '') : matterRec.モール管理番号.value,
        商品名: matterRec.掲載商品名.value,
        個数: order.申込数,
        発送日: dueDate.toFormat('yyyy-MM-dd'),
        納価: matterRec.納価_税抜.value,
        URL: matterRec.掲載URL.value,
        配送業者: matterRec.配送業者.value,
      };
      csvData.push(tmpObj);
    }
    window.errorLogs = errorLogs;
    return csvData;
  };

  /**
   * SDGs用の発注書CSVをダウンロード
   */
  const downloadCSV_Main = async () => {
    try {
      spinner.open();

      resParam = { status: 1, message: '' };

      let ele = document.getElementById('spreadsheet');
      let tableData = [];
      // 表示されている表のデータを取得
      if (ele.jspreadsheet.results) {
        tableData = ele.jspreadsheet.results.map((val, index) => ele.jspreadsheet.getJsonRow(val));
      } else {
        tableData = ele.jspreadsheet.getJson();
      }
      console.log('表示されているTableデータ:', tableData);

      // 申込数が1以上のSDGs_GROUP_MALL_NAMEに絞る
      const orderData = tableData.filter((row) => row.申込数 > 0 && SDGs_GROUP_MALL_NAME.includes(row.掲載媒体名));
      console.log('申込数が1以上 & SDGsのデータ:', orderData);

      if (orderData.length == 0) {
        resParam = { status: 9, message: '対象のデータがありません。' };
        return;
      }

      // 案件管理のレコードを取得
      const matterRecords = await getAllRecordsWithCondition(HC_MATTER_APP_ID);
      console.log('案件管理のレコード:', matterRecords);

      // 休業日カレンダーのレコードを取得
      const holidayRecords = await getAllRecordsWithCondition(HC_HOLIDAY_APP_ID, '日付 >= TODAY()');
      console.log('休業日カレンダーのレコード:', holidayRecords);

      // CSV用のデータを生成
      let csvData = createCSVData(orderData, matterRecords, holidayRecords);
      console.log('CSV用のデータ:', csvData);

      // 媒体別に分ける
      let groupByMall = Object.groupBy(csvData, (data) => data.掲載媒体名);
      console.log('媒体別に分けたデータ:', groupByMall);

      // 媒体別にCSV出力
      for (let mall of Object.keys(groupByMall)) {
        let mallCSV = groupByMall[mall];
        // 発送日の昇順でソート
        mallCSV.sort((a, b) => new Date(a.発送日) - new Date(b.発送日));
        downloadCSV(convertToCSV(mallCSV), `${dtNow.toFormat('yyyyMMdd')}_${mall}_発注書`);
      }

      resParam = { status: 1, message: 'SDGs用の発注書CSVをダウンロードしました。' };
      // エラーログCSV出力
      console.log('🪵 errorLogs 配列の長さ:', window.errorLogs?.length);
      console.log('🪵 errorLogs 配列の中身:', window.errorLogs);
      if (window.errorLogs && window.errorLogs.length > 0) {
        console.log('🛑 発注エラーCSV出力対象:', window.errorLogs); // 強調ログ
        const errorCSV = createErrorCSV(window.errorLogs);
        console.log('📦 出力されるエラーCSV文字列:\n', errorCSV); // ← 任意のデバッグ用ログ
        downloadCSV(errorCSV, `${dtNow.toFormat('yyyyMMdd')}_発注エラー`);
      }
    } catch (error) {
      console.error('SDGs用の発注書CSV作成中にエラーが発生しました:', error);
      resParam = { status: 9, message: 'SDGs用の発注書CSV作成中にエラーが発生しました。' };
    } finally {
      spinner.close();

      let iconType = 'success';
      let title = '成功';
      switch (resParam.status) {
        case 1:
          iconType = 'success';
          title = '成功';
          break;
        case 9:
          iconType = 'error';
          title = 'エラー';
          break;
      }

      await Swal.fire({
        icon: iconType,
        title: title,
        text: resParam.message,
      });

      if (resParam.status == 1) {
        location.reload();
      }
    }
  };

  kintone.events.on('app.record.index.show', async (event) => {
    if (event.viewId != 6427204 && event.viewId != 6428079) return event;

    try {
      // 発注書作成ボタン
      const downloadCSVButton = new Kuc.Button({
        text: 'SDGs用の発注書CSVをダウンロード',
        type: 'submit',
      });
      //createOrderButton.style.verticalAlign = 'middle';
      downloadCSVButton.style.marginLeft = '10px';
      downloadCSVButton.addEventListener('click', downloadCSV_Main);
      kintone.app.getHeaderMenuSpaceElement().appendChild(downloadCSVButton);
    } catch (error) {
      console.log(error);
      event.error = error.message;
    }
  });
})();
