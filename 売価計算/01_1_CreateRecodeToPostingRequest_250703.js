/**
 * データ連携 売価計算APP->掲載依頼APP
 *
 */
(() => {
  'use strict';

  const HC_POSTINGREQUEST_APP_ID = HC.apps.掲載依頼.id;
  const HC_PRICE_APP_ID = HC.apps.売価計算.id;
  const HC_DOMAIN = HC.domain.url;
  // Ensure TEMU and WELBOX are included in the malls list
  const HC_MALLS = HC.malls || ['au', 'kumapon', 'FiNC', 'eecoto', 'モラタメ', 'TEMU', 'WELBOX'];

  /**
   * 掲載依頼APPへのデータ登録更新
   * @param {*} event
   */
  const CreateRecodeToPostingRequestApp = async (event) => {
    const record = event.record;
    try {
      // リクエスト情報
      let reqRecord = SetReqRecord(record);
      let id = record['掲載依頼レコードID'].value;

      if (id) {
        // 更新
        await UpdateRecode(HC_POSTINGREQUEST_APP_ID, id, reqRecord);
      } else {
        // 登録
        reqRecord['売価計算レコードID'] = { value: record.$id.value };
        reqRecord['売価計算レコードURL'] = {
          value: 'https://' + HC_DOMAIN + '/k/' + HC_PRICE_APP_ID + '/show#record=' + record.$id.value,
        };
        await CreateRecode(HC_POSTINGREQUEST_APP_ID, reqRecord, record.$id.value);
      }

      await ShowSwal('掲載依頼レコードを反映しました。', 'success');
    } catch (ex) {
      console.error(ex);
      await ShowSwal('掲載依頼レコードの反映に失敗しました。\n' + ex, 'error');
    }
  };

  /**
   * レコードを生成
   */
  const CreateRecode = async (appId, reqRecord, priceId) => {
    try {
      let param = { app: appId, record: reqRecord };
      return await new KintoneRestAPIClient().record.addRecord(param).then((resp) => {
        // 売価計算レコードに掲載依頼IDをセット
        UpdateRecode(HC_PRICE_APP_ID, priceId, {
          掲載依頼レコードID: { value: resp.id },
          掲載依頼レコードURL: {
            value: 'https://' + HC_DOMAIN + '/k/' + HC_POSTINGREQUEST_APP_ID + '/show#record=' + resp.id,
          },
        });
      });
    } catch (ex) {
      console.error(ex);
      throw ex;
    }
  };

  /**
   * レコードを更新
   */
  const UpdateRecode = async (appId, recordId, record) => {
    let param = { app: appId, id: recordId, record: record };
    return await new KintoneRestAPIClient().record.updateRecord(param).catch((e) => {
      console.error(e);
      throw e;
    });
  };

  /**
   * リクエストレコードの生成
   */
  const SetReqRecord = (record) => {
    try {
      let reqRecord = {};

      // --- モール売価・採用・利益率情報 ---
      const malls = HC_MALLS;
      for (let mall of malls) {
        if (mall === '坂戸以外') continue;

        // 採用フラグ
        let adopted = record['案件採用_' + mall].value;
        if (adopted.length === 1) {
          reqRecord['案件採用_' + mall] = { value: adopted };
          reqRecord['売上_税抜_' + mall] = { value: record['売上_税抜_' + mall].value };
          reqRecord['セット数_' + mall] = { value: record['セット数_' + mall].value };
          reqRecord['HC利益率_' + mall] = { value: record['HC利益率_' + mall].value };

          // eecoto独自
          if (mall === 'eecoto') {
            reqRecord['寄付金額_' + mall] = { value: record['寄付金額_' + mall].value };
          }

          // 売価・納価の連携
          // Note: TEMU and WELBOX use the standard 売価_税抜_ path, not 納価
          const nokaMalls = ['リロ', 'ベネ', 'Tポイント', '社販'];
          if (nokaMalls.includes(mall)) {
            // 納価を参照するモール
            reqRecord['売価_税抜_' + mall] = { value: record['納価_' + mall].value };
          } else {
            // 売価（税抜）を参照するモール (おためし, etc.)
            reqRecord['売価_税抜_' + mall] = { value: record['売価_税抜_' + mall].value };
          }
        }
      }

      // --- 備考フィールドのマッピング ---
      const noteFieldMap = {
        くまポン: { src: '備考_kumapon', dest: '備考_くまポン' },
        リロクラブ: { src: '備考_リロ', dest: '備考_リロ' },
        ベネフィットワン: { src: '備考_ベネ', dest: '備考_ベネ' },
        KAUCHE: { src: '備考_おためし', dest: '備考_おためし' },
        V景品交換: { src: '備考_Tポイント', dest: '備考_Tポイント' },
        社内販売ネットモール: { src: '備考_社販', dest: '備考_社販' },
        TEMU: { src: '備考_TEMU', dest: '備考_temu' },
        BEAUTH: { src: '備考_eecoto', dest: '備考_eecoto' },
        モラタメ: { src: '備考_モラタメ', dest: '備考_モラタメ' },
        WELBOX: { src: '備考_FiNC', dest: '備考_FiNC' },
      };

      // --- 掲載情報 ---
      reqRecord['掲載商品名'] = { value: record['掲載商品名_au'].value };
      reqRecord['掲載商品名_その他'] = { value: record['掲載商品名_その他'].value };

      // --- 配送費関連 ---
      reqRecord['配送サイズ名'] = { value: record['配送サイズ名'].value };
      reqRecord['資材名'] = { value: record['資材名'].value };
      reqRecord['アソート有無'] = { value: record['アソート有無'].value };
      reqRecord['三菱手数料バラ_税抜'] = { value: record['三菱手数料バラ_税抜'].value };
      reqRecord['検品料'] = { value: record['検品料'].value };
      reqRecord['緩衝材費有無'] = { value: record['緩衝材費有無'].value };
      reqRecord['配送費追加'] = { value: record['配送費追加'].value };

      // --- 商品情報（サブテーブル） ---
      let subTable = record['商品情報一覧'].value || [];
      subTable.forEach((rowObj, idx) => {
        let row = rowObj.value;
        let i = idx + 1;
        let itemId = row['商品情報一覧_商品レコードID'].value;
        if (itemId) {
          reqRecord['商品レコードID_' + i] = { value: itemId };
        } else {
          reqRecord['商品コード_' + i] = { value: row['商品情報一覧_商品コード'].value };
          reqRecord['希望小売価格バラ_税抜_' + i] = { value: row['商品情報一覧_希望小売価格バラ_税抜'].value };
        }
        reqRecord['セット入数_' + i] = { value: row['商品情報一覧_セット入数'].value };
        reqRecord['ケース入数_' + i] = { value: row['商品情報一覧_ケース入数'].value };
        reqRecord['バラ数_' + i] = { value: row['商品情報一覧_発注バラ数'].value };
        reqRecord['仕入れバラ_税抜_' + i] = { value: row['商品情報一覧_仕入れバラ_税抜'].value };
        reqRecord['最安値_' + i] = { value: row['商品情報一覧_最安値'].value };
        reqRecord['最安値URL_' + i] = { value: row['商品情報一覧_最安値URL'].value };
      });

      // --- その他 ---
      reqRecord['税率'] = { value: record['税率'].value };
      reqRecord['セット数合計'] = { value: record['媒体セット数合計'].value };
      reqRecord['担当者'] = { value: record['担当者'].value };
      reqRecord['取引形式'] = { value: record['取引形式'].value };

      return reqRecord;
    } catch (ex) {
      console.error(ex);
      throw ex;
    }
  };

  /**
   * ポップアップ表示
   */
  const ShowSwal = async (text, icon) => {
    await swal({
      title: '【掲載依頼】レコード反映',
      text: text,
      icon: icon,
      timer: 10000,
    }).then(() => {
      location.reload(true);
    });
  };

  /**
   * [掲載依頼アプリに反映]ボタン表示
   */
  kintone.events.on('app.record.detail.show', (event) => {
    const button = document.createElement('button');
    button.id = 'hc_space_field_button';
    button.classList.add('kintoneplugin-button-normal');
    button.innerText = '掲載依頼アプリに反映';
    button.onclick = () => {
      swal({
        title: '【掲載依頼】レコード反映',
        text: '掲載依頼アプリにレコードを生成または更新してもよろしいですか',
        icon: 'info',
        buttons: true,
      }).then((ok) => {
        if (ok) CreateRecodeToPostingRequestApp(event);
      });
    };
    kintone.app.record.getSpaceElement('hc_space_field').appendChild(button);
    return event;
  });
})();
