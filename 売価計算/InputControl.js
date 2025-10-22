/**
 * InputControl.js
 * 商品情報一覧：初期生成 + 入力可否制御を一元管理
 *
 * - 旧 01_2_1_SetStyle_ItemSubTable_250512.js の「10行生成・採番」
 * - 旧 01_2_2_SetStyle_FieldsStyle_250512_2.js の「活性/非活性制御・連携項目初期化」
 * を統合。
 */
(() => {
  'use strict';
  console.info('[IC] InputControl.js: evaluated (top-level)');
  window.onerror = function (message, source, lineno, colno, error) {
    console.error('[IC] window.onerror:', { message, source, lineno, colno, error });
  };
  /*
  // ==== 環境・定数 ====
  // ==== DEBUGモード設定 ====
  // URLパラメータまたは localStorage で切り替え可
  const DEBUG = (() => {
    try {
      const param = new URL(window.location.href).searchParams.get('debug');
      if (param === 'true') return true;
      if (param === 'false') return false;
      const stored = localStorage.getItem('HC_DEBUG');
      return stored === 'true' || (window.HC && HC.DEBUG);
    } catch (e) {
      return !!(window.HC && HC.DEBUG);
    }
  })();
  */
  const DEBUG = true;
  console.info('[IC] DEBUG flag:', DEBUG);

  if (DEBUG) console.log('[DEBUG mode active] InputControl.js loaded');
  const client = new KintoneRestAPIClient();
  const ITEM_MASTER_APP_ID = (window.HC && HC.apps && HC.apps.商品マスタ && HC.apps.商品マスタ.id) || null;
  if (ITEM_MASTER_APP_ID === null) {
    console.warn('[IC] ITEM_MASTER_APP_ID is null (HC.apps.商品マスタ.id not available at load time)');
  }

  // サブテーブル/フィールドのコード
  const TABLE = '商品情報一覧';

  // 行内フィールド
  const F = {
    ROW_ID: '商品情報一覧_商品情報一覧ID',
    ITEM_RECORD_ID: '商品情報一覧_商品レコードID',
    ITEM_CODE: '商品情報一覧_商品コード',
    SET_NUM: '商品情報一覧_セット数',
    SET_QTY: '商品情報一覧_セット入数',
    CASE_QTY: '商品情報一覧_ケース入数',
    CASE_QTY_ZERO: '商品情報一覧_ケース入数_ゼロ埋め',
    ORDER_CASES: '商品情報一覧_発注ケース数',
    ORDER_EACH: '商品情報一覧_発注バラ数',
    MSRP_EACH: '商品情報一覧_希望小売価格バラ_税抜',
    MSRP_SET: '商品情報一覧_希望小売価格セット_税抜',
    COST_EACH: '商品情報一覧_仕入れバラ_税抜',
    SET_COST: '商品情報一覧_セット仕入れ価格_税抜',
    ORDER_AMOUNT: '商品情報一覧_発注金額_税抜',
    LOWEST: '商品情報一覧_最安値',
    LOWEST20: '商品情報一覧_最安値_20',
    LOWEST_URL: '商品情報一覧_最安値URL',
  };

  // レコード直下
  const R = {
    SERIAL: '商品シリアルコード',
    REQ_ID: '掲載依頼レコードID',
    REQ_URL: '掲載依頼レコードURL',
    SUM_SALES: '媒体売上合計_税抜',
    SUM_PROFIT: '媒体利益合計',
    SUM_SET: '媒体セット数合計',
    SHIP_COST_AU: '配送関連費_au',
  };

  // ==== イベント登録 ====
  // 新規表示：10行生成 + 全体の非活性 + 行の活性制御 + 連携項目初期化
  kintone.events.on(['app.record.create.show'], async (event) => {
    await generateItemSubTable(event);
    disableGlobalFields(event);
    setFieldAccessibility(event);
    resetLinkedFields(event); // 複製時もここで初期化
    // 初期描画後の競合対策（再描画をまたいで有効化を確定）
    forceEnableEditableFieldsWithRetry(6, 250);
    return event;
  });

  // 編集表示：全体の非活性 + 行の活性制御
  kintone.events.on(['app.record.edit.show'], (event) => {
    disableGlobalFields(event);
    setFieldAccessibility(event);
    // 初期描画後の競合対策（再描画をまたいで有効化を確定）
    forceEnableEditableFieldsWithRetry(6, 250);
    return event;
  });

  // ルックアップ連携（商品レコードID/商品コード）変更時：該当行の活性制御
  kintone.events.on(['app.record.create.change.' + TABLE + '.' + F.ITEM_RECORD_ID, 'app.record.edit.change.' + TABLE + '.' + F.ITEM_RECORD_ID, 'app.record.create.change.' + TABLE + '.' + F.ITEM_CODE, 'app.record.edit.change.' + TABLE + '.' + F.ITEM_CODE], (event) => {
    setFieldAccessibility(event);
    return event;
  });

  // （任意）保存前バリデーションの骨格：必要なら強化してください
  kintone.events.on(['app.record.create.submit', 'app.record.edit.submit'], (event) => {
    // validateItemSubTable(event); // 使う場合はコメントアウト解除
    return event;
  });

  // ==== 関数群 ====

  /**
   * 1) サブテーブル初期生成（10行固定）+ 採番
   * - 現在アプリの最大 $id を元に SER: HC-<id+1> を採番
   * - 商品マスタの最大 商品コード（hcNNNN）を元に、1行目のコードを自動採番して付与
   */
  async function generateItemSubTable(event) {
    // 🔧 将来対応ポイント：可変行対応
    // 商品マスタの件数などに合わせて可変生成する場合、
    // 下記の固定10行ループを forEach や map に置き換えて、
    // 取得した records を動的に反映できるようにする。
    // 例:
    //   const masterRecords = await client.record.getRecords({ app: ITEM_MASTER_APP_ID, ... });
    //   masterRecords.records.forEach((r, i) => {
    //     rows.push(createEmptyRow(i + 1, r['商品コード'].value));
    //   });
    const record = event.record;

    // すでに何か行がある場合は生成しない（複製/再表示対策）
    if (Array.isArray(record[TABLE]?.value) && record[TABLE].value.length > 0) {
      if (DEBUG) console.log('[generateItemSubTable] skip (already has rows)');
      return;
    }

    // --- シリアル採番 ---
    const appId = kintone.app.getId();
    let newSerial = 'HC-1';
    try {
      const resp = await client.record.getRecords({
        app: appId,
        fields: ['$id'],
        query: 'order by $id desc limit 1',
      });
      const lastId = resp.records.length === 0 ? 0 : Number(resp.records[0]['$id'].value);
      newSerial = 'HC-' + (lastId + 1);
    } catch (e) {
      console.warn('[generateItemSubTable] get max $id failed', e);
    }
    record[R.SERIAL].value = newSerial;

    // --- 商品コード自動採番（1行目だけ） ---
    let firstItemCode = 'hc0001';
    if (ITEM_MASTER_APP_ID === null) {
      console.warn('[IC] skip auto item-code numbering because ITEM_MASTER_APP_ID is null');
    } else {
      try {
        const r = await client.record.getRecords({
          app: ITEM_MASTER_APP_ID,
          fields: ['商品コード'],
          query: 'order by 商品コード desc limit 1',
        });
        const last = r.records.length === 0 ? 'hc0000' : r.records[0]['商品コード'].value;
        const n = Number(String(last).replace('hc', '')) + 1;
        firstItemCode = 'hc' + (n < 10000 ? String(n).padStart(4, '0') : String(n));
      } catch (e) {
        console.warn('[generateItemSubTable] get max 商品コード failed', e);
      }
    }

    // --- 10行の初期配列を作成 ---
    const rows = [];
    for (let i = 0; i < 10; i++) {
      rows.push(createEmptyRow(i + 1, i === 0 ? firstItemCode : ''));
    }
    record[TABLE].value = rows;

    if (DEBUG) console.log('[generateItemSubTable] initialized 10 rows');
  }

  /**
   * 2) 行単位の活性/非活性制御
   * - 商品レコードIDが空欄（= ルックアップ未連携）は「手入力可」
   * - 商品レコードIDがある（= 連携済み）は「手入力不可」
   * - ※ 常に手入力可：発注ケース数 / 発注バラ数 / 商品コード
   */
  function setFieldAccessibility(event) {
    if (DEBUG) {
      console.group('[setFieldAccessibility] start');
      console.log('record:', event.record);
      console.groupEnd();
    }
    // 🔧 将来対応ポイント：可変行対応
    // 現在は最大10行想定だが、今後は可変行に対応予定。
    // setFieldAccessibility は forEach で全行処理しているため、
    // 可変長でもそのまま対応可能。
    const record = event.record;
    const rows = record[TABLE]?.value || [];
    rows.forEach((rowObj, idx) => {
      const row = rowObj.value;
      const id = row[F.ITEM_RECORD_ID]?.value;

      // 常時入力可
      safeSetDisabled(row, F.ITEM_CODE, false);
      safeSetDisabled(row, F.ORDER_CASES, false);
      safeSetDisabled(row, F.ORDER_EACH, false);
      safeSetDisabled(row, F.MSRP_EACH, false); // 希望小売価格バラ（税抜）
      safeSetDisabled(row, F.COST_EACH, false); // 仕入れバラ（税抜）

      // ルックアップ未連携なら入力可、連携済みなら不可
      const editable = !id; // true: 入力可
      // safeSetDisabled(row, F.MSRP_EACH, !editable); // 希望小売価格バラ（税抜） ← 常時入力可のため削除
      safeSetDisabled(row, F.CASE_QTY, !editable); // ケース入数
      // safeSetDisabled(row, F.COST_EACH, !editable); // 仕入れバラ（税抜） ← 常時入力可のため削除
      safeSetDisabled(row, F.LOWEST, !editable); // 最安値
      safeSetDisabled(row, F.LOWEST_URL, !editable); // 最安値URL

      if (DEBUG) {
        console.log(`[setFieldAccessibility] row ${idx + 1} itemRecordId=${id || '(blank)'} -> MSRP_EACH/COST_EACH/CASQTY editable=${editable}`);
      }
    });

    // 🔧 常時入力可能フィールドを再適用（上書き防止）
    rows.forEach((rowObj) => {
      const row = rowObj.value;
      safeSetDisabled(row, F.MSRP_EACH, false);
      safeSetDisabled(row, F.COST_EACH, false);
    });

    if (DEBUG) {
      console.group('[setFieldAccessibility] detailed row states');
      rows.forEach((rowObj, idx) => {
        const row = rowObj.value;
        console.group(`Row ${idx + 1}`);
        console.log(`${F.ITEM_RECORD_ID}:`, row[F.ITEM_RECORD_ID]?.value);
        console.log(`${F.MSRP_EACH} disabled:`, row[F.MSRP_EACH]?.disabled, 'value:', row[F.MSRP_EACH]?.value);
        console.log(`${F.COST_EACH} disabled:`, row[F.COST_EACH]?.disabled, 'value:', row[F.COST_EACH]?.value);
        console.groupEnd();
      });
      console.groupEnd();
    }

    // === DOM構造確認ログ ===
    console.group('[DEBUG] Subtable DOM check');
    document.querySelectorAll('div[fieldcode]').forEach((el, i) => {
      console.log(i, el.getAttribute('fieldcode'), el);
    });
    console.groupEnd();

    // ==== DOM監視による再適用（2行目以降が無効化される対策） ====
    if (!window._HC_MSRP_DOM_OBSERVER) {
      // === サブテーブルDOM監視対象の検出 ===
      const tableEl = document.querySelector(`div[fieldcode="${TABLE}"]`) || document.querySelector(`div[data-field-code="${TABLE}"]`) || document.querySelector(`table.subtable-gaia`);

      if (!tableEl) {
        console.warn('[Observer] table element not found');
        console.group('[DEBUG] Subtable DOM candidates');
        document.querySelectorAll('table,div').forEach((el, i) => {
          if (el.getAttribute('fieldcode') || el.getAttribute('data-field-code')) {
            console.log(i, el.tagName, el.getAttribute('fieldcode') || el.getAttribute('data-field-code'), el);
          }
        });
        console.groupEnd();
        return;
      }
      console.log('[Observer] table element found:', tableEl);
      // --- Replace observer callback with record API-based re-enabling ---
      const observer = new MutationObserver(() => {
        setTimeout(() => {
          const record = kintone.app.record.get();
          if (!record || !record.record || !record.record[TABLE]) return;

          const tableRows = record.record[TABLE].value;
          tableRows.forEach((row, i) => {
            const msrpField = row.value[F.MSRP_EACH];
            const costField = row.value[F.COST_EACH];

            if (msrpField) msrpField.disabled = false;
            if (costField) costField.disabled = false;

            console.log(`[Observer-Fix] Row ${i + 1} re-enabled via record API`);
          });

          // Kintone UI再描画
          kintone.app.record.set(record);
        }, 300);
      });
      observer.observe(tableEl, { childList: true, subtree: true });
      window._HC_MSRP_DOM_OBSERVER = observer;
      if (DEBUG) console.log('[Observer] MutationObserver started for MSRP_EACH/COST_EACH');
    }

    // 🔁 初期表示後の再描画競合に備えてリトライを起動
    if (DEBUG) console.log('[Final UI refresh replaced by retry mechanism]');
    forceEnableEditableFieldsWithRetry(6, 250);
  }

  /**
   * 3) レコード直下の常時非活性項目
   */
  function disableGlobalFields(event) {
    const r = event.record;
    safeSetDisabledRec(r, R.REQ_ID, true);
    safeSetDisabledRec(r, R.REQ_URL, true);
    safeSetDisabledRec(r, R.SUM_SALES, true);
    safeSetDisabledRec(r, R.SUM_PROFIT, true);
    safeSetDisabledRec(r, R.SUM_SET, true);
    safeSetDisabledRec(r, R.SERIAL, true);
    safeSetDisabledRec(r, R.SHIP_COST_AU, true);
  }

  /**
   * 4) 複製時の連携フィールド初期化
   */
  function resetLinkedFields(event) {
    const r = event.record;
    if (r[R.REQ_ID]) r[R.REQ_ID].value = '';
    if (r[R.REQ_URL]) r[R.REQ_URL].value = '';
  }

  /**
   * 5) 保存前バリデーション（必要に応じて拡張）
   *  - 例：商品コード未入力の行があるときは警告、など
   */
  function validateItemSubTable(event) {
    const record = event.record;
    const rows = record[TABLE]?.value || [];
    let ng = false;

    rows.forEach((rowObj, i) => {
      const row = rowObj.value;
      // 例：商品コード or 商品レコードIDの どちらも空 → データ不完全（必要なら制約）
      const code = row[F.ITEM_CODE]?.value;
      const id = row[F.ITEM_RECORD_ID]?.value;
      if (!code && !id) {
        // 空行は許容するならスキップ。ここでは例として警告ログのみに留める。
        if (DEBUG) console.warn(`[validate] row ${i + 1}: code & id both empty`);
      }
    });

    if (ng) {
      event.error = '商品情報一覧の入力に不備があります。';
    }
    return event;
  }

  // ==== ヘルパ ====

  // ==== 強制有効化のリトライ（初期表示の競合対策） ====
  function forceEnableEditableFieldsWithRetry(retries = 6, interval = 250) {
    let attempt = 0;
    const apply = () => {
      const rec = kintone.app.record.get();
      if (!rec || !rec.record || !rec.record[TABLE]) return false;

      let changed = false;
      rec.record[TABLE].value.forEach((rowObj, i) => {
        const row = rowObj.value;
        const msrp = row[F.MSRP_EACH];
        const cost = row[F.COST_EACH];

        if (msrp && msrp.disabled) {
          msrp.disabled = false;
          changed = true;
          if (DEBUG) console.log(`[retry] row ${i + 1} MSRP_EACH -> disabled=false`);
        }
        if (cost && cost.disabled) {
          cost.disabled = false;
          changed = true;
          if (DEBUG) console.log(`[retry] row ${i + 1} COST_EACH -> disabled=false`);
        }
      });

      if (changed) {
        if (DEBUG) console.log('[retry] applying record.set()');
        kintone.app.record.set(rec);
      }
      return changed;
    };

    const tick = () => {
      attempt++;
      const ok = apply();
      if (DEBUG) console.log(`[retry] attempt ${attempt}/${retries}, changed=${ok}`);
      if (attempt < retries) {
        setTimeout(tick, interval);
      }
    };

    // 初回は軽く遅延してから開始
    setTimeout(tick, 200);
  }

  // 行の雛形を作成
  function createEmptyRow(number, itemCode) {
    return {
      value: {
        [F.ROW_ID]: { type: 'NUMBER', value: number },
        [F.ITEM_RECORD_ID]: { type: 'SINGLE_LINE_TEXT', value: '' },
        [F.ITEM_CODE]: { type: 'SINGLE_LINE_TEXT', value: itemCode || '' },
        [F.SET_NUM]: { type: 'CALC', value: '' },
        [F.SET_QTY]: { type: 'NUMBER', value: '' },
        [F.CASE_QTY]: { type: 'NUMBER', value: '' },
        [F.CASE_QTY_ZERO]: { type: 'NUMBER', value: '' },
        [F.ORDER_CASES]: { type: 'CALC', value: '' },
        [F.ORDER_EACH]: { type: 'CALC', value: '' },
        [F.MSRP_EACH]: { type: 'NUMBER', value: '' },
        [F.MSRP_SET]: { type: 'CALC', value: '' },
        [F.COST_EACH]: { type: 'NUMBER', value: '' },
        [F.SET_COST]: { type: 'CALC', value: '' },
        [F.ORDER_AMOUNT]: { type: 'CALC', value: '' },
        [F.LOWEST]: { type: 'NUMBER', value: '' },
        [F.LOWEST20]: { type: 'CALC', value: '' },
        [F.LOWEST_URL]: { type: 'LINK', value: '' },
      },
    };
  }

  // サブテーブル行の disabled セッター（安全版）
  function safeSetDisabled(row, fieldCode, disabled) {
    if (DEBUG) {
      const before = row && row[fieldCode] ? row[fieldCode].disabled : undefined;
      console.log(`[safeSetDisabled] field: ${fieldCode}, before: ${before}, set to: ${disabled}`);
    }
    if (row && row[fieldCode]) row[fieldCode].disabled = disabled;
    if (DEBUG) {
      const after = row && row[fieldCode] ? row[fieldCode].disabled : undefined;
      console.log(`[safeSetDisabled] field: ${fieldCode}, after: ${after}`);
    }
  }

  // レコード直下フィールドの disabled セッター（安全版）
  function safeSetDisabledRec(record, fieldCode, disabled) {
    if (record && record[fieldCode]) record[fieldCode].disabled = disabled;
  }

  /**
   * 6) サブテーブル行追加時にも再度フィールド制御を適用
   * - これを入れないと、新しい行が disabled のままになる
   */
  // サブテーブル行追加／商品コード変更時など、常に再実行
  kintone.events.on(['app.record.create.change.' + TABLE, 'app.record.edit.change.' + TABLE, 'app.record.create.change.' + TABLE + '.' + F.ITEM_CODE, 'app.record.edit.change.' + TABLE + '.' + F.ITEM_CODE], (event) => {
    setTimeout(() => setFieldAccessibility(event), 50);
    return event;
  });
  // Diagnostic: unconditional event hook to verify firing
  kintone.events.on(['app.record.create.show', 'app.record.edit.show'], (event) => {
    console.info('[IC] kintone show event fired');
    return event;
  });
})();

/**
 * 🪄 DEBUG切替方法
 * - URL末尾に ?debug=true または ?debug=false を付与
 * - または localStorage.setItem('HC_DEBUG', 'true') で永続ON
 * - 確認用: console.log('[DEBUG mode active]')
 */
