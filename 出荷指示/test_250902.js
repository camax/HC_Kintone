(() => {
  'use strict';

  // ===== 設定 =====
  // 対象ビュー（指定したい場合だけ数字を入れる。未指定なら全ビューでボタン表示）
  const TARGET_VIEW_IDS = [];

  // クリア対象は「現在の画面の絞り込み条件」を使用（固定クエリは使わない）
  // const FIXED_QUERY = '...'; // ←未使用

  // クリアするフィールドコード
  const FIELD_SHIPDATE = '指定出荷日';

  // 一括更新のチャンクサイズ
  const CHUNK = 100;
  // =================

  const client = new KintoneRestAPIClient();

  kintone.events.on('app.record.index.show', async (event) => {
    // ビュー制限
    if (TARGET_VIEW_IDS.length > 0 && !TARGET_VIEW_IDS.includes(Number(event.viewId))) return event;

    const header = kintone.app.getHeaderMenuSpaceElement();
    if (!header || document.getElementById('btn-test-clear-shipdate')) return event;

    const btn = document.createElement('button');
    btn.id = 'btn-test-clear-shipdate';
    btn.className = 'kintoneplugin-button-normal';
    btn.textContent = 'テスト_指定出荷日クリア';
    header.appendChild(btn);

    btn.onclick = async () => {
      try {
        const appId = kintone.app.getId();

        // 現在の画面の絞り込み条件を使用
        const condition = kintone.app.getQueryCondition() || '';
        // 実行前に条件をユーザーに提示
        const proceed = confirm(condition ? `現在の絞り込み条件で対象レコードの「指定出荷日」を空(null)にします。\n\n条件:\n${condition}\n\n実行してよろしいですか？` : '現在の画面には絞り込み条件が設定されていません。\nこのアプリの全件が対象になります。実行してよろしいですか？');
        if (!proceed) return;

        const records = await client.record.getAllRecords({
          app: appId,
          condition, // 画面の絞り込み条件をそのまま使用
        });

        if (!records || records.length === 0) {
          alert('対象レコードが0件でした。処理を終了します。');
          return;
        }

        // 更新ペイロード作成
        const updates = records.map((r) => ({
          id: r.$id.value,
          record: {
            [FIELD_SHIPDATE]: { value: null },
          },
        }));

        // 100件ずつ更新
        for (let i = 0; i < updates.length; i += CHUNK) {
          const chunk = updates.slice(i, i + CHUNK);
          await client.record.updateAllRecords({ app: appId, records: chunk });
          console.log(`[テスト_指定出荷日クリア] 更新 ${i + 1} - ${Math.min(i + CHUNK, updates.length)} / ${updates.length}`);
        }

        alert(`完了：${updates.length}件の「指定出荷日」をクリアしました。必要ならページを再読み込みしてください。`);
      } catch (e) {
        console.error('[テスト_指定出荷日クリア] 失敗', e);
        alert('エラーが発生しました。コンソールを確認してください。');
      }
    };

    return event;
  });
})();
