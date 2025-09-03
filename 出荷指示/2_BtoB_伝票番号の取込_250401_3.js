/**
 * BtoB 伝票番号CSVを取り込む
 * ［BtoB 伝票番号CSVをUL］ボタンで実行
 */
(() => {
  'use strict';
  luxon.Settings.defaultLocale = 'ja';

  const client = new KintoneRestAPIClient();
  const APP_ID = kintone.app.getId();

  let resParam = { status: 1, message: '' };

  let dtNow = luxon.DateTime.local().toFormat('yyyy-MM-dd');
  let mode = 'production';

  // テスト用機能の定義
  const testFunction = async () => {
    console.log('testFunction開始');
    try {
      // Simulate test processing
      console.log('テスト処理実行中...');
      // (Additional test processing can be added here)
      console.log('テスト処理完了');
    } catch (error) {
      console.log('テスト処理でエラー:', error);
    }
  };

  /**
   * BtoB 伝票番号CSVファイルを読み込む
   * @param {*} file
   * @returns
   */
  const readFile = (file) => {
    return new Promise((resolve) => {
      console.log('readFile開始');
      let reader = new FileReader();
      reader.onload = async (e) => {
        // 読み込んだ結果をresolveする
        resolve(e.target.result);
      };
      // 読み込む
      reader.readAsText(file, 'sjis');
    });
  };

  /**
   * BtoB 伝票番号CSVのデータを配列に変換
   * @param {*} text
   * @returns
   */
  const convertToArray = (text) => {
    console.log('convertToArray開始');
    // CSVのデータを配列に変換する処理
    let lines = text.split(/\r\n|\n/);
    let result = [];

    for (let ii = 0; ii < lines.length; ii++) {
      let currentline = lines[ii].split(',');

      for (let jj = 0; jj < currentline.length; jj++) {
        // 前後の"を削除する
        currentline = currentline.map((ele) => {
          if (ele.slice(0, 1) == '"') {
            ele = ele.slice(1);
          }
          if (ele.slice(-1) == '"') {
            ele = ele.slice(0, -1);
          }
          return ele;
        });
      }
      result.push(currentline);
    }

    console.log('convertToArray完了');
    return result;
  };

  /**
   * 一覧に表示されているレコードを全て取得する
   * @returns
   */
  const GetShippingRecords = async () => {
    console.log('GetShippingRecords開始');
    try {
      let strQuery = kintone.app.getQuery();
      let [strCondition, strOrder] = strQuery.split(/order by|limit/i).map((part) => part.trim());
      return await client.record.getAllRecords({ app: APP_ID, condition: strCondition, orderBy: strOrder });
    } catch (error) {
      resParam.status = 9;
      resParam.message = 'BtoB 伝票番号CSVの一覧を取得する処理に失敗しました。\n\n' + error.message;
    }
  };

  /**
   * レコード更新用のデータを生成
   * @param {*} arrData
   * @param {*} allRecords
   * @returns
   */
  const CreateUpdateDataRecords = (arrData, allRecords) => {
    console.log('CreateUpdateDataRecords開始');
    let dataRecords = [];

    // 1行目からデータが入っている
    let idxApptdDate = 0;
    let idxItemCode = 3;
    let idxBestDate = 5;
    let idxAmount = 6;
    let idxShippingDate = 7;
    let idxShippingNumber = 8;
    let idxShippingCompany = 9;

    // 商品情報テーブルが全て配送されていればOK

    // レコードでループ
    for (let ii = 0; ii < allRecords.length; ii++) {
      let rec = allRecords[ii];

      // 指定出荷日が一致する行を取得
      let apptdRows = arrData.filter((ele) => {
        let dtTmp = new Date(ele[idxApptdDate]);
        let apptdDate = luxon.DateTime.fromJSDate(dtTmp).toISODate();
        let recDate = luxon.DateTime.fromISO(rec.指定出荷日.value).toISODate();
        return apptdDate == recDate;
      });
      if (apptdRows.length === 0) continue;
      console.log(apptdRows);

      let blnAllDelivered = true;

      // 商品情報テーブルでループ
      let updateData = {};
      for (let jj = 0; jj < rec.商品情報.value.length; jj++) {
        let itemRow = rec.商品情報.value[jj].value;
        // 商品コードと賞味期限が一致する行を取得
        let matchItemRow = apptdRows.find((ele) => {
          let dtTmp = new Date(ele[idxBestDate]);
          let bestDate = luxon.DateTime.fromJSDate(dtTmp).toISODate();
          let itemCode = ele[idxItemCode];
          return itemCode == itemRow.商品コード.value && bestDate == itemRow.賞味期限.value;
        });
        if (!matchItemRow) {
          blnAllDelivered = false;
          break;
        }
        // 納品バラ数合計が納品バラ数より小さければNG
        if (Number(matchItemRow[idxAmount]) < Number(itemRow.個数.value)) {
          blnAllDelivered = false;
          break;
        }
        // 納品バラ数合計を減らす
        matchItemRow[idxAmount] = Number(matchItemRow[idxAmount]) - Number(itemRow.個数.value);
        let dtTmp = new Date(matchItemRow[idxShippingDate]);
        updateData = {
          配送業者: { value: matchItemRow[idxShippingCompany] },
          伝票番号: { value: matchItemRow[idxShippingNumber] },
          発送日: { value: luxon.DateTime.fromJSDate(dtTmp).toISODate() },
          伝票番号CSVの取込日: { value: dtNow },
        };
      }
      // 全て配送されている場合
      if (blnAllDelivered) {
        dataRecords.push({
          id: rec.$id.value,
          record: updateData,
        });
      }
    }

    console.log('CreateUpdateDataRecords完了');
    return dataRecords;
  };

  /**
   * レコードを更新
   * @param {*} objData
   * @returns
   */
  const UpdateRecords = async (objData) => {
    console.log('UpdateRecords開始');
    try {
      return await client.record.updateAllRecords({ app: APP_ID, records: objData });
    } catch (error) {
      resParam.status = 9;
      resParam.message = error;
    }
  };

  /**
   * BtoB 伝票番号CSVを取り込むMain
   * @returns
   */
  const ImportShippingNumber_Main = async (file) => {
    try {
      resParam.status = 1;

      // CSVの中身を取得
      let textCSV = await readFile(file);
      console.log(textCSV);

      // CSVのデータを配列に変換
      let arrCSV = convertToArray(textCSV);
      console.log(arrCSV);
      if (resParam.status !== 1) return;

      // 一覧のレコードを取得
      let allRecords = await GetShippingRecords();
      console.log(allRecords);

      // レコード更新用のデータを生成
      let dataRecords = CreateUpdateDataRecords(arrCSV, allRecords);
      console.log(dataRecords);
      if (resParam.status !== 1) return;
      if (dataRecords.length === 0) {
        resParam.message = '更新するレコードはありません。';
        return;
      }

      // テストモードの場合はデータ更新をスキップ
      if (mode === 'test') {
        console.log('テストモード: データの更新はスキップされました');
        resParam.message = 'テストモード: CSVの処理は成功しましたが、データの更新は行いません。';
        return;
      }

      // レコードを更新
      let resp = await UpdateRecords(dataRecords);
      console.log(resp);
      if (resParam.status !== 1) return;

      resParam.message = 'BtoB 伝票番号CSVの取込に成功しました。\n';
    } catch (ex) {
      console.log(ex);
      resParam.message = 'BtoB 伝票番号CSVの取込に失敗しました。\n\n' + ex.message;
    } finally {
      await Swal.fire({
        title: 'BtoB 伝票番号CSVを取込',
        text: resParam.message + (resParam.status !== 1 ? '\nエラーが発生しました。' : ''),
      });
      location.reload(true);
    }
  };

  kintone.events.on('app.record.index.show', function (event) {
    if (event.viewId != 6427850) return event;

    // ファイル選択ボタン（非表示）
    if (document.getElementById('hc_button_imp') !== null) return;
    var input1 = document.createElement('input');
    input1.id = 'hc_button_imp';
    input1.type = 'file';
    input1.accept = '.csv';
    input1.style = 'display:none';
    kintone.app.getHeaderMenuSpaceElement().appendChild(input1);
    input1.addEventListener('click', (event) => {
      event.target.value = '';
    });
    input1.addEventListener('change', async (event) => {
      const file = event.target.files[0];
      await ImportShippingNumber_Main(file);
    });

    // ボタン（ファイル選択ボタンのclickイベントを発火）
    if (document.getElementById('hc_button_1') !== null) return;
    var button1 = document.createElement('button');
    button1.id = 'hc_button_1';
    button1.classList.add('kintoneplugin-button-dialog-ok');
    button1.innerText = 'BtoB 伝票番号CSVをUL';
    kintone.app.getHeaderMenuSpaceElement().appendChild(button1);

    button1.onclick = () => {
      if (input1) {
        input1.click();
      }
    };

    // テスト機能用ボタンの追加
    if (document.getElementById('hc_button_test') === null) {
      var buttonTest = document.createElement('button');
      buttonTest.id = 'hc_button_test';
      buttonTest.classList.add('kintoneplugin-button-dialog-ok');
      buttonTest.innerText = 'テスト機能実行';
      kintone.app.getHeaderMenuSpaceElement().appendChild(buttonTest);

      buttonTest.onclick = () => {
        console.log('テスト機能: CSV選択画面を表示');
        mode = 'test';
        if (input1) {
          input1.click();
        } else {
          console.log('CSVファイル選択用の要素が見つかりません。');
          Swal.fire({
            title: 'エラー',
            text: 'CSVファイル選択用の要素が見つかりません。',
          });
        }
      };
    }
  });
})();
