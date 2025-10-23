/**
 * 商品情報一覧は商品数10で固定, 新規コード自動入力
 */
(() => {
  'use strict';

  const client = new KintoneRestAPIClient();
  const HC_ITEM_MASTER_APP_ID = HC.apps.商品マスタ.id;

  kintone.events.on('app.record.create.show', async (event) => {
    var records = await client.record
      .getRecords({
        app: kintone.app.getId(),
        fields: ['$id'],
        query: 'order by $id desc limit 1',
      })
      .then(function (resp) {
        return resp.records;
      })
      .catch(function (err) {
        console.log(err);
      });

    let id = records.length == 0 ? 1 : 1 + Number(records[0]['$id'].value);
    let newCode = 'HC-' + id;

    // 商品コードを取得
    let itemRecords = await client.record.getRecords({
      app: HC_ITEM_MASTER_APP_ID,
      fields: ['商品コード'],
      query: 'order by 商品コード desc limit 1',
    });

    let lastItemCode = itemRecords.records.length == 0 ? 'hc0000' : itemRecords.records[0]['商品コード'].value;
    let lastItemCodeNumber = Number(lastItemCode.replace('hc', ''));
    let newItemCodeNumber = lastItemCodeNumber + 1;
    let newItemCode = 'hc' + (newItemCodeNumber < 10000 ? newItemCodeNumber.toString().padStart(4, '0') : newItemCodeNumber);

    let array = [];
    for (let i = 0; i < 10; i++) {
      let index = i + 1;
      let code = i === 0 ? newItemCode : '';
      let v = CreateValue(index, code);
      array.push(v);
    }

    event.record.商品情報一覧.value = array;
    event.record.商品シリアルコード.value = newCode;

    return event;
  });

  const CreateValue = (number, code) => ({
    value: {
      商品情報一覧_商品情報一覧ID: {
        type: 'NUMBER',
        value: number,
      },
      商品情報一覧_商品レコードID: {
        type: 'SINGLE_LINE_TEXT',
        value: '',
      },
      商品情報一覧_商品コード: {
        type: 'SINGLE_LINE_TEXT',
        value: code,
      },
      商品情報一覧_セット数: {
        type: 'CALC',
        value: '',
      },
      商品情報一覧_セット入数: {
        type: 'NUMBER',
        value: '',
      },
      商品情報一覧_ケース入数: {
        type: 'NUMBER',
        value: '',
      },
      商品情報一覧_ケース入数_ゼロ埋め: {
        type: 'NUMBER',
        value: '',
      },
      商品情報一覧_発注ケース数: {
        type: 'CALC',
        value: '',
      },
      商品情報一覧_発注バラ数: {
        type: 'CALC',
        value: '',
      },
      商品情報一覧_希望小売価格バラ_税抜: {
        type: 'NUMBER',
        value: '',
      },
      商品情報一覧_希望小売価格セット_税抜: {
        type: 'CALC',
        value: '',
      },
      商品情報一覧_仕入れバラ_税抜: {
        type: 'NUMBER',
        value: '',
      },
      商品情報一覧_セット仕入れ価格_税抜: {
        type: 'CALC',
        value: '',
      },
      商品情報一覧_発注金額_税抜: {
        type: 'CALC',
        value: '',
      },
      商品情報一覧_最安値: {
        type: 'NUMBER',
        value: '',
      },
      商品情報一覧_最安値_20: {
        type: 'CALC',
        value: '',
      },
      商品情報一覧_最安値URL: {
        type: 'LINK',
        value: '',
      },
    },
  });
})();
