(() => {
  'use strict';
  luxon.Settings.defaultLocale = 'ja';
  const client = new KintoneRestAPIClient();
  const APP_ID = kintone.app.getId();

  const csvFields = [
    { title: 'オーダーID', value: '', type: 'fixed' },
    { title: '注文商品ID', field: 'ID_くまポン用', type: 'kintone' },
    { title: '数量', field: '数量', type: 'kintone' },
    { title: '発送元', type: 'custom' },
    { title: '配送会社', field: '配送業者', type: 'kintone' },
    { title: '追跡番号', field: '伝票No', type: 'kintone' },
  ];

  /**
   * 現在のビュー条件でレコードを取得（全件まとめて）
   */
  const GetVisibleRecords = async () => {
    const query = kintone.app.getQueryCondition();
    const allRecords = await client.record.getAllRecords({ app: APP_ID, condition: query });
    return allRecords;
  };

  /**
   * 100件単位でステータスを更新
   */
  const UpdateStatusBatch = async (records) => {
    const CHUNK_SIZE = 100;
    const chunks = [];
    for (let i = 0; i < records.length; i += CHUNK_SIZE) {
      chunks.push(records.slice(i, i + CHUNK_SIZE));
    }

    for (const chunk of chunks) {
      const updateRecords = chunk.map((r) => ({
        id: r.$id.value,
        record: { 運用ステータス: { value: '消込データ出力済み' } },
      }));
      await client.record.updateAllRecords({ app: APP_ID, records: updateRecords });
    }
  };

  /**
   * 出力用データを生成
   */
  const GenerateOutputData = (records) => {
    const arrData = [];
    for (const record of records) {
      const row = {};
      for (const fieldDef of csvFields) {
        if (fieldDef.type === 'kintone') {
          row[fieldDef.title] = record[fieldDef.field]?.value || '';
        } else if (fieldDef.type === 'fixed') {
          row[fieldDef.title] = fieldDef.value;
        } else if (fieldDef.type === 'custom') {
          if (fieldDef.title === '発送元') {
            const zip = record['送り先郵便番号']?.value || '';
            const pref = record['送り先都道府県']?.value || '';
            const addr1 = record['送り先住所１']?.value || '';
            const addr2 = record['送り先住所２']?.value || '';
            const name = record['送り先名']?.value || '';
            const combined = [zip, pref, addr1, addr2, name].filter((v) => v && v.trim() !== '').join(' ');
            row[fieldDef.title] = combined;
          }
        }
      }
      arrData.push(row);
    }
    return arrData;
  };

  /**
   * CSVへ変換＋出力
   */
  const ExportCSV = (arrData) => {
    const header = csvFields.map((f) => f.title).join(',');
    const body = arrData.map((row) => csvFields.map((f) => `"${row[f.title] || ''}"`).join(',')).join('\n');
    const csvData = header + '\n' + body;

    const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
    const blob = new Blob([bom, csvData], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${luxon.DateTime.local().toFormat('yyyyMMdd')}_TEMU_消込用.csv`;
    a.click();
  };

  /**
   * メイン処理
   */
  const ExportShippingReport_Main = async () => {
    const spinner = new Kuc.Spinner({ text: '処理中...', container: document.body });
    try {
      spinner.open();

      const records = await GetVisibleRecords();
      if (!records.length) {
        Swal.fire('データなし', '出力対象のレコードがありません。', 'info');
        return;
      }

      const arrData = GenerateOutputData(records);
      ExportCSV(arrData);
      await UpdateStatusBatch(records);

      Swal.fire('TEMU消込データCSVを出力', '出力が完了しました。', 'success');
    } catch (err) {
      Swal.fire('エラー', '処理中にエラーが発生しました。\n' + err.message, 'error');
    } finally {
      spinner.close();
    }
  };

  /**
   * ビューID（6428851）のみで動作
   */
  kintone.events.on('app.record.index.show', (event) => {
    if (String(event.viewId) !== '6428851') return event;
    if (!document.getElementById('temu_export_button')) {
      const button = document.createElement('button');
      button.id = 'temu_export_button';
      button.classList.add('kintoneplugin-button-dialog-ok');
      button.innerText = 'TEMU 消し込みCSVを出力';
      kintone.app.getHeaderMenuSpaceElement().appendChild(button);
      button.onclick = ExportShippingReport_Main;
    }
  });
})();
