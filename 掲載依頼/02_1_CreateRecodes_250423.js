// 商品マスタ・案件管理へのレコード作成のみ
(function () {
  'use strict';

  const HC_ITEM_APP_ID = HC.apps.商品マスタ.id;
  const HC_MATTER_APP_ID = HC.apps.案件管理.id;
  const HC_APPLICATION_APP_ID = HC.apps.申込管理.id;
  const HC_SETNUMBER_APP_ID = HC.apps.掲載セット数管理.id;
  const HC_DOMAIN = HC.domain.url;
  const HC_MALLS = HC.malls;
  const MALL_NUM_PREFIX = 'beauth';
  const MALL_NUM_PREFIX_TP = 'HC';

  /**
   * 【商品マスタ】にレコードを生成する
   */
  const CreateRecodeToItemApp = async (event) => {
    const record = event.record;

    // 商品1~10で商品コードが登録されている商品をレコード生成
    let paramRecords = [];
    for (let j = 1; j <= 10; j++) {
      let codeId = record['商品レコードID_' + j].value;
      let code = record['商品コード_' + j].value;
      if (!codeId && code) {
        let paramRecord = {
          商品コード: { value: record['商品コード_' + j].value },
          メーカー名: { value: record['メーカー名_' + j].value },
          商品名: { value: record['商品名_' + j].value },
          JAN: { value: record['JAN_' + j].value },
          賞味期限: { value: record['賞味期限_' + j].value },
          商品参考URL: { value: record['商品参考URL_' + j].value },
          ケース入数: { value: record['ケース入数_' + j].value },
          希望小売価格_バラ_税抜: { value: record['希望小売価格バラ_税抜_' + j].value },
          通常_アウトレット: { value: record['通常_アウトレット'].value },
          税率: { value: record['税率'].value },
          入稿担当者: { value: record['入稿担当者'].value },
        };
        paramRecords.push(paramRecord);
      }
    }

    let param = {
      app: HC_ITEM_APP_ID,
      records: paramRecords,
    };

    return new KintoneRestAPIClient().record
      .addRecords(param)
      .then(function (resp) {
        return resp;
      })
      .catch(function (e) {
        console.log(e);
        return e;
      });
  };

  /**
   * モール管理番号を取得（'beauth-yyyyMMdd-001'）
   */
  const GetUniqueMallNumberBeauth = async () => {
    let date = luxon.DateTime.now();
    let mallNumPrefix = MALL_NUM_PREFIX + '-' + date.toFormat('yyyyMMdd');

    // 案件管理から該当するレコードを取得
    let matterRecords = await new KintoneRestAPIClient().record.getRecords({
      app: HC_MATTER_APP_ID,
      query: `モール管理番号 like "${mallNumPrefix}"`,
    });

    let mallNumber = null;
    if (matterRecords.records.length == 0) {
      mallNumber = mallNumPrefix + '-001';
    } else {
      let maxNumber = matterRecords.records.reduce((max, record) => Math.max(max, parseInt(record.モール管理番号.value.split('-')[2])), 0);
      mallNumber = mallNumPrefix + '-' + (maxNumber + 1).toString().padStart(3, '0');
    }
    return mallNumber;
  };

  /**
   * モール管理番号を取得（'HCyyyyMMdd001'）
   */
  const GetUniqueMallNumberTpoint = async () => {
    let date = luxon.DateTime.now();
    let mallNumPrefix = MALL_NUM_PREFIX_TP + date.toFormat('yyyyMMdd');

    // 案件管理から該当するレコードを取得
    let matterRecords = await new KintoneRestAPIClient().record.getRecords({
      app: HC_MATTER_APP_ID,
      query: `掲載媒体名 = "Tポイント" order by モール管理番号 desc limit 100`,
      fields: ['モール管理番号'],
    });

    let mallNumber = null;
    if (matterRecords.records.length == 0) {
      mallNumber = mallNumPrefix + '001';
    } else {
      // 今日の日付(yyyyMMdd)のモール管理番号だけにする
      let filteredRecords = matterRecords.records.filter((record) => record.モール管理番号.value.startsWith(mallNumPrefix));
      if (filteredRecords.length == 0) {
        mallNumber = mallNumPrefix + '001';
      } else {
        // 降順にソート
        filteredRecords.sort((a, b) => b.モール管理番号.value.localeCompare(a.モール管理番号.value));
        // 最後の3文字
        let lastThree = filteredRecords[0].モール管理番号.value.slice(-3);

        mallNumber = mallNumPrefix + (Number(lastThree) + 1).toString().padStart(3, '0');
      }
    }
    return mallNumber;
  };

  /**
   * 【案件管理】にレコードを生成する
   */
  const CreateRecodeToMatterApp = async (record) => {
    let matterIds = [];
    let applicationIds = [];
    let setNumberIds = [];
    try {
      const malls = HC_MALLS;
      let groupId = null;
      for (let mall of malls) {
        // Temu専用分岐（共通ファイル利用）
        if (mall === 'Temu') {
          // 共通関数で媒体固有ルール適用
          record = HC_UTILS.applyMallSpecificRules('temu', record);

          // Temu用フィールド設定（基本的には他媒体と同様）
          let paramRecord = {
            掲載依頼レコードID: { value: record.$id.value },
            掲載依頼レコードURL: { value: 'https://' + HC_DOMAIN + '/k/' + HC.apps.掲載依頼.id + '/show#record=' + record.$id.value },
            掲載モール: { value: 'Temu' },
            掲載媒体名: { value: 'Temu' },
            掲載商品名: { value: record['掲載商品名_その他'].value || record['掲載商品名'].value },
            メーカー確認: { value: record['メーカー確認'].value },
            税率: { value: record['税率'].value },
            最短賞味期限: { value: record['最短賞味期限'].value },
            掲載終了日: { value: record['掲載終了日_その他'].value || record['掲載終了日'].value },
            掲載残日数: { value: record['掲載残日数_その他'].value || record['掲載残日数'].value },
            セット数: { value: record['セット数_temu']?.value || 0 },
            売価_税抜: { value: record['売価_税抜_temu']?.value || 0 },
            HC利益率: { value: record['HC利益率_temu']?.value || 0 },
            配送サイズ名: { value: record['配送サイズ名'].value },
            資材名: { value: record['資材名'].value },
            アソート有無: { value: record['アソート有無'].value },
            三菱手数料バラ_税抜: { value: record['三菱手数料バラ_税抜'].value },
            検品料: { value: record['検品料'].value },
            緩衝材費有無: { value: record['緩衝材費有無'].value },
            配送費追加: { value: record['配送費追加'].value },
            分析カテゴリーID: { value: record['分析カテゴリーID'].value },
            セット入数合計: { value: record['セット入数合計'].value },
            希望小売価格セット_税抜: { value: record['希望小売価格セット_税抜'].value },
            希望小売価格セット_税込: { value: record['希望小売価格セット_税込'].value },
            取引形式: { value: record['取引形式'].value },
            商品数: { value: record['セット数_temu']?.value || 0 },
            商品の総取り扱い数: { value: record['セット数_temu']?.value || 0 },
          };

          // 採番（共通関数で生成）
          try {
            let todayStr = HC_UTILS.formatDate(new Date()).replace(/-/g, '');
            const temuNumber = HC_UTILS.formatMallNumber('TEMU', todayStr);
            paramRecord['モール管理番号'] = { value: temuNumber };
          } catch (e) {
            HC_UTILS.handleError('TemuMallNumber', e, record);
          }

          // 案件管理アプリに登録
          let param = { app: HC_MATTER_APP_ID, record: paramRecord };
          await new KintoneRestAPIClient().record
            .addRecord(param)
            .then(async function (resp) {
              matterIds.push(resp.id);
              if (groupId === null) groupId = resp.id;
              UpdateRecodeToMatterApp(HC_MATTER_APP_ID, resp.id, groupId);
            })
            .catch(function (e) {
              HC_UTILS.handleError('CreateTemuRecord', e, record);
            });

          continue; // Temu処理を終えたら次の媒体へ
        }

        if (mall == '坂戸以外') continue;

        // ★ FiNC を WELBOX に置き換える
        let mallNameForKintone = mall;
        if (mallNameForKintone === 'FiNC') {
          mallNameForKintone = 'WELBOX';
        }

        let length = record['案件採用_' + mall].value.length;
        if (length == 1) {
          let paramRecord = {
            掲載依頼レコードID: { value: record.$id.value },
            掲載依頼レコードURL: { value: 'https://' + HC_DOMAIN + '/k/' + HC.apps.掲載依頼.id + '/show#record=' + record.$id.value },

            掲載モール: { value: mallNameForKintone },
            掲載媒体名: { value: mallNameForKintone },
            掲載商品名: { value: mall == 'au' || mall == 'Tサンプル' ? record['掲載商品名'].value : record['掲載商品名_その他'].value },
            メーカー確認: { value: record['メーカー確認'].value },

            税率: { value: record['税率'].value },
            最短賞味期限: { value: record['最短賞味期限'].value },
            掲載終了日: { value: mall == 'au' || mall == 'Tサンプル' || mall == 'FiNC' ? record['掲載終了日'].value : record['掲載終了日_その他'].value },
            掲載残日数: { value: mall == 'au' || mall == 'Tサンプル' || mall == 'FiNC' ? record['掲載残日数'].value : record['掲載残日数_その他'].value },
            セット数: { value: record['セット数_' + mall].value },
            HC利益率: { value: record['HC利益率_' + mall].value },
            売価_税抜: { value: record['売価_税抜_' + mall].value },

            // 配送費関連
            配送サイズ名: { value: record['配送サイズ名'].value },
            資材名: { value: record['資材名'].value },
            アソート有無: { value: record['アソート有無'].value },
            三菱手数料バラ_税抜: { value: record['三菱手数料バラ_税抜'].value },
            検品料: { value: record['検品料'].value },
            緩衝材費有無: { value: record['緩衝材費有無'].value },
            配送費追加: { value: record['配送費追加'].value },

            分析カテゴリーID: { value: record['分析カテゴリーID'].value },
            セット入数合計: { value: record['セット入数合計'].value },
            希望小売価格セット_税抜: { value: record['希望小売価格セット_税抜'].value },
            希望小売価格セット_税込: { value: record['希望小売価格セット_税込'].value },
          };

          // Tポイントの場合
          if (mall == 'Tポイント') {
            // モール管理番号を取得（'HCyyyyMMdd001'）
            let mallNumber = await GetUniqueMallNumberTpoint();
            paramRecord['モール管理番号'] = { value: mallNumber };
          }

          // eecoto独自項目
          if (mall == 'eecoto') {
            paramRecord['寄付金額_' + mall] = { value: record['寄付金額_' + mall].value };
            // モール管理番号を取得（'beauth-yyyyMMdd-001'）
            let mallNumber = await GetUniqueMallNumberBeauth();
            paramRecord['モール管理番号'] = { value: mallNumber };
          }

          paramRecord['取引形式'] = { value: record['取引形式'].value };

          // HC管理用
          paramRecord['商品数'] = { value: paramRecord['セット数'].value };
          paramRecord['商品の総取り扱い数'] = { value: paramRecord['セット数'].value };

          // 商品情報
          for (let j = 1; j <= 10; j++) {
            let code = record['商品コード_' + j].value;
            let code2 = record['商品コード_' + j + '_ルックアップ'].value;
            let codeId = record['商品レコードID_' + j].value;
            if (!code && !codeId) continue;

            let itemRecordCode = codeId != '' ? code2 : code;
            paramRecord['商品コード_' + j] = { value: itemRecordCode };
            paramRecord['セット入数_' + j] = { value: record['セット入数_' + j].value };
          }

          // 案件管理レコード生成
          let param = {
            app: HC_MATTER_APP_ID,
            record: paramRecord,
          };

          await new KintoneRestAPIClient().record
            .addRecord(param)
            .then(async function (resp) {
              matterIds.push(resp.id);

              // 案件番号を更新
              if (groupId === null) groupId = resp.id;
              UpdateRecodeToMatterApp(HC_MATTER_APP_ID, resp.id, groupId);

              // 申込管理レコード生成
              // let respApp = await CreateRecodeToApplicationApp(resp, record, mall);
              // if(respApp.status == 0) applicationIds.push(respApp.resp.id);
              // if(respApp.status == 9) throw respApp;
            })
            .catch(function (e) {
              console.log(e);
              throw e;
            });
        }
      }

      // 掲載セット数管理生成
      let respApp1 = await CreateRecodeToSetNumberApp(record, groupId);
      if (respApp1.status == 0) setNumberIds.push(respApp1.resp.id);
      if (respApp1.status == 9) throw respApp1;

      // 【掲載依頼】に案件グループIDを記入
      record['案件グループID'].value = 'HC-' + groupId;

      return { status: 0 };
    } catch (e) {
      console.log(e);

      // 失敗した場合は生成したレコードを削除
      // 案件管理
      console.log(matterIds);
      if (matterIds.length != 0) DeleteRecodes(HC_MATTER_APP_ID, matterIds);
      // セット数管理
      console.log(setNumberIds);
      if (setNumberIds.length != 0) DeleteRecodes(HC_SETNUMBER_APP_ID, setNumberIds);

      return { e: e, status: 9 };
    }
  };

  /**
   * 案件管理アプリの案件番号を更新
   * @param  appId  更新AppID
   * @param  recordId 更新レコードID
   */
  const UpdateRecodeToMatterApp = (appId, recordId, groupId) => {
    let record = {
      案件グループID: {
        value: 'HC-' + groupId,
      },
      掲載モール連携番号: {
        value: 'HCH-' + recordId,
      },
    };
    let param = {
      app: appId,
      id: recordId,
      record: record,
    };

    return new KintoneRestAPIClient().record
      .updateRecord(param)
      .then(function (resp) {})
      .catch(function (e) {
        throw e.message;
      });
  };

  /**
   * プロセス管理アクション実行時
   */
  kintone.events.on(['app.record.detail.process.proceed'], async function (event) {
    var record = event.record;
    var nextStatus = event.nextStatus.value;

    switch (nextStatus) {
      case '商品レコード発行済み':
        // 【商品マスタ】にレコードを生成する
        let res1 = await CreateRecodeToItemApp(event);
        if ('errors' in res1) event.error = '【商品マスタ】レコードに生成に失敗しました。入力内容に不備がありました。商品コードが重複などご確認ください';
        break;

      case '案件レコード発行済み':
        // 【案件管理】にレコードを生成する
        let res2 = await CreateRecodeToMatterApp(record);
        if (res2.status == 9) {
          event.error = '【案件管理】レコードに生成に失敗しました。入力内容を確認してください。';
        }
        break;
    }

    return event;
  });

  /**
   * 【掲載セット数管理】にレコードを生成する
   * @param  {kinton event object} event
   */
  const CreateRecodeToSetNumberApp = async (record, groupId) => {
    try {
      let date = new Date();
      let resTbRecords = [
        {
          value: {
            増減数量: { value: Number(record['掲載セット数合計'].value) },
            変更日: { value: date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate() },
          },
        },
      ];

      let param = {
        app: HC_SETNUMBER_APP_ID,
        record: {
          掲載依頼レコードID: { value: record.$id.value },
          掲載依頼レコードURL: { value: 'https://' + HC_DOMAIN + '/k/' + HC.apps.掲載依頼.id + '/show#record=' + record.$id.value },

          // セット数
          セット数_au: { value: record['セット数_au'].value },
          セット数_Tサンプル: { value: record['セット数_Tサンプル'].value },
          セット数_くまポン: { value: record['セット数_くまポン'].value },
          セット数_FiNC: { value: record['セット数_FiNC'].value },
          セット数_eecoto: { value: record['セット数_eecoto'].value },

          掲載商品名: { value: record['掲載商品名'].value },
          掲載商品名_その他: { value: record['掲載商品名_その他'].value },
          セット数変更履歴: { value: resTbRecords },

          // 案件グループID
          案件グループID: { value: 'HC-' + groupId },
        },
      };

      return await new KintoneRestAPIClient().record
        .addRecord(param)
        .then(function (resp) {
          return { resp: resp, status: 0 };
        })
        .catch(function (e) {
          console.log(e);
          return { e: e, status: 9 };
        });
    } catch (e) {
      console.log(e);
      return { errors: '【掲載セット数管理】レコードに生成に失敗しました。', status: 9 };
    }
  };

  /**
   * 商品マスタの案件関連情報を更新
   * @param {*} record
   * @param {Array} matterIds
   * @returns
   */
  const UpdateRecodeToItemApp = async (record, matterIds, groupId) => {
    try {
      // 案件管理一覧を作成
      let newTbRecords = [];
      matterIds.forEach((id) => {
        let row = {
          value: {
            案件管理レコード_レコードID: { value: id },
            案件管理レコード_案件グループID: { value: 'HC-' + groupId },
          },
        };
        newTbRecords.push(row);
      });

      // 登録されてる各商品の総在庫数を更新
      for (let i = 1; i <= 10; i++) {
        //　商品が登録されてるかチェック
        let code = record['商品コード_' + i].value;
        let code2 = record['商品コード_' + i + '_ルックアップ'].value;
        if (!code && !code2) continue;

        // 対象の商品コードを取得
        let itemRecordCode = code == '' ? code2 : code;

        // --商品マスタから各媒体掲載数合計を取得
        let item = await GetItem(HC_ITEM_APP_ID, itemRecordCode);

        // 案件管理一覧の設定
        let tbRecords = item[0]['案件管理レコード'].value;
        let reqtbRecords = tbRecords.concat(newTbRecords);
        let reqRecord = { 案件管理レコード: { value: reqtbRecords } };

        // 各媒体掲載数合計の設定
        // --セット数合計・各商品のセット入数を取得
        let setSumNumber = record['セット数合計'].value;
        let individualNum = record['セット入数_' + i].value;

        if (individualNum || individualNum != 0) {
          // --追加分の媒体掲載数 (総セットバラ数)
          let diffIndividualNum = setSumNumber * individualNum;

          // --各媒体掲載数合計に追加分を加算
          let sumNum = Number(item[0]['各媒体掲載数合計'].value) + Number(diffIndividualNum);

          reqRecord['各媒体掲載数合計'] = { value: sumNum };
        }

        // 各媒体掲載数合計・案件管理一覧を更新
        await UpdateRecodeByItmeMasterApp(HC_ITEM_APP_ID, item[0]['$id'].value, reqRecord)
          .then(function () {
            //console.log(resp)
          })
          .catch(function (e) {
            console.log(e);
          });
      }

      return { resp: null, status: 0 };
    } catch (e) {
      console.log(e);
      return { errors: '【商品マスタ】レコードに生成に失敗しました。', status: 9 };
    }
  };

  /**
   * 商品マスター対象レコードの各媒体掲載数合計を更新
   * @param  appId  更新AppID
   * @param  recordId 更新レコードIDを
   * @param  sumNum 在庫数
   */
  const UpdateRecodeByItmeMasterApp = (appId, recordId, record) => {
    // 各媒体掲載数合計、案件管理一覧
    let param = {
      app: appId,
      id: recordId,
      record: record,
    };

    return new KintoneRestAPIClient().record
      .updateRecord(param)
      .then(function () {})
      .catch(function (e) {
        throw e.message;
      });
  };

  /**
   * 商品マスターから案件管理一覧・各媒体掲載数合計を取得
   * @param  appId
   * @param  itemRecordCode
   */
  const GetItem = async (appId, itemRecordCode) => {
    return await new KintoneRestAPIClient().record
      .getRecords({
        app: appId,
        fields: ['各媒体掲載数合計', '案件管理レコード', '$id'],
        query: '商品コード = "@id"'.replace('@id', itemRecordCode),
      })
      .then(function (resp) {
        return resp.records;
      })
      .catch(function (err) {
        console.log(err);
      });
  };

  /**
   * レコードの一括削除
   * @param {*} appId 削除先アプリID
   * @param {*} ids 削除レコードID
   */
  const DeleteRecodes = (appId, ids) => {
    new KintoneRestAPIClient().record
      .deleteRecords({ app: appId, ids: ids })
      .then(function (resp) {})
      .catch(function (e) {
        console.log(e);
        throw e;
      });
  };
})();
