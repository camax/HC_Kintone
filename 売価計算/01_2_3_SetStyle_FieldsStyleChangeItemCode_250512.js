(function () {
  'use strict';

  /**
   * 商品コードルックアップ選択
   * 商品情報一覧で商品マスターから商品を選択した場合は、ケース入数・希望小売価格バラを非活性化。ルックアップ連携がクリアされた場合は活性化させる。
   */
  const SetLookUpCode = (event) => {
    let changesValue = event.changes.row.value;

    if (changesValue.商品情報一覧_商品情報一覧ID.value !== undefined) {
      let i = Number(changesValue.商品情報一覧_商品情報一覧ID.value) - 1;
      let row = event.record['商品情報一覧']['value'][i]['value'];
      // 新規商品の場合（レコードIDが空）：入力可能
      const isNew = changesValue.商品情報一覧_商品レコードID.value == '' || changesValue.商品情報一覧_商品レコードID.value === undefined;
      row['商品情報一覧_ケース入数'].disabled = !isNew;
      row['商品情報一覧_希望小売価格バラ_税抜'].disabled = !isNew;
      row['商品情報一覧_仕入れバラ_税抜'].disabled = !isNew;
      row['商品情報一覧_最安値'].disabled = !isNew;
      row['商品情報一覧_最安値URL'].disabled = !isNew;
    }

    return event;
  };

  kintone.events.on(['app.record.create.change.商品情報一覧_商品コード', 'app.record.edit.change.商品情報一覧_商品コード', 'app.record.create.change.商品情報一覧_商品レコードID', 'app.record.edit.change.商品情報一覧_商品レコードID'], SetLookUpCode);

  // 初期表示時（新規作成時）にも制御を行う
  kintone.events.on(['app.record.create.show'], function (event) {
    const rows = event.record['商品情報一覧'].value;
    if (!rows) return event;

    rows.forEach((rowObj) => {
      const row = rowObj.value;
      const isNew = !row['商品情報一覧_商品レコードID'].value;

      row['商品情報一覧_ケース入数'].disabled = !isNew;
      row['商品情報一覧_希望小売価格バラ_税抜'].disabled = !isNew;
      row['商品情報一覧_仕入れバラ_税抜'].disabled = !isNew;
      row['商品情報一覧_最安値'].disabled = !isNew;
      row['商品情報一覧_最安値URL'].disabled = !isNew;
    });

    return event;
  });
})();
