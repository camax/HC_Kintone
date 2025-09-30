/**
 * 各モールの出荷管理アプリから出荷依頼データを収集する
 * ［各モールの注文データを収集］ボタンで実行
 * 適用アプリ：出荷指示
 * 案件レコードを取得できなかった場合、対象をリスト出力する
 * ◆在庫管理が機能するまで、一時的に在庫チェックをOFFにしている◆
 */

/**
 * Excelで0から始まる文字列が消えないようにする
 * @param {string} val - 文字列として処理したい値（郵便番号・電話番号など）
 * @returns {string} Excelで文字列扱いされる形式
 */
const formatForExcel = (val) => (val ? `="${val}"` : '');

(() => {
  'use strict';

  const client = new KintoneRestAPIClient();
  const APP_ID = kintone.app.getId();

  const HC_APP_ID_SHIPPING_AU = HC.apps.出荷管理AU.id;
  const HC_APP_ID_SHIPPING_TSAMPLE = HC.apps.出荷管理TSAMPLE.id;
  const HC_APP_ID_SHIPPING_KUMAPON = HC.apps.出荷管理KUMAPON.id;
  const HC_APP_ID_SHIPPING_EECOTO = HC.apps.出荷管理EECOTO.id; // BEAUTH
  const HC_APP_ID_SHIPPING_RIRO = HC.apps.出荷管理RIRO.id;
  const HC_APP_ID_SHIPPING_BENE = HC.apps.出荷管理BENE.id;
  const HC_APP_ID_SHIPPING_TPOINT = HC.apps.出荷管理TPOINT.id;
  const HC_APP_ID_SHIPPING_SHAHAN = HC.apps.出荷管理SHAHAN.id;
  const HC_APP_ID_SHIPPING_SAKADOIGAI = HC.apps.出荷管理SAKADOIGAI.id;
  const HC_APP_ID_SHIPPING_KAUCHE = HC.apps.出荷管理KAUCHE.id;

  const HC_APP_ID_MATTER = HC.apps.案件管理.id;
  const HC_APP_ID_ITEM = HC.apps.商品マスタ.id;
  const HC_APP_ID_STOCK = HC.apps.在庫管理.id;
  const HP_APP_ID_WAREHOUSE = HC.apps.倉庫マスタ.id;

  const HC_MEMBER = ['kiyo@happy-campaign.co.jp', 'sae.seki', 'hc-assistant'];

  let shipRecords = {
    //au: [],
    //Tサンプル: [],
    くまポン: [],
    eecoto: [], // BEAUTH
    リロ: [],
    ベネ: [],
    Tポイント: [],
    社販: [],
    坂戸以外: [],
    KAUCHE: [],
  };
  let mattRecords = [];
  let itemRecords = [];
  let stockRecords = [];
  let warehouseRecords = [];

  // 商品コード → レコード(群) のインデックス
  let ITEM_BY_CODE = new Map(); // 商品コード => itemRecord
  let STOCK_BY_CODE = new Map(); // 商品コード => [stockRecord, ...]（賞味期限昇順）

  // 商品コードの正規化（揺れ対策）
  function normalizeCode(code) {
    if (!code) return '';
    return code
      .trim() // 前後の空白除去
      .toUpperCase() // 小文字→大文字
      .replace(
        /[Ａ-Ｚａ-ｚ０-９]/g,
        (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0) // 全角英数字→半角
      );
  }

  let mallManageNumber = {
    くまポン: 'ID_くまポン用',
    eecoto: 'SKU', // BEAUTH
    リロ: '商品コード',
    ベネ: 'メニューNo',
    Tポイント: '商品コード',
    社販: '品番',
    坂戸以外: 'モール管理番号',
    KAUCHE: '商品管理番号',
  };

  let dtExecute = luxon.DateTime.local().toFormat('yyyy-MM-dd');
  let resParam = { status: 1, message: '' };

  const spinner = new Kuc.Spinner({
    text: '処理中...',
    container: document.body,
  });

  /**
   * Condition を指定してレコードを一括取得（必要に応じて fields で返却フィールドを絞る）
   * @param {number|string} appId
   * @param {string} queCond
   * @param {string[]=} fields  取得したいフィールド配列（省略可）
   */
  const GetAllRecords = async (appId, queCond, fields) => {
    try {
      const params = { app: appId };
      // 空白だけの条件は弾く（trimして判定・設定）
      const cond = typeof queCond === 'string' ? queCond.trim() : '';
      if (cond.length > 0) params.condition = cond;
      // 🔽 追加：fields が配列なら fields 指定で返却フィールドを最小化
      if (Array.isArray(fields) && fields.length > 0) {
        params.fields = fields;
      }
      const MAX_RETRY = 2; // 追加で2回（合計3回トライ）
      const BASE_DELAY = 250; // 初期待機(ms)
      const shouldRetry = (err) => {
        // kintone SDKのエラー形状を想定して安全に判定
        const code = err?.response?.status ?? err?.status ?? 0;
        // 429（レート制限）/ 5xx（サーバ側一時障害）は再試行
        return code === 429 || (code >= 500 && code <= 599);
      };
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      let lastErr;
      for (let i = 0; i <= MAX_RETRY; i++) {
        try {
          const resp = await client.record.getAllRecords(params);
          resParam.status = 1;
          return resp;
        } catch (e) {
          lastErr = e;
          if (!shouldRetry(e) || i === MAX_RETRY) {
            console.error(e);
            resParam.status = 9;
            resParam.message = `アプリ[${appId}]からレコードの取得に失敗しました。\n` + e;
            return;
          }
          // 指数バックオフ ちょいジッター
          const jitter = Math.floor(Math.random() * 100);
          await sleep(BASE_DELAY * Math.pow(2, i) + jitter);
        }
      }
    } catch (ex) {
      console.log(ex);
      resParam.status = 9;
      resParam.message = `アプリ[${appId}]からレコードの取得に失敗しました。\n` + ex;
      return;
    }
  };

  // --- helpers: unique / chunk / escape ---
  const uniq = (arr) => Array.from(new Set(arr.filter(Boolean)));

  const CHUNK_SIZE = 100;
  // 関数内の 100 を CHUNK_SIZE に置換

  const chunk = (arr, size) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };

  // Kintone のクエリ内文字列用の簡易エスケープ（ダブルクォートを二重化）
  const q = (s) => String(s).replace(/"/g, '""');

  // --- fields: 必要最小限のみ取得するための定義 ---
  const MATTER_FIELDS = ['$id', '掲載媒体名', '掲載媒体名_表示用', 'モール管理番号', '案件グループID', '取引形式', '掲載商品名', '配送サイズ_GDL', '最短賞味期限', '配送業者', ...Array.from({ length: 10 }, (_, i) => `商品コード_${i + 1}`), ...Array.from({ length: 10 }, (_, i) => `セット入数_${i + 1}`)];

  const ITEM_FIELDS = ['商品コード'];

  const STOCK_FIELDS = ['商品コード', '在庫数', '賞味期限', 'ロケーション', '備考'];

  const WH_FIELDS = ['倉庫ID', '倉庫名', '郵便番号', '住所', '電話番号'];

  // 並列取得で使う媒体→アプリIDのマッピング
  const SHIPPING_SOURCES = [
    // { key: 'au',       app: HC_APP_ID_SHIPPING_AU },
    // { key: 'Tサンプル', app: HC_APP_ID_SHIPPING_TSAMPLE },
    { key: 'くまポン', app: HC_APP_ID_SHIPPING_KUMAPON },
    { key: 'eecoto', app: HC_APP_ID_SHIPPING_EECOTO }, // BEAUTH
    { key: 'リロ', app: HC_APP_ID_SHIPPING_RIRO },
    { key: 'ベネ', app: HC_APP_ID_SHIPPING_BENE },
    { key: 'Tポイント', app: HC_APP_ID_SHIPPING_TPOINT },
    { key: '社販', app: HC_APP_ID_SHIPPING_SHAHAN },
    { key: '坂戸以外', app: HC_APP_ID_SHIPPING_SAKADOIGAI },
    { key: 'KAUCHE', app: HC_APP_ID_SHIPPING_KAUCHE },
  ];

  /**
   * 出荷管理アプリから「出荷依頼」を並列取得（429/5xxは指数バックオフで再試行）
   * - 失敗媒体があっても他媒体は継続
   * - 失敗媒体名は message に集約
   */
  const GetShippingRecords = async () => {
    const CONDITION = '運用ステータス in ("出荷依頼")';
    const MAX_RETRY = 2; // 追加で2回（合計3回）
    const BASE_DELAY = 250; // 初期待機(ms)
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const shouldRetry = (err) => {
      const code = err?.response?.status ?? err?.status ?? 0;
      return code === 429 || (code >= 500 && code <= 599);
    };

    // 媒体ごとに getAllRecords を並列発火（個別の失敗は握り潰して結果に載せる）
    const tasks = SHIPPING_SOURCES.map(({ key, app }) =>
      (async () => {
        let lastErr = null;
        for (let i = 0; i <= MAX_RETRY; i++) {
          try {
            const recs = await client.record.getAllRecords({ app, condition: CONDITION });
            if (typeof DEBUG !== 'undefined' && DEBUG) {
              console.log(`[GetShippingRecords] ${key} 取得成功（試行 ${i + 1}/${MAX_RETRY + 1}）: ${recs?.length ?? 0}件`);
            }
            return { key, recs };
          } catch (e) {
            lastErr = e;
            const code = e?.response?.status ?? e?.status ?? 0;
            if (typeof DEBUG !== 'undefined' && DEBUG) {
              console.warn(`[GetShippingRecords] ${key} 失敗 code=${code}（試行 ${i + 1}/${MAX_RETRY + 1}）`, e);
            }
            if (!shouldRetry(e) || i === MAX_RETRY) {
              return { key, error: e };
            }
            const jitter = Math.floor(Math.random() * 100);
            await sleep(BASE_DELAY * Math.pow(2, i) + jitter);
          }
        }
        // 通常ここには来ないが型を合わせる
        return { key, error: lastErr || new Error('unknown error') };
      })()
    );

    const results = await Promise.all(tasks); // 個々が catch/return 済みなのでここは reject しない

    // 反映＆失敗媒体集計
    const failed = [];
    for (const r of results) {
      if (r.error) {
        shipRecords[r.key] = []; // 失敗媒体は空で持つ（後段で安全にスキップできる）
        failed.push(r.key);
      } else {
        shipRecords[r.key] = r.recs || [];
      }
    }

    // ステータス整備（全体は継続できる設計）
    resParam.status = 1;
    if (failed.length) {
      const msg = `一部媒体の取得に失敗: ${failed.join(', ')}`;
      resParam.message = resParam.message ? `${resParam.message}\n${msg}` : msg;
    }

    // 件数サマリ（任意）
    const ts = new Date().toISOString();
    if (typeof DEBUG !== 'undefined' && DEBUG) {
      for (const { key } of SHIPPING_SOURCES) {
        console.log(`[${ts}] 📦 ${key}: ${shipRecords[key]?.length ?? 0}件`);
      }
    }
  };

  /**
   * 案件レコードを取得
   * @returns
   */
  /**
   * 案件レコードを取得（IN句 + チャンク100）
   * @param {string[]} keysByMall   モール管理番号（媒体横断）
   * @param {string[]} eecotoGroups eecoto用の案件グループID
   */
  const GetMatterRecords = async (keysByMall = [], eecotoGroups = []) => {
    mattRecords = [];

    // くまポン等：モール管理番号で検索
    const keyChunks = chunk(keysByMall, CHUNK_SIZE);
    for (const part of keyChunks) {
      if (!part.length) continue;
      const inList = part.map((v) => `"${q(v)}"`).join(',');
      const cond = `モール管理番号 in (${inList})`;
      const recs = await GetAllRecords(HC_APP_ID_MATTER, cond, MATTER_FIELDS);
      if (resParam.status !== 1) return;
      mattRecords = mattRecords.concat(recs || []);
    }

    // eecoto：案件グループIDで検索
    const grpChunks = chunk(eecotoGroups, CHUNK_SIZE);
    for (const part of grpChunks) {
      if (!part.length) continue;
      const inList = part.map((v) => `"${q(v)}"`).join(',');
      const cond = `案件グループID in (${inList})`;
      const recs = await GetAllRecords(HC_APP_ID_MATTER, cond, MATTER_FIELDS);
      if (resParam.status !== 1) return;
      mattRecords = mattRecords.concat(recs || []);
    }

    // 重複除去（$id 基準）
    if (Array.isArray(mattRecords)) {
      const before = mattRecords.length;
      const seen = new Set();
      mattRecords = mattRecords.filter((r) => {
        const id = r?.$id?.value;
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      });
      if (typeof DEBUG !== 'undefined' && DEBUG) {
        const removed = before - mattRecords.length;
        if (removed > 0) console.log(`🧹 案件の重複除去: ${removed}件を除外`);
      }
    }

    // 参考ログ
    const emptyMall = (mattRecords || []).filter((r) => !r.モール管理番号?.value);
    if (emptyMall.length) {
      console.warn('⚠ 案件管理：モール管理番号が空のレコード 件数:', emptyMall.length);
    } else {
      console.log('✅ 案件管理：モール管理番号が空のレコードはありません');
    }
  };

  /**
   * 商品マスタレコードを取得
   * @returns
   */
  /**
   * 商品マスタレコードを取得（IN句 + チャンク100）
   * @param {string[]} productCodes
   */
  const GetItemRecords = async (productCodes = []) => {
    itemRecords = [];
    const codeChunks = chunk(uniq(productCodes), CHUNK_SIZE);
    for (const part of codeChunks) {
      if (!part.length) continue;
      const inList = part.map((v) => `"${q(v)}"`).join(',');
      const cond = `商品コード in (${inList})`;
      const recs = await GetAllRecords(HC_APP_ID_ITEM, cond, ITEM_FIELDS);
      if (resParam.status !== 1) return;
      itemRecords = itemRecords.concat(recs || []);
    }
  };

  /**
   * 在庫管理レコードを取得（IN句 + チャンク100）
   * @param {string[]} productCodes
   */
  const GetStockRecords = async (productCodes = []) => {
    stockRecords = [];
    const codeChunks = chunk(uniq(productCodes), CHUNK_SIZE);
    for (const part of codeChunks) {
      if (!part.length) continue;
      const inList = part.map((v) => `"${q(v)}"`).join(',');
      const cond = `商品コード in (${inList})`;
      const recs = await GetAllRecords(HC_APP_ID_STOCK, cond, STOCK_FIELDS);
      if (resParam.status !== 1) return;
      stockRecords = stockRecords.concat(recs || []);
    }
  };

  /**
   * 倉庫マスタのレコードを取得
   * @returns
   */
  const GetWarehouseRecords = async () => {
    warehouseRecords = await GetAllRecords(HP_APP_ID_WAREHOUSE, '', WH_FIELDS);
    if (resParam.status !== 1) return;
  };

  /**
   * 倉庫マスタのフォールバック取得
   * 指定IDが見つからない場合、altIds の順に探し、
   * それでも無ければ先頭レコード、最後に null を返す
   * @param {string} preferredId
   * @param {string[]} altIds
   */
  const pickWarehouse = (preferredId, altIds = ['103', '104']) => {
    if (!warehouseRecords || warehouseRecords.length === 0) return null;

    // 1) 第一候補
    let rec = warehouseRecords.find((r) => r?.倉庫ID?.value === preferredId);
    if (rec) return rec;

    // 2) 代替候補を順に検索
    for (const alt of altIds) {
      rec = warehouseRecords.find((r) => r?.倉庫ID?.value === alt);
      if (rec) return rec;
    }

    // 3) 先頭をフォールバック
    return warehouseRecords[0] || null;
  };

  /**
   * 出荷指示アプリ用にデータを生成（au）
   * @returns
   */
  const CreateDataForShipInstruction_AU = async () => {
    let arrRtn = [];

    for (let ii = 0; ii < shipRecords.au.length; ii++) {
      const shipRec = shipRecords.au[ii];
      // 案件レコードを取得
      let mattRec = mattRecords.find((record) => record.掲載媒体名.value === 'au' && record.モール管理番号.value === shipRecords.au[ii].PJTID.value);
      // デバッグログ追加
      console.warn(`[取引形式デバッグ] 媒体名: ${mattRec?.掲載媒体名?.value}, モール管理番号: ${mattRec?.モール管理番号?.value}, 案件レコードID: ${mattRec?.$id?.value}, 取引形式: ${mattRec?.取引形式?.value}, mattRec取得成功: ${!!mattRec}`);
      if (!mattRec) {
        const mediaName = 'au';
        console.error(`[案件未取得エラー] 媒体名: ${mediaName || '(不明)'}, モール管理番号: ${shipRec.PJTID?.value || '(なし)'}`);
        console.table(
          mattRecords
            .filter((r) => r.掲載媒体名.value === mediaName)
            .map((r) => ({
              案件ID: r.$id.value,
              掲載媒体名: r.掲載媒体名.value,
              モール管理番号: r.モール管理番号.value,
              取引形式: r.取引形式.value,
            }))
        );
      }
      if (mattRec) {
        let itemInfos = [];
        // 案件の商品1～10でループ
        for (let jj = 1; jj <= 10; jj++) {
          // 商品コード取得＆商品存在確認（Map 参照）
          const code = normalizeCode(mattRec['商品コード_' + jj]?.value);
          if (!code) continue;

          // 存在確認のみ（属性は未使用）
          const _itemRec = ITEM_BY_CODE.get(code);
          if (!_itemRec) continue;

          // 必要バラ数
          const needBara = (parseInt(shipRec?.数量?.value, 10) || 0) * (parseInt(mattRec['セット入数_' + jj]?.value, 10) || 0);

          // 在庫バケット（賞味期限昇順に整列済み）から条件を満たす最初の1件を割り当て
          const bucket = STOCK_BY_CODE.get(code) || [];
          let stockRec = null;
          for (let k = 0; k < bucket.length; k++) {
            const cand = bucket[k];
            const okDate = mattRec?.最短賞味期限?.value == null || cand?.賞味期限?.value >= mattRec.最短賞味期限.value;
            const qty = parseInt(cand?.在庫数?.value, 10) || 0;
            if (okDate && qty >= needBara) {
              stockRec = cand;
              cand.在庫数.value = String(qty - needBara); // Kintoneは文字列で持つので戻す
              break;
            }
          }

          // 商品情報を作成
          itemInfos.push({
            value: {
              商品コード: { value: mattRec['商品コード_' + jj].value },
              セット入数: { value: mattRec['セット入数_' + jj].value },
              賞味期限: { value: stockRec ? stockRec.賞味期限.value : '' },
              //不足: { value: stockRec ? "" : "不足" },
              ロケーション: { value: stockRec ? stockRec.ロケーション.value : '' },
              備考: { value: stockRec ? stockRec.備考.value : '' },
            },
          });
        }
        if (itemInfos.length) {
          arrRtn.push({
            出荷管理アプリID: { value: HC_APP_ID_SHIPPING_AU },
            出荷管理レコードID: { value: shipRecords.au[ii].$id.value },
            案件グループID: { value: mattRec.案件グループID.value },
            案件レコードID: { value: mattRec.$id.value },
            取引形式: { value: mattRec.取引形式.value },
            モール管理番号: { value: mattRec.モール管理番号.value },
            出荷管理から取得日: { value: dtExecute },

            商品情報: { value: itemInfos },

            掲載媒体名: { value: mattRec.掲載媒体名_表示用.value },
            注文番号: { value: shipRec.seq.value },
            注文日: { value: luxon.DateTime.fromISO(shipRecords.au[ii].申込日時.value).toFormat('yyyy-MM-dd') },
            注文数: { value: shipRecords.au[ii].数量.value },
            掲載商品名: { value: mattRec.掲載商品名.value },
            //配送日指定: { value: "" },
            時間帯指定: { value: '0' },
            サイズ: { value: mattRec.配送サイズ_GDL.value },
            //のし: { value: "" },

            /*
						注文者名: { value: shipRecords.au[ii].会員名.value },
						注文者かな: { value: shipRecords.au[ii].会員かな.value },
						注文者郵便番号: { value: shipRecords.au[ii].会員郵便番号.value },
						注文者住所: { value: shipRecords.au[ii].会員都道府県.value + shipRecords.au[ii].会員住所１.value + shipRecords.au[ii].会員住所２.value },
						注文者電話番号: { value: shipRecords.au[ii].会員電話番号.value },

						送付先名: { value: shipRecords.au[ii].送り先名.value },
						送付先かな: { value: shipRecords.au[ii].送り先かな.value },
						送付先郵便番号: { value: shipRecords.au[ii].送り先郵便番号.value },
						送付先住所: { value: shipRecords.au[ii].送り先都道府県.value + shipRecords.au[ii].送り先住所１.value + shipRecords.au[ii].送り先住所２.value },
						送付先電話番号: { value: shipRecords.au[ii].送り先電話番号.value },
						*/

            配送業者: { value: mattRec.配送業者.value },
          });
        }
      }
    }
    return arrRtn;
  };
  /**
   * 出荷指示アプリ用にデータを生成（Tサンプル）
   * @returns
   */
  const CreateDataForShipInstruction_TSAMPLE = async () => {
    let arrRtn = [];

    for (let ii = 0; ii < shipRecords.Tサンプル.length; ii++) {
      // 案件レコードを取得
      let mattRec = mattRecords.find((record) => record.掲載媒体名.value === 'Tサンプル' && record.モール管理番号.value === shipRecords.Tサンプル[ii].PJTID.value);
      // デバッグログ追加
      console.warn(`[取引形式デバッグ] 媒体名: ${mattRec?.掲載媒体名?.value}, モール管理番号: ${mattRec?.モール管理番号?.value}, 案件レコードID: ${mattRec?.$id?.value}, 取引形式: ${mattRec?.取引形式?.value}, mattRec取得成功: ${!!mattRec}`);
      if (!mattRec) {
        const shipRec = shipRecords.Tサンプル[ii];
        const mediaName = 'Tサンプル';
        console.error(`[案件未取得エラー] 媒体名: ${mediaName || '(不明)'}, モール管理番号: ${shipRec.PJTID?.value || '(なし)'}`);
        console.table(
          mattRecords
            .filter((r) => r.掲載媒体名.value === mediaName)
            .map((r) => ({
              案件ID: r.$id.value,
              掲載媒体名: r.掲載媒体名.value,
              モール管理番号: r.モール管理番号.value,
              取引形式: r.取引形式.value,
            }))
        );
      }
      if (mattRec) {
        let itemInfos = [];
        // 案件の商品1～10でループ
        for (let jj = 1; jj <= 10; jj++) {
          // 商品コード取得＆存在チェック（Map 参照＋正規化）
          const code = normalizeCode(mattRec['商品コード_' + jj]?.value);
          if (!code) continue;

          // 存在確認のみ（属性は未使用）
          const _itemRec = ITEM_BY_CODE.get(code);
          if (!_itemRec) continue;

          // 必要バラ数
          const needBara = (parseInt(shipRecords.Tサンプル[ii]?.数量?.value, 10) || 0) * (parseInt(mattRec['セット入数_' + jj]?.value, 10) || 0);

          // 在庫バケット（賞味期限昇順に整列済み）から条件一致の1件を割り当て
          const bucket = STOCK_BY_CODE.get(code) || [];
          let stockRec = null;
          for (let k = 0; k < bucket.length; k++) {
            const cand = bucket[k];
            const okDate = mattRec?.最短賞味期限?.value == null || cand?.賞味期限?.value >= mattRec.最短賞味期限.value;
            const qty = parseInt(cand?.在庫数?.value, 10) || 0;
            if (okDate && qty >= needBara) {
              stockRec = cand;
              cand.在庫数.value = String(qty - needBara); // Kintoneは文字列
              break;
            }
          }

          // 商品情報を作成
          itemInfos.push({
            value: {
              商品コード: { value: mattRec['商品コード_' + jj].value },
              セット入数: { value: mattRec['セット入数_' + jj].value },
              賞味期限: { value: stockRec ? stockRec.賞味期限.value : '' },
              //不足: { value: stockRec ? "" : "不足" },
              ロケーション: { value: stockRec ? stockRec.ロケーション.value : '' },
              備考: { value: stockRec ? stockRec.備考.value : '' },
            },
          });
        }
        if (itemInfos.length) {
          arrRtn.push({
            出荷管理アプリID: { value: HC_APP_ID_SHIPPING_TSAMPLE },
            出荷管理レコードID: { value: shipRecords.Tサンプル[ii].$id.value },
            案件グループID: { value: mattRec.案件グループID.value },
            案件レコードID: { value: mattRec.$id.value },
            取引形式: { value: mattRec.取引形式.value },
            モール管理番号: { value: mattRec.モール管理番号.value },
            出荷管理から取得日: { value: dtExecute },

            商品情報: { value: itemInfos },

            掲載媒体名: { value: mattRec.掲載媒体名_表示用.value },
            注文番号: { value: shipRecords.Tサンプル[ii].seq.value },
            注文日: { value: luxon.DateTime.fromISO(shipRecords.Tサンプル[ii].申込日時.value).toFormat('yyyy-MM-dd') },
            注文数: { value: shipRecords.Tサンプル[ii].数量.value },
            掲載商品名: { value: mattRec.掲載商品名.value },
            //配送日指定: { value: "" },
            時間帯指定: { value: '0' },
            サイズ: { value: mattRec.配送サイズ_GDL.value },
            //のし: { value: "" },

            /*
						注文者名: { value: shipRecords.Tサンプル[ii].会員名.value },
						注文者かな: { value: shipRecords.Tサンプル[ii].会員かな.value },
						注文者郵便番号: { value: shipRecords.Tサンプル[ii].会員郵便番号.value },
						注文者住所: { value: shipRecords.Tサンプル[ii].会員都道府県.value + shipRecords.Tサンプル[ii].会員住所１.value + shipRecords.Tサンプル[ii].会員住所２.value },
						注文者電話番号: { value: shipRecords.Tサンプル[ii].会員電話番号.value },

						送付先名: { value: shipRecords.Tサンプル[ii].送り先名.value },
						送付先かな: { value: shipRecords.Tサンプル[ii].送り先かな.value },
						送付先郵便番号: { value: shipRecords.Tサンプル[ii].送り先郵便番号.value },
						送付先住所: { value: shipRecords.Tサンプル[ii].送り先都道府県.value + shipRecords.Tサンプル[ii].送り先住所１.value + shipRecords.Tサンプル[ii].送り先住所２.value },
						送付先電話番号: { value: shipRecords.Tサンプル[ii].送り先電話番号.value },
						*/

            配送業者: { value: mattRec.配送業者.value },
          });
        }
      }
    }
    return arrRtn;
  };
  /**
   * 出荷指示アプリ用にデータを生成（くまポン & WELBOX 兼用）
   * @returns
   */
  const CreateDataForShipInstruction_KUMAPON = async () => {
    let arrRtn = [];

    // 「くまポン」アプリから取得した全レコード（くまポンとWELBOXを含む）でループ
    for (let ii = 0; ii < shipRecords.くまポン.length; ii++) {
      const shipRec = shipRecords.くまポン[ii];
      // レコードに「媒体名」フィールドが存在しない場合、デフォルトで「くまポン」として扱う
      const mediaName = shipRec.媒体名 && shipRec.媒体名.value ? shipRec.媒体名.value : 'くまポン';

      // 案件レコードを、レコード自身の媒体名を使って検索
      let mattRec = mattRecords.find((record) => record.掲載媒体名.value === mediaName && record.モール管理番号.value === shipRec[mallManageNumber.くまポン].value);
      // デバッグログ追加
      console.warn(`[取引形式デバッグ] 媒体名: ${mattRec?.掲載媒体名?.value}, モール管理番号: ${mattRec?.モール管理番号?.value}, 案件レコードID: ${mattRec?.$id?.value}, 取引形式: ${mattRec?.取引形式?.value}, mattRec取得成功: ${!!mattRec}`);
      // mattRec未取得時の詳細デバッグログ
      if (!mattRec) {
        console.warn(`[mattRec未取得] 媒体名条件: ${mediaName || '(不明)'}, 出荷レコード側モール管理番号: ${shipRec[mallManageNumber.くまポン]?.value || '(なし)'}`);
        let candidates = mattRecords.filter((r) => r.掲載媒体名.value === mediaName);
        console.warn(`[mattRec未取得] 案件管理側で媒体名一致の件数: ${candidates.length}`);
        if (candidates.length) {
          console.warn(
            '[mattRec未取得] 媒体名一致候補のモール管理番号一覧:',
            candidates.map((c) => c.モール管理番号.value)
          );
        }
        // 追加ログ
        console.error(`[案件未取得エラー] 媒体名: ${mediaName || '(不明)'}, モール管理番号: ${shipRec[mallManageNumber.くまポン]?.value || '(なし)'}`);
        console.table(
          mattRecords
            .filter((r) => r.掲載媒体名.value === mediaName)
            .map((r) => ({
              案件ID: r.$id.value,
              掲載媒体名: r.掲載媒体名.value,
              モール管理番号: r.モール管理番号.value,
              取引形式: r.取引形式.value,
            }))
        );
      }

      if (mattRec) {
        let itemInfos = [];
        // 案件の商品1～10でループ
        for (let jj = 1; jj <= 10; jj++) {
          // 商品コード取得＆商品存在確認（Map 参照）
          const code = normalizeCode(mattRec['商品コード_' + jj]?.value);
          if (!code) continue;

          // 存在確認のみ（属性は未使用）
          const _itemRec = ITEM_BY_CODE.get(code);
          if (!_itemRec) continue;

          // 必要バラ数（数量 × セット入数）
          const needBara = (parseInt(shipRec?.数量?.value, 10) || 0) * (parseInt(mattRec['セット入数_' + jj]?.value, 10) || 0);

          // 在庫バケット（賞味期限昇順に整列済み）から条件を満たす最初の1件を割り当て
          const bucket = STOCK_BY_CODE.get(code) || [];
          let stockRec = null;
          for (let k = 0; k < bucket.length; k++) {
            const cand = bucket[k];
            const okDate = mattRec?.最短賞味期限?.value == null || cand?.賞味期限?.value >= mattRec.最短賞味期限.value;
            const qty = parseInt(cand?.在庫数?.value, 10) || 0;
            if (okDate && qty >= needBara) {
              stockRec = cand;
              // 在庫を消費（Kintoneは文字列で持つので戻す）
              cand.在庫数.value = String(qty - needBara);
              break;
            }
          }

          // 商品情報を作成
          itemInfos.push({
            value: {
              商品コード: { value: mattRec['商品コード_' + jj].value },
              セット入数: { value: mattRec['セット入数_' + jj].value },
              賞味期限: { value: stockRec ? stockRec.賞味期限.value : '' },
              //不足: { value: stockRec ? "" : "不足" },
              ロケーション: { value: stockRec ? stockRec.ロケーション.value : '' },
              備考: { value: stockRec ? stockRec.備考.value : '' },
            },
          });
        }

        if (itemInfos.length) {
          let warehouseRec = warehouseRecords.find((record) => record.倉庫ID.value === '103');

          // 出荷指示アプリに登録するレコード本体を作成
          let newRecord = {
            出荷管理アプリID: { value: HC_APP_ID_SHIPPING_KUMAPON },
            出荷管理レコードID: { value: shipRec.$id.value },
            案件グループID: { value: mattRec.案件グループID.value },
            案件レコードID: { value: mattRec.$id.value },
            取引形式: { value: mattRec.取引形式.value },
            モール管理番号: { value: mattRec.モール管理番号.value },
            出荷管理から取得日: { value: dtExecute },
            商品情報: { value: itemInfos },
            掲載媒体名: { value: mattRec.掲載媒体名_表示用.value },
            注文番号: { value: shipRec.購入番号.value },
            注文日: { value: luxon.DateTime.fromISO(shipRec.購入日時.value).toFormat('yyyy-MM-dd') },
            注文数: { value: shipRec.数量.value },
            掲載商品名: { value: mattRec.掲載商品名.value },
            時間帯指定: { value: '0' },
            サイズ: { value: mattRec.配送サイズ_GDL.value },
            注文者名: { value: shipRec.会員名.value },
            注文者かな: { value: shipRec.会員かな.value },
            注文者郵便番号: { value: shipRec.会員郵便番号.value },
            注文者住所: { value: shipRec.会員都道府県.value + shipRec.会員住所１.value + (shipRec.会員住所２ ? shipRec.会員住所２.value : '') },
            注文者電話番号: { value: shipRec.会員電話番号.value },
            送付先名: { value: shipRec.送り先名.value },
            送付先かな: { value: shipRec.送り先かな.value },
            送付先郵便番号: { value: shipRec.送り先郵便番号.value },
            送付先住所: { value: shipRec.送り先都道府県.value + shipRec.送り先住所１.value + (shipRec.送り先住所２ ? shipRec.送り先住所２.value : '') },
            送付先電話番号: { value: shipRec.送り先電話番号.value },
            ご依頼主名: { value: warehouseRec.倉庫名.value },
            ご依頼主郵便番号: { value: warehouseRec.郵便番号.value },
            ご依頼主住所: { value: warehouseRec.住所.value },
            ご依頼主電話番号: { value: warehouseRec.電話番号.value },
            配送業者: { value: mattRec.配送業者.value },
          };

          // 【追加要望】WELBOXの場合のみ「記事欄1」に自動記入
          if (mediaName === 'WELBOX') {
            newRecord['記事欄1'] = { value: 'WELBOX' };
          }

          arrRtn.push(newRecord);
        }
      }
    }
    return arrRtn;
  };
  /**
   * 出荷指示アプリ用にデータを生成（eecoto）
   * @returns
   */
  const CreateDataForShipInstruction_EECOTO = async () => {
    let arrRtn = [];

    for (let ii = 0; ii < shipRecords.eecoto.length; ii++) {
      // 案件レコードを取得
      let mattRec = mattRecords.find((record) => record.掲載媒体名.value === 'eecoto' && record.案件グループID.value === shipRecords.eecoto[ii][mallManageNumber.eecoto].value);
      // デバッグログ追加
      console.warn(`[取引形式デバッグ] 媒体名: ${mattRec?.掲載媒体名?.value}, モール管理番号: ${mattRec?.モール管理番号?.value}, 案件レコードID: ${mattRec?.$id?.value}, 取引形式: ${mattRec?.取引形式?.value}, mattRec取得成功: ${!!mattRec}`);
      if (!mattRec) {
        console.warn(`[mattRec未取得] 媒体名条件: eecoto, 出荷レコード側モール管理番号: ${shipRecords.eecoto[ii][mallManageNumber.eecoto]?.value || '(なし)'}`);
        let candidates = mattRecords.filter((r) => r.掲載媒体名.value === 'eecoto');
        console.warn(`[mattRec未取得] 案件管理側で媒体名一致の件数: ${candidates.length}`);
        if (candidates.length) {
          console.warn(
            '[mattRec未取得] 媒体名一致候補のモール管理番号一覧:',
            candidates.map((c) => c.モール管理番号.value)
          );
        }
        // 追加ログ
        const shipRec = shipRecords.eecoto[ii];
        const mediaName = 'eecoto';
        console.error(`[案件未取得エラー] 媒体名: ${mediaName || '(不明)'}, モール管理番号: ${shipRec[mallManageNumber.eecoto]?.value || '(なし)'}`);
        console.table(
          mattRecords
            .filter((r) => r.掲載媒体名.value === mediaName)
            .map((r) => ({
              案件ID: r.$id.value,
              掲載媒体名: r.掲載媒体名.value,
              モール管理番号: r.モール管理番号.value,
              取引形式: r.取引形式.value,
            }))
        );
      }
      if (mattRec) {
        let itemInfos = [];
        // 案件の商品1～10でループ
        for (let jj = 1; jj <= 10; jj++) {
          // 商品コード取得＆存在チェック（Map 参照＋正規化）
          const code = normalizeCode(mattRec['商品コード_' + jj]?.value);
          if (!code) continue;

          const _itemRec = ITEM_BY_CODE.get(code);
          if (!_itemRec) continue;

          // 必要バラ数
          const needBara = (parseInt(shipRecords.eecoto[ii]?.数量?.value, 10) || 0) * (parseInt(mattRec['セット入数_' + jj]?.value, 10) || 0);

          // 在庫バケットから条件一致の1件を割り当て
          const bucket = STOCK_BY_CODE.get(code) || [];
          let stockRec = null;
          for (let k = 0; k < bucket.length; k++) {
            const cand = bucket[k];
            const okDate = mattRec?.最短賞味期限?.value == null || cand?.賞味期限?.value >= mattRec.最短賞味期限.value;
            const qty = parseInt(cand?.在庫数?.value, 10) || 0;
            if (okDate && qty >= needBara) {
              stockRec = cand;
              cand.在庫数.value = String(qty - needBara);
              break;
            }
          }

          // 商品情報を作成
          itemInfos.push({
            value: {
              商品コード: { value: mattRec['商品コード_' + jj].value },
              セット入数: { value: mattRec['セット入数_' + jj].value },
              賞味期限: { value: stockRec ? stockRec.賞味期限.value : '' },
              //不足: { value: stockRec ? "" : "不足" },
              ロケーション: { value: stockRec ? stockRec.ロケーション.value : '' },
              備考: { value: stockRec ? stockRec.備考.value : '' },
            },
          });
        }
        if (itemInfos.length) {
          let warehouseRec = warehouseRecords.find((record) => record.倉庫ID.value === '104');
          let newRecord = {
            出荷管理アプリID: { value: HC_APP_ID_SHIPPING_EECOTO },
            出荷管理レコードID: { value: shipRecords.eecoto[ii].$id.value },
            案件グループID: { value: mattRec.案件グループID.value },
            案件レコードID: { value: mattRec.$id.value },
            取引形式: { value: mattRec.取引形式.value },
            モール管理番号: { value: mattRec.モール管理番号.value },
            出荷管理から取得日: { value: dtExecute },

            商品情報: { value: itemInfos },

            掲載媒体名: { value: mattRec.掲載媒体名_表示用.value },
            注文番号: { value: shipRecords.eecoto[ii].注文ID.value },
            注文日: { value: shipRecords.eecoto[ii].注文日.value },
            注文数: { value: shipRecords.eecoto[ii].数量.value },
            掲載商品名: { value: mattRec.掲載商品名.value },
            //配送日指定: { value: "" },
            時間帯指定: { value: '0' },
            サイズ: { value: mattRec.配送サイズ_GDL.value },
            //のし: { value: "" },

            注文者名: { value: shipRecords.eecoto[ii].氏名_請求者情報.value },
            //注文者かな: { value: shipRecords.eecoto[ii].会員かな.value },
            注文者郵便番号: { value: shipRecords.eecoto[ii].郵便番号_請求者情報.value },
            注文者住所: { value: shipRecords.eecoto[ii].住所_請求者情報.value },
            //注文者電話番号: { value: shipRecords.eecoto[ii].会員電話番号.value },

            送付先名: { value: shipRecords.eecoto[ii].氏名.value },
            //送付先かな: { value: shipRecords.eecoto[ii].送り先かな.value },
            送付先郵便番号: { value: shipRecords.eecoto[ii].郵便番号.value },
            送付先住所: { value: shipRecords.eecoto[ii].住所.value },
            送付先電話番号: { value: shipRecords.eecoto[ii].電話番号.value },

            ご依頼主名: { value: warehouseRec.倉庫名.value },
            ご依頼主郵便番号: { value: warehouseRec.郵便番号.value },
            ご依頼主住所: { value: warehouseRec.住所.value },
            ご依頼主電話番号: { value: warehouseRec.電話番号.value },

            配送業者: { value: mattRec.配送業者.value },
          };
          // 注文メモの内容を確認して記事欄5へ反映
          const rawCoupon = shipRecords.eecoto[ii].注文メモ ? shipRecords.eecoto[ii].注文メモ.value : '';
          const coupon = (rawCoupon || '').toUpperCase().trim();

          if (coupon.includes('ANA')) {
            newRecord['記事欄5'] = { value: 'ANA Pocket分' };
          } else if (coupon.includes('JAL')) {
            newRecord['記事欄5'] = { value: 'JALミニマイル特典分' };
          }
          // どちらも含まれない場合は何も入れない（空欄のまま）
          arrRtn.push(newRecord);
        }
      }
    }
    return arrRtn;
  };
  /**
   * 出荷指示アプリ用にデータを生成（リロクラブ）
   * @returns
   */
  const CreateDataForShipInstruction_RIRO = async () => {
    let arrRtn = [];

    for (let ii = 0; ii < shipRecords.リロ.length; ii++) {
      // 案件レコードを取得
      let mattRec = mattRecords.find((record) => record.掲載媒体名.value === 'リロ' && record.モール管理番号.value === shipRecords.リロ[ii][mallManageNumber.リロ].value);
      // デバッグログ追加
      console.warn(`[取引形式デバッグ] 媒体名: ${mattRec?.掲載媒体名?.value}, モール管理番号: ${mattRec?.モール管理番号?.value}, 案件レコードID: ${mattRec?.$id?.value}, 取引形式: ${mattRec?.取引形式?.value}, mattRec取得成功: ${!!mattRec}`);
      if (!mattRec) {
        console.warn(`[mattRec未取得] 媒体名条件: リロ, 出荷レコード側モール管理番号: ${shipRecords.リロ[ii][mallManageNumber.リロ]?.value || '(なし)'}`);
        let candidates = mattRecords.filter((r) => r.掲載媒体名.value === 'リロ');
        console.warn(`[mattRec未取得] 案件管理側で媒体名一致の件数: ${candidates.length}`);
        if (candidates.length) {
          console.warn(
            '[mattRec未取得] 媒体名一致候補のモール管理番号一覧:',
            candidates.map((c) => c.モール管理番号.value)
          );
        }
        // 追加ログ
        const shipRec = shipRecords.リロ[ii];
        const mediaName = 'リロ';
        console.error(`[案件未取得エラー] 媒体名: ${mediaName || '(不明)'}, モール管理番号: ${shipRec[mallManageNumber.リロ]?.value || '(なし)'}`);
        console.table(
          mattRecords
            .filter((r) => r.掲載媒体名.value === mediaName)
            .map((r) => ({
              案件ID: r.$id.value,
              掲載媒体名: r.掲載媒体名.value,
              モール管理番号: r.モール管理番号.value,
              取引形式: r.取引形式.value,
            }))
        );
      }
      if (mattRec) {
        let itemInfos = [];
        // 案件の商品1～10でループ（Map参照版）
        for (let jj = 1; jj <= 10; jj++) {
          // 商品コード取得＆存在チェック（Map 参照）
          const code = normalizeCode(mattRec['商品コード_' + jj]?.value);
          if (!code) continue;

          // 存在確認のみ（属性は未使用）— パターンA
          const _itemRec = ITEM_BY_CODE.get(code);
          if (!_itemRec) continue;

          // 必要バラ数（数量 × セット入数）
          const needBara = (parseInt(shipRecords.リロ[ii]?.数量?.value, 10) || 0) * (parseInt(mattRec['セット入数_' + jj]?.value, 10) || 0);

          // 在庫バケット（賞味期限昇順）から条件一致の1件を割り当て
          const bucket = STOCK_BY_CODE.get(code) || [];
          let stockRec = null;
          for (let k = 0; k < bucket.length; k++) {
            const cand = bucket[k];
            const okDate = mattRec?.最短賞味期限?.value == null || cand?.賞味期限?.value >= mattRec.最短賞味期限.value;
            const qty = parseInt(cand?.在庫数?.value, 10) || 0;
            if (okDate && qty >= needBara) {
              stockRec = cand;
              // 在庫を消費（Kintoneは文字列型）
              cand.在庫数.value = String(qty - needBara);
              break;
            }
          }

          // 商品情報を作成
          itemInfos.push({
            value: {
              商品コード: { value: mattRec['商品コード_' + jj].value },
              セット入数: { value: mattRec['セット入数_' + jj].value },
              賞味期限: { value: stockRec ? stockRec.賞味期限.value : '' },
              //不足:       { value: stockRec ? "" : "不足" },
              ロケーション: { value: stockRec ? stockRec.ロケーション.value : '' },
              備考: { value: stockRec ? stockRec.備考.value : '' },
            },
          });
        }

        if (itemInfos.length) {
          arrRtn.push({
            出荷管理アプリID: { value: HC_APP_ID_SHIPPING_RIRO },
            出荷管理レコードID: { value: shipRecords.リロ[ii].$id.value },
            案件グループID: { value: mattRec.案件グループID.value },
            案件レコードID: { value: mattRec.$id.value },
            取引形式: { value: mattRec.取引形式.value },
            モール管理番号: { value: mattRec.モール管理番号.value },
            出荷管理から取得日: { value: dtExecute },

            商品情報: { value: itemInfos },

            掲載媒体名: { value: mattRec.掲載媒体名_表示用.value },
            注文番号: { value: shipRecords.リロ[ii].注文番号.value },
            注文日: { value: shipRecords.リロ[ii].受付日.value },
            注文数: { value: shipRecords.リロ[ii].数量.value },
            掲載商品名: { value: mattRec.掲載商品名.value },
            //配送日指定: { value: "" },
            時間帯指定: { value: '0' },
            サイズ: { value: mattRec.配送サイズ_GDL.value },
            のし: { value: shipRecords.リロ[ii].のし区分.value },

            注文者名: { value: shipRecords.リロ[ii].送り主名.value },
            注文者かな: { value: shipRecords.リロ[ii].送り主名_カナ.value },
            注文者郵便番号: { value: shipRecords.リロ[ii].送り主郵便番号.value },
            注文者住所: { value: shipRecords.リロ[ii].送付主都道府県.value + shipRecords.リロ[ii].送り主住所.value + shipRecords.リロ[ii].送り主住所番地.value },
            注文者電話番号: { value: shipRecords.リロ[ii].送り主TEL.value },

            送付先名: { value: shipRecords.リロ[ii].お届け先名称.value },
            送付先かな: { value: shipRecords.リロ[ii].お届け先名称_カナ.value },
            送付先郵便番号: { value: shipRecords.リロ[ii].お届け先郵便番号.value },
            送付先住所: { value: shipRecords.リロ[ii].お届け先都道府県.value + shipRecords.リロ[ii].お届け先住所.value + shipRecords.リロ[ii].お届け先番地.value },
            送付先電話番号: { value: shipRecords.リロ[ii].お届け先TEL.value },

            ご依頼主名: { value: shipRecords.リロ[ii].送り主名.value },
            ご依頼主郵便番号: { value: shipRecords.リロ[ii].送り主郵便番号.value },
            ご依頼主住所: { value: shipRecords.リロ[ii].送付主都道府県.value + shipRecords.リロ[ii].送り主住所.value + shipRecords.リロ[ii].送り主住所番地.value },
            ご依頼主電話番号: { value: shipRecords.リロ[ii].送り主TEL.value },

            配送業者: { value: mattRec.配送業者.value },
          });
        }
      }
    }
    return arrRtn;
  };
  /**
   * 出荷指示アプリ用にデータを生成（ベネフィット・ワン）
   * @returns
   */
  const CreateDataForShipInstruction_BENE = async () => {
    let arrRtn = [];

    for (let ii = 0; ii < shipRecords.ベネ.length; ii++) {
      // 案件レコードを取得
      let mattRec = mattRecords.find((record) => record.掲載媒体名.value === 'ベネ' && record.モール管理番号.value === shipRecords.ベネ[ii][mallManageNumber.ベネ].value);
      // デバッグログ追加
      console.warn(`[取引形式デバッグ] 媒体名: ${mattRec?.掲載媒体名?.value}, モール管理番号: ${mattRec?.モール管理番号?.value}, 案件レコードID: ${mattRec?.$id?.value}, 取引形式: ${mattRec?.取引形式?.value}, mattRec取得成功: ${!!mattRec}`);
      if (!mattRec) {
        console.warn(`[mattRec未取得] 媒体名条件: ベネ, 出荷レコード側モール管理番号: ${shipRecords.ベネ[ii][mallManageNumber.ベネ]?.value || '(なし)'}`);
        let candidates = mattRecords.filter((r) => r.掲載媒体名.value === 'ベネ');
        console.warn(`[mattRec未取得] 案件管理側で媒体名一致の件数: ${candidates.length}`);
        if (candidates.length) {
          console.warn(
            '[mattRec未取得] 媒体名一致候補のモール管理番号一覧:',
            candidates.map((c) => c.モール管理番号.value)
          );
        }
        // 追加ログ
        const shipRec = shipRecords.ベネ[ii];
        const mediaName = 'ベネ';
        console.error(`[案件未取得エラー] 媒体名: ${mediaName || '(不明)'}, モール管理番号: ${shipRec[mallManageNumber.ベネ]?.value || '(なし)'}`);
        console.table(
          mattRecords
            .filter((r) => r.掲載媒体名.value === mediaName)
            .map((r) => ({
              案件ID: r.$id.value,
              掲載媒体名: r.掲載媒体名.value,
              モール管理番号: r.モール管理番号.value,
              取引形式: r.取引形式.value,
            }))
        );
      }
      if (mattRec) {
        let itemInfos = [];
        // 案件の商品1～10でループ（Map参照版）
        const shipRec = shipRecords.ベネ[ii];
        for (let jj = 1; jj <= 10; jj++) {
          // 商品コード取得＆存在チェック（Map 参照）
          const code = normalizeCode(mattRec['商品コード_' + jj]?.value);
          if (!code) continue;

          // 存在確認のみ（属性は未使用）
          const _itemRec = ITEM_BY_CODE.get(code);
          if (!_itemRec) continue;

          // 必要バラ数（数量 × セット入数）
          const needBara = (parseInt(shipRec?.数量?.value, 10) || 0) * (parseInt(mattRec['セット入数_' + jj]?.value, 10) || 0);
          if (needBara <= 0) continue; // 任意

          // 在庫バケット（賞味期限昇順）から条件一致の1件を割り当て
          const bucket = STOCK_BY_CODE.get(code) || [];
          let stockRec = null;
          for (let k = 0; k < bucket.length; k++) {
            const cand = bucket[k];
            const okDate = mattRec?.最短賞味期限?.value == null || cand?.賞味期限?.value >= mattRec.最短賞味期限.value;
            const qty = parseInt(cand?.在庫数?.value, 10) || 0;
            if (okDate && qty >= needBara) {
              stockRec = cand;
              // 在庫を消費（Kintoneは文字列型）
              cand.在庫数.value = String(qty - needBara);
              break;
            }
          }

          // 商品情報を作成（既存と同じ形）
          itemInfos.push({
            value: {
              商品コード: { value: mattRec['商品コード_' + jj].value },
              セット入数: { value: mattRec['セット入数_' + jj].value },
              賞味期限: { value: stockRec ? stockRec.賞味期限.value : '' },
              //不足:       { value: stockRec ? "" : "不足" },
              ロケーション: { value: stockRec ? stockRec.ロケーション.value : '' },
              備考: { value: stockRec ? stockRec.備考.value : '' },
            },
          });
        }

        if (itemInfos.length) {
          // 送付先の不備を確認
          let strErrMsg = shipRecords.ベネ[ii]['配送先市区町村・番地'].value ? (Number.isNaN(new Date(shipRecords.ベネ[ii]['配送先市区町村・番地'].value).getTime()) ? '' : '送付先住所が不正です') : '';

          arrRtn.push({
            出荷管理アプリID: { value: HC_APP_ID_SHIPPING_BENE },
            出荷管理レコードID: { value: shipRecords.ベネ[ii].$id.value },
            案件グループID: { value: mattRec.案件グループID.value },
            案件レコードID: { value: mattRec.$id.value },
            取引形式: { value: mattRec.取引形式.value },
            モール管理番号: { value: mattRec.モール管理番号.value },
            出荷管理から取得日: { value: dtExecute },

            商品情報: { value: itemInfos },

            掲載媒体名: { value: mattRec.掲載媒体名_表示用.value },
            注文番号: { value: shipRecords.ベネ[ii].受付番号.value },
            注文日: { value: luxon.DateTime.fromISO(shipRecords.ベネ[ii].受注日.value).toFormat('yyyy-MM-dd') },
            注文数: { value: shipRecords.ベネ[ii].数量.value },
            掲載商品名: { value: mattRec.掲載商品名.value },
            //配送日指定: { value: "" },
            時間帯指定: { value: '0' },
            サイズ: { value: mattRec.配送サイズ_GDL.value },
            のし: { value: shipRecords.ベネ[ii].のし_ラッピング種別.value + '/' + shipRecords.ベネ[ii].のし用途_ラッピング名称.value },

            注文者名: { value: shipRecords.ベネ[ii].送り主氏名.value },
            注文者かな: { value: shipRecords.ベネ[ii].送り主フリガナ.value },
            注文者郵便番号: { value: shipRecords.ベネ[ii].送り主郵便番号.value },
            注文者住所: { value: shipRecords.ベネ[ii].送り主都道府県.value + shipRecords.ベネ[ii]['送り主市区町村・番地'].value + shipRecords.ベネ[ii]['送り主建物・号室'].value },
            注文者電話番号: { value: shipRecords.ベネ[ii].送り主電話番号.value },

            送付先名: { value: shipRecords.ベネ[ii].配送先名.value },
            送付先かな: { value: shipRecords.ベネ[ii].配送先名カナ.value },
            送付先郵便番号: { value: shipRecords.ベネ[ii].配送先郵便番号.value },
            送付先住所: { value: shipRecords.ベネ[ii].配送先都道府県.value + shipRecords.ベネ[ii]['配送先市区町村・番地'].value + shipRecords.ベネ[ii]['配送先建物・号室'].value },
            送付先電話番号: { value: shipRecords.ベネ[ii].配送先電話番号.value },

            ご依頼主名: { value: shipRecords.ベネ[ii].送り主氏名.value },
            ご依頼主郵便番号: { value: shipRecords.ベネ[ii].送り主郵便番号.value },
            ご依頼主住所: { value: shipRecords.ベネ[ii].送り主都道府県.value + shipRecords.ベネ[ii]['送り主市区町村・番地'].value + shipRecords.ベネ[ii]['送り主建物・号室'].value },
            ご依頼主電話番号: { value: shipRecords.ベネ[ii].送り主電話番号.value },

            配送業者: { value: mattRec.配送業者.value },

            送付先不備: { value: strErrMsg ? '不備あり' : '' },
            不備内容: { value: strErrMsg ? strErrMsg : '' },
          });
        }
      }
    }
    return arrRtn;
  };
  /**
   * 出荷指示アプリ用にデータを生成（Tポイント）
   * @returns
   */
  const CreateDataForShipInstruction_TPOINT = async () => {
    let arrRtn = [];

    for (let ii = 0; ii < shipRecords.Tポイント.length; ii++) {
      // 案件レコードを取得
      let mattRec = mattRecords.find((record) => record.掲載媒体名.value === 'Tポイント' && record.モール管理番号.value === shipRecords.Tポイント[ii][mallManageNumber.Tポイント].value);
      // デバッグログ追加
      console.warn(`[取引形式デバッグ] 媒体名: ${mattRec?.掲載媒体名?.value}, モール管理番号: ${mattRec?.モール管理番号?.value}, 案件レコードID: ${mattRec?.$id?.value}, 取引形式: ${mattRec?.取引形式?.value}, mattRec取得成功: ${!!mattRec}`);
      if (!mattRec) {
        console.warn(`[mattRec未取得] 媒体名条件: Tポイント, 出荷レコード側モール管理番号: ${shipRecords.Tポイント[ii][mallManageNumber.Tポイント]?.value || '(なし)'}`);
        let candidates = mattRecords.filter((r) => r.掲載媒体名.value === 'Tポイント');
        console.warn(`[mattRec未取得] 案件管理側で媒体名一致の件数: ${candidates.length}`);
        if (candidates.length) {
          console.warn(
            '[mattRec未取得] 媒体名一致候補のモール管理番号一覧:',
            candidates.map((c) => c.モール管理番号.value)
          );
        }
        // 追加ログ
        const shipRec = shipRecords.Tポイント[ii];
        const mediaName = 'Tポイント';
        console.error(`[案件未取得エラー] 媒体名: ${mediaName || '(不明)'}, モール管理番号: ${shipRec[mallManageNumber.Tポイント]?.value || '(なし)'}`);
        console.table(
          mattRecords
            .filter((r) => r.掲載媒体名.value === mediaName)
            .map((r) => ({
              案件ID: r.$id.value,
              掲載媒体名: r.掲載媒体名.value,
              モール管理番号: r.モール管理番号.value,
              取引形式: r.取引形式.value,
            }))
        );
      }
      if (mattRec) {
        let itemInfos = [];
        // 案件の商品1～10でループ（Map参照版）
        const shipRec = shipRecords.Tポイント[ii];
        for (let jj = 1; jj <= 10; jj++) {
          // 商品コード取得＆存在チェック（Map 参照）
          const code = normalizeCode(mattRec['商品コード_' + jj]?.value);
          if (!code) continue;

          // 存在確認のみ（属性は未使用）
          const _itemRec = ITEM_BY_CODE.get(code);
          if (!_itemRec) continue;

          // 必要バラ数（商品申込数量 × セット入数）
          const needBara = (parseInt(shipRec?.商品申込数量?.value, 10) || 0) * (parseInt(mattRec['セット入数_' + jj]?.value, 10) || 0);
          if (needBara <= 0) continue; // 任意

          // 在庫バケット（賞味期限昇順）から条件一致の1件を割り当て
          const bucket = STOCK_BY_CODE.get(code) || [];
          let stockRec = null;
          for (let k = 0; k < bucket.length; k++) {
            const cand = bucket[k];
            const okDate = mattRec?.最短賞味期限?.value == null || cand?.賞味期限?.value >= mattRec.最短賞味期限.value;
            const qty = parseInt(cand?.在庫数?.value, 10) || 0;
            if (okDate && qty >= needBara) {
              stockRec = cand;
              // 在庫を消費（Kintoneは文字列型）
              cand.在庫数.value = String(qty - needBara);
              break;
            }
          }

          // 商品情報を作成（既存と同じ形）
          itemInfos.push({
            value: {
              商品コード: { value: mattRec['商品コード_' + jj].value },
              セット入数: { value: mattRec['セット入数_' + jj].value },
              賞味期限: { value: stockRec ? stockRec.賞味期限.value : '' },
              //不足:       { value: stockRec ? "" : "不足" },
              ロケーション: { value: stockRec ? stockRec.ロケーション.value : '' },
              備考: { value: stockRec ? stockRec.備考.value : '' },
            },
          });
        }
        if (itemInfos.length) {
          let warehouseRec = warehouseRecords.find((record) => record.倉庫ID.value === '103');
          arrRtn.push({
            出荷管理アプリID: { value: HC_APP_ID_SHIPPING_TPOINT },
            出荷管理レコードID: { value: shipRecords.Tポイント[ii].$id.value },
            案件グループID: { value: mattRec.案件グループID.value },
            案件レコードID: { value: mattRec.$id.value },
            取引形式: { value: mattRec.取引形式.value },
            モール管理番号: { value: mattRec.モール管理番号.value },
            出荷管理から取得日: { value: dtExecute },

            商品情報: { value: itemInfos },

            掲載媒体名: { value: mattRec.掲載媒体名_表示用.value },
            注文番号: { value: shipRecords.Tポイント[ii].オーダー番号.value },
            注文日: { value: luxon.DateTime.fromFormat(shipRecords.Tポイント[ii].申込日時.value, 'yyyyMMddHHmmss').toFormat('yyyy-MM-dd') },
            注文数: { value: shipRecords.Tポイント[ii].商品申込数量.value },
            掲載商品名: { value: mattRec.掲載商品名.value },
            //配送日指定: { value: "" },
            時間帯指定: { value: '0' },
            サイズ: { value: mattRec.配送サイズ_GDL.value },
            //のし: { value: shipRecords.Tポイント[ii].のし_ラッピング種別.value + "/" + shipRecords.Tポイント[ii].のし用途_ラッピング名称.value },

            注文者名: { value: shipRecords.Tポイント[ii].氏名_漢字.value },
            //注文者かな: { value: shipRecords.Tポイント[ii].送り主フリガナ.value },
            注文者郵便番号: { value: shipRecords.Tポイント[ii].郵便番号.value },
            注文者住所: { value: shipRecords.Tポイント[ii].住所.value },
            注文者電話番号: { value: shipRecords.Tポイント[ii].電話番号.value },

            送付先名: { value: shipRecords.Tポイント[ii].氏名_漢字.value },
            //送付先かな: { value: shipRecords.Tポイント[ii].配送先名カナ.value },
            送付先郵便番号: { value: shipRecords.Tポイント[ii].郵便番号.value },
            送付先住所: { value: shipRecords.Tポイント[ii].住所.value },
            送付先電話番号: { value: shipRecords.Tポイント[ii].電話番号.value },

            ご依頼主名: { value: warehouseRec.倉庫名.value },
            ご依頼主郵便番号: { value: warehouseRec.郵便番号.value },
            ご依頼主住所: { value: warehouseRec.住所.value },
            ご依頼主電話番号: { value: warehouseRec.電話番号.value },

            配送業者: { value: mattRec.配送業者.value },
          });
        }
      }
    }
    return arrRtn;
  };
  /**
   * 出荷指示アプリ用にデータを生成（社販）
   * @returns
   */
  const CreateDataForShipInstruction_SHAHAN = async () => {
    let arrRtn = [];

    for (let ii = 0; ii < shipRecords.社販.length; ii++) {
      // 案件レコードを取得
      let mattRec = mattRecords.find((record) => record.掲載媒体名.value === '社販' && record.モール管理番号.value === shipRecords.社販[ii][mallManageNumber.社販].value);
      // デバッグログ追加
      console.warn(`[取引形式デバッグ] 媒体名: ${mattRec?.掲載媒体名?.value}, モール管理番号: ${mattRec?.モール管理番号?.value}, 案件レコードID: ${mattRec?.$id?.value}, 取引形式: ${mattRec?.取引形式?.value}, mattRec取得成功: ${!!mattRec}`);
      if (!mattRec) {
        console.warn(`[mattRec未取得] 媒体名条件: 社販, 出荷レコード側モール管理番号: ${shipRecords.社販[ii][mallManageNumber.社販]?.value || '(なし)'}`);
        let candidates = mattRecords.filter((r) => r.掲載媒体名.value === '社販');
        console.warn(`[mattRec未取得] 案件管理側で媒体名一致の件数: ${candidates.length}`);
        if (candidates.length) {
          console.warn(
            '[mattRec未取得] 媒体名一致候補のモール管理番号一覧:',
            candidates.map((c) => c.モール管理番号.value)
          );
        }
        // 追加ログ
        const shipRec = shipRecords.社販[ii];
        const mediaName = '社販';
        console.error(`[案件未取得エラー] 媒体名: ${mediaName || '(不明)'}, モール管理番号: ${shipRec[mallManageNumber.社販]?.value || '(なし)'}`);
        console.table(
          mattRecords
            .filter((r) => r.掲載媒体名.value === mediaName)
            .map((r) => ({
              案件ID: r.$id.value,
              掲載媒体名: r.掲載媒体名.value,
              モール管理番号: r.モール管理番号.value,
              取引形式: r.取引形式.value,
            }))
        );
      }
      if (mattRec) {
        let itemInfos = [];
        // 案件の商品1～10でループ（Map参照版）
        const shipRec = shipRecords.社販[ii];
        for (let jj = 1; jj <= 10; jj++) {
          // 商品コード取得＆存在チェック（Map 参照）
          const code = normalizeCode(mattRec['商品コード_' + jj]?.value);
          if (!code) continue;

          // 商品の存在確認のみ（属性は未使用）
          const _itemRec = ITEM_BY_CODE.get(code);
          if (!_itemRec) continue;

          // 必要バラ数（数量 × セット入数）
          const needBara = (parseInt(shipRec?.数量?.value, 10) || 0) * (parseInt(mattRec['セット入数_' + jj]?.value, 10) || 0);
          if (needBara <= 0) continue; // 任意

          // 在庫バケット（賞味期限昇順）から条件一致の1件を割り当て
          const bucket = STOCK_BY_CODE.get(code) || [];
          let stockRec = null;
          for (let k = 0; k < bucket.length; k++) {
            const cand = bucket[k];
            const okDate = mattRec?.最短賞味期限?.value == null || cand?.賞味期限?.value >= mattRec.最短賞味期限.value;
            const qty = parseInt(cand?.在庫数?.value, 10) || 0;
            if (okDate && qty >= needBara) {
              stockRec = cand;
              // 在庫を消費（Kintoneは文字列フィールド）
              cand.在庫数.value = String(qty - needBara);
              break;
            }
          }

          // 商品情報を作成（既存と同じ形）
          itemInfos.push({
            value: {
              商品コード: { value: mattRec['商品コード_' + jj].value },
              セット入数: { value: mattRec['セット入数_' + jj].value },
              賞味期限: { value: stockRec ? stockRec.賞味期限.value : '' },
              //不足:       { value: stockRec ? "" : "不足" },
              ロケーション: { value: stockRec ? stockRec.ロケーション.value : '' },
              備考: { value: stockRec ? stockRec.備考.value : '' },
            },
          });
        }

        if (itemInfos.length) {
          // 送付先の不備を確認
          let strErrMsg = shipRecords.社販[ii]['配送先住所_町名番地'].value ? (Number.isNaN(new Date(shipRecords.社販[ii]['配送先住所_町名番地'].value).getTime()) ? '' : '送付先住所が不正です') : '';

          arrRtn.push({
            出荷管理アプリID: { value: HC_APP_ID_SHIPPING_SHAHAN },
            出荷管理レコードID: { value: shipRecords.社販[ii].$id.value },
            案件グループID: { value: mattRec.案件グループID.value },
            案件レコードID: { value: mattRec.$id.value },
            取引形式: { value: mattRec.取引形式.value },
            モール管理番号: { value: mattRec.モール管理番号.value },
            出荷管理から取得日: { value: dtExecute },

            商品情報: { value: itemInfos },

            掲載媒体名: { value: mattRec.掲載媒体名_表示用.value },
            注文番号: { value: shipRecords.社販[ii].注文サプライヤID.value },
            注文日: { value: luxon.DateTime.fromISO(shipRecords.社販[ii].注文日.value).toFormat('yyyy-MM-dd') },
            注文数: { value: shipRecords.社販[ii].数量.value },
            掲載商品名: { value: mattRec.掲載商品名.value },
            配送日指定: { value: shipRecords.社販[ii].お届け日指定.value ? luxon.DateTime.fromISO(shipRecords.社販[ii].お届け日指定.value).toFormat('yyyy-MM-dd') : '' },
            時間帯指定: {
              value:
                shipRecords.社販[ii].時間帯指定.value === '指定なし' || shipRecords.社販[ii].時間帯指定.value === '指定無し'
                  ? '00'
                  : shipRecords.社販[ii].時間帯指定.value === '午前中'
                  ? '01'
                  : shipRecords.社販[ii].時間帯指定.value === '0～10時'
                  ? '06'
                  : shipRecords.社販[ii].時間帯指定.value === '10～12時'
                  ? '10'
                  : shipRecords.社販[ii].時間帯指定.value === '11～13時'
                  ? '11'
                  : shipRecords.社販[ii].時間帯指定.value === '12～14時'
                  ? '12'
                  : shipRecords.社販[ii].時間帯指定.value === '13～15時'
                  ? '13'
                  : shipRecords.社販[ii].時間帯指定.value === '14～16時'
                  ? '14'
                  : shipRecords.社販[ii].時間帯指定.value === '15～17時'
                  ? '15'
                  : shipRecords.社販[ii].時間帯指定.value === '16～18時'
                  ? '16'
                  : shipRecords.社販[ii].時間帯指定.value === '17～19時'
                  ? '17'
                  : shipRecords.社販[ii].時間帯指定.value === '18～20時'
                  ? '18'
                  : shipRecords.社販[ii].時間帯指定.value === '19～21時'
                  ? '19'
                  : shipRecords.社販[ii].時間帯指定.value === '20～22時'
                  ? '20'
                  : shipRecords.社販[ii].時間帯指定.value === '21～23時'
                  ? '21'
                  : shipRecords.社販[ii].時間帯指定.value === '22～24時'
                  ? '22'
                  : shipRecords.社販[ii].時間帯指定.value === '18～21時'
                  ? '04'
                  : '00',
            },
            サイズ: { value: mattRec.配送サイズ_GDL.value },
            //のし: { value: shipRecords.社販[ii].のし_ラッピング種別.value + "/" + shipRecords.社販[ii].のし用途_ラッピング名称.value },

            注文者名: { value: shipRecords.社販[ii].送り主氏名_姓.value + shipRecords.社販[ii].送り主氏名_名.value },
            注文者かな: { value: shipRecords.社販[ii].送り主カナ_姓.value + shipRecords.社販[ii].送り主カナ_名.value },
            注文者郵便番号: { value: shipRecords.社販[ii].送り主郵便番号.value },
            注文者住所: { value: shipRecords.社販[ii].送り主都道府県.value + shipRecords.社販[ii].送り主住所_郡市区.value + shipRecords.社販[ii].送り主住所_町名番地.value + shipRecords.社販[ii].送り主住所_建物名等.value },
            注文者電話番号: { value: shipRecords.社販[ii].送り主電話番号.value },

            送付先名: { value: shipRecords.社販[ii].配送先氏名_姓.value + shipRecords.社販[ii].配送先氏名_名.value },
            送付先かな: { value: shipRecords.社販[ii].配送先カナ_姓.value + shipRecords.社販[ii].配送先カナ_名.value },
            送付先郵便番号: { value: shipRecords.社販[ii].配送先郵便番号.value },
            送付先住所: { value: shipRecords.社販[ii].配送先都道府県.value + shipRecords.社販[ii].配送先住所_郡市区.value + shipRecords.社販[ii].配送先住所_町名番地.value + shipRecords.社販[ii].配送先住所_建物名等.value },
            送付先電話番号: { value: shipRecords.社販[ii].配送先電話番号.value },

            ご依頼主名: { value: shipRecords.社販[ii].送り主氏名_姓.value + shipRecords.社販[ii].送り主氏名_名.value },
            ご依頼主郵便番号: { value: shipRecords.社販[ii].送り主郵便番号.value },
            ご依頼主住所: { value: shipRecords.社販[ii].送り主都道府県.value + shipRecords.社販[ii].送り主住所_郡市区.value + shipRecords.社販[ii].送り主住所_町名番地.value + shipRecords.社販[ii].送り主住所_建物名等.value },
            ご依頼主電話番号: { value: shipRecords.社販[ii].送り主電話番号.value },

            配送業者: { value: mattRec.配送業者.value },

            送付先不備: { value: strErrMsg ? '不備あり' : '' },
            不備内容: { value: strErrMsg ? strErrMsg : '' },
          });
        }
      }
    }
    return arrRtn;
  };
  /**
   * 出荷指示アプリ用にデータを生成（坂戸以外）
   * @returns
   */
  const CreateDataForShipInstruction_SAKADOIGAI = async () => {
    let arrRtn = [];

    for (let ii = 0; ii < shipRecords.坂戸以外.length; ii++) {
      // 案件レコードを取得
      let mattRec = mattRecords.find((record) => record.掲載媒体名.value === '坂戸以外' && record.モール管理番号.value === shipRecords.坂戸以外[ii][mallManageNumber.坂戸以外].value);
      // デバッグログ追加
      console.warn(`[取引形式デバッグ] 媒体名: ${mattRec?.掲載媒体名?.value}, モール管理番号: ${mattRec?.モール管理番号?.value}, 案件レコードID: ${mattRec?.$id?.value}, 取引形式: ${mattRec?.取引形式?.value}, mattRec取得成功: ${!!mattRec}`);
      if (!mattRec) {
        console.warn(`[mattRec未取得] 媒体名条件: 坂戸以外, 出荷レコード側モール管理番号: ${shipRecords.坂戸以外[ii][mallManageNumber.坂戸以外]?.value || '(なし)'}`);
        let candidates = mattRecords.filter((r) => r.掲載媒体名.value === '坂戸以外');
        console.warn(`[mattRec未取得] 案件管理側で媒体名一致の件数: ${candidates.length}`);
        if (candidates.length) {
          console.warn(
            '[mattRec未取得] 媒体名一致候補のモール管理番号一覧:',
            candidates.map((c) => c.モール管理番号.value)
          );
        }
        // 追加ログ
        const shipRec = shipRecords.坂戸以外[ii];
        const mediaName = '坂戸以外';
        console.error(`[案件未取得エラー] 媒体名: ${mediaName || '(不明)'}, モール管理番号: ${shipRec[mallManageNumber.坂戸以外]?.value || '(なし)'}`);
        console.table(
          mattRecords
            .filter((r) => r.掲載媒体名.value === mediaName)
            .map((r) => ({
              案件ID: r.$id.value,
              掲載媒体名: r.掲載媒体名.value,
              モール管理番号: r.モール管理番号.value,
              取引形式: r.取引形式.value,
            }))
        );
      }
      if (mattRec) {
        let itemInfos = [];
        const shipRec = shipRecords.坂戸以外[ii];

        for (let jj = 1; jj <= 10; jj++) {
          const code = normalizeCode(mattRec['商品コード_' + jj]?.value);
          if (!code) continue;

          const _itemRec = ITEM_BY_CODE.get(code);
          if (!_itemRec) continue;

          const needBara = (parseInt(shipRec?.数量?.value, 10) || 0) * (parseInt(mattRec['セット入数_' + jj]?.value, 10) || 0);
          if (needBara <= 0) continue;

          const bucket = STOCK_BY_CODE.get(code) || [];
          let stockRec = null;
          for (let k = 0; k < bucket.length; k++) {
            const cand = bucket[k];
            const okDate = mattRec?.最短賞味期限?.value == null || cand?.賞味期限?.value >= mattRec.最短賞味期限.value;
            const qty = parseInt(cand?.在庫数?.value, 10) || 0;
            if (okDate && qty >= needBara) {
              stockRec = cand;
              cand.在庫数.value = String(qty - needBara); // Kintoneは文字列
              break;
            }
          }

          itemInfos.push({
            value: {
              商品コード: { value: mattRec['商品コード_' + jj].value },
              セット入数: { value: mattRec['セット入数_' + jj].value },
              賞味期限: { value: stockRec ? stockRec.賞味期限.value : '' },
              ロケーション: { value: stockRec ? stockRec.ロケーション.value : '' },
              備考: { value: stockRec ? stockRec.備考.value : '' },
            },
          });
        }

        if (itemInfos.length) {
          const warehouseRec = warehouseRecords.find((r) => r.倉庫ID.value === '103');
          const rawDate = shipRec.注文日?.value || shipRec.受付日?.value || '';
          let orderDateStr = dtExecute;
          if (rawDate) {
            let dt = luxon.DateTime.fromISO(rawDate);
            if (!dt.isValid) {
              dt = luxon.DateTime.fromFormat(rawDate, 'yyyy/MM/dd');
            }
            if (dt.isValid) {
              orderDateStr = dt.toFormat('yyyy-MM-dd');
            }
          }

          // ここからレコード生成
          arrRtn.push({
            出荷管理アプリID: { value: HC_APP_ID_SHIPPING_SAKADOIGAI },
            出荷管理レコードID: { value: shipRec.$id.value },
            案件グループID: { value: mattRec.案件グループID.value },
            案件レコードID: { value: mattRec.$id.value },
            取引形式: { value: mattRec.取引形式.value },
            モール管理番号: { value: mattRec.モール管理番号.value },
            出荷管理から取得日: { value: dtExecute },

            商品情報: { value: itemInfos },

            掲載媒体名: { value: mattRec.掲載媒体名_表示用.value },
            注文番号: { value: shipRec.注文番号?.value || shipRec.オーダー番号?.value || '' },

            注文日: { value: orderDateStr },
            注文数: { value: shipRec.数量?.value || 0 },
            掲載商品名: { value: mattRec.掲載商品名.value },
            時間帯指定: { value: '0' },
            サイズ: { value: mattRec.配送サイズ_GDL.value },

            送付先名: { value: shipRec.送付先名?.value || shipRec.氏名?.value || '' },
            送付先郵便番号: { value: shipRec.送付先郵便番号?.value || shipRec.郵便番号?.value || '' },
            送付先住所: { value: shipRec.送付先住所?.value || (shipRec.都道府県?.value || '') + (shipRec.市区町村?.value || '') + (shipRec.町名番地?.value || '') + (shipRec.建物等?.value || '') },
            送付先電話番号: { value: shipRec.送付先電話番号?.value || shipRec.電話番号?.value || '' },

            ご依頼主名: { value: warehouseRec?.倉庫名?.value || '' },
            ご依頼主郵便番号: { value: warehouseRec?.郵便番号?.value || '' },
            ご依頼主住所: { value: warehouseRec?.住所?.value || '' },
            ご依頼主電話番号: { value: warehouseRec?.電話番号?.value || '' },

            配送業者: { value: mattRec.配送業者.value },
          });
        }
      }
    }
    return arrRtn;
  };
  /**
   * 出荷指示アプリ用にデータを生成（KAUCHE）
   * @returns
   */
  const CreateDataForShipInstruction_KAUCHE = async () => {
    let arrRtn = [];

    for (let ii = 0; ii < shipRecords.KAUCHE.length; ii++) {
      // 案件レコードを取得
      let mattRec = mattRecords.find((record) => record.掲載媒体名.value === 'おためし' && record.モール管理番号.value === shipRecords.KAUCHE[ii][mallManageNumber.KAUCHE].value);
      // デバッグログ追加
      console.warn(`[取引形式デバッグ] 媒体名: ${mattRec?.掲載媒体名?.value}, モール管理番号: ${mattRec?.モール管理番号?.value}, 案件レコードID: ${mattRec?.$id?.value}, 取引形式: ${mattRec?.取引形式?.value}, mattRec取得成功: ${!!mattRec}`);
      if (!mattRec) {
        console.warn(`[mattRec未取得] 媒体名条件: おためし, 出荷レコード側モール管理番号: ${shipRecords.KAUCHE[ii][mallManageNumber.KAUCHE]?.value || '(なし)'}`);
        let candidates = mattRecords.filter((r) => r.掲載媒体名.value === 'おためし');
        console.warn(`[mattRec未取得] 案件管理側で媒体名一致の件数: ${candidates.length}`);
        if (candidates.length) {
          console.warn(
            '[mattRec未取得] 媒体名一致候補のモール管理番号一覧:',
            candidates.map((c) => c.モール管理番号.value)
          );
        }
        // 追加ログ
        const shipRec = shipRecords.KAUCHE[ii];
        const mediaName = 'おためし';
        console.error(`[案件未取得エラー] 媒体名: ${mediaName || '(不明)'}, モール管理番号: ${shipRec[mallManageNumber.KAUCHE]?.value || '(なし)'}`);
        console.table(
          mattRecords
            .filter((r) => r.掲載媒体名.value === mediaName)
            .map((r) => ({
              案件ID: r.$id.value,
              掲載媒体名: r.掲載媒体名.value,
              モール管理番号: r.モール管理番号.value,
              取引形式: r.取引形式.value,
            }))
        );
      }
      if (mattRec) {
        let itemInfos = [];
        // 案件の商品1～10でループ
        for (let jj = 1; jj <= 10; jj++) {
          // 商品コード取得＆存在チェック（Map 参照＋正規化）
          const code = normalizeCode(mattRec['商品コード_' + jj]?.value);
          if (!code) continue;

          const _itemRec = ITEM_BY_CODE.get(code);
          if (!_itemRec) continue;

          // 必要バラ数（元ロジック踏襲：セット入数のみ）
          const needBara = parseInt(mattRec['セット入数_' + jj]?.value, 10) || 0;
          if (needBara <= 0) continue;

          // 在庫バケットから条件一致の1件を割り当て
          const bucket = STOCK_BY_CODE.get(code) || [];
          let stockRec = null;
          for (let k = 0; k < bucket.length; k++) {
            const cand = bucket[k];
            const okDate = mattRec?.最短賞味期限?.value == null || cand?.賞味期限?.value >= mattRec.最短賞味期限.value;
            const qty = parseInt(cand?.在庫数?.value, 10) || 0;
            if (okDate && qty >= needBara) {
              stockRec = cand;
              cand.在庫数.value = String(qty - needBara);
              break;
            }
          }

          // 商品情報を作成
          itemInfos.push({
            value: {
              商品コード: { value: mattRec['商品コード_' + jj].value },
              セット入数: { value: mattRec['セット入数_' + jj].value },
              賞味期限: { value: stockRec ? stockRec.賞味期限.value : '' },
              //不足: { value: stockRec ? "" : "不足" },
              ロケーション: { value: stockRec ? stockRec.ロケーション.value : '' },
              備考: { value: stockRec ? stockRec.備考.value : '' },
            },
          });
        }
        if (itemInfos.length) {
          // 倉庫は 103（他媒体と合わせる）
          const warehouseRec = warehouseRecords.find((r) => r.倉庫ID.value === '103');

          // 注文日のフォールバック（ISO → yyyy/MM/dd → 実行日）
          const shipRec = shipRecords.KAUCHE[ii];
          const rawDate = shipRec?.注文日?.value || shipRec?.受付日?.value || shipRec?.購入日時?.value || '';
          let orderDateStr = dtExecute;
          if (rawDate) {
            let dt = luxon.DateTime.fromISO(rawDate);
            if (!dt.isValid) {
              dt = luxon.DateTime.fromFormat(rawDate, 'yyyy/MM/dd');
            }
            if (dt.isValid) {
              orderDateStr = dt.toFormat('yyyy-MM-dd');
            }
          }

          // 出荷指示アプリに登録するレコード
          arrRtn.push({
            出荷管理アプリID: { value: HC_APP_ID_SHIPPING_KAUCHE },
            出荷管理レコードID: { value: shipRec.$id.value },
            案件グループID: { value: mattRec.案件グループID.value },
            案件レコードID: { value: mattRec.$id.value },
            取引形式: { value: mattRec.取引形式.value },
            モール管理番号: { value: mattRec.モール管理番号.value },
            出荷管理から取得日: { value: dtExecute },

            商品情報: { value: itemInfos },

            掲載媒体名: { value: mattRec.掲載媒体名_表示用?.value || 'おためし' },
            注文番号: { value: shipRec?.注文番号?.value || shipRec?.オーダー番号?.value || '' },
            注文日: { value: orderDateStr },

            // KAUCHE は元コードが「注文数=セット入数合計」に近い運用だったため、
            // 数量が無いケースは 1 にフォールバック（必要なら 0/空に）
            注文数: { value: shipRec?.数量?.value || 1 },

            掲載商品名: { value: mattRec.掲載商品名.value },
            時間帯指定: { value: '0' },
            サイズ: { value: mattRec.配送サイズ_GDL.value },

            // 送付先（坂戸以外と同じフォールバック戦略）
            送付先名: { value: shipRec?.送付先名?.value || shipRec?.氏名?.value || '' },
            送付先郵便番号: { value: shipRec?.送付先郵便番号?.value || shipRec?.郵便番号?.value || '' },
            送付先住所: { value: shipRec?.送付先住所?.value || (shipRec?.都道府県?.value || '') + (shipRec?.市区町村?.value || '') + (shipRec?.町名番地?.value || '') + (shipRec?.建物等?.value || '') },
            送付先電話番号: { value: shipRec?.送付先電話番号?.value || shipRec?.電話番号?.value || '' },

            // ご依頼主（倉庫103）
            ご依頼主名: { value: warehouseRec?.倉庫名?.value || '' },
            ご依頼主郵便番号: { value: warehouseRec?.郵便番号?.value || '' },
            ご依頼主住所: { value: warehouseRec?.住所?.value || '' },
            ご依頼主電話番号: { value: warehouseRec?.電話番号?.value || '' },

            配送業者: { value: mattRec.配送業者.value },
          });
        }
        //1545
      }
    }
    return arrRtn;
  };

  /**
   * 出荷管理のレコードURLを追加
   * @param {*} allRec
   */
  const AddRecordUrl = (allRec) => {
    for (let ii = 0; ii < allRec.length; ii++) {
      allRec[ii]['出荷管理のレコードURL'] = { value: `https://s4i8kg86wpie.cybozu.com/k/${allRec[ii].出荷管理アプリID.value}/show#record=${allRec[ii].出荷管理レコードID.value}` };
    }
    return allRec;
  };

  /**
   * 住所不備の確認
   * @param {*} allRec
   * @returns
   */
  const CheckAddress = (allRec) => {
    /*
		郵便番号：空欄、ハイフン抜き、桁数、全角NG
		氏名：空欄
		住所：市区町村、番地の抜けている
		電話番号：空欄、ハイフン抜きの桁数（10 ～ 11桁）、半角
		*/
    for (let ii = 0; ii < allRec.length; ii++) {
      let errMsg = [];

      // 郵便番号
      if ('送付先郵便番号' in allRec[ii]) {
        let val = allRec[ii]['送付先郵便番号'].value;
        if (!val) {
          errMsg.push('郵便番号が空欄です。');
        } else {
          val = val.replace(/-|ー|－/g, '');
          val = val.replace(/[０-９]/g, (s) => {
            return String.fromCharCode(s.charCodeAt(0) - 0xfee0);
          });

          // ✅ 追加した修正
          if (val.length < 7) {
            val = val.padStart(7, '0');
          }
          if (val.length !== 7) {
            errMsg.push('郵便番号が7桁ではありません。');
          }
        }
        allRec[ii]['送付先郵便番号'] = { value: val };
      }

      // 氏名
      if ('送付先名' in allRec[ii] && !allRec[ii].送付先名.value) {
        errMsg.push('氏名が空欄です。');
      }

      // 住所
      if ('送付先住所' in allRec[ii]) {
        let val = allRec[ii].送付先住所.value;
        if (!val) {
          errMsg.push('住所が空欄です。');
        } else {
          const cityRegex = /(.+?[市区町村])/;
          const cityMatch = val.match(cityRegex);
          if (!cityMatch) {
            errMsg.push('市区町村がありません。');
          }
          if (!/\d|[一二三四五六七八九]|[０-９]/.test(val)) {
            errMsg.push('番地がありません。');
          }
        }
      }

      // 電話番号
      if ('送付先電話番号' in allRec[ii]) {
        let val = allRec[ii]['送付先電話番号'].value;
        if (!val) {
          errMsg.push('電話番号が空欄です。');
        } else {
          val = val.replace(/-|ー|－/g, '');
          val = val.replace(/[０-９]/g, (s) => {
            return String.fromCharCode(s.charCodeAt(0) - 0xfee0);
          });
          // ✅ 修正ポイント：先頭の +81 または 81 を 0 に変換
          val = val.replace(/^(\+81|81)/, '0');
          val = val.startsWith('0') ? val : '0' + val;

          if (val.length !== 10 && val.length !== 11) {
            errMsg.push('電話番号が10桁または11桁ではありません。');
          }
        }
        allRec[ii]['送付先電話番号'] = { value: val };
      }

      if (errMsg.length) {
        allRec[ii]['送付先不備'] = { value: '不備あり' };
        if ('不備内容' in allRec[ii]) {
          allRec[ii]['不備内容'] = { value: allRec[ii].不備内容.value + '\n' + errMsg.join('\n') };
        } else {
          allRec[ii]['不備内容'] = { value: errMsg.join('\n') };
        }
        continue;
      }
    }

    return allRec;
  };

  /**
   * 出荷管理のデータを出荷指示アプリ用に生成
   * @returns
   */
  const CreateDataForShipInstruction = async () => {
    let allRec = [];

    /*
		// au
		let rec_AU = await CreateDataForShipInstruction_AU();
		if (rec_AU.length) allRec = allRec.concat(rec_AU);

		// Tサンプル
		let rec_TSAMPLE = await CreateDataForShipInstruction_TSAMPLE();
		if (rec_TSAMPLE.length) allRec = allRec.concat(rec_TSAMPLE);
		*/

    // くまポン
    let rec_KUMAPON = await CreateDataForShipInstruction_KUMAPON();
    if (rec_KUMAPON.length) allRec = allRec.concat(rec_KUMAPON);

    // eecoto
    let rec_EECOTO = await CreateDataForShipInstruction_EECOTO();
    if (rec_EECOTO.length) allRec = allRec.concat(rec_EECOTO);

    // リロ
    let rec_RIRO = await CreateDataForShipInstruction_RIRO();
    if (rec_RIRO.length) allRec = allRec.concat(rec_RIRO);

    // ベネ
    let rec_BENE = await CreateDataForShipInstruction_BENE();
    if (rec_BENE.length) allRec = allRec.concat(rec_BENE);

    // Tポイント
    let rec_TPOINT = await CreateDataForShipInstruction_TPOINT();
    if (rec_TPOINT.length) allRec = allRec.concat(rec_TPOINT);

    // 社販
    let rec_SHAHAN = await CreateDataForShipInstruction_SHAHAN();
    if (rec_SHAHAN.length) allRec = allRec.concat(rec_SHAHAN);

    // 坂戸以外
    let rec_SAKADOIGAI = await CreateDataForShipInstruction_SAKADOIGAI();
    if (rec_SAKADOIGAI.length) allRec = allRec.concat(rec_SAKADOIGAI);

    // KAUCHE
    let rec_KAUCHE = await CreateDataForShipInstruction_KAUCHE();
    if (rec_KAUCHE.length) allRec = allRec.concat(rec_KAUCHE);

    // レコードURLを追加
    allRec = AddRecordUrl(allRec);

    // 住所不備確認
    allRec = CheckAddress(allRec);

    // 電話番号補正
    if (typeof FixPhoneNumbers === 'function') {
      allRec = FixPhoneNumbers(allRec);
    }

    return allRec;
  };

  /**
   * 出荷指示アプリにレコードを一括作成
   * @param {*} recData
   * @returns
   */
  const AddRecordsForShipInstruction = async (recData) => {
    try {
      return client.record
        .addAllRecords({ app: APP_ID, records: recData })
        .then(function (resp) {
          resParam.status = 1;
          // --- 追加：結果サマリ作成（作成件数／失敗件数） ---
          const requested = Array.isArray(recData) ? recData.length : 0;

          // kintone SDKの返り値に幅があるため防御的に件数を推定
          const countFromObject = resp && Array.isArray(resp.records) ? resp.records.length : null;
          const countFromArray = Array.isArray(resp)
            ? resp.reduce((sum, r) => {
                if (r && Array.isArray(r.records)) return sum + r.records.length;
                if (r && typeof r === 'object' && 'id' in r) return sum + 1;
                return sum;
              }, 0)
            : null;
          const created = countFromObject ?? countFromArray ?? requested;
          const failed = Math.max(0, requested - created);

          // メッセージ（Swal に表示される）
          resParam.message = `出荷指示：登録 ${created} 件 / 失敗 ${failed} 件（要求 ${requested} 件）`;

          // ログにも残しておく
          console.log('🧾 出荷指示・作成サマリ', { requested, created, failed, raw: resp });
          return resp;
        })
        .catch(function (e) {
          console.log(e);
          resParam.status = 9;
          resParam.message = `出荷指示アプリにレコードを作成できませんでした。\n` + e;
          return;
        });
    } catch (ex) {
      console.log(ex);
      resParam.status = 9;
      resParam.message = `出荷指示アプリにレコードを作成できませんでした。\n` + ex;
      return;
    }
  };

  /**
   * 出荷管理アプリのレコードを更新
   * @param {*} recData
   * @returns
   */
  const UpdateAllRecords = async (appId, recData) => {
    // 空配列は早期終了（成功0件）
    if (!Array.isArray(recData) || recData.length === 0) {
      return { updated: 0, failed: 0, error: null };
    }
    const MAX_RETRY = 2; // 追加で2回（合計3回）
    const BASE_DELAY = 250;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const shouldRetry = (err) => {
      const code = err?.response?.status ?? err?.status ?? 0;
      return code === 429 || (code >= 500 && code <= 599);
    };

    let lastErr = null;
    for (let i = 0; i <= MAX_RETRY; i++) {
      try {
        await client.record.updateAllRecords({ app: appId, records: recData });
        // 成功：要求分すべて更新できた前提でカウント
        return { updated: recData.length, failed: 0, error: null };
      } catch (e) {
        lastErr = e;
        if (!shouldRetry(e) || i === MAX_RETRY) {
          console.error(e);
          // 失敗：全件失敗として集計（SDKが部分失敗を返す実装でなければここでOK）
          return { updated: 0, failed: recData.length, error: e };
        }
        const jitter = Math.floor(Math.random() * 100);
        await sleep(BASE_DELAY * Math.pow(2, i) + jitter);
      }
    }
    // ここには通常来ない
    return { updated: 0, failed: recData.length, error: lastErr };
  };

  /**
   * 出荷管理アプリの「運用ステータス」を"出荷依頼済み"変更
   * @param {*} recData
   * @returns
   */
  const UpdateShippingRecords = async (recData) => {
    // 集計用
    const perMedia = []; // { key, requested, updated, failed }
    let totalReq = 0,
      totalUpd = 0,
      totalFail = 0;

    for (const key in shipRecords) {
      if (!shipRecords.hasOwnProperty(key)) continue;

      // 媒体→アプリID
      let appId = '';
      switch (key) {
        // case "au": appId = HC_APP_ID_SHIPPING_AU; break;
        // case "Tサンプル": appId = HC_APP_ID_SHIPPING_TSAMPLE; break;
        case 'くまポン':
          appId = HC_APP_ID_SHIPPING_KUMAPON;
          break;
        case 'eecoto':
          appId = HC_APP_ID_SHIPPING_EECOTO;
          break;
        case 'リロ':
          appId = HC_APP_ID_SHIPPING_RIRO;
          break;
        case 'ベネ':
          appId = HC_APP_ID_SHIPPING_BENE;
          break;
        case 'Tポイント':
          appId = HC_APP_ID_SHIPPING_TPOINT;
          break;
        case '社販':
          appId = HC_APP_ID_SHIPPING_SHAHAN;
          break;
        case '坂戸以外':
          appId = HC_APP_ID_SHIPPING_SAKADOIGAI;
          break;
        case 'KAUCHE':
          appId = HC_APP_ID_SHIPPING_KAUCHE;
          break;
        default:
          continue;
      }

      // 今回「出荷指示」に登録できたレコード（＝更新対象）を抽出
      const addedRecords = recData.filter((r) => r['出荷管理アプリID'].value == appId);
      if (addedRecords.length === 0) {
        perMedia.push({ key, requested: 0, updated: 0, failed: 0 });
        continue;
      }

      // 出荷管理側の対応レコードを集めて更新リクエストを作成
      const gatherRecords = shipRecords[key] || [];

      // Set化：更新対象となる出荷管理レコードID（型差異吸収のため文字列化）
      const targetIds = new Set(addedRecords.map((r) => String(r['出荷管理レコードID'].value)));

      const updateRecords = [];
      for (let i = 0; i < gatherRecords.length; i++) {
        const gid = String(gatherRecords[i].$id.value);
        if (targetIds.has(gid)) {
          updateRecords.push({
            id: gatherRecords[i].$id.value,
            record: { 運用ステータス: { value: '出荷依頼済み' } },
          });
        }
      }

      if (updateRecords.length === 0) {
        perMedia.push({ key, requested: 0, updated: 0, failed: 0 });
        continue;
      }

      // 更新（簡易リトライ付き）
      const { updated, failed, error } = await UpdateAllRecords(appId, updateRecords);
      if (error) {
        console.warn(`⚠ 更新失敗（媒体: ${key}）`, error);
        // resParam.status は全体継続のため 1 のまま維持。最終メッセージには反映する。
      }

      perMedia.push({ key, requested: updateRecords.length, updated, failed });
      totalReq += updateRecords.length;
      totalUpd += updated;
      totalFail += failed;
    }

    // ここで結果をメッセージに追記（サマリ）
    const lines = perMedia.filter((x) => x.requested > 0).map((x) => `・${x.key}: 更新 ${x.updated}/${x.requested}${x.failed ? `（失敗 ${x.failed}）` : ''}`);
    if (lines.length) {
      const head = `出荷管理 更新サマリ: 合計 ${totalUpd}/${totalReq}${totalFail ? `（失敗 ${totalFail}）` : ''}`;
      const body = lines.join('\n');
      resParam.message = (resParam.message ? resParam.message + '\n' : '') + head + '\n' + body;
    }
  };

  /**
   * メイン処理
   * @returns
   */
  const GatherShippingRecords_Main = async () => {
    try {
      spinner.open();

      // 実行日
      dtExecute = luxon.DateTime.local().toFormat('yyyy-MM-dd');

      // 出荷管理アプリから「出荷依頼」のデータを取得
      await GetShippingRecords();
      const summary = {};
      for (const { key } of SHIPPING_SOURCES) summary[key] = shipRecords[key]?.length ?? 0;
      console.log('✅ 出荷依頼データ取得完了 件数サマリ:', summary);
      if (resParam.status !== 1) return;

      // 1) 案件検索キーを収集
      const matterKeys = [];
      const eecotoGroupIds = [];

      // くまポン（くまポン／WELBOX混在）
      for (const r of shipRecords.くまポン) {
        const f = mallManageNumber.くまポン; // "ID_くまポン用"
        if (r[f]?.value) matterKeys.push(r[f].value);
      }
      // eecoto は「案件グループID」で引く
      for (const r of shipRecords.eecoto) {
        const f = mallManageNumber.eecoto; // "SKU"
        if (r[f]?.value) eecotoGroupIds.push(r[f].value);
      }
      // その他媒体（リロ/ベネ/Tポイント/社販/坂戸以外/KAUCHE）
      for (const r of shipRecords.リロ) if (r[mallManageNumber.リロ]?.value) matterKeys.push(r[mallManageNumber.リロ].value);
      for (const r of shipRecords.ベネ) if (r[mallManageNumber.ベネ]?.value) matterKeys.push(r[mallManageNumber.ベネ].value);
      for (const r of shipRecords.Tポイント) if (r[mallManageNumber.Tポイント]?.value) matterKeys.push(r[mallManageNumber.Tポイント].value);
      for (const r of shipRecords.社販) if (r[mallManageNumber.社販]?.value) matterKeys.push(r[mallManageNumber.社販].value);
      for (const r of shipRecords.坂戸以外) if (r[mallManageNumber.坂戸以外]?.value) matterKeys.push(r[mallManageNumber.坂戸以外].value);
      for (const r of shipRecords.KAUCHE) if (r[mallManageNumber.KAUCHE]?.value) matterKeys.push(r[mallManageNumber.KAUCHE].value);

      const matterKeysUniq = uniq(matterKeys);
      const eecotoKeysUniq = uniq(eecotoGroupIds);
      console.log('🔎 案件検索キー数:', { matterKeys: matterKeysUniq.length, eecotoGroupIds: eecotoKeysUniq.length });

      // 案件レコードを取得（IN句 + チャンク）
      await GetMatterRecords(matterKeysUniq, eecotoKeysUniq);
      console.log('✅ 案件レコード取得完了:', mattRecords.length);
      if (resParam.status !== 1) return;

      // 2) 案件から商品コードを抽出（商品コード_1〜10）
      const productCodeSet = new Set();
      for (const m of mattRecords || []) {
        for (let j = 1; j <= 10; j++) {
          let code = m[`商品コード_${j}`]?.value;
          if (!code) continue;
          code = String(code).trim(); // 余計な空白を除去
          if (code) productCodeSet.add(code);
        }
      }
      const productCodesUniq = Array.from(productCodeSet);
      console.log('🔎 商品コード数(uniq):', productCodesUniq.length);
      if (typeof DEBUG !== 'undefined' && DEBUG && productCodesUniq.length) {
        console.log('例) 商品コード（先頭10件）:', productCodesUniq.slice(0, 10));
      }

      if (productCodesUniq.length === 0) {
        console.warn('⚠ 商品コードが0件のため、商品マスタ/在庫の取得をスキップします。');
        itemRecords = [];
        stockRecords = [];
      } else {
        // 商品マスタのレコードを取得
        await GetItemRecords(productCodesUniq);
        console.log('✅ 商品マスタ取得完了:', itemRecords.length);
        if (resParam.status !== 1) return;

        // --- ここから Map 構築（商品コード→レコード / 在庫配列(賞味期限昇順)）---
        ITEM_BY_CODE = new Map();
        for (const r of itemRecords || []) {
          const code = normalizeCode(r?.商品コード?.value);
          if (!code) continue;
          ITEM_BY_CODE.set(code, r);
        }

        // --- Map 構築ここまで ---

        // 在庫管理のレコードを取得
        await GetStockRecords(productCodesUniq);
        console.log('✅ 在庫管理取得完了:', stockRecords.length);

        // 商品コード → 在庫レコード配列（賞味期限昇順）
        {
          const tmp = new Map();
          for (const s of stockRecords) {
            const code = normalizeCode(s?.商品コード?.value);
            if (!code) continue; // ★ 空コードは無視
            if (!tmp.has(code)) tmp.set(code, []);
            tmp.get(code).push(s);
          }
          for (const [code, arr] of tmp) {
            arr.sort((a, b) => new Date(a.賞味期限.value) - new Date(b.賞味期限.value));
          }
          STOCK_BY_CODE = tmp;
        }

        if (resParam.status !== 1) return;
      }

      // 倉庫マスタのレコードを取得
      await GetWarehouseRecords();
      console.log('✅ 倉庫マスタ取得完了:', Array.isArray(warehouseRecords) ? warehouseRecords.length : 0);
      if (resParam.status !== 1) return;

      // 出荷指示アプリ用にデータを生成
      let recData = await CreateDataForShipInstruction();
      console.log('✅ 出荷指示アプリ用データ生成完了:', recData);
      if (resParam.status !== 1) return;

      if (recData.length == 0) {
        resParam.message = '登録できる注文データがありませんでした。';
        return;
      }

      // 出荷指示アプリにレコード追加
      let addedRecs = await AddRecordsForShipInstruction(recData);
      console.log('出荷指示アプリにレコード追加', addedRecs);
      if (resParam.status !== 1) return;

      // 出荷管理アプリの「運用ステータス」を"出荷依頼済み"変更
      await UpdateShippingRecords(recData);
      if (resParam.status !== 1) return;

      if (!resParam.message) {
        resParam.message = '各モールの注文データを収集しました。';
      } else {
        // 既にサマリがある場合は追記（任意）
        resParam.message += '\n各モールの注文データを収集しました。';
      }
    } catch (error) {
      console.log(error);
      resParam.message = '各モールの注文データの取得に失敗しました。';
    } finally {
      spinner.close();
      await Swal.fire({
        title: '注文データの収集',
        text: resParam.message,
      });
      location.reload(true);
    }
  };

  /**
   * 一覧表示イベント
   * @returns
   */
  kintone.events.on('app.record.index.show', async (event) => {
    if (event.viewId !== 6428047) return event;
    if (!HC_MEMBER.includes(kintone.getLoginUser().code)) return event;

    // ボタン
    if (document.getElementById('hc_button_1') !== null) return;
    var button1 = document.createElement('button');
    button1.id = 'hc_button_1';
    button1.classList.add('kintoneplugin-button-normal');
    button1.innerText = '各モールの注文データを収集';
    kintone.app.getHeaderMenuSpaceElement().appendChild(button1);

    button1.onclick = async () => {
      // ボタン二重起動防止
      button1.disabled = true;

      // ちょい足し：元テキストを保存して「処理中…」に切替
      const oldText = button1.innerText;
      button1.innerText = '処理中…';

      resParam = { status: 1, message: '' };
      try {
        await GatherShippingRecords_Main();
      } finally {
        // 実行完了後に元の状態へ戻す
        button1.innerText = oldText;
        button1.disabled = false;
      }
    };

    return event;
  });
})();

/**
 * ご依頼主名・媒体名に基づいて電話番号を補正
 */
const FixPhoneNumbers = (allRec) => {
  console.log('▶ ご依頼主電話番号 上書き処理 開始');
  allRec.forEach((record, i) => {
    const senderName = record['ご依頼主名']?.value || '';
    const mediaName = record['掲載媒体名']?.value || '';
    console.log(`📦 record[${i}] ご依頼主名: ${senderName}, 掲載媒体名: ${mediaName}`);

    if (senderName === 'ハッピーキャンペーン柏センター') {
      console.log(`➡ ご依頼主電話番号を 050-1722-7845 に上書き`);
      record['ご依頼主電話番号'].value = '050-1722-7845';
    } else if (mediaName === 'BEAUTH') {
      console.log(`➡ ご依頼主電話番号を 050-1807-4570 に上書き`);
      record['ご依頼主電話番号'].value = '050-1807-4570';
    }
  });
  console.log('✅ ご依頼主電話番号 上書き処理 完了');
  return allRec;
};
