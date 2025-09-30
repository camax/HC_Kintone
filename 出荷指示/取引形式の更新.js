(() => {
  // ===== 設定ここから =====
  // === 設定 ===
  const DEBUG = false; // 詳細ログON/OFF
  const GET_CHUNK = 100; // in句に入れるモール管理番号の最大件数
  const PUT_CHUNK = 100; // PUT一括更新チャンク
  const USE_RETRY = false; // 自動リトライ（まずはfalseで運用開始を推奨）
  const EMPTY_MALL_POLICY = 'SET_MISSING'; // 'SET_MISSING'=「記載なし」に更新 / 'LEAVE'=未変更
  const MISSING_POLICY = 'LEAVE'; // 案件管理に該当なし: 'LEAVE'（未変更）/ 'SET_MISSING'
  const MISSING_TEXT = '記載なし';

  // === 小ユーティリティ ===
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const log = (...a) => {
    if (DEBUG) console.info('[fetch-trade]', ...a);
  };

  // 文字列の " を \" にエスケープ（kintoneクエリ用）
  const esc = (s = '') => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  // in句を安全に分割
  function chunk(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  // 標準kintone.apiラッパ（必要ならリトライ）
  async function callKintone(path, method, body) {
    const url = kintone.api.url(path, true);
    if (!USE_RETRY) return kintone.api(url, method, body);
    let attempt = 0;
    while (true) {
      try {
        return await kintone.api(url, method, body);
      } catch (e) {
        const status = e?.code || e?.response?.status;
        // 429/5xxのみリトライ（最大2回＝計3回）
        if ((status === 429 || (status >= 500 && status < 600)) && attempt < 2) {
          attempt++;
          const wait = 300 * Math.pow(2, attempt); // 300ms, 600ms
          log(`retry #${attempt} after ${wait}ms`, { path, method, status });
          await sleep(wait);
          continue;
        }
        throw e;
      }
    }
  }

  // 対象レコードIDの取得（選択＞表示中）
  function getTargetRecordIds(event) {
    const selected = (kintone.app.getSelectedRecordIds && kintone.app.getSelectedRecordIds()) || [];
    if (selected.length) return selected.map(String);
    return event.records.map((r) => r.$id.value);
  }

  // レコードID → モール管理番号のMap
  function mapMallByRecordId(event, targetIds, FIELD_MALL_ID) {
    const m = new Map();
    for (const r of event.records) {
      const id = r.$id.value;
      if (!targetIds.includes(id)) continue;
      m.set(id, r[FIELD_MALL_ID]?.value || '');
    }
    return m;
  }

  // ユニークなモールID配列（空欄は除外）
  function uniqueMalls(mallById) {
    const set = new Set();
    for (const mall of mallById.values()) {
      if (mall) set.add(mall);
    }
    return Array.from(set);
  }

  // 案件管理からモール→取引形式のMapを作る
  async function fetchMallTradeMap(malls, appId, FIELD_MALL_ID, FIELD_TRADE_SRC) {
    const mallChunks = chunk(malls, GET_CHUNK);
    const map = new Map();

    for (const c of mallChunks) {
      const inClause = c.map((v) => `"${esc(v)}"`).join(',');
      const query = `${FIELD_MALL_ID} in (${inClause})`; // 必要なら order by 更新日時 desc
      const resp = await callKintone('/k/v1/records.json', 'GET', {
        app: appId,
        query,
        fields: [FIELD_MALL_ID, FIELD_TRADE_SRC, '更新日時'], // fields最小化（更新日時は任意）
      });

      // 一意前提。複数ヒットした場合に最新を採用したいならここでグルーピングして更新日時比較
      for (const rec of resp.records || []) {
        const mall = rec[FIELD_MALL_ID]?.value || '';
        // まだ未登録時のみ採用（最新優先にするなら比較して上書き）
        if (mall && !map.has(mall)) {
          map.set(mall, rec[FIELD_TRADE_SRC]?.value || '');
        }
      }
    }

    return map;
  }

  // 差分更新レコードの構築
  function buildUpdates(event, targetIds, mallById, tradeMap, FIELD_TRADE_DST) {
    const updates = [];
    let emptyMallToMissing = 0;
    let notFound = 0;
    let unchanged = 0;

    for (const r of event.records) {
      const id = r.$id.value;
      if (!targetIds.includes(id)) continue;

      const current = r[FIELD_TRADE_DST]?.value || '';
      const mall = mallById.get(id) || '';

      // 空欄モールの取り扱い
      if (!mall) {
        if (EMPTY_MALL_POLICY === 'SET_MISSING') {
          if (current !== MISSING_TEXT) {
            updates.push({ id, record: { [FIELD_TRADE_DST]: { value: MISSING_TEXT } } });
            emptyMallToMissing++;
          } else {
            unchanged++;
          }
        } else {
          unchanged++;
        }
        continue;
      }

      // 案件管理で見つからない
      if (!tradeMap.has(mall)) {
        if (MISSING_POLICY === 'SET_MISSING') {
          if (current !== MISSING_TEXT) {
            updates.push({ id, record: { [FIELD_TRADE_DST]: { value: MISSING_TEXT } } });
          } else {
            unchanged++;
          }
        } else {
          unchanged++; // 未変更
          notFound++;
        }
        continue;
      }

      const next = tradeMap.get(mall) || '';
      if (current !== next) {
        updates.push({ id, record: { [FIELD_TRADE_DST]: { value: next || MISSING_TEXT } } });
      } else {
        unchanged++;
      }
    }

    return { updates, stats: { emptyMallToMissing, notFound, unchanged } };
  }

  // 一括PUT
  async function bulkPut(appId, records) {
    for (const c of chunk(records, PUT_CHUNK)) {
      await callKintone('/k/v1/records.json', 'PUT', { app: appId, records: c });
    }
  }
  function createFetchHandler(event, btnFetch) {
    return async () => {
      const appId = kintone.app.getId();
      const recIds = getTargetRecordIds(event);
      if (!recIds.length) {
        alert('対象レコードがありません。');
        return;
      }

      btnFetch.disabled = true;
      const beforeText = btnFetch.textContent;
      btnFetch.textContent = '取引形式を取得（処理中…）';
      try {
        const mallById = mapMallByRecordId(event, recIds, FIELD_MALL_ID);
        const malls = uniqueMalls(mallById);
        log('targets', { recCount: recIds.length, uniqueMalls: malls.length });

        const tradeMap = await fetchMallTradeMap(malls, 案件管理_APP_ID, FIELD_MALL_ID, FIELD_TRADE_SRC);
        log('tradeMap size', tradeMap.size);

        const { updates, stats } = buildUpdates(event, recIds, mallById, tradeMap, FIELD_TRADE_DST);
        log('updates', updates.length, stats);

        if (!updates.length) {
          alert(`更新対象はありませんでした。\n（未該当:${stats.notFound} / 空欄→記載なし:${stats.emptyMallToMissing} / 変更なし:${stats.unchanged}）`);
          return;
        }

        await bulkPut(appId, updates);

        alert([`取引形式の取得・更新が完了しました。`, `更新件数: ${updates.length}`, `未該当: ${stats.notFound}`, `空欄→記載なし: ${stats.emptyMallToMissing}`, `変更なし: ${stats.unchanged}`, `\nページを再読み込みしてください。`].join('\n'));
      } catch (e) {
        console.error('取引形式 一括更新 失敗', e);
        const msg = e && e.message ? e.message : '不明なエラー';
        alert(`取引形式の更新に失敗しました。\n原因: ${msg}\n（案件管理の参照権限が不足している可能性があります）`);
      } finally {
        btnFetch.disabled = false;
        btnFetch.textContent = beforeText;
      }
    };
  }
  const 案件管理_APP_ID = 514;

  // ボタンを出す対象ビューID（URL の view= の数値）
  const TARGET_VIEW_IDS = [6428047, 6428141];

  // 両アプリ共通キー
  const FIELD_MALL_ID = 'モール管理番号';

  // 取得→反映する項目
  const FIELD_TRADE_SRC = '取引形式'; // 案件管理（ドロップダウン）
  const FIELD_TRADE_DST = '取引形式'; // 出荷指示（文字列1行）

  // ===== 設定ここまで =====

  const onIndexShow = async (event) => {
    // ビューIDで対象判定
    const viewId = Number(event.viewId);
    if (!TARGET_VIEW_IDS.includes(viewId)) return;

    const header = kintone.app.getHeaderMenuSpaceElement();
    if (!header) return;

    // 既存カスタマイズが同名ボタンを置いている場合のクリーンアップ（このビュー限定）
    // ヘッダ直下の『指定出荷日を入力』『取引形式を取得』ボタンで、
    // まだ当ツールバー(#hc-toolbar)の内側でないものを削除
    (() => {
      const texts = ['取引形式を取得'];
      const btns = Array.from(header.querySelectorAll('button'));
      btns.forEach((b) => {
        if (texts.includes(b.textContent) && !b.closest('#hc-toolbar')) {
          b.remove();
        }
      });
    })();

    // 二重設置防止（既存があればハンドラだけ差し替えて return）
    const existing = document.getElementById('hc-toolbar');
    if (existing) {
      const btnFetch = existing.querySelector('#hc-btn-fetch-trade-type');
      if (btnFetch) {
        btnFetch.onclick = createFetchHandler(event, btnFetch); // ← 直下の関数を追加
      }
      return;
    }

    // 操作用ツールバー
    const wrap = document.createElement('div');
    wrap.id = 'hc-toolbar';
    wrap.style.display = 'flex';
    wrap.style.gap = '8px';
    wrap.style.alignItems = 'center';

    // --- 取引形式を取得ボタン ---
    const btnFetch = document.createElement('button');
    btnFetch.id = 'hc-btn-fetch-trade-type';
    btnFetch.textContent = '取引形式を取得';
    btnFetch.className = 'kintoneplugin-button-normal';

    // ヘッダへ追加
    wrap.appendChild(btnFetch);
    header.appendChild(wrap);

    // 取引形式を取得

    btnFetch.onclick = createFetchHandler(event, btnFetch);
  };

  kintone.events.on('app.record.index.show', onIndexShow);
})();
