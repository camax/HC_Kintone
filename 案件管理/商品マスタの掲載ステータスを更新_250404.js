/**
 * 商品マスタのステータスを更新
 * 全ての案件で、1つでも掲載済があれば、商品マスタのステータスを「掲載済」に更新
 */
(() => {
  'use strict';
  luxon.Settings.defaultLocale = 'ja';

  const client = new KintoneRestAPIClient();
  const HC_MATTER_APP_ID = HC.apps.案件管理.id;
  const HC_ITEM_APP_ID = HC.apps.商品マスタ.id;
  const HC_ORDER_APP_ID = HC.apps.発注書.id;

  const HC_MEMBER_ID = ['1', '3', '6'];

  const MATTER_STATUS_FIELD = '掲載ステータス';
  const MATTER_STATUS_PUBLISHED = '掲載済';
  const ITEM_STATUS_FIELD = '掲載ステータス';
  const ITEM_STATUS_PUBLISHED = '掲載済';

  const spinner = new Kuc.Spinner({
    text: '処理中...',
    container: document.body,
  });

  let resParam = { status: 1, message: '' };

  /**
   * 条件にあうすべてのレコードを取得
   * @param {*} id
   * @param {*} condition
   * @param {*} order
   * @returns
   */
  const getAllRecordsWithCondition = async (id, condition = null, order = null) => {
    try {
      const records = await client.record.getAllRecords({
        app: id,
        condition: condition,
        orderBy: order,
      });
      return records;
    } catch (error) {
      resParam = { status: 9, message: 'レコードの取得中にエラーが発生しました:\n\n' + error.message };
      return [];
    }
  };

  /**
   * レコードを一括更新
   * @param {*} appId
   * @param {*} recData
   * @returns
   */
  const updateSomeRecords = async (appId, recData) => {
    try {
      return client.record
        .updateAllRecords({ app: appId, records: recData })
        .then(function (resp) {
          resParam.status = 1;
          return resp;
        })
        .catch(function (e) {
          console.log(e);
          resParam.status = 9;
          resParam.message = `レコードを更新できませんでした。\n` + e;
          return;
        });
    } catch (ex) {
      console.log(ex);
      resParam.status = 9;
      resParam.message = `レコードを更新できませんでした。\n` + ex;
      return;
    }
  };

  /**
   * 商品マスタの掲載ステータスを更新
   */
  const updateItemMasterStatus_Top = async () => {
    try {
      spinner.open();

      // 全ての案件レコードを取得
      let matterRecords = await getAllRecordsWithCondition(HC_MATTER_APP_ID, `${MATTER_STATUS_FIELD} in ("${MATTER_STATUS_PUBLISHED}")`);
      console.log('全ての案件レコード:', matterRecords);

      // 全ての商品レコードを取得
      let itemRecords = await getAllRecordsWithCondition(HC_ITEM_APP_ID);
      console.log('全ての商品レコード:', itemRecords);

      // 案件レコードから掲載済の商品コードを取得
      let pubItemCodes = [];
      matterRecords.forEach((record) => {
        for (let ii = 1; ii <= 10; ii++) {
          let itemCode = record[`商品コード_${ii}`].value;
          if (itemCode != null) pubItemCodes.push(itemCode);
        }
      });
      // 重複を削除
      pubItemCodes = [...new Set(pubItemCodes)];
      console.log('掲載済の商品コード:', pubItemCodes);

      // 商品マスタのステータスを更新用のデータを作成
      let updateItemRecords = [];
      itemRecords.forEach((item) => {
        // 空欄で用意し格納
        let objData = {
          updateKey: { field: '商品コード', value: item['商品コード'].value },
          record: { [ITEM_STATUS_FIELD]: { value: [] } },
        };
        updateItemRecords.push(objData);

        // 掲載済の配列に商品コードがあれば、「掲載済」にする
        if (pubItemCodes.includes(item['商品コード'].value)) {
          objData.record[ITEM_STATUS_FIELD].value = [ITEM_STATUS_PUBLISHED];
        }
      });
      console.log('更新用のデータ:', updateItemRecords);

      // 商品マスタのステータスを更新
      let updateResult = await updateSomeRecords(HC_ITEM_APP_ID, updateItemRecords);
      console.log('更新結果:', updateResult);
    } catch (error) {
      console.log(error);
    } finally {
      spinner.close();
    }
  };

  kintone.events.on('app.record.index.show', async (event) => {
    if (event.viewId !== 6414768 && event.viewId !== 6428250) return event;
    if (!HC_MEMBER_ID.includes(kintone.getLoginUser().id)) return event;

    try {
      // ボタン
      const updateStatusButton = new Kuc.Button({
        text: '商品マスタの掲載ステータスを更新',
        type: 'submit',
      });
      updateStatusButton.addEventListener('click', updateItemMasterStatus_Top);
      kintone.app.getHeaderMenuSpaceElement().appendChild(updateStatusButton);
    } catch (error) {
      console.log(error);
      event.error = error.message;
    }
  });
})();
