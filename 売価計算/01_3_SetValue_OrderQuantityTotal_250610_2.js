(function () {
  'use strict';

  kintone.events.on(['app.record.create.submit', 'app.record.edit.submit'], function (event) {
    const record = event.record;
    const table = record['商品情報一覧'].value;

    let totalOrder = 0;
    let countOrder = 0;

    let totalRetail = 0;
    let countRetail = 0;

    let totalCost = 0;
    let countCost = 0;

    table.forEach(function (row) {
      const orderVal = Number(row.value['商品情報一覧_発注バラ数'].value);
      const retailVal = Number(row.value['商品情報一覧_希望小売価格バラ_税抜'].value);
      const costVal = Number(row.value['商品情報一覧_仕入れバラ_税抜'].value);

      if (!isNaN(orderVal)) {
        totalOrder += orderVal;
        countOrder++;
      }
      if (!isNaN(retailVal)) {
        totalRetail += retailVal;
        countRetail++;
      }
      if (!isNaN(costVal)) {
        totalCost += costVal;
        countCost++;
      }
    });

    // 平均 → 整数（切り捨て）
    record['発注バラ数_平均'].value = countOrder ? Math.floor(totalOrder / countOrder) : 0;
    record['商品情報一覧_希望小売価格バラ_税抜_平均'].value = countRetail ? Math.floor(totalRetail / countRetail) : 0;
    record['商品情報一覧_仕入れバラ_税抜_平均'].value = countCost ? Math.floor(totalCost / countCost) : 0;

    return event;
  });
})();
