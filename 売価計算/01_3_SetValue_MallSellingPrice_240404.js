/**
 *  各掲載案件の売価情報を設定
 *
 * ■ トリガー
 *  採用フラグチェック時の動作
 *
 * ■ 動作
 * 採用フラグが有効
 *  ・下記のフィールドをコピー
 *    売価計算 => 売価（税抜）_mall, HC利益率 = HC利益率_mall,  HC利益 =  HC利益_mall
 *
 *  ・下記のフィールドを計算
 *    売上_税抜 = セット数 * 売価_税抜
 *    セット利益 = HC利益 * セット数
 *    損益分岐点 = 合計_発注金額_税抜 * (合計_セット仕入れ価格_税抜 + セット利益)
 *
 *  ・売価シュミレーション項目は非活性化
 *
 * 採用フラグが無効
 *  ・売価シュミレーション項目を活性化
 */

(function () {
  'use strict';

  const mallGroups = ['au', 'kumapon', 'FiNC', 'eecoto', 'モラタメ', 'TEMU', 'WELBOX'];

  /**
   * 採用フラグ操作
   */
  const SetDisabled = (event) => {
    const fields = ['売価_税抜_', '売価_税込_', 'オフ率_', '売価1個あたり_税抜_', '売価1個あたり_税込_', '納価_', 'HC利益_税抜_', 'HC利益率_', '指値_税抜_'];

    // 採用シュミレーション番号, モール情報の取得
    let type = event.type;
    let ts = type.split('_');
    let index = Number(ts[1]);
    let mallGroup = ts[2];
    let malls = GetMalls(mallGroup);

    // 採用フラグの取得
    let value = event.changes.field.value;
    let flag = value.length == 1;

    // 採用シミュレーションの個数
    let simNums = [1, 2, 3];
    // くまポンの場合
    if (mallGroup === 'kumapon') {
      simNums.push(4);
      event.record['ギフト券_4_' + mallGroup]['disabled'] = flag;
    }

    // 採用情報の反映
    simNums.forEach((caseIndexs) => {
      let code = caseIndexs + '_' + mallGroup;

      // --採用シュミレーションのDisabled設定
      fields.forEach((field) => {
        event.record[field + code]['disabled'] = flag;
      });

      if (flag) {
        if (caseIndexs == index) {
          // --掲載案件の売価情報を設定
          malls.forEach((mall) => {
            console.log(mall);
            console.log(event.record['HC利益率_' + code].value);

            // フィールドの活性化
            event.record['セット数_' + mall]['disabled'] = flag;

            event.record['売価_税抜_' + mall].value = event.record['売価_税抜_' + code].value;
            event.record['納価_' + mall].value = event.record['納価_' + code].value;
            event.record['HC利益率_' + mall].value = Number(event.record['HC利益率_' + code].value);
            event.record['HC利益_' + mall].value = event.record['HC利益_税抜_' + code].value;

            let setNumber = Number(event.record['セット数_' + mall].value);
            if (isNaN(setNumber)) setNumber = 0;
            event.record['売上_税抜_' + mall].value = setNumber * Number(event.record['売価_税抜_' + code].value);
            event.record['セット利益_' + mall].value = setNumber * Number(event.record['HC利益_税抜_' + code].value);

            let sumOrderAmount = Number(event.record['合計_発注金額_税抜'].value);
            let sumSetPurchasePrice = Number(event.record['合計_セット仕入れ価格_税抜'].value);
            event.record['損益分岐点_' + mall].value = sumOrderAmount * (sumSetPurchasePrice + setNumber * Number(event.record['HC利益_税抜_' + code].value));

            if (mall == 'au') {
              // 採用フラグが有効な売価が設定される
              event.record['配送関連費_' + mall].value = event.record['売価_税抜_' + code].value;
            }
          });
        } else {
          // --採用シュミレーションのDisabled設定
          event.record['採用フラグ_' + code]['disabled'] = flag;
        }
      } else {
        malls.forEach((mall) => {
          event.record['売価_税抜_' + mall].value = 0;
          event.record['納価_' + mall].value = 0;
          event.record['HC利益率_' + mall].value = 0;
          event.record['HC利益_' + mall].value = 0;
          event.record['売上_税抜_' + mall].value = 0;
          event.record['セット利益_' + mall].value = 0;
          event.record['損益分岐点_' + mall].value = 0;

          if (mall == 'au') {
            // 採用フラグが有効な売価が設定される
            event.record['配送関連費_' + mall].value = 0;
          }

          // フィールドの活性化
          event.record['セット数_' + mall]['disabled'] = flag;
        });

        // フィールドの活性化
        event.record['採用フラグ_' + code]['disabled'] = flag;
      }
    });

    return event;
  };

  /**
   * モール名を取得
   * @param {*} mall モール名
   */
  const GetMalls = (mall) => {
    switch (mall) {
      case 'au':
        return ['au', 'Tサンプル'];
      case 'kumapon':
        return ['くまポン'];
      case 'TEMU':
        return ['TEMU'];
      case 'WELBOX':
        return ['WELBOX'];
      default:
        return [mall];
    }
  };

  // イベントの設定
  let eventsList_0 = [];
  mallGroups.forEach((mallGroup) => {
    for (let i = 1; i <= 4; i++) {
      let code = '採用フラグ_' + i + '_' + mallGroup;
      eventsList_0.push('app.record.edit.change.' + code, 'app.record.create.change.' + code);
    }
  });
  kintone.events.on(eventsList_0, SetDisabled);
})();
