(() => {
  // ===== 設定ここから =====
  const 案件管理_APP_ID = 514;

  // ボタンを出す対象ビューID（URL の view= の数値）
  const TARGET_VIEW_IDS = [6428047, 6428141];

  // 両アプリ共通キー
  const FIELD_MALL_ID = 'モール管理番号';

  // 取得→反映する項目
  const FIELD_TRADE_SRC = '取引形式'; // 案件管理（ドロップダウン）
  const FIELD_TRADE_DST = '取引形式'; // 出荷指示（文字列1行）

  // バッチ更新サイズ
  const CHUNK = 100;

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
      const texts = ['指定出荷日を入力', '取引形式を取得'];
      const btns = Array.from(header.querySelectorAll('button'));
      btns.forEach((b) => {
        if (texts.includes(b.textContent) && !b.closest('#hc-toolbar')) {
          b.remove();
        }
      });
    })();

    // 二重設置防止
    if (document.getElementById('hc-toolbar')) return;

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

    // 共通：対象レコードID（チェックがあれば選択、なければ表示中全件）
    const getTargetRecordIds = () => {
      const selected = (kintone.app.getSelectedRecordIds && kintone.app.getSelectedRecordIds()) || [];
      if (selected.length > 0) return selected.map((id) => String(id));
      return event.records.map((r) => r.$id.value);
    };

    // 共通：PUT一括更新
    const bulkUpdate = async (records) => {
      for (let i = 0; i < records.length; i += CHUNK) {
        const chunk = records.slice(i, i + CHUNK);
        await kintone.api(kintone.api.url('/k/v1/records.json', true), 'PUT', {
          app: kintone.app.getId(),
          records: chunk,
        });
      }
    };

    // 取引形式を取得
    btnFetch.onclick = async () => {
      const recIds = getTargetRecordIds();
      if (!recIds.length) {
        alert('対象レコードがありません。');
        return;
      }

      // 表示中レコードのモールIDをマップ
      const mallById = new Map();
      for (const r of event.records) {
        if (recIds.includes(r.$id.value)) mallById.set(r.$id.value, r[FIELD_MALL_ID]?.value || '');
      }

      const updates = [];
      for (const id of recIds) {
        const mall = mallById.get(id) || '';
        if (!mall) {
          updates.push({ id, record: { [FIELD_TRADE_DST]: { value: '記載なし' } } });
          continue;
        }
        try {
          const query = `${FIELD_MALL_ID} = "${mall}"`;
          const resp = await kintone.api(kintone.api.url('/k/v1/records.json', true), 'GET', {
            app: 案件管理_APP_ID,
            query,
            fields: [FIELD_TRADE_SRC],
          });
          const val = resp.records?.[0]?.[FIELD_TRADE_SRC]?.value || '記載なし';
          updates.push({ id, record: { [FIELD_TRADE_DST]: { value: val } } });
        } catch (e) {
          console.warn('取引形式取得失敗', { id, mall, e });
          updates.push({ id, record: { [FIELD_TRADE_DST]: { value: '記載なし' } } });
        }
      }

      if (!updates.length) {
        alert('更新対象がありません。');
        return;
      }
      await bulkUpdate(updates);
      alert(`取引形式の取得・更新が完了しました（${updates.length}件）。ページを再読み込みしてください。`);
    };
  };

  kintone.events.on('app.record.index.show', onIndexShow);
})();
