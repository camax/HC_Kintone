(function () {
  'use strict';

  const malls = HC.malls;

  kintone.events.on(['app.record.create.show', 'app.record.edit.show'], (event) => {
    // 非活性化の設定

    // --アプリ連携関連
    event.record['掲載依頼レコードID']['disabled'] = true;
    event.record['掲載依頼レコードURL']['disabled'] = true;

    // --合計関連
    event.record['媒体売上合計_税抜']['disabled'] = true;
    event.record['媒体利益合計']['disabled'] = true;
    event.record['媒体セット数合計']['disabled'] = true;

    // --商品情報一覧関連
    event.record['商品シリアルコード']['disabled'] = true;
    for (let i = 0; i < 10; i++) {
      event.record['商品情報一覧']['value'][i]['value']['商品情報一覧_商品情報一覧ID']['disabled'] = true;
      event.record['商品情報一覧']['value'][i]['value']['商品情報一覧_商品コード']['disabled'] = false;
      event.record['商品情報一覧']['value'][i]['value']['商品情報一覧_発注ケース数']['disabled'] = false;
      event.record['商品情報一覧']['value'][i]['value']['商品情報一覧_発注バラ数']['disabled'] = false;

      // ルックアップ設定項目
      const row = event.record['商品情報一覧']['value'][i]['value'];
      let id = row && row['商品情報一覧_商品レコードID'] ? row['商品情報一覧_商品レコードID'].value : undefined;
      console.log(`row ${i + 1}: 商品レコードID =`, id);
      console.log(`→ 希望小売価格バラ_税抜 (before) disabled =`, row && row['商品情報一覧_希望小売価格バラ_税抜'] ? row['商品情報一覧_希望小売価格バラ_税抜']['disabled'] : undefined);
      if (row) {
        if (id === '' || id === undefined) {
          if (row['商品情報一覧_希望小売価格バラ_税抜']) row['商品情報一覧_希望小売価格バラ_税抜']['disabled'] = false;
          if (row['商品情報一覧_ケース入数']) row['商品情報一覧_ケース入数']['disabled'] = false;
          if (row['商品情報一覧_仕入れバラ_税抜']) row['商品情報一覧_仕入れバラ_税抜']['disabled'] = false;
          if (row['商品情報一覧_最安値']) row['商品情報一覧_最安値']['disabled'] = false;
          if (row['商品情報一覧_最安値URL']) row['商品情報一覧_最安値URL']['disabled'] = false;
        } else {
          if (row['商品情報一覧_希望小売価格バラ_税抜']) row['商品情報一覧_希望小売価格バラ_税抜']['disabled'] = true;
          if (row['商品情報一覧_ケース入数']) row['商品情報一覧_ケース入数']['disabled'] = true;
          if (row['商品情報一覧_仕入れバラ_税抜']) row['商品情報一覧_仕入れバラ_税抜']['disabled'] = true;
          if (row['商品情報一覧_最安値']) row['商品情報一覧_最安値']['disabled'] = true;
          if (row['商品情報一覧_最安値URL']) row['商品情報一覧_最安値URL']['disabled'] = true;
        }
      }
    }

    // --売価情報
    //malls.forEach(mall => {
    //  event.record['売価_税抜_'+mall]['disabled'] = true;
    //  event.record['納価_'+mall]['disabled'] = true;
    //  event.record['HC利益率_'+mall]['disabled'] = true;
    //  event.record['HC利益_'+mall]['disabled'] = true;
    //  event.record['売上_税抜_'+mall]['disabled'] = true;
    //  event.record['セット利益_'+mall]['disabled'] = true;
    //  event.record['損益分岐点_'+mall]['disabled'] = true;
    //});

    event.record['配送関連費_au']['disabled'] = true;

    return event;
  });

  // 複製時の初期化
  kintone.events.on(['app.record.create.show', 'app.record.edit.change'], (event) => {
    // 複製時はアプリ連携項目を初期化
    event.record['掲載依頼レコードID'].value = '';
    event.record['掲載依頼レコードURL'].value = '';

    return event;
  });

  // // 非表示
  // let tableNo = 0; //ボタンを消したいテーブルの番号。(0始まり)
  // kintone.events.on(['app.record.edit.show'], function(event) {
  // [].forEach.call(document.getElementsByClassName("subtable-gaia")[tableNo].getElementsByClassName("subtable-operation-gaia"), function(button){
  //   button.style.display = 'none';
  // });
  // });
})();
