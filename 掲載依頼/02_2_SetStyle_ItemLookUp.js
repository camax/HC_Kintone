/***
 * 商品ルックアップに関連するUI制御
 */

(function() {
  "use strict";

  // --新規・編集画面
  kintone.events.on(['app.record.create.show','app.record.edit.show'], async(event) => {

      for (let j = 1; j <= 10; j++){

        // 商品データがルックアップされている場合
        if(event.record['商品レコードID_'+j].value){
          // 非表示
          kintone.app.record.setFieldShown('商品コード_'+j, false);
          kintone.app.record.setFieldShown('メーカー名_'+j, false);
          kintone.app.record.setFieldShown('希望小売価格バラ_税抜_'+j, false);

          // ルックアップ取得情報を非活性化
          event.record['商品名_'+j]['disabled'] = true;
          event.record['JAN_'+j]['disabled'] = true;
          event.record['賞味期限_'+j]['disabled'] = true;
          event.record['商品参考URL_'+j]['disabled'] = true;

        }else{
          // 非表示
          kintone.app.record.setFieldShown('商品コード_'+j+'_ルックアップ', false);
          kintone.app.record.setFieldShown('メーカー名_'+j+'_ルックアップ', false);
          kintone.app.record.setFieldShown('希望小売価格バラ_税抜_'+j+'_ルックアップ', false);

          // ルックアップ取得情報を活性化
          event.record['商品名_'+j]['disabled'] = false;
          event.record['JAN_'+j]['disabled'] = false;
          event.record['賞味期限_'+j]['disabled'] = false;
          event.record['商品参考URL_'+j]['disabled'] = false;
        }
        
      }

      return event;
  });


  // --詳細画面
  kintone.events.on(['app.record.detail.show'], async(event) => {
    for (let j = 1; j <= 10; j++){
      // 商品データがルックアップされている場合
      if(event.record['商品レコードID_'+j].value){
        // 非表示
        kintone.app.record.setFieldShown('商品コード_'+j, false);
        kintone.app.record.setFieldShown('メーカー名_'+j, false);
        kintone.app.record.setFieldShown('希望小売価格バラ_税抜_'+j, false);

      }else{
        // 非表示
        kintone.app.record.setFieldShown('商品コード_'+j+'_ルックアップ', false);
        kintone.app.record.setFieldShown('メーカー名_'+j+'_ルックアップ', false);
        kintone.app.record.setFieldShown('希望小売価格バラ_税抜_'+j+'_ルックアップ', false);
      }
    }
  });


  /**
   * 商品コードルックアップ選択
   */
  const SetLookUpCode = event => {

    // 商品コード_既存の値が選択
    let type = event.type;
    let j = type.split('_');

    // ルックアップで取得の場合はtrue
    let active = (typeof(event.record['商品レコードID_'+j[1]].value) != "undefined");
    
    // 表示制御
    kintone.app.record.setFieldShown('商品コード_'+j[1]+'_ルックアップ', active);
    kintone.app.record.setFieldShown('メーカー名_'+j[1]+'_ルックアップ', active);
    kintone.app.record.setFieldShown('希望小売価格バラ_税抜_'+j[1]+'_ルックアップ', active);

    kintone.app.record.setFieldShown('商品コード_'+j[1], !active);
    kintone.app.record.setFieldShown('メーカー名_'+j[1], !active);
    kintone.app.record.setFieldShown('希望小売価格バラ_税抜_'+j[1], !active);


    // ルックアップ取得情報のdisabled制御
    event.record['商品名_'+j[1]]['disabled'] = active;
    event.record['JAN_'+j[1]]['disabled'] = active;
    event.record['賞味期限_'+j[1]]['disabled'] = active;
    event.record['商品参考URL_'+j[1]]['disabled'] = active;

    return event;
  } 

  // --商品ルックアップ選択
  let eventsList_0 = [];
  for (let i = 1; i <= 10; i++){
    let code = '商品コード_'+i+'_ルックアップ';
    eventsList_0.push('app.record.edit.change.'+code, 'app.record.create.change.'+code);
  }
  kintone.events.on(eventsList_0, SetLookUpCode);

})();