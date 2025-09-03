/**
 * モール掲載アプリ（各モール）にレコードを生成（フル版・貼り付け運用可）
 * 追加/変更点:
 *  - 詳細ログ(HC_DEBUG)：viewId / login / query / appId / fields / e.response.data
 *  - 送信前バリデーション：フォームスキーマ取得→ unknown / requiredMissing / typeHints を出力
 *  - サニタイズ：null/空文字の項目は送らない（追加時は未送信が安全）
 *  - 送信失敗時：単発 addRecord でサーバ詳細（field別 errors）を取得しログ
 *  - URLの /k/ 抜け修正
 *  - ダイアログの [object Object] 回避（JSON文字列化）
 */
(() => {
  'use strict';

  // ========= 設定（必要に応じて切替） ==========================
  const CONFIG = {
    DIAG_MODE: true, // true: 失敗時に単発 addRecord で詳細解析を実施
    STOP_ON_FIRST_ERROR: true, // true: 最初の失敗でループを中断（診断優先） / false: 最後まで続行（本番）
    LOG_LONG_TEXT_THRESHOLD: 100000, // 文字列の長さ警告しきい値（概ね安全側）
  };
  // ============================================================

  // ===== DEBUG LOGGER =========================================
  const HC_DEBUG = {
    enabled: true, // 本番で不要なら false
    tag: 'HC:MALL-PUBLISH',
    safe(v) {
      try {
        return typeof v === 'string'
          ? v
          : JSON.stringify(
              v,
              (k, val) => {
                if (val instanceof Blob || val instanceof File) return `[${val.constructor.name}:${val.size}]`;
                if (typeof val === 'object' && val !== null && 'value' in val) {
                  const s = String(val.value ?? '');
                  if (s.length > 500) return { ...val, value: s.slice(0, 500) + '…(trunc)' };
                }
                return val;
              },
              2
            );
      } catch {
        return String(v);
      }
    },
    log(phase, obj) {
      if (!this.enabled) return;
      const ts = new Date().toISOString();
      console.log(`[${this.tag}] ${ts} ${phase}:`, this.safe(obj));
    },
    warn(phase, obj) {
      if (!this.enabled) return;
      const ts = new Date().toISOString();
      console.warn(`[${this.tag}] ${ts} ${phase}:`, this.safe(obj));
    },
    error(phase, obj) {
      if (!this.enabled) return;
      const ts = new Date().toISOString();
      console.error(`[${this.tag}] ${ts} ${phase}:`, this.safe(obj));
    },
  };
  // ============================================================

  // ===== 依存の存在チェック（念のため） =========================
  if (typeof KintoneRestAPIClient === 'undefined' || typeof kintone === 'undefined' || !kintone.app) {
    console.error('[HC] 必要な kintone オブジェクトが見つかりません。');
    return;
  }
  if (typeof HC === 'undefined' || !HC.apps || !HC.domain) {
    console.error('[HC] HC.apps/HC.domain が未定義です。設定JSを先に読み込んでください。');
    // 続行はする（後続ログで appId 未定義など検出できる）
  }
  // ============================================================

  const HC_MALLAU_APP_ID = HC.apps.掲載モールAU.id;
  const HC_MALLEECOTO_APP_ID = HC.apps.掲載モールEECOTO.id;
  const HC_KUMAPON_APP_ID = HC.apps.掲載モールKUMAPON.id;
  const HC_RIRO_APP_ID = HC.apps.掲載モールRIRO.id;
  const HC_BENE_APP_ID = HC.apps.掲載モールBENE.id;
  const HC_OTAMESHI_APP_ID = HC.apps.掲載モールOTAMESHI.id;
  const HC_TPOINT_APP_ID = HC.apps.掲載モールTPOINT.id;
  const HC_MATTER_APP_ID = HC.apps.案件管理.id;
  const HC_DOMAIN = HC.domain.url;

  const HC_MEMBER_ID = ['1', '3', '6'];
  const FILTER_CODE = {
    au: ['au', 'Tサンプル'],
    eecoto: ['eecoto'],
    kumapon: ['くまポン'],
    riro: ['リロ'],
    bene: ['ベネ'],
    otameshi: ['おためし'],
    tpoint: ['Tポイント'],
  };

  const client = new KintoneRestAPIClient();

  // ===== スキーマ検証 & サニタイズ ===============================
  const fetchFormSchema = async (appId) => {
    try {
      const resp = await client.app.getFormFields({ app: appId });
      return resp?.properties ?? {};
    } catch (e) {
      HC_DEBUG.error('Schema.fetch.error', e?.response?.data ?? e);
      return {};
    }
  };

  const isEmptyValue = (v) => v === null || v === undefined || v === '';

  const sanitizeRecord = (record) => {
    // { fieldCode: { value: ... } } を前提に null/空文字は送らない（追加時は未送信が安全）
    const cleaned = {};
    for (const [k, vv] of Object.entries(record || {})) {
      if (!vv || isEmptyValue(vv.value)) continue;
      // 長文警告（上限はフィールドタイプ依存のため目安のみ）
      if (typeof vv.value === 'string' && vv.value.length > CONFIG.LOG_LONG_TEXT_THRESHOLD) {
        HC_DEBUG.warn('Sanitize.longText', { field: k, length: vv.value.length });
      }
      cleaned[k] = vv;
    }
    return cleaned;
  };

  const validateAgainstSchema = (schema, record) => {
    const unknown = [];
    const requiredMissing = [];
    const typeHints = [];

    // 未知フィールド
    for (const key of Object.keys(record)) {
      if (!schema[key]) unknown.push(key);
    }

    // 必須未充足（sanitizeで空は落とす＝未送信扱い）
    for (const [code, def] of Object.entries(schema)) {
      if (def.required === true && record[code] === undefined) {
        requiredMissing.push(code);
      }
    }

    // 型ヒント（DATE/NUMBER/選択肢の簡易検査）
    for (const [code, def] of Object.entries(schema)) {
      if (!record[code]) continue;
      const v = record[code].value;
      switch (def.type) {
        case 'DATE':
        case 'DATETIME':
          if (typeof v !== 'string' || v.length < 8) typeHints.push({ code, expect: def.type, got: v });
          break;
        case 'NUMBER':
          if (isNaN(Number(v))) typeHints.push({ code, expect: 'NUMBER', got: v });
          break;
        case 'RADIO_BUTTON':
        case 'DROP_DOWN':
          if (def.options && !def.options[v]) typeHints.push({ code, expect: 'one-of-options', got: v });
          break;
        default:
          break;
      }
    }
    return { unknown, requiredMissing, typeHints };
  };
  // ============================================================

  /**
   * 一覧に表示されてるレコード取得（選んだモールでフィルタ）
   */
  const GetRecordsByList = async (mall) => {
    const mallCode = FILTER_CODE[mall].map((code) => `"${code}"`).join(', ');
    const queryCondi = kintone.app.getQueryCondition() + ` and 掲載媒体名 in (${mallCode})`;

    HC_DEBUG.log('GetRecordsByList.query', {
      mall,
      queryCondi,
      viewId: kintone.app.getViewId?.(),
      login: kintone.getLoginUser()?.id,
    });

    return client.record
      .getAllRecordsWithCursor({
        app: kintone.app.getId(),
        query: queryCondi,
      })
      .then((response) => {
        HC_DEBUG.log('GetRecordsByList.res.count', { count: response?.length ?? 0 });
        return response;
      });
  };

  /**
   * ステータス更新
   */
  const UpdateStatas = async (ids) => {
    try {
      const reqRecords = ids.map((id) => ({
        id,
        record: { 掲載モールアプリ連携: { value: '発行済' } },
      }));

      HC_DEBUG.log('UpdateStatus.req', { app: kintone.app.getId(), idsLen: ids.length });

      return client.record
        .updateAllRecords({
          app: kintone.app.getId(),
          records: reqRecords,
        })
        .then(() => {
          HC_DEBUG.log('UpdateStatus.ok', { updated: ids.length });
          return { status: 1 };
        })
        .catch((e) => {
          const detail = e?.response?.data ?? e;
          HC_DEBUG.log('UpdateStatus.err', detail);
          return { status: 9, message: detail };
        });
    } catch (ex) {
      HC_DEBUG.log('UpdateStatus.ex', ex);
      return { status: 9, message: ex };
    }
  };

  /**
   * 掲載モールにレコード一括生成（バリデーション & サニタイズ付き）
   */
  const CrateAllRecodes = async (appId, records) => {
    try {
      const keys = Object.keys(records?.[0] ?? {});
      HC_DEBUG.log('AddAllRecords.req', { appId, recordsLen: records?.length ?? 0, fields: keys });

      // フォームスキーマ取得 → 差分チェック
      const schema = await fetchFormSchema(appId);

      const sampleRaw = records?.[0] ?? {};
      const sample = sanitizeRecord(sampleRaw);
      const { unknown, requiredMissing, typeHints } = validateAgainstSchema(schema, sample);
      HC_DEBUG.log('AddAllRecords.schemaCheck', { unknown, requiredMissing, typeHints });

      // サニタイズ：全レコード適用
      const cleanedRecords = records.map(sanitizeRecord);

      return client.record
        .addAllRecords({
          app: appId,
          records: cleanedRecords,
        })
        .then(() => {
          HC_DEBUG.log('AddAllRecords.ok', { chunks: records?.length ?? 0 });
          return { status: 1 };
        })
        .catch((e) => {
          const detail = e?.response?.data ?? e;
          const extra = {
            code: detail?.error?.code,
            message: detail?.error?.message,
            errors: detail?.errors,
          };
          HC_DEBUG.log('AddAllRecords.err', { appId, detail, extra });

          // 事後診断：単発 addRecord でサーバに項目別エラーをしゃべってもらう
          if (CONFIG.DIAG_MODE) {
            try {
              const first = cleanedRecords?.[0];
              if (first) {
                client.record
                  .addRecord({ app: appId, record: first })
                  .then(() => {
                    HC_DEBUG.log('Diag.singleAdd.ok', {
                      msg: '単発追加は成功（バルクの別要因の可能性）',
                      recordPreview: Object.keys(first),
                    });
                  })
                  .catch((ee) => {
                    const dd = ee?.response?.data ?? ee;
                    HC_DEBUG.log('Diag.singleAdd.err', {
                      code: dd?.error?.code,
                      message: dd?.error?.message,
                      errors: dd?.errors, // ← フィールド単位のエラーが入ることが多い
                      recordPreview: Object.keys(first),
                    });
                  });
              }
            } catch (diagEx) {
              HC_DEBUG.error('Diag.singleAdd.ex', diagEx);
            }
          }

          return { status: 9, message: detail };
        });
    } catch (ex) {
      HC_DEBUG.log('AddAllRecords.ex', ex);
      return { status: 9, message: ex };
    }
  };

  /**
   * 生成先アプリIdを取得
   */
  const GetAppId = (mall) => {
    switch (mall) {
      case 'au':
        return HC_MALLAU_APP_ID;
      case 'eecoto':
        return HC_MALLEECOTO_APP_ID;
      case 'kumapon':
        return HC_KUMAPON_APP_ID;
      case 'riro':
        return HC_RIRO_APP_ID;
      case 'bene':
        return HC_BENE_APP_ID;
      case 'otameshi':
        return HC_OTAMESHI_APP_ID;
      case 'tpoint':
        return HC_TPOINT_APP_ID;
      default:
        return undefined;
    }
  };

  /**
   * リクエスト用のレコードを作成
   */
  const CreateReqRecords = (mall, record) => {
    switch (mall) {
      case 'au':
        return SetReqRecodeByAu(record);
      case 'eecoto':
        return SetReqRecodesByEecoto(record);
      case 'kumapon':
        return SetReqRecodeByKumapon(record);
      case 'riro':
        return SetReqRecodeByRiro(record);
      case 'bene':
        return SetReqRecodeByBene(record);
      case 'otameshi':
        return SetReqRecodeByOtameshi(record);
      case 'tpoint':
        return SetReqRecodeByTpoint(record);
      default:
        return [];
    }
  };

  // ===== eecoto =====
  const SetReqRecodesByEecoto = (record) => {
    const reqRecords = [];
    let price = 0;
    const flag = record.商品お試し価格選択.value;

    if (flag == '簡易設定') {
      price = record.配送関連費_税込.value;
      const reqRecord = SetReqRecodeByEecoto(record, price);
      reqRecords.push(reqRecord);
    } else if (flag == '詳細設定') {
      const area = ['関東', '北海道', '東北', '中部', '近畿', '中国', '四国', '九州', '沖縄離島'];
      area.forEach((element) => {
        price = record['商品お試し価格_詳細_' + element].value;
        if (Number(price) > 0) {
          const reqRecord = SetReqRecodeByEecoto(record, price);
          reqRecords.push(reqRecord);
        }
      });
    } else {
      const reqRecord = SetReqRecodeByEecoto(record, price);
      reqRecords.push(reqRecord);
    }
    return reqRecords;
  };

  const SetReqRecodeByEecoto = (record, price) => {
    const reqRecord = {
      案件管理レコードID: { value: record.$id.value },
      案件管理レコードURL: { value: 'https://' + HC_DOMAIN + '/k/' + HC_MATTER_APP_ID + '/show#record=' + record.$id.value },

      URLハンドル: { value: record.掲載商品名.value },
      現在の在庫数: { value: record.セット数.value },

      PJT名: { value: record.案件グループID.value },
      タグ: { value: record.タグ.value },
      クライアント企業名: { value: record.メーカー名.value },
      掲載開始日: { value: record.掲載開始日.value },
      掲載終了日: { value: record.掲載終了日.value },
      発送予定日: { value: record.初回発送日.value },
      商品名: { value: record.掲載商品名.value },
      商品画像アイコン1行目: { value: record.商品画像アイコン1行目.value },
      商品画像アイコン2行目: { value: record.商品画像アイコン2行目.value },
      商品画像アイコン3行目: { value: record.商品画像アイコン3行目.value },
      アイコンカラー: { value: record.アイコンカラー.value },
      商品数: { value: record.セット数.value },
      商品数フリーテキスト: { value: record.商品数フリーテキスト.value },
      商品実売価格: { value: record.商品実売価格.value },
      商品実売価格フリーテキスト: { value: record.商品実売価格フリーテキスト.value },
      商品お試し価格選択: { value: record.商品お試し価格選択.value },
      商品お試し価格: { value: price },
      ページ内配送業者: { value: record.ページ内配送業者.value },
      配送サイズ名: { value: record.配送サイズ名.value },
      分析カテゴリーID: { value: record.分析カテゴリーID.value },
      商品共通説明: { value: record.商品共通説明.value },
      寄付金額: { value: record.寄付金額_eecoto.value },
      バリエーションのタイトル: { value: record.バリエーションのタイトル1.value },
      バリエーションのタイトル2: { value: record.バリエーションのタイトル2.value },
      バリエーションのタイトル3: { value: record.バリエーションのタイトル3.value },
      バリエーション名: { value: record.バリエーション名1.value },
      バリエーション名2: { value: record.バリエーション名2.value },
      バリエーション名3: { value: record.バリエーション名3.value },
    };

    for (let i = 1; i <= 10; i++) {
      reqRecord['商品_商品コード_' + i] = { value: record['商品コード_' + i].value };
      reqRecord['商品_商品数量_' + i] = { value: record['セット入数_' + i].value };
      reqRecord['商品_商品説明_' + i] = { value: record['商品説明_' + i].value };
    }

    const imageCount = record['掲載画像数_eecoto'].value;
    if (imageCount > 0) {
      const list = [];
      for (let i = 1; i <= imageCount; i++) {
        list.push(`https://drive.google.com/drive/u/1/folders/1Eo-t6fpL2xCYdBBbGTCcZ6WdZSAaHE6K/${record['掲載モール連携番号'].value}_${imageCount}`);
      }
      reqRecord['商品画像URL'] = { value: list.join('\n') };
    }

    return reqRecord;
  };

  // ===== au =====
  const SetReqRecodeByAu = (record) => {
    const reqRecords = [];
    const reqRecord = {
      案件管理レコードID: { value: record.$id.value },
      案件管理レコードURL: { value: 'https://' + HC_DOMAIN + '/k/' + HC_MATTER_APP_ID + '/show#record=' + record.$id.value },
      掲載媒体名: { value: record.掲載媒体名.value },

      PJT名: { value: record.掲載モール連携番号.value },
      クライアント企業名: { value: record.メーカー名.value ? record.メーカー名.value + ' 井上潔' : '' },
      掲載開始日: { value: record.掲載開始日.value },
      掲載終了日: { value: record.掲載終了日.value },
      ヤマト配送オプション: { value: record.ヤマト配送オプション.value },
      発送予定日: { value: record.初回発送日.value },
      クチコミ開始日: { value: record.クチコミ開始日.value },
      クチコミ終了日: { value: record.クチコミ終了日.value },
      タメ最終申込日: { value: record.掲載終了日.value },
      最短賞味期限: { value: record.最短賞味期限.value },
      商品名: { value: record.掲載商品名.value },
      商品画像アイコン1行目: { value: record.商品画像アイコン1行目.value },
      商品画像アイコン2行目: { value: record.商品画像アイコン2行目.value },
      商品画像アイコン3行目: { value: record.商品画像アイコン3行目.value },
      アイコンカラー: { value: record.アイコンカラー.value },
      商品数: { value: record.セット数.value },
      商品数フリーテキスト: { value: record.商品数フリーテキスト.value },
      商品実売価格: { value: record.商品実売価格.value },
      商品実売価格フリーテキスト: { value: record.商品実売価格フリーテキスト.value },

      商品お試し価格選択: { value: record.商品お試し価格選択.value },
      商品お試し価格_簡易_本州四国: { value: record.商品お試し価格_簡易_中国.value },
      商品お試し価格_簡易_北海道: { value: record.商品お試し価格_簡易_九州.value },
      商品お試し価格_簡易_九州: { value: record.商品お試し価格_簡易_九州.value },
      商品お試し価格_簡易_沖縄離島: { value: record.商品お試し価格_簡易_九州.value },

      商品お試し価格_詳細_関東: { value: record.商品お試し価格_詳細_関東.value },
      商品お試し価格_詳細_北海道: { value: record.商品お試し価格_詳細_九州.value },
      商品お試し価格_詳細_東北: { value: record.商品お試し価格_詳細_東北.value },
      商品お試し価格_詳細_中部: { value: record.商品お試し価格_詳細_東北.value },
      商品お試し価格_詳細_近畿: { value: record.商品お試し価格_詳細_中国.value },
      商品お試し価格_詳細_中国: { value: record.商品お試し価格_詳細_中国.value },
      商品お試し価格_詳細_四国: { value: record.商品お試し価格_詳細_中国.value },
      商品お試し価格_詳細_九州: { value: record.商品お試し価格_詳細_九州.value },
      商品お試し価格_詳細_沖縄離島: { value: record.商品お試し価格_詳細_九州.value },

      関連PJTID1: { value: record.関連PJTID1.value },
      関連PJTタイトル1: { value: record.関連PJTタイトル1.value },
      関連PJTID2: { value: record.関連PJTID2.value },
      関連PJTタイトル2: { value: record.関連PJTタイトル2.value },
      関連PJTID3: { value: record.関連PJTID3.value },
      関連PJTタイトル3: { value: record.関連PJTタイトル3.value },
      関連PJTID4: { value: record.関連PJTID4.value },
      関連PJTタイトル4: { value: record.関連PJTタイトル4.value },
      商品の総取り扱い数: { value: record.商品の総取り扱い数.value },
      ページ内配送業者: { value: record.ページ内配送業者.value },
      配送サイズ: { value: record.配送サイズ名.value },
      アンケートQ4: { value: record.アンケートQ4.value },
      商品共通説明: { value: record.商品共通説明.value },
    };

    for (let i = 1; i <= 10; i++) {
      reqRecord['商品_商品コード_' + i] = { value: record['商品コード_' + i].value };
      reqRecord['商品_商品数量_' + i] = { value: record['セット入数_' + i].value };
      reqRecord['商品_商品説明_' + i] = { value: record['商品説明_' + i].value };
    }

    reqRecords.push(reqRecord);
    return reqRecords;
  };

  // ===== kumapon =====
  const SetReqRecodeByKumapon = async (record) => {
    const reqRecords = [];
    const reqRecord = {
      案件管理レコードID: { value: record.$id.value },
      案件管理レコードURL: { value: 'https://' + HC_DOMAIN + '/k/' + HC_MATTER_APP_ID + '/show#record=' + record.$id.value },

      掲載モール連携番号: { value: record.掲載モール連携番号.value },

      クーポンメニュー: { value: record.掲載商品名.value },
      通常価格_税込: { value: record.希望小売価格セット_税抜.value },
      卸価格_税込: { value: record.売価_税込.value },
      販売上限枚数: { value: record.セット数.value },
      SKU: { value: record.セット数.value },
    };

    const noteList = [];
    noteList.push(CreateNoteCommonByKumapon(record));

    const urlList = [];
    for (let i = 1; i <= 10; i++) {
      const code = record['商品コード_' + i].value;
      if (!code) continue;
      const itemRecords = await GetDetailByItemApp(code);
      const itemRecord = itemRecords?.[0];
      if (!itemRecord) continue;

      if (itemRecord['商品参考URL'].value) urlList.push(itemRecord['商品参考URL'].value);
      const text = CreateNoteByKumapon(record, itemRecord, i);
      noteList.push(text);
    }

    reqRecord['備考'] = { value: noteList.join('\n\n') };
    reqRecord['参考価格記載URL'] = { value: urlList.join('\n') };

    reqRecords.push(reqRecord);
    return reqRecords;
  };

  // ===== riro =====
  const SetReqRecodeByRiro = async (record) => {
    const reqRecords = [];
    const reqRecord = {
      案件管理レコードID: { value: record.$id.value },
      案件管理レコードURL: { value: 'https://' + HC_DOMAIN + '/k/' + HC_MATTER_APP_ID + '/show#record=' + record.$id.value },

      商品名: { value: record.掲載商品名.value },
      商品内容: { value: record.掲載商品名.value },
      限定数: { value: record.セット数.value },
      賞味期限: { value: record.最短賞味期限.value },
      出荷期間_終了: { value: record.掲載終了日.value },
      上代_税抜: { value: record.希望小売価格セット_税抜.value },
      下代_税抜: { value: record.売価_税抜.value },
      配送サイズ名: { value: record.配送サイズ名.value },
    };

    const makerList = [];
    const urlList = [];
    const itemList = [];
    for (let i = 1; i <= 10; i++) {
      const code = record['商品コード_' + i].value;
      if (!code) continue;
      const itemRecords = await GetDetailByItemApp(code);
      const itemRecord = itemRecords?.[0];
      if (!itemRecord) continue;

      if (itemRecord['メーカー名'].value) makerList.push(itemRecord['メーカー名'].value);
      if (itemRecord['商品参考URL'].value) urlList.push(itemRecord['商品参考URL'].value);

      if (itemRecord['商品名'].value) {
        itemList.push(`＜${itemRecord['商品名'].value}＞`);
        const itemText = CreatItemNoteColumn(itemRecord, 1, 10);
        itemList.push(itemText);
        itemList.push('\n');
      }
    }

    reqRecord['メーカー名'] = { value: makerList.join('\n') };
    reqRecord['上記上代価格の根拠'] = { value: urlList.join('\n') };
    reqRecord['商品コピー'] = { value: itemList.join('\n') };

    reqRecords.push(reqRecord);
    return reqRecords;
  };

  // ===== bene =====
  const SetReqRecodeByBene = async (record) => {
    const reqRecords = [];
    const reqRecord = {
      案件管理レコードID: { value: record.$id.value },
      案件管理レコードURL: { value: 'https://' + HC_DOMAIN + '/k/' + HC_MATTER_APP_ID + '/show#record=' + record.$id.value },

      商品名: { value: record.掲載商品名.value },
      希望小売価格_税抜: { value: record.希望小売価格セット_税抜.value },
      仕入価格_税抜: { value: record.売価_税抜.value },
      消費税率: { value: record.税率.value },
      販売期間_終了: { value: record.掲載終了日.value },
      ベネ通販在庫数: { value: record.セット数.value },
      キャッチコピー: { value: record.キャッチコピー.value },
      JANコード: { value: record.JANコード.value },
    };

    const urlList = [];
    const janList = [];
    const itemList = [];
    for (let i = 1; i <= 10; i++) {
      const code = record['商品コード_' + i].value;
      if (!code) continue;
      const itemRecords = await GetDetailByItemApp(code);
      const itemRecord = itemRecords?.[0];
      if (!itemRecord) continue;

      if (itemRecord['商品参考URL'].value) urlList.push(itemRecord['商品参考URL'].value);

      if (itemRecord['商品名'].value) {
        itemList.push(`＜${itemRecord['商品名'].value}＞`);
        const itemText = CreatItemNoteColumn(itemRecord, 1, 10);
        itemList.push(itemText);
        itemList.push('\n');
      }

      if (itemRecord['JAN'].value) janList.push(itemRecord['JAN'].value);
    }

    reqRecord['メーカーURL'] = { value: urlList.join('\n') };
    reqRecord['商品コピー'] = { value: itemList.join('\n') };
    reqRecord['JANコード'] = { value: janList.join('\n') };

    reqRecords.push(reqRecord);
    return reqRecords;
  };

  // ===== otameshi =====
  const SetReqRecodeByOtameshi = async (record) => {
    const reqRecords = [];
    const reqRecord = {
      案件管理レコードID: { value: record.$id.value },
      案件管理レコードURL: { value: 'https://' + HC_DOMAIN + '/k/' + HC_MATTER_APP_ID + '/show#record=' + record.$id.value },

      商品コード: { value: record.モール管理番号.value },
      商品名: { value: record.掲載商品名.value },
      原価: { value: record.売価_税抜.value },
      参考価格: { value: record.希望小売価格セット_税込.value },
      消費税: { value: record.税率.value },
      JAN: { value: record.モール管理番号.value },
      賞味期限: { value: record.最短賞味期限.value },
      在庫数: { value: record.セット数.value },
    };

    const itemList = [];
    const specList = [];
    const makerList = [];
    const freeList = [];
    const janList = [];
    for (let i = 1; i <= 10; i++) {
      const code = record['商品コード_' + i].value;
      if (!code) continue;
      const itemRecords = await GetDetailByItemApp(code);
      const itemRecord = itemRecords?.[0];
      if (!itemRecord) continue;

      if (itemRecord['商品名'].value) {
        itemList.push(`＜${itemRecord['商品名'].value}＞`);
        const itemText = CreatItemNoteColumn(itemRecord, 1, 10);
        itemList.push(itemText);
        itemList.push('\n');
      }

      if (itemRecord['内容量'].value) specList.push(`${itemRecord['内容量'].value}`);
      if (itemRecord['メーカー名'].value) makerList.push(itemRecord['メーカー名'].value);
      if (itemRecord['内容量'].value) freeList.push(itemRecord['内容量'].value);
      if (itemRecord['JAN'].value) janList.push(itemRecord['JAN'].value);
    }

    reqRecord['商品説明文'] = { value: itemList.join('\n') };
    reqRecord['内容量'] = { value: specList.join('\n') };
    reqRecord['メーカー'] = { value: makerList.join('\n') };
    reqRecord['単位'] = { value: freeList.join('\n') };
    // JAN は画面のJANに既に入れているためここでは未設定

    reqRecords.push(reqRecord);
    return reqRecords;
  };

  // ===== tpoint =====
  const SetReqRecodeByTpoint = async (record) => {
    const reqRecords = [];
    const reqRecord = {
      案件管理レコードID: { value: record.$id.value },
      案件管理レコードURL: { value: 'https://' + HC_DOMAIN + '/k/' + HC_MATTER_APP_ID + '/show#record=' + record.$id.value },

      卸値: { value: record.売価_税抜.value },
      モール管理番号: { value: record.モール管理番号.value },
      商品名: { value: record.掲載商品名.value },
    };

    const itemList = [];
    const urlList = [];
    const makerList = [];
    const janList = [];
    for (let i = 1; i <= 10; i++) {
      const code = record['商品コード_' + i].value;
      if (!code) continue;
      const itemRecords = await GetDetailByItemApp(code);
      const itemRecord = itemRecords?.[0];
      if (!itemRecord) continue;

      if (itemRecord['商品名'].value) {
        itemList.push(`＜${itemRecord['商品名'].value}＞`);
        const itemText = CreatItemNoteColumn(itemRecord, 1, 1);
        itemList.push(itemText);
        itemList.push('\n');
      }

      if (itemRecord['メーカー名'].value) makerList.push(itemRecord['メーカー名'].value);
      if (itemRecord['商品参考URL'].value) urlList.push(itemRecord['商品参考URL'].value);
      if (itemRecord['JAN'].value) janList.push(itemRecord['JAN'].value);
    }

    reqRecord['メーカー名'] = { value: makerList.join('\n') };
    reqRecord['商品詳細'] = { value: urlList.join('\n') };
    reqRecord['商品紹介'] = { value: itemList.join('\n') };
    reqRecord['商品型番'] = { value: janList.join('\n') };

    reqRecords.push(reqRecord);
    return reqRecords;
  };

  /**
   * 商品詳細説明（アイテム）
   */
  const CreatItemNoteColumn = (itemRecord, minIndex, maXindex) => {
    const list = [];
    for (let i = minIndex; i <= maXindex; i++) {
      if (itemRecord['タイトル' + i].value) {
        list.push(`【${itemRecord['タイトル' + i].value}】`);
        list.push(`${itemRecord['説明' + i].value}`);
      }
    }
    return list.join('\n');
  };

  /**
   * kumapon 備考（案件共通）
   */
  const CreateNoteCommonByKumapon = (record) => {
    const list = [];
    list.push(`発送方法　${record.発送方法.value ?? ''}`);
    list.push(`発送不可エリア　${record.発送不可エリア.value ?? ''}`);
    list.push(`掲載終了日　${record.掲載終了日.value ?? ''}`);
    if (record.クローズドorオープン.value != null) list.push(`${record.クローズドorオープン.value}`);
    return list.join('\n');
  };

  /**
   * kumapon 備考（商品）
   */
  const CreateNoteByKumapon = (record, itemRecord, i) => {
    const list = [];
    if (itemRecord['商品名'].value) list.push(`【${itemRecord['商品名'].value}】`);
    if (itemRecord['賞味期限FLAG'].value) list.push(`${itemRecord['賞味期限FLAG'].value}　${itemRecord['賞味期限'].value ?? ''}`);
    if (itemRecord['商品参考URL'].value) list.push(itemRecord['商品参考URL'].value);
    if (record['商品説明_' + i].value) list.push(`${record['商品説明_' + i].value}`);
    return list.join('\n');
  };

  /**
   * 商品マスターから商品情報を取得
   */
  const GetDetailByItemApp = async (itemRecordCode) => {
    return new KintoneRestAPIClient().record
      .getRecords({
        app: HC.apps.商品マスタ.id,
        query: '商品コード = "@id"'.replace('@id', itemRecordCode),
      })
      .then((resp) => resp.records)
      .catch((err) => {
        HC_DEBUG.error('GetDetailByItemApp.err', err);
        return [];
      });
  };

  /**
   * メイン：掲載モールアプリにレコード生成
   */
  const CreateRecodeToCsvApp = async (mall) => {
    let resParam = { status: 1, message: '' };
    try {
      HC_DEBUG.log('Create.start', { mall });

      const records = await GetRecordsByList(mall);
      if (!records || records.length === 0) {
        HC_DEBUG.log('Create.skip', '対象レコード0件');
        Swal.fire({
          title: 'アプリ連携',
          text: '対象レコードがありません（一覧の絞り込み条件をご確認ください）。',
          icon: 'info',
          timer: 8000,
        });
        return false;
      }

      const appId = GetAppId(mall);
      HC_DEBUG.log('Create.targetApp', { mall, appId });

      if (!appId) {
        Swal.fire({
          title: 'アプリ連携',
          text: '対象モールのアプリIDが未定義です（設定JSの読み込み順/定義を確認）。',
          icon: 'error',
          timer: 12000,
        });
        return false;
      }

      const ids = [];
      let reqRecords = [];

      for (const record of records) {
        reqRecords = await CreateReqRecords(mall, record);
        HC_DEBUG.log('Create.reqRecords.sample', { mall, sample: reqRecords?.[0] });

        resParam = await CrateAllRecodes(appId, reqRecords);
        if (resParam.status === 1) {
          ids.push(record['$id'].value);
        } else {
          if (CONFIG.STOP_ON_FIRST_ERROR) break;
        }
      }

      if (resParam.status === 1 && ids.length > 0) {
        resParam = await UpdateStatas(ids);
      }

      if (resParam.status === 1) {
        HC_DEBUG.log('Create.done', { success: ids.length, total: records.length });
        Swal.fire({
          title: 'アプリ連携',
          text: '掲載モールアプリにレコードを発行しました。\n' + ids.length + '/' + records.length,
          icon: 'success',
          timer: 10000,
          showConfirmButton: false,
        }).then(() => location.reload(true));
      } else {
        const errMsg = typeof resParam.message === 'string' ? resParam.message : JSON.stringify(resParam.message, null, 2);
        Swal.fire({
          title: 'アプリ連携',
          text: '掲載モールアプリのレコード発行に失敗しました。\n' + errMsg,
          icon: 'error',
          timer: 12000,
        }).then(() => location.reload(true));
      }
    } catch (ex) {
      HC_DEBUG.log('Create.catch', ex);
      Swal.fire({
        title: 'アプリ連携',
        text: '掲載モールアプリのレコード発行に失敗しました。\n' + (typeof ex === 'string' ? ex : JSON.stringify(ex)),
        icon: 'error',
        timer: 12000,
        showConfirmButton: false,
      }).then(() => location.reload(true));
    }
  };

  /**
   * 画面イベント：一覧表示時にボタン設置
   */
  kintone.events.on('app.record.index.show', function (event) {
    if (!HC_MEMBER_ID.includes(kintone.getLoginUser().id)) return event;

    if (event.viewId != '6428194') {
      HC_DEBUG.log('Index.show.skip', { reason: 'viewId mismatch', viewId: event.viewId });
      return event;
    }

    if (document.getElementById('hc_button_stock2') !== null) return event;

    const button1 = document.createElement('button');
    button1.id = 'hc_button_stock2';
    button1.classList.add('kintoneplugin-button-normal');
    button1.innerText = '掲載モール レコード発行';
    kintone.app.getHeaderMenuSpaceElement().appendChild(button1);

    button1.onclick = function () {
      Swal.fire({
        title: 'モールを選択してください',
        input: 'select',
        inputOptions: {
          au: 'Pontaパス, Vサンプル',
          eecoto: 'BEAUTH',
          kumapon: 'くまポン',
          riro: 'リロクラブ',
          bene: 'ベネフィット・ワン',
          otameshi: 'KAUCHE',
          tpoint: 'V景品交換',
        },
        inputPlaceholder: 'モールを選択',
        showCancelButton: true,
        confirmButtonText: '選択',
        cancelButtonText: 'キャンセル',
        preConfirm: (selectedMall) => {
          if (!selectedMall) Swal.showValidationMessage('モールを選択してください');
          return selectedMall;
        },
      }).then((result) => {
        if (result.isConfirmed) {
          HC_DEBUG.log('UI.mallSelected', result.value);
          CreateRecodeToCsvApp(result.value);
        }
      });
    };

    return event;
  });
})();
