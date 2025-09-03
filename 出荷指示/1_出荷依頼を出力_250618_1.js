/**
 * 出荷依頼をCSVでダウンロードする
 * HCの場合、DLだけ
 */
(() => {
  'use strict';
  luxon.Settings.defaultLocale = 'ja';

  const client = new KintoneRestAPIClient();
  const APP_ID = kintone.app.getId();

  const CODE_CLIENT_1 = '131960390509'; // 60，80サイズのご依頼主コード
  const CODE_CLIENT_2 = '131960390495'; // 100，140，160サイズのご依頼主コード

  const HC_MEMBER_ID = ['1', '3', '6'];

  let resParam = { status: 1, message: '' };

  // 出荷依頼のCSVの項目
  let shippingFields = {
    佐川急便: [
      { title: '行番号', field: '行番号', value: '' },
      { title: '問い合せ№', field: 'レコード番号', value: '' },
      { title: '指定出荷日', field: '指定出荷日', value: '' },
      { title: '商品コード', field: '商品コード', value: '' },
      { title: 'バラ数', field: '個数', value: '' },
      { title: '賞味期限', field: '賞味期限', value: '' },

      { title: 'ご依頼主コード', field: 'サイズ', value: '' }, // サイズでご依頼主コードが変わるので、fieldは「サイズ」を指定
      { title: '部署ご担当者コード', field: '', value: '' },
      { title: '部署ご担当者名', field: '', value: '' },
      { title: 'ご依頼主電話', field: '', value: '' },
      { title: 'お届け先コード', field: '', value: '' },
      { title: 'お届け先郵便番号', field: '送付先郵便番号', value: '' },
      { title: 'お届け先名１', field: '送付先名', value: '' },
      { title: 'お届け先名 2', field: '', value: '' },
      { title: 'お届け先住所 1', field: '送付先_都道府県', value: '' },
      { title: 'お届け先住所 2', field: '送付先_市区町村', value: '' },
      { title: 'お届け先住所 3', field: '送付先_住所', value: '' },
      { title: 'お届け先電話', field: '送付先電話番号', value: '' },
      { title: 'ご不在連絡先', field: '', value: '' },
      { title: 'メールアドレス', field: '', value: '' },
      { title: '代行ご依頼主コード', field: '', value: '' },
      { title: '代行ご依頼主郵便番号', field: 'ご依頼主郵便番号', value: '' },
      { title: '代行ご依頼主名 1', field: 'ご依頼主名', value: '' },
      { title: '代行ご依頼主名 2', field: '', value: '' },
      { title: '代行ご依頼主住所 1', field: 'ご依頼主住所', value: '' },
      { title: '代行ご依頼主住所 2', field: '', value: '' },
      { title: '代行ご依頼主住所 3', field: '', value: '' },
      { title: '代行ご依頼主電話', field: 'ご依頼主電話番号', value: '' },
      { title: '出荷日', field: '指定出荷日', value: '' },
      { title: '発送日', field: '', value: '' },
      { title: '配達指定日', field: '配送日指定', value: '' },
      { title: 'セット数', field: '', value: '' },
      { title: '個数', field: '注文数', value: '' },
      { title: '元着区分', field: '', value: '' },
      { title: '保険金額', field: '', value: '' },
      { title: '決済種別', field: '', value: '' },
      { title: '代引金額', field: '', value: '' },
      { title: '代引消費税', field: '', value: '' },
      { title: '代引税込金額', field: '', value: '' },
      { title: '消費税区分', field: '', value: '' },
      { title: '旧問い合せ№', field: '', value: '' },
      { title: '顧客管理番号', field: '', value: '' },
      { title: '営止め区分', field: '', value: '' },
      { title: '営止精算店コード', field: '', value: '' },
      { title: 'クール指定', field: '', value: '' },
      { title: '便種コード', field: '', value: '' },
      { title: '時間帯コード', field: '時間帯指定', value: '' },
      { title: '配達時間指定', field: '', value: '' },
      { title: 'シールコード1', field: '', value: '' },
      { title: 'シールコード2', field: '', value: '' },
      { title: 'シールコード3', field: '', value: '' },
      { title: 'シールコード4', field: '', value: '' },
      { title: '出荷区分', field: '', value: '' },
      { title: '出荷場印字区分', field: '', value: '' },
      { title: '保険金額印字フラグ', field: '', value: '' },
      { title: '集約解除指定', field: '', value: '' },
      { title: '編集01', field: '記事欄1', value: '' },
      { title: '編集02', field: '記事欄2', value: '' },
      { title: '編集03', field: '記事欄3', value: '' },
      { title: '編集04', field: '記事欄4', value: '' },
      { title: '編集05', field: '記事欄5', value: '' },
      { title: '編集06', field: '記事欄6', value: '' },
      { title: '編集07', field: '', value: '' },
      { title: '編集08', field: '', value: '' },
      { title: '編集09', field: '', value: '' },
      { title: '編集10', field: '', value: '' },
      { title: '重量1個数', field: 'サイズ', value: '' },
      { title: '重量2個数', field: 'サイズ', value: '' },
      { title: '重量3個数', field: 'サイズ', value: '' },
      { title: '重量4個数', field: 'サイズ', value: '' },
      { title: '重量5個数', field: 'サイズ', value: '' },
      { title: '重量6個数', field: 'サイズ', value: '' },
      { title: '重量7（値）', field: '', value: '' },
      { title: '重量7単位', field: '', value: '' },
      { title: '重量7個数', field: '', value: '' },
      { title: '重量8（値）', field: '', value: '' },
      { title: '重量8単位', field: '', value: '' },
      { title: '重量8個数', field: '', value: '' },
      { title: '発送形式', field: '発送形式', value: '' },
      { title: 'ピッキング単価', field: 'ピッキング単価', value: '' },
      { title: '注文数xピッキング単価', field: '注文数xピッキング単価', value: '' },
    ],
    ゆうパケット: [
      { title: '行番号', field: '行番号', value: '' },
      { title: '管理番号', field: 'レコード番号', value: '' },
      { title: '指定出荷日', field: '指定出荷日', value: '' },
      { title: '商品コード', field: '商品コード', value: '' },
      { title: 'バラ数', field: '個数', value: '' },
      { title: '賞味期限', field: '賞味期限', value: '' },

      { title: 'お届け先郵便番号', field: '送付先郵便番号', value: '' },
      { title: 'お届け先住所1', field: '送付先_都道府県', value: '' },
      { title: 'お届け先住所2', field: '送付先_市区町村', value: '' },
      { title: 'お届け先住所3', field: '送付先_住所', value: '' },
      { title: 'お届け先名称1', field: '送付先名', value: '' },
      { title: 'お届け先名称2', field: '', value: '' },
      { title: 'お届け先電話番号', field: '送付先電話番号', value: '' },
      { title: '品名', field: '掲載商品名', value: '' },
      { title: '厚さ', field: 'サイズ', value: '' },
      { title: '荷送人名', field: 'ご依頼主名', value: '' },
      { title: '記事欄', field: '記事欄4', value: '' },
      { title: '発送形式', field: '発送形式', value: '' },
      { title: 'ピッキング単価', field: 'ピッキング単価', value: '' },
      { title: '注文数xピッキング単価', field: '注文数xピッキング単価', value: '' },
    ],
  };

  // 今日
  let dtNow = luxon.DateTime.local().toFormat('yyyy-MM-dd');
  // HCフラグ（trueの場合、CSVのDLだけ）
  let isHC = false;

  /**
   * 一覧に表示されているレコードを全て取得する
   * @returns
   */
  const GetShippingRecords = async () => {
    try {
      let strQuery = kintone.app.getQuery();
      let [strCondition, strOrder] = strQuery.split(/order by|limit/i).map((part) => part.trim());
      return await client.record.getAllRecords({ app: APP_ID, condition: strCondition, orderBy: strOrder });
    } catch (error) {
      resParam.status = 9;
      resParam.message = '出荷依頼データの一覧を取得する処理に失敗しました。\n\n' + error.message;
    }
  };

  /**
   * 住所を都道府県と市区町村以降に分割
   * @param {*} records
   * @returns
   */
  const SplitAddress = (records) => {
    let arrRecords = [];
    for (let ii = 0; ii < records.length; ii++) {
      let record = records[ii];

      let sendAddress = record.送付先住所.value;
      let strPrefecture = (sendAddress.match(/^(.+?[都道府県])/) || [])[1] || '';
      let strCity = (sendAddress.match(/^(?:.+?[都道府県])?(.+?[市区町村])/) || [])[1] || '';
      let strAddress = sendAddress.replace(strPrefecture, '').trim().replace(strCity, '').trim();
      record['送付先_都道府県'] = { value: strPrefecture };
      record['送付先_市区町村'] = { value: strCity };
      record['送付先_住所'] = { value: strAddress };

      arrRecords.push(record);
    }
    return arrRecords;
  };

  /**
   * JSONをカンマ区切りの文字列に変換
   */
  const JsonToComma_Shipping = (json, shippingCompany) => {
    // jsonの商品情報を平面化
    let jsonItems = [];
    for (let ii = 0; ii < json.length; ii++) {
      let record = json[ii];
      let Items = record.商品情報.value;
      for (let jj = 0; jj < Items.length; jj++) {
        let item = Items[jj].value;
        jsonItems.push({ ...record, ...item, 行番号: { value: String(jj + 1) } });
      }
    }

    let header = '"' + shippingFields[shippingCompany].map((item) => item.title).join('","') + '"\n';

    let body = jsonItems
      .map((row) => {
        row = shippingFields[shippingCompany]
          .map((item) => {
            if (item.value) {
              return item.value;
            } else if (!item.field) {
              return '';
            }

            let val = row[item.field].value;
            // ご依頼主名と掲載媒体名に応じて電話番号を上書き
            if (item.field === 'ご依頼主電話番号' || item.title === '代行ご依頼主電話') {
              const senderName = row['ご依頼主名']?.value || '';
              const mediaName = row['掲載媒体名']?.value || '';
              if (senderName === 'ハッピーキャンペーン柏センター') {
                val = '050-1722-7845';
              } else if (mediaName === 'BEAUTH') {
                val = '050-1807-4570';
              }
            }
            // 項目によって値を変換
            switch (item.title) {
              case 'ピッキング単価':
                {
                  const shippingFormat = row['発送形式']?.value || '';
                  if (shippingFormat === 'ボール発送') {
                    val = '10';
                  } else if (shippingFormat === '2ボール結束発送') {
                    val = '20';
                  } else {
                    val = row['ピッキング単価']?.value || '0';
                  }
                }
                break;

              case '注文数xピッキング単価':
                {
                  const qty = Number(row['注文数']?.value || 0);
                  const shippingFormat = row['発送形式']?.value || '';
                  let unit = 0;
                  if (shippingFormat === 'ボール発送') {
                    unit = 10;
                  } else if (shippingFormat === '2ボール結束発送') {
                    unit = 20;
                  } else {
                    unit = Number(row['ピッキング単価']?.value || 0);
                  }
                  val = String(qty * unit);
                }
                break;
              case 'ご依頼主コード':
                if (val === '60サイズ' || val === '80サイズ') {
                  val = CODE_CLIENT_1;
                } else if (val === '100サイズ' || val === '140サイズ' || val === '160サイズ') {
                  val = CODE_CLIENT_2;
                }
                break;
              case '配達指定日':
                val = val ? val.replace(/-/g, '/') : '';
                break;
              case 'お届け先郵便番号':
              case 'お届け先電話':
              case '代行ご依頼主郵便番号':
              case '代行ご依頼主電話':
              case 'お届け先電話番号':
                val = val ? val.replace(/-/g, '') : '';
                break;
              case '重量1個数':
                val = val === '60サイズ' ? row.注文数.value : '';
                break;
              case '重量2個数':
                val = val === '80サイズ' ? row.注文数.value : '';
                break;
              case '重量3個数':
                val = val === '100サイズ' ? row.注文数.value : '';
                break;
              case '重量4個数':
                val = val === '140サイズ' ? row.注文数.value : '';
                break;
              case '重量5個数':
                val = val === '160サイズ' ? row.注文数.value : '';
                break;
              case '重量6個数':
                val = val === '170サイズ' ? row.注文数.value : '';
                break;
              case '厚さ':
                const match = val.match(/(\d+)cm/);
                val = match ? match[1] : '3';
                break;
              default:
                break;
            }
            // ダブルクォーテーションをダブルクォーテーションx2に変換
            if (val) {
              val = val.replace(/\"/g, '""');
            }
            return val;
          })
          .join('","');
        return '"' + row + '"';
      })
      .join('\n');

    return header + body;
  };

  /**
   * CSVファイルを出力
   */
  const exportCSV = (csvData, filename) => {
    //出力ファイル名
    var exportedFilenmae = (filename || 'exportCSV') + '.csv';

    //BLOBに変換
    var bom = new Uint8Array([0xef, 0xbb, 0xbf]); //ここでUTF-8を指定
    var blob = new Blob([bom, csvData], { type: 'text/csv;charset=utf-8' });

    //anchorを生成してclickイベントを呼び出す。
    var link = document.createElement('a');
    if (link.download !== undefined) {
      var url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', exportedFilenmae);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  /**
   * CSV出力日を更新する
   * @param {*} records
   * @returns
   */
  const UpdateExportDate = async (records) => {
    try {
      let arrRecords = [];
      for (let ii = 0; ii < records.length; ii++) {
        arrRecords.push({ id: records[ii].レコード番号.value, record: { 出荷依頼CSVの出力日: { value: dtNow } } });
      }
      return await client.record.updateAllRecords({ app: APP_ID, records: arrRecords });
    } catch (error) {
      resParam.status = 9;
      resParam.message = '出荷依頼データの一覧を取得する処理に失敗しました。\n\n' + error.message;
    }
  };

  /**
   * 出荷依頼データを出力する Main
   * @returns
   */
  const ExportShippingData_Main = async () => {
    try {
      resParam.status = 1;

      // 一覧に表示されているレコードを取得
      let allRecords = await GetShippingRecords();
      if (resParam.status != 1) return;

      // 住所を都道府県と市区町村以降に分割
      allRecords = await SplitAddress(allRecords);

      // 出荷依頼を出力したレコード
      let exportedRecords = [];

      // 指定出荷日ごとにデータをグループ化
      let groupedByDate = Object.groupBy(allRecords, (record) => record.指定出荷日.value);
      for (let shippingDate in groupedByDate) {
        let shipDateRecords = groupedByDate[shippingDate];

        // 配送業者でグループ化
        let groupedByShippingCompany = Object.groupBy(shipDateRecords, (record) => record.配送業者.value);
        for (let shippingCompany in groupedByShippingCompany) {
          if (!shippingCompany) continue;
          let companyRecords = groupedByShippingCompany[shippingCompany];

          // 出荷依頼のカンマ区切りデータ
          let shippingData = JsonToComma_Shipping(companyRecords, shippingCompany);
          // 出荷依頼をCSVで出力
          exportCSV(shippingData, shippingDate.replace(/-/g, '') + '_出荷依頼_' + shippingCompany);

          // 出荷依頼を出力したレコードを追加
          exportedRecords.push(...companyRecords);
        }
      }

      if (!isHC) {
        // CSV出力日を反映
        let resp = await UpdateExportDate(exportedRecords);
        if (resParam.status != 1) return;
      }

      resParam.message = '出荷依頼データを出力しました。\n';
    } catch (ex) {
      console.log(ex);
      resParam.message = '出荷依頼データの出力に失敗しました。\n\n' + ex.message;
    } finally {
      await Swal.fire({
        title: '出荷依頼データを出力',
        text: resParam.message,
        willClose: () => {
          location.reload(true);
        },
      });
    }
  };

  kintone.events.on('app.record.index.show', function (event) {
    if (event.viewId != 6426714) return event;

    // HC用ボタン
    if (!document.getElementById('hc_button_exp_hc') && HC_MEMBER_ID.includes(kintone.getLoginUser().id)) {
      var button0 = document.createElement('button');
      button0.id = 'hc_button_exp_hc';
      button0.classList.add('kintoneplugin-button-normal');
      button0.innerText = '出荷依頼データをDL(HC確認用)';
      kintone.app.getHeaderMenuSpaceElement().appendChild(button0);

      button0.onclick = async () => {
        isHC = true;
        await ExportShippingData_Main();
      };
    }

    // インターアシスト用ボタン
    if (!document.getElementById('hc_button_exp')) {
      var button1 = document.createElement('button');
      button1.id = 'hc_button_exp';
      button1.classList.add('kintoneplugin-button-dialog-ok');
      button1.innerText = '出荷依頼データをDL';
      kintone.app.getHeaderMenuSpaceElement().appendChild(button1);

      button1.onclick = async () => {
        isHC = false;
        await ExportShippingData_Main();
      };
    }
  });
})();
