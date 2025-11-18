/**
 * 発注商品金額表（テーブル）について：
 * テーブル本体のフィールドコードは「発注商品金額表」
 * 各行の値は「発注商品金額表_項目名」というフィールドコードで送信される
 *
 * 例：
 *   発注商品金額表_納品日
 *   発注商品金額表_商品コード
 *   発注商品金額表_ケース数
 *
 * 旧コメントにある
 * 「発注商品金額表 → 発注商品金額表表」は誤り。
 */
(async () => {
  'use strict';
  luxon.Settings.defaultLocale = 'ja';

  const safe = (v) => {
    if (v === undefined || v === null || Number.isNaN(v)) return '';

    // 数字のみ（整数 or 小数）の場合だけ数値に変換
    if (typeof v === 'string' && /^[0-9]+(\.[0-9]+)?$/.test(v.trim())) {
      return Number(v);
    }

    return v;
  };

  const client = new KintoneRestAPIClient();
  const HC_APPLICATION_APP_ID = kintone.app.getId();
  const HC_MATTER_APP_ID = HC.apps.案件管理.id;
  const HC_ITEM_APP_ID = HC.apps.商品マスタ.id;
  const HC_STOCK_APP_ID = HC.apps.在庫管理.id;
  const HC_CONTACT_APP_ID = HC.apps.取引先マスタ.id;
  const HC_HOLIDAY_APP_ID = HC.apps.休業日カレンダー.id;
  const HC_DELIVERY_APP_ID = HC.apps.納品先マスタ.id;
  const HC_ORDER_APP_ID = HC.apps.発注書.id;

  const HC_DELIVERY_NORMAL_PLACE_ID = 195;
  const HC_DELIVERY_RANZAN_PLACE_ID = 197;
  const SDGs_GROUP_MALL_NAME = ['au', 'Pontaパス', 'Tサンプル', 'Vサンプル'];

  const spinner = new Kuc.Spinner({
    text: '処理中...',
    container: document.body,
  });

  // CSVのヘッダー
  const CSV_HEADER = {
    No: 'No',
    MDチェック: 'MDチェック',
    アシスタントチェック: 'アシスタントチェック',
    発注番号: '発注番号',
    案件グループID: '案件グループID',
    案件ID: '案件ID',
    モール: 'モール',
    モール管理番号: 'モール管理番号',
    掲載ステータス: '掲載ステータス',
    取引形式: '取引形式',
    申込セット数: '申込セット数',
    納品予定日: '納品予定日',
    発注先: '発注先',
    支払い条件: '支払い条件',
    メーカー: 'メーカー',
    商品コード: '商品コード',
    商品名: '商品名',
    JANコード: 'JANコード',
    刻印: '刻印',
    賞味期限: '賞味期限',
    掲載商品名: '掲載商品名',
    セット入数: 'セット入数',
    ケース規格: 'ケース規格',
    ケース入数: 'ケース入数',
    ボール入数: 'ボール入数',
    発注単位: '発注単位',
    最低バラ数: '最低バラ数',
    最低ケース数: '最低ケース数',
    発注セット数: '発注セット数',
    実際の発注ケース数: '実際の発注ケース数',
    実際の発注バラ数: '実際の発注バラ数',
    発注バラ数合計: '発注バラ数合計',
    単価: '単価',
    小計金額: '小計金額',
    合計金額: '合計金額',
    税率: '税率',
    引当バラ数: '引当バラ数',
    引当セット数: '引当セット数',
    余りバラ数: '余りバラ数',
    発注先名: '発注先名',
    発注先数: '発注先数',
    発注先数合計: '発注先数合計',
    発注先担当者: '発注先担当者',
    発注先メールアドレスTo: '発注先メールアドレスTo',
    発注先メールアドレスCC: '発注先メールアドレスCC',
    発注先メールアドレスBCC: '発注先メールアドレスBCC',
    エラー内容: 'エラー内容',
  };

  let onlyCSV = false;

  let resParam = { status: 0, message: '' };

  /**
   * CSVの列情報を初期設定
   * @returns
   */
  const initDataRow = () => {
    let obj = {
      No: 0,
      MDチェック: '',
      アシスタントチェック: '',
      発注番号: '',
      案件グループID: '',
      案件ID: '',
      モール: '',
      モール管理番号: '',
      掲載ステータス: '',
      取引形式: '',
      申込セット数: 0,
      納品予定日: '',
      発注先: '',
      支払い条件: '',
      メーカー: '',
      商品コード: '',
      商品名: '',
      JANコード: '',
      刻印: '',
      賞味期限: '',
      掲載商品名: '',
      セット入数: 0,
      ケース規格: '',
      ケース入数: 0,
      ボール入数: 0,
      発注単位: '',
      最低バラ数: 0,
      最低ケース数: 0,
      発注セット数: 0,
      実際の発注ケース数: 0,
      実際の発注バラ数: 0,
      発注バラ数合計: null,
      単価: 0,
      小計金額: null,
      合計金額: null,
      税率: 0,
      引当バラ数: 0,
      引当セット数: 0,
      余りバラ数: 0,
      発注先名: '',
      発注先数: null,
      発注先数合計: null,
      発注先担当者: '',
      発注先メールアドレスTo: '',
      発注先メールアドレスCC: '',
      発注先メールアドレスBCC: '',
      エラー内容: '',
    };
    return obj;
  };

  /**
   * 条件にあうすべてのレコードを取得
   * @param {*} id
   * @param {*} condition
   * @param {*} order
   * @returns
   */
  const getAllRecordsWithCondition = async (id, condition = null, order = null) => {
    try {
      const records = await client.record.getAllRecords({ app: id, condition: condition, orderBy: order });
      return records;
    } catch (error) {
      resParam = {
        status: 9,
        message: 'レコードの取得中にエラーが発生しました:\n\n' + error.message,
      };
      return [];
    }
  };

  /**
   * 発注番号の最大値を取得
   * @param {*} dayName
   * @returns
   */
  const getLastOrderNumber = async (dayName) => {
    return await client.record
      .getRecords({
        app: HC_ORDER_APP_ID,
        fields: ['発注番号'],
        query: `発注番号 like "${dayName}" order by 発注番号 desc limit 1 offset 0`,
      })
      .then(function (resp) {
        if (resp.records.length == 0) return 0;
        let lastNumber = resp.records[0]['発注番号'].value.split('-')[2];
        return parseInt(lastNumber);
      })
      .catch(function (err) {
        console.log(err);
        return 0; // ★ エラー時は必ず 0 を返す
      });
  };

  /**
   * レコードを一括追
   * @param {*} appId
   * @param {*} recData
   * @returns
   */
  const addSomeRecords = async (appId, recData) => {
    try {
      // ★ 件数確認
      console.log('🔥 recData 件数:', recData?.length);

      // ★ 内容 dump
      console.log('🔥 Kintoneに送信予定のレコードデータ:', JSON.stringify(recData, null, 2));
      console.log('◆ 送信する recData の 1件目:', JSON.stringify(recData[0], null, 2));
      console.log('◆ recData のフィールド一覧:', Object.keys(recData[0]));

      // ★ recData 再帰チェック
      const deepCheck = (obj, path = '') => {
        const errors = [];

        for (const key in obj) {
          const v = obj[key];
          const current = path ? `${path}.${key}` : key;

          if (v === null || v === undefined) {
            errors.push(current);
            continue;
          }

          if (typeof v === 'number' && Number.isNaN(v)) {
            errors.push(current);
            continue;
          }

          if (v === '') continue;

          if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
            const d = new Date(v);
            if (isNaN(d.getTime())) errors.push(current);
            continue;
          }

          if (typeof v === 'object') {
            errors.push(...deepCheck(v, current));
          }
        }
        return errors;
      };

      recData.forEach((r, i) => {
        const errs = deepCheck(r, `recData[${i}]`);
        if (errs.length > 0) {
          console.log(`⚠ 問題ありレコード path 一覧:`, errs);
          console.log(`⚠ recData[${i}]`, JSON.stringify(r, null, 2));
        }
      });

      // ★★★ ここが add() 本体 ★★★
      const body = {
        requests: [
          {
            method: 'POST',
            api: '/k/v1/records.json',
            payload: { app: appId, records: recData },
          },
        ],
      };

      console.log('🔥 bulkRequest body:', JSON.stringify(body, null, 2));

      const resp = await kintone.api(kintone.api.url('/k/v1/bulkRequest.json', true), 'POST', body);

      console.log('🔥 bulkRequest response:', JSON.stringify(resp, null, 2));

      return resp;
    } catch (e) {
      console.log('🔥🔥🔥【ERROR in addSomeRecords】🔥🔥🔥');
      console.log('◆ e:', e);

      // ▼ これを必ず追加（必須）
      console.log('◆ e.response:', JSON.stringify(e?.response, null, 2));
      console.log('◆ e.response.data:', JSON.stringify(e?.response?.data, null, 2));
      console.log('◆ e.results:', JSON.stringify(e?.results, null, 2));

      if (e && e.body) {
        console.error('◆ e.body ↓↓↓');
        console.log(JSON.stringify(e.body, null, 2));
      }

      if (e && e.message) {
        console.error('◆ e.message ↓↓↓');
        console.error(e.message);
      }

      if (e && e.response && e.response.data) {
        console.error('◆ e.response.data ↓↓↓');
        console.log(JSON.stringify(e.response.data, null, 2));
      }

      // 生のレスポンスがあれば出す
      if (e && e.response) {
        console.error('◆ e.response ↓↓↓');
        console.log(JSON.stringify(e.response, null, 2));
      }

      throw e;
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
          console.log('◆ updateAllRecords Error Object:', e);
          console.log('◆ updateAllRecords Error Response:', e.response);
          console.log('◆ updateAllRecords Error Data:', e.response?.data);

          resParam.status = 9;
          resParam.message = `レコードを更新できませんでした。\n` + (e.response?.data?.message || e);
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
   * CSV用のデータを生成
   * @param {*} objArray
   * @returns
   */
  const convertToCSV = (objArray) => {
    const array = typeof objArray !== 'object' ? JSON.parse(objArray) : objArray;

    /** 1. Objectの Key を headerとして取り出す */
    let str =
      `${Object.keys(CSV_HEADER)
        .map((header) => `"${header}"`)
        .join(',')}` + '\r\n';

    // 2. 各オブジェクトの値をCSVの行として追加する
    return array.reduce((str, next) => {
      str +=
        `${Object.values(CSV_HEADER)
          .map((header) => `"${next[header] !== null ? next[header] : ''}"`)
          .join(',')}` + '\r\n';
      return str;
    }, str);
  };

  /**
   * CSVを出力
   * @param {*} arrJsonForCSV
   */
  const downloadCSV = (data, name) => {
    /** Blob Object を作成する Type. CSV */
    const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
    const blob = new Blob([bom, data], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `${name}.csv`);
    a.click();
    a.remove();
  };

  const getDeliveryFromMaster = async (isMarudai) => {
    // 丸大かどうかで見るレコードIDを切り替え
    const recordId = isMarudai ? HC_DELIVERY_RANZAN_PLACE_ID : HC_DELIVERY_NORMAL_PLACE_ID;
    // ここで使う ID は
    //   HC_DELIVERY_NORMAL_PLACE_ID = 195
    //   HC_DELIVERY_RANZAN_PLACE_ID = 197
    // が上で定義されている前提

    const body = {
      app: HC_DELIVERY_APP_ID,
      id: recordId,
    };

    const resp = await kintone.api(kintone.api.url('/k/v1/record.json', true), 'GET', body);

    const rec = resp.record;

    return {
      // 👇 ここがルール
      name: rec.納品先名.value, // 納品先マスタ.納品先名
      info: rec.納品先情報.value, // 納品先マスタ.納品先情報
    };
  };

  /**
   * 発注書を作成
   */
  const createOrderRecords_Top = async () => {
    // ▼▼ Jspreadsheet が初期化されるまで待つ（最大 2 秒）▼▼
    const waitForSpreadsheet = async () => {
      let ele = document.getElementById('spreadsheet');
      for (let i = 0; i < 20; i++) {
        // 100ms × 20 = 最大2秒待つ
        if (ele && ele.jspreadsheet) return true;
        await new Promise((r) => setTimeout(r, 100));
        ele = document.getElementById('spreadsheet');
      }
      return false;
    };

    if (!(await waitForSpreadsheet())) {
      console.log('❌ spreadsheet 初期化タイムアウト');
      await Swal.fire({
        icon: 'error',
        title: 'データが読み込まれていません',
        text: '画面が完全に読み込まれてから、もう一度押してください。',
      });
      return;
    }
    // ▲▲ 初期化待ちここまで ▲▲
    // ▼▼ Jspreadsheet ロード確認用 ▼▼
    let ele = document.getElementById('spreadsheet');
    if (!ele || !ele.jspreadsheet) {
      console.log('⚠ spreadsheet がまだ初期化されていません');
      await Swal.fire({
        icon: 'error',
        title: 'データが読み込まれていません',
        text: '画面のロードが終わってから、もう一度ボタンを押してください。',
      });
      return; // ここで中断
    }
    // ▲▲ Jspreadsheet ロード確認用 ▲▲
    console.log('⑤ createOrderRecords_Top() 開始');
    // 納品予定日の入力を求める
    let { value: defaultDueDate } = await Swal.fire({
      title: '納品予定日',
      text: '納品予定日を一括で設定する場合、入力してください。',
      icon: 'question',
      input: 'date',
      inputAttributes: { min: luxon.DateTime.local().toFormat('yyyy-MM-dd') },
      showCancelButton: true,
      confirmButtonText: '設定する',
      cancelButtonText: 'Skip',
    });
    console.log('納品予定日:', defaultDueDate);

    let orderType = 'draft'; // 初期値を設定
    if (!onlyCSV) {
      // 下書きor本番の選択を求める
      let { value, isConfirmed } = await Swal.fire({
        title: '発注書作成',
        text: '発注書作成処理を実行しますか？',
        icon: 'question',
        input: 'radio',
        inputOptions: {
          draft: '下書き',
          final: '本番',
        },
        inputValidator: (value) => {
          if (!value) {
            return '下書きまたは本番を選択してください。';
          }
        },
        showCancelButton: true,
        confirmButtonText: '実行',
        cancelButtonText: '中止',
      });
      if (!isConfirmed) return;
      orderType = value;
      console.log('選択された発注書タイプ:', orderType);
    }

    try {
      spinner.open();

      resParam = { status: 1, message: '' };

      let ele = document.getElementById('spreadsheet');
      let jsonData = [];
      // 表示されている行のデータを取得
      if (ele.jspreadsheet.results) {
        jsonData = ele.jspreadsheet.results.map((val, index) => ele.jspreadsheet.getJsonRow(val));
      } else {
        jsonData = ele.jspreadsheet.getJson();
      }
      console.log('取得したデータ:', jsonData);

      // 発注にチェック有り、申込数が1以上に絞る
      const orderData = jsonData.filter((row) => row['発注'] && row['申込数'] > 0);
      console.log('発注チェック有り & 申込数が1以上のデータ:', orderData);

      if (orderData.length == 0) {
        resParam = { status: 9, message: '発注するデータがありません。' };
        return;
      }

      // 案件管理のレコードを取得
      const matterRecords = await getAllRecordsWithCondition(HC_MATTER_APP_ID);
      console.log('案件管理のレコード:', matterRecords);

      // 商品マスタのレコードを取得
      const itemRecords = await getAllRecordsWithCondition(HC_ITEM_APP_ID);
      console.log('商品マスタのレコード:', itemRecords);

      // 在庫管理のレコードを取得
      const stockRecords = await getAllRecordsWithCondition(HC_STOCK_APP_ID);
      console.log('在庫管理のレコード:', stockRecords);

      // 取引先マスタのレコードを取得
      const contactRecords = await getAllRecordsWithCondition(HC_CONTACT_APP_ID);
      console.log('取引先マスタのレコード:', contactRecords);

      // 休業日カレンダーのレコードを取得
      const holidayRecords = await getAllRecordsWithCondition(HC_HOLIDAY_APP_ID, '日付 >= TODAY()');
      console.log('休業日カレンダーのレコード:', holidayRecords);

      // 納品先マスタのレコードを取得
      const deliveryRecords = await getAllRecordsWithCondition(HC_DELIVERY_APP_ID);
      console.log('納品先マスタのレコード:', deliveryRecords);

      // 案件のすべての情報配列（CSV出力で使用、発注書データの生成で利用）
      let allItemData = [];

      // すべての案件を案件グループでグループ化
      let matterGroupData = Object.groupBy(matterRecords, (data) => data.案件グループID.value);
      console.log('案件グループデータ:', matterGroupData);

      // すべての案件グループでループ
      for (let mattGrpId of Object.keys(matterGroupData)) {
        // 案件グループのレコード配列
        let mattGrpRecs = matterGroupData[mattGrpId];

        // 同じ案件グループの案件でループ
        for (let mattRec of mattGrpRecs) {
          // 1～10の商品コードを取得
          for (let ii = 1; ii <= 10; ii++) {
            let itemCode = mattRec[`商品コード_${ii}`]?.value;
            if (!itemCode) continue;

            let objItem = initDataRow();
            allItemData.push(objItem);

            objItem['案件グループID'] = mattGrpId;
            objItem['案件ID'] = mattRec.$id.value;
            objItem['モール'] = mattRec.掲載媒体名_表示用.value;
            objItem['モール管理番号'] = mattRec.モール管理番号.value;
            objItem['掲載ステータス'] = mattRec.掲載ステータス.value;
            objItem['取引形式'] = mattRec.取引形式.value;
            objItem['商品コード'] = itemCode;
            console.log('掲載商品名:', mattRec.掲載商品名);
            console.log('掲載商品名 raw:', mattRec.掲載商品名);
            console.log('掲載商品名 value:', mattRec.掲載商品名 ? mattRec.掲載商品名.value : '(なし)');
            objItem['掲載商品名'] = mattRec.掲載商品名 ? mattRec.掲載商品名.value : '';
            objItem['セット入数'] = mattRec['セット入数_' + ii].value ? parseInt(mattRec['セット入数_' + ii].value) : 0;

            // 商品マスタのレコードを取得
            let itemRec = itemRecords.find((item) => item.商品コード.value == itemCode);
            if (!itemRec) {
              objItem['エラー内容'] = '商品マスタに登録がありません';
              continue;
            }
            // 取引先マスタのレコードを取得
            let contactRec = contactRecords.find((rec) => rec.取引先名_部署名.value == mattRec.発注先.value);
            if (!contactRec) {
              objItem['エラー内容'] = '発注先が設定されていません';
              continue;
            }

            objItem['JANコード'] = itemRec.JAN.value;
            objItem['商品名'] = itemRec.商品名.value;
            objItem['ケース入数'] = itemRec.ケース入数.value ? parseInt(itemRec.ケース入数.value) : 0;
            objItem['ケース規格'] = itemRec.ケース規格.value;
            objItem['ボール入数'] = itemRec.ボール入数.value ? parseInt(itemRec.ボール入数.value) : 0;
            objItem['メーカー'] = itemRec.メーカー名.value;
            objItem['単価'] = parseInt(itemRec.仕入価格_税抜.value);
            objItem['刻印'] = itemRec.刻印.value.length > 0 ? itemRec.刻印.value[0] : '';
            objItem['最低ケース数'] = itemRec.最低ケース数.value ? parseInt(itemRec.最低ケース数.value) : 0;
            objItem['最低ケース数_混載'] = itemRec.最低ケース数_混載.value ? parseInt(itemRec.最低ケース数_混載.value) : 0;
            objItem['最低バラ数'] = itemRec.最低バラ数.value ? parseInt(itemRec.最低バラ数.value) : 0;
            objItem['発注単位'] = itemRec.発注単位.value;
            objItem['発注先'] = itemRec.発注先.value;
            objItem['発注先名'] = itemRec.発注先.value;
            objItem['税率'] = parseInt(itemRec.税率.value);

            objItem['支払い条件'] = contactRec.支払い条件.value;
            objItem['発注先担当者'] = contactRec.宛先名_To.value;
            objItem['発注先メールアドレスTo'] = contactRec.メールアドレス_To.value;
            objItem['発注先メールアドレスCC'] = contactRec.メールアドレス_CC.value;
            objItem['発注先メールアドレスBCC'] = contactRec.メールアドレス_BCC.value;
            objItem['納品タイプ'] = contactRec.納品タイプ.value;
          }
        }
      }
      console.log('すべての案件の商品データ:', allItemData);

      // すべての案件の商品データでループ
      for (let item of allItemData) {
        // 発注情報を取得
        let jsonInfo = jsonData.find((data) => data.モール管理番号 == item.モール管理番号);
        if (!jsonInfo) {
          item['申込セット数'] = 0;
          item['発注セット数'] = 0;
          item['calc_発注バラ数'] = 0;
          item['発注書レコードID_下書き'] = '';
          item['発注番号_下書き'] = '';
          item['発注セット数_下書き'] = 0;
          continue;
        }
        item['申込セット数'] = jsonInfo.申込数 ? parseInt(jsonInfo.申込数) : 0;
        item['発注セット数'] = jsonInfo.申込数 ? parseInt(jsonInfo.申込数) : 0;
        item['calc_発注バラ数'] = jsonInfo.申込数 ? parseInt(jsonInfo.申込数) * item['セット入数'] : 0;
        item['発注書レコードID_下書き'] = jsonInfo.発注書レコードID_下書き;
        item['発注番号_下書き'] = jsonInfo.発注番号_下書き;
        item['発注セット数_下書き'] = jsonInfo.発注セット数_下書き ? parseInt(jsonInfo.発注セット数_下書き) : 0;
      }
      console.log('すべての案件の商品データ:', allItemData);

      // 掲載ステータスが掲載済～掲載終了済だけ or calc_発注バラ数が存在するものだけにする
      allItemData = allItemData.filter((rec) => {
        const isTargetStatus = rec.掲載ステータス === '掲載済' || rec.掲載ステータス === '掲載終了依頼' || rec.掲載ステータス === '掲載終了済';

        const hasOrder = typeof rec.calc_発注バラ数 === 'number' && rec.calc_発注バラ数 > 0;

        return isTargetStatus || hasOrder;
      });
      console.log('掲載ステータスが掲載済～掲載終了済 or calc_発注バラ数が存在するものだけ:', allItemData);

      // 案件グループIDでグループ化
      let groupByMatterGroup = Object.groupBy(allItemData, (data) => data.案件グループID);
      console.log('案件グループIDでグループ化:', groupByMatterGroup);

      for (let groupId of Object.keys(groupByMatterGroup)) {
        let groupRecords = groupByMatterGroup[groupId];

        // 発注セット数がすべて0のものを除外
        if (groupRecords.every((item) => item['発注セット数'] == 0)) {
          allItemData = allItemData.filter((item) => item.案件グループID !== groupId);
          delete groupByMatterGroup[groupId];
          continue;
        }

        // さらに商品コードでグループ化
        let groupByItemCode = Object.groupBy(groupRecords, (data) => data.商品コード);
        console.log('商品コードでグループ化:', groupByItemCode);

        // 商品コードでループでループ
        for (let itemCode of Object.keys(groupByItemCode)) {
          let itemGroup = groupByItemCode[itemCode];

          // 発注バラ数の合計を求める
          let sumBara = itemGroup.reduce((acc, curr) => acc + curr['calc_発注バラ数'], 0);
          // 発注バラ数の合計をセット
          itemGroup.forEach((item) => (item['calc_発注バラ数の合計'] = sumBara));

          // 引当割合を求める
          itemGroup.forEach((item) => {
            item['calc_引当割合'] = (item['発注セット数'] * item['セット入数']) / sumBara;
          });
        }
      }
      console.log('発注セット数がすべて0のものを除外:', groupByMatterGroup);

      // 商品コードでグループ化
      let groupByItemCode = Object.groupBy(allItemData, (data) => data.商品コード);
      // 商品コードごとにループ
      for (let itemCode of Object.keys(groupByItemCode)) {
        let itemGroup = groupByItemCode[itemCode];

        // 発注バラ数の合計を求める（案件グループに関係ない）
        let sumBara = itemGroup.reduce((acc, curr) => acc + curr['calc_発注バラ数'], 0);

        // 発注単位に合わせ、実際の発注バラ数を求める
        let inBall = itemGroup[0].ボール入数 ? itemGroup[0].ボール入数 : 1;
        let inCase = itemGroup[0].ケース入数 ? itemGroup[0].ケース入数 : 1;
        let minBara = itemGroup[0].最低バラ数 ? itemGroup[0].最低バラ数 : 1;
        let minCase = itemGroup[0].最低ケース数 ? itemGroup[0].最低ケース数 : 1;
        let numBall = 0;
        let numBara = 0;
        let numCase = 0;
        switch (itemGroup[0].発注単位) {
          case 'ボール単位':
            numBall = Math.ceil(sumBara / inBall);
            numBara = numBall * inBall;
            break;
          case 'ケース単位':
            numCase = Math.ceil(sumBara / inCase);
            numBara = numCase * inCase;
            break;
          case '最低ケース数指定あり':
            numCase = Math.ceil(sumBara / inCase);
            if (numCase < minCase) numCase = minCase;
            numBara = numCase * inCase;
            break;
          default: // バラ単位
            numBara = sumBara > minBara ? sumBara : minBara;
            break;
        }
        // 実際の発注バラ数、実際の発注ケース数をセット
        itemGroup.forEach((item) => {
          if (item['発注セット数'] > 0) {
            item['実際の発注バラ数'] = numBara;
            item['実際の発注ケース数'] = numCase;
          } else if (item['発注セット数'] == 0) {
            item['実際の発注バラ数'] = 0;
            item['実際の発注ケース数'] = 0;
          }
        });

        // 案件グループでグループ化
        let groupByMatterGroup = Object.groupBy(itemGroup, (data) => data.案件グループID);
        for (let groupId of Object.keys(groupByMatterGroup)) {
          let groupRecords = groupByMatterGroup[groupId];
          // 案件グループ内の発注バラ数の合計
          let sumBaraInMatt = groupRecords.reduce((acc, curr) => acc + curr['calc_発注バラ数'], 0);

          // 引当バラ数、引当セット数、余りバラ数を求める
          let sumPutBara = 0;
          for (let ii = 0; ii < groupRecords.length; ii++) {
            let item = groupRecords[ii];
            let putBara = Math.floor(sumBaraInMatt * item['calc_引当割合']);
            if (ii < groupRecords.length - 1) {
              sumPutBara += putBara;
            } else {
              putBara = sumBaraInMatt - sumPutBara;
            }

            item['引当バラ数'] = putBara ? putBara : 0;
            item['引当セット数'] = putBara ? Math.floor(putBara / item['セット入数']) : 0;
            item['余りバラ数'] = putBara ? putBara - item['引当セット数'] * item['セット入数'] : 0;
          }
        }

        //納品予定日を求める
        let dueDate = defaultDueDate ? luxon.DateTime.fromISO(defaultDueDate) : '';
        if (!dueDate) {
          // 取引先マスタのレコードからリードタイムを取得
          let contactRec = contactRecords.find((rec) => rec.取引先名_部署名.value == itemGroup[0].発注先);
          let restDays = contactRec.リードタイム.value ? parseInt(contactRec.リードタイム.value) : 1;
          dueDate = luxon.DateTime.local().startOf('day');
          for (let ii = 0; ii < restDays + 50; ii++) {
            if (ii != 0) dueDate = dueDate.plus({ days: 1 });
            if (dueDate.weekday == 6 || dueDate.weekday == 7) continue;
            if (holidayRecords.find((rec) => rec.日付.value == dueDate.toFormat('yyyy-MM-dd'))) continue;

            restDays--;
            if (restDays <= 0) break;
          }
        }
        itemGroup.forEach((item) => {
          if (item['発注セット数'] > 0) {
            item['納品予定日'] = dueDate.toFormat('yyyy-MM-dd');
          }
        });

        // 最新の賞味期限を取得
        let deadLine = '';
        if (itemGroup[0].刻印) {
          /*
					// 商品コードが一致する在庫レコードを取得
					let stockRecs = stockRecords.filter((rec) => rec.商品コード.value == itemGroup[0].商品コード.value);
					if (stockRecs.length == 0) continue;
					// 賞味期限が新しい順に並び替え
					stockRecs.sort((a, b) => { return (luxon.DateTime.fromISO(b.賞味期限.value).toMillis() - luxon.DateTime.fromISO(a.賞味期限.value).toMillis()); });
					// 最新の賞味期限
					deadLine = stockRecs[0].賞味期限.value
					*/

          // 在庫管理で賞味期限を運用するまでの暫定処置（商品マスタの賞味期限を使用）
          // 商品マスタのレコードを取得
          let itemRec = itemRecords.find((item) => item.商品コード.value == itemGroup[0].商品コード);
          deadLine = itemRec.賞味期限.value;
        }
        itemGroup.forEach((item) => {
          if (item['発注セット数'] > 0 && item['刻印']) {
            item['賞味期限'] = deadLine;
          }
        });
      }

      // 発注番号の最大値を取得
      let dayName = luxon.DateTime.local().toFormat('yyyyMMdd');
      let lastOrderNumber = await getLastOrderNumber(dayName);
      console.log('発注番号の最大値:', lastOrderNumber);

      // 発注先、案件グループID、発注セット数でソート
      allItemData.sort((a, b) => {
        // nullチェックを追加
        let shopA = a.発注先 || '';
        let shopB = b.発注先 || '';
        let groupA = a.案件グループID || '';
        let groupB = b.案件グループID || '';

        // まず発注先で比較
        let shopCompare = shopA.localeCompare(shopB);
        if (shopCompare !== 0) return shopCompare;

        // 発注先が同じ場合は案件グループIDで比較
        let groupCompare = groupA.localeCompare(groupB);
        if (groupCompare !== 0) return groupCompare;

        // 案件グループIDが同じ場合は発注セット数で昇順に比較
        return (a['発注セット数'] || 0) - (b['発注セット数'] || 0);
      });
      console.log('ソート:', allItemData);

      // 発注先でグループ化
      let groupByShop = Object.groupBy(allItemData, (data) => data.発注先);
      console.log('発注先でグループ化:', groupByShop);

      // 発注先ごとにループ
      for (let shopName of Object.keys(groupByShop)) {
        let shopRecords = groupByShop[shopName];

        /*
				・今回なし、下書きなし
					・何もしなくてよい
				・今回なし、下書きあり
					・発注番号は不要
					・下書き情報をクリア
				・今回あり、下書きなし
					・発注番号は新規
					・下書き情報をセット
				・今回あり、下書きあり
					・発注番号は上書きor新規
					・下書き情報をセット
				*/
        let flgDraft = false;
        let flgThis = false;
        if (shopRecords.some((item) => item['発注番号_下書き'] || item['発注書レコードID_下書き'] || item['発注セット数_下書き'])) flgDraft = true;
        if (shopRecords.some((item) => item['発注セット数'] > 0)) flgThis = true;

        // 今回あり
        if (flgThis == true) {
          // 発注番号
          let orderNumber = '';

          // 下書きあり
          if (flgDraft == true) {
            // 発注番号は上書きor新規
            orderNumber = shopRecords.find((item) => item['発注番号_下書き'])?.['発注番号_下書き'] || '';
            if (orderNumber) {
              // 発注番号の日付部分
              let draftOrderDateNum = orderNumber.split('-')[1];
              // 日付部分が今日ではない場合、発注番号はリセット
              if (draftOrderDateNum != dayName) orderNumber = '';
            }
          }

          if (!orderNumber) {
            // 発注番号をインクリメント
            lastOrderNumber++;
            orderNumber = 'HCH-' + dayName + '-' + String(lastOrderNumber).padStart(3, '0');
          }

          // 発注番号をセット
          for (let item of shopRecords) {
            if (item['発注セット数'] > 0) {
              item['発注番号'] = orderNumber;
            }
          }

          // 商品コードでグループ化
          let groupByItemCode = Object.groupBy(shopRecords, (data) => data.商品コード);

          // 商品コードごとにループ
          for (let itemCode of Object.keys(groupByItemCode)) {
            let itemGroup = groupByItemCode[itemCode];
            if (itemGroup.length > 0) {
              let lastItem = itemGroup[itemGroup.length - 1];
              // 最後のレコードに発注バラ数合計をセット
              lastItem['発注バラ数合計'] = lastItem['実際の発注バラ数'];
              // 最後のレコードに小計金額をセット
              lastItem['小計金額'] = lastItem['発注バラ数合計'] * lastItem['単価'];
            }
          }

          // 合計金額を求める
          let sumAmount = shopRecords.reduce((acc, curr) => acc + (curr['小計金額'] || 0), 0);

          if (shopRecords.length > 0) {
            // 合計金額をセット
            shopRecords[shopRecords.length - 1]['合計金額'] = sumAmount;
            // 発注先数をセット
            shopRecords[shopRecords.length - 1]['発注先数'] = 1;
          }
        }
      }

      //--------------------------------------------------
      // 発注先数の合計（allItemData が空のときはスキップ）
      //--------------------------------------------------
      if (allItemData.length > 0) {
        const sumShopCount = allItemData.reduce((acc, curr) => acc + (curr['発注先数'] || 0), 0);
        allItemData[allItemData.length - 1]['発注先数合計'] = sumShopCount;
      }

      // 連番をセット
      let allIdx = 1;
      allItemData.forEach((item) => (item['No'] = allIdx++));
      console.log('連番をセット:', allItemData);

      // Vサンプルでモール管理番号が「V」から始まる場合、「V」を消す
      allItemData.forEach((item) => {
        if (item.モール == 'Vサンプル' && item.モール管理番号.startsWith('V')) {
          item.モール管理番号 = item.モール管理番号.slice(1);
        }
      });

      // 設定期間を取得
      const startEl = document.getElementById('eleStartDate');
      const endEl = document.getElementById('eleEndDate');

      // ▼ ガード（ここから）
      if (!startEl || !endEl) {
        resParam = { status: 9, message: '画面項目(eleStartDate / eleEndDate) が存在しません。' };
        return;
      }

      let startDate = startEl.value;
      let endDate = endEl.value;

      if (!startDate || !endDate) {
        resParam = { status: 9, message: '期間（開始／終了日）が未入力です。' };
        return;
      }
      // ▲ ガード（ここまで）

      if (onlyCSV) {
        // ▼ CSV データ生成（allItemData または必要な行の配列を指定）
        const csvData = convertToCSV(allItemData);

        // ▼ CSV ダウンロード
        downloadCSV(csvData, `発注データ_${luxon.DateTime.local().toFormat('yyyyMMdd')}`);

        resParam = { status: 0, message: '発注数CSVを出力しました。' };

        return; // ← CSV出力後に終了
      }

      // Vサンプルのモール管理番号から削除した「V」を復活
      allItemData.forEach((item) => {
        if (item.モール == 'Vサンプル' && !item.モール管理番号.startsWith('V')) {
          item.モール管理番号 = 'V' + item.モール管理番号;
        }
      });

      // 発注書レコード用のデータを生成
      let orderDataForAll = [];

      // 発注番号でグループ化（発注番号があるものだけ）
      let groupByOrderNumber = Object.groupBy(
        allItemData.filter((data) => data['発注番号']),
        (data) => data['発注番号']
      );
      for (let orderNumber of Object.keys(groupByOrderNumber)) {
        let orderRecords = groupByOrderNumber[orderNumber];
        // 商品コードでグループ化
        let groupByItemCode = Object.groupBy(orderRecords, (data) => data.商品コード);

        let itemTable = [];
        let arrDueDate = [];
        for (let itemCode of Object.keys(groupByItemCode)) {
          const group = groupByItemCode[itemCode] || [];
          if (!group.length) {
            console.log(`⚠ groupByItemCode[${itemCode}] が空です`);
            continue;
          }

          const item = group[0];
          if (!item) {
            console.log(`⚠ item が undefined: itemCode=${itemCode}`);
            continue;
          }

          console.log('🟦 item (before push):', JSON.stringify(item, null, 2));

          // ★ 使用賞味期限をKintone向けに完全安全にセットする
          let safeExpire = '';

          if (item.刻印 && item.賞味期限) {
            const iso = safe(item.賞味期限);

            // YYYY-MM-DD の形式かどうか完全チェック
            if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
              safeExpire = iso;
            } else {
              safeExpire = ''; // 不正な形式は強制的に空にする
            }
          } else {
            safeExpire = '';
          }

          itemTable.push({
            value: {
              発注商品金額表_納品日: { value: safe(item.納品予定日) },
              発注商品金額表_商品コード: { value: safe(item.商品コード) },
              発注商品金額表_使用賞味期限: {
                value: safeExpire,
              },
              発注商品金額表_バラ数量: { value: safe(item.実際の発注バラ数) },
              発注商品金額表_ケース数: { value: safe(item.実際の発注ケース数) },
              発注商品金額表_単価: { value: safe(item.単価) },
            },
          });

          // デバッグログ（ここだけで十分）
          console.log('🟧 safe() 適用後の使用賞味期限:', safeExpire);

          if (item.納品予定日) {
            arrDueDate.push(luxon.DateTime.fromISO(item.納品予定日));
          }
        }

        if (itemTable.length == 0) continue;

        // 最短納品予定日を求める
        let dtMin = arrDueDate.length > 0 ? luxon.DateTime.min(...arrDueDate) : '';

        // -----------------------------------------
        // ★ 発注先名の値を確実に取得
        // -----------------------------------------
        const 発注先名_value = orderRecords.find((r) => r['発注先'])?.['発注先'] || orderRecords.find((r) => r['発注先名'])?.['発注先名'] || '';

        // -----------------------------------------
        // ★ 丸大を含むかどうかで、見る納品先マスタを切り替え
        //   - 丸大を含む  → ID197（嵐山）
        //   - それ以外    → ID195（柏）
        // -----------------------------------------
        const isMarudai = 発注先名_value.includes('丸大');

        // 納品先マスタから 「納品先名」「納品先情報」 を取得
        const { name: deliveryName, info: deliveryInfo } = await getDeliveryFromMaster(isMarudai);

        // -----------------------------------------
        // ★ 発注書レコードにセット
        //   - 納品先 ← 納品先マスタ.納品先名
        //   - 納品先情報 ← 納品先マスタ.納品先情報
        // -----------------------------------------
        const recordData = {
          発注番号: {
            value: orderRecords.find((r) => r['発注番号'])?.['発注番号'] || '',
          },

          発注先名: { value: 発注先名_value },

          // 👇 ここが今回のルールどおり
          納品先: { value: deliveryName }, // 発注書.納品先  ← マスタ.納品先名
          納品先情報: { value: deliveryInfo }, // 発注書.納品先情報 ← マスタ.納品先情報

          // ※もし「発注書側にも 納品先名 フィールドがあって使いたいなら」
          // 納品先名: { value: deliveryName }, をここに追加してOK

          発注商品金額表: {
            value: itemTable.map((row) => ({
              value: row.value,
            })),
          },
        };

        //------------------------------------------------------
        // ★ ルックアップ由来のゴミフィールドを完全削除（必須）
        //------------------------------------------------------
        const lookupFields = ['倉庫ID', '倉庫名', 'ルックアップ_納品先情報'];

        lookupFields.forEach((f) => {
          if (recordData[f] !== undefined) {
            console.log(`⚠ 不要フィールド削除: ${f}`);
            delete recordData[f];
          }
        });

        // ★ Kintone へ送信する前に null / undefined を空に正規化（必須）
        Object.keys(recordData).forEach((key) => {
          const val = recordData[key];
          if (val && typeof val === 'object' && 'value' in val) {
            if (val.value === null || val.value === undefined) {
              val.value = '';
            }
          }
        });

        orderDataForAll.push(recordData);
      }
      console.log('発注書レコード用のデータ:', orderDataForAll);

      // 追加と更新を分けて実行
      let orderDataForAdd = [];
      let orderDataForUpdate = [];
      // orderDataForAddの各レコードをチェック
      for (let ii = orderDataForAll.length - 1; ii >= 0; ii--) {
        // allItemDataから該当する発注番号_下書きを持つレコードを探す
        let matchingItem = allItemData.find((item) => item.発注番号_下書き === orderDataForAll[ii].発注番号.value);

        // 該当するレコードが見つかった場合
        if (matchingItem) {
          // orderDataForUpdateに追加
          orderDataForUpdate.push({
            id: matchingItem.発注書レコードID_下書き,
            record: orderDataForAll[ii],
          });
        } else {
          // orderDataForAddに追加
          orderDataForAdd.push(orderDataForAll[ii]);
        }
      }
      console.log('追加用データ:', orderDataForAdd);
      console.log('更新用データ:', orderDataForUpdate);

      console.log('🔥🔥🔥【送信直前】orderDataForUpdate FULL DUMP ↓↓↓');
      console.log(JSON.stringify(orderDataForUpdate, null, 2));

      let resOrders = [];

      // ★★★★★ これが「絶対に必要な」完全ダンプ ★★★★★
      console.log('🔥🔥🔥【送信直前】orderDataForAdd FULL DUMP ↓↓↓');
      console.log(JSON.stringify(orderDataForAdd, null, 2));
      if (orderDataForAdd.length > 0) {
        // 発注書レコードを一括追加
        resOrders = await addSomeRecords(HC_ORDER_APP_ID, orderDataForAdd);
        if (resParam.status != 1) return;
      }

      if (orderDataForUpdate.length > 0) {
        // 発注書レコードを一括更新
        await updateSomeRecords(HC_ORDER_APP_ID, orderDataForUpdate);
        if (resParam.status != 1) return;
      }

      let updateData = [];
      if (orderType == 'final') {
        // 前回発注日を更新するためのデータを作成
        let lastOrderDate = luxon.DateTime.local().minus({ days: 1 }).toFormat('yyyy-MM-dd');
        for (let ii = 0; ii < orderData.length; ii++) {
          let orderInfo = allItemData.find((data) => data.発注番号 && data.モール管理番号 == orderData[ii].モール管理番号);
          if (!orderInfo) continue;
          updateData.push({
            id: orderData[ii]['$id'],
            record: {
              前回発注日: { value: lastOrderDate },
              前回発注数: { value: orderInfo.引当セット数 },
              発注書レコードID_下書き: { value: '' },
              発注番号_下書き: { value: '' },
              発注セット数_下書き: { value: 0 },
            },
          });
        }
        console.log('前回発注日を更新するためのデータ:', updateData);
      } else {
        // 発注書レコードID_下書きを更新するためのデータを作成
        for (let ii = 0; ii < jsonData.length; ii++) {
          let jsonInfo = allItemData.find((data) => data.モール管理番号 == jsonData[ii].モール管理番号);
          if (!jsonInfo) continue;

          // 今回の値がある場合、今回の値をセット
          // 今回の値がなく下書きがある場合、下書き情報をクリア

          let draftInfo = { id: '', 発注番号: '', 発注セット数: 0 };

          // 今回の値がある場合
          if (jsonInfo.発注セット数 > 0) {
            let orderIdx = orderDataForAdd.findIndex((rec) => rec.発注先名.value == jsonInfo.発注先);
            if (orderIdx != -1) {
              draftInfo.id = resOrders.records[orderIdx].id;
            } else {
              orderIdx = orderDataForUpdate.findIndex((rec) => rec.record.発注先名.value == jsonInfo.発注先);
              if (orderIdx == -1) continue;
              draftInfo.id = orderDataForUpdate[orderIdx].id;
            }
            draftInfo.発注番号 = jsonInfo.発注番号;
            draftInfo.発注セット数 = jsonInfo.発注セット数;
          }
          // 今回の値がない場合
          else {
            // 下書きがある場合
            if (jsonInfo.発注書レコードID_下書き || jsonInfo.発注番号_下書き || jsonInfo.発注セット数_下書き > 0) {
              draftInfo.id = '';
              draftInfo.発注番号 = '';
              draftInfo.発注セット数 = 0;
            }
          }
          updateData.push({
            id: jsonData[ii]['$id'],
            record: {
              発注書レコードID_下書き: { value: draftInfo.id },
              発注番号_下書き: { value: draftInfo.発注番号 },
              発注セット数_下書き: { value: draftInfo.発注セット数 },
            },
          });
        }
      }
      console.log('発注書レコードID_下書きを更新するためのデータ:', updateData);
      if (updateData.length > 0) {
        // 申込数管理のレコードを一括更新
        await updateSomeRecords(HC_APPLICATION_APP_ID, updateData);
      }

      resParam = { status: 1, message: '発注書を作成しました。' };
    } catch (error) {
      console.error('発注書作成中にエラーが発生しました:', error);
      resParam = { status: 9, message: '発注書作成中にエラーが発生しました。' };
    } finally {
      spinner.close();

      let iconType = 'success';
      let title = '成功';
      switch (resParam.status) {
        case 1:
          iconType = 'success';
          title = '成功';
          break;
        case 9:
          iconType = 'error';
          title = 'エラー';
          break;
      }

      await Swal.fire({
        icon: iconType,
        title: title,
        text: resParam.message,
      });

      if (resParam.status == 1) {
        location.reload();
      }
    }
  };

  kintone.events.on('app.record.index.show', async (event) => {
    // ▼ ここからデバッグを挿入（※必ずこの位置）
    console.log('===== 発注書作成 START =====');
    console.log('event.records =', event.records);
    console.log('レコード件数 =', event.records ? event.records.length : 'undefined');
    // ▲ ここまでデバッグ
    if (event.viewId != 6427204 && event.viewId != 6428079) return event;

    try {
      // 発注書作成ボタン
      const exportCSVButton = new Kuc.Button({
        text: '発注数CSV出力',
      });
      exportCSVButton.style.marginLeft = '10px';
      exportCSVButton.addEventListener('click', () => {
        onlyCSV = true;
        createOrderRecords_Top();
      });
      kintone.app.getHeaderMenuSpaceElement().appendChild(exportCSVButton);

      if (event.viewId == 6427204) {
        // 発注書作成ボタン
        const createOrderButton = new Kuc.Button({
          text: '発注書作成',
          type: 'submit',
        });

        console.log('② 発注書作成ボタン生成 OK:', createOrderButton);

        //createOrderButton.style.verticalAlign = 'middle';
        //createOrderButton.style.marginLeft = "10px";
        createOrderButton.addEventListener('click', () => {
          console.log('④ 発注書作成ボタンクリック発生');
          onlyCSV = false;
          createOrderRecords_Top();
        });
        kintone.app.getHeaderMenuSpaceElement().appendChild(createOrderButton);
      }
    } catch (error) {
      console.log(error);
      event.error = error.message;
    }
  });
})();
