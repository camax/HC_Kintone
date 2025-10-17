(function () {
  'use strict';

  // ドロップダウンの値 → フィールドコードのマップ
  const STOCK_FIELD_MAP = {
    au: 'セット数_au',
    Tサンプル: 'セット数_Tサンプル',
    くまポン: 'セット数_くまポン',
    FiNC: 'セット数_FiNC',
    BEAUTH: 'セット数_eecoto',
    リロクラブ: 'セット数_リロ',
    ベネフィット: 'セット数_ベネ',
    おためし: 'セット数_おためし',
    Tポイント: 'セット数_Tポイント',
    社販: 'セット数_社販',
    モラタメ: 'セット数_モラタメ',
    坂戸以外: 'セット数_坂戸以外',
  };

  kintone.events.on('app.record.edit.submit', function (event) {
    const record = event.record;
    const table = record['セット数変更履歴']?.value || [];

    for (let i = 0; i < table.length; i++) {
      const row = table[i].value;
      const from = row['変更元'].value;
      const to = row['変更先'].value;
      const amount = Number(row['増減数量'].value);

      if (!from || !to || isNaN(amount) || amount <= 0) {
        event.error = `在庫移動データの ${i + 1} 行目に入力不備があります。`;
        return event;
      }

      if (from === to) {
        event.error = `在庫移動データの ${i + 1} 行目で、変更元と変更先が同じです。`;
        return event;
      }

      const fromField = STOCK_FIELD_MAP[from];
      const toField = STOCK_FIELD_MAP[to];

      if (!fromField || !toField) {
        event.error = `在庫移動データの ${i + 1} 行目のモール名に対応する在庫フィールドが見つかりません。`;
        return event;
      }

      const fromStock = Number(record[fromField].value || 0);
      const toStock = Number(record[toField].value || 0);

      if (fromStock < amount) {
        event.error = `在庫移動データの ${i + 1} 行目で、移動元の在庫が不足しています（在庫: ${fromStock}, 移動数: ${amount}）。`;
        return event;
      }

      // 在庫加減算
      record[fromField].value = fromStock - amount;
      record[toField].value = toStock + amount;

      console.log(`在庫移動 ${i + 1}行目: ${from}(${fromStock}→${record[fromField].value}), ${to}(${toStock}→${record[toField].value})`);
    }

    return event;
  });
})();
