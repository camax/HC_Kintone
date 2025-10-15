/**
 * WELBOX消込データCSVを出力する（API最適化版）
 */
(() => {
  'use strict';
  luxon.Settings.defaultLocale = 'ja';
  const client = new KintoneRestAPIClient();
  const APP_ID = kintone.app.getId();
  const spinner = new Kuc.Spinner({ text: '処理中...', container: document.body });

  const csvFields = [
    { title: 'オーダーID', field: '購入番号', type: 'kintone' },
    { title: '配送業者コード', type: 'custom' },
    { title: 'その他配送業者', value: '', type: 'fixed' },
    { title: '配送方法', type: 'custom' },
    { title: '送り状No', field: '伝票No', type: 'kintone' },
    { title: '荷物お問い合わせURL', value: '', type: 'fixed' },
    { title: '出荷日', field: '発送日', type: 'kintone' },
    { title: '出荷指示日', value: '', type: 'fixed' },
    { title: '会員メッセージ備考', value: '', type: 'fixed' },
  ];

  let dtNow = luxon.DateTime.local();
  let resParam = { status: 1, message: '' };

  /**
   * 現在のビュー条件で表示されているレコードのみ取得
   */
  const GetVisibleRecords = async () => {
    console.log('[WELBOX] GetVisibleRecords start');
    try {
      const query = kintone.app.getQueryCondition();
      console.log('[WELBOX] Query:', query);
      const allRecords = await client.record.getAllRecords({ app: APP_ID, condition: query });
      return allRecords;
    } catch (error) {
      resParam.status = 9;
      resParam.message = 'WELBOX消込データCSVの取得に失敗しました。\n' + error.message;
      throw error;
    }
  };

  /**
   * 出力用データ生成
   */
  const GenerateOutputData = (records) => {
    return records.map((record) => {
      const dataEntry = {};
      for (const fieldDef of csvFields) {
        if (fieldDef.type === 'kintone') {
          dataEntry[fieldDef.title] = record[fieldDef.field]?.value || '';
        } else if (fieldDef.type === 'fixed') {
          dataEntry[fieldDef.title] = fieldDef.value;
        } else if (fieldDef.type === 'custom') {
          const shipper = record['配送業者']?.value || '';
          if (fieldDef.title === '配送業者コード') {
            dataEntry[fieldDef.title] = shipper === '佐川急便' ? '2' : shipper === 'ゆうパケット' ? '3' : '';
          } else if (fieldDef.title === '配送方法') {
            dataEntry[fieldDef.title] = shipper === '佐川急便' ? '宅配' : shipper === 'ゆうパケット' ? '郵便' : '';
          }
        }
      }
      return dataEntry;
    });
  };

  /**
   * CSV変換
   */
  const TransformToCSV = (arrObj) => {
    const header = '"' + csvFields.map((f) => f.title).join('","') + '"\n';
    const body = arrObj
      .map((row) => {
        const strRow = csvFields
          .map((fieldDef) => {
            let val = row[fieldDef.title] || '';
            return String(val).replace(/"/g, '""');
          })
          .join('","');
        return '"' + strRow + '"';
      })
      .join('\n');
    return header + body;
  };

  /**
   * CSV出力
   */
  const exportCSV = (csvData, filename) => {
    const exportedFilename = (filename || 'exportCSV') + '.csv';
    const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
    const blob = new Blob([bom, csvData], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', exportedFilename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  /**
   * ステータス更新（100件単位）
   */
  const UpdateStatusBatch = async (records) => {
    const CHUNK_SIZE = 100;
    for (let i = 0; i < records.length; i += CHUNK_SIZE) {
      const chunk = records.slice(i, i + CHUNK_SIZE);
      const arrRecords = chunk.map((r) => ({
        id: r.$id.value,
        record: { 運用ステータス: { value: '消込データ出力済み' } },
      }));
      await client.record.updateAllRecords({ app: APP_ID, records: arrRecords });
    }
  };

  /**
   * メイン処理
   */
  const ExportShippingReport_Main = async () => {
    console.log('[WELBOX] ExportShippingReport_Main started');
    try {
      spinner.open();
      resParam.status = 1;

      const reportRecords = await GetVisibleRecords();
      console.log('[WELBOX] Records:', reportRecords.length);

      if (reportRecords.length === 0) {
        resParam.message = '出力対象のレコードがありませんでした。';
        return;
      }

      const arrData = GenerateOutputData(reportRecords);
      const csvData = TransformToCSV(arrData);
      exportCSV(csvData, dtNow.toFormat('yyyyMMdd') + '_WELBOX_消込用');

      await UpdateStatusBatch(reportRecords);
      resParam.message = 'WELBOX消込データCSVを出力しました。';
    } catch (ex) {
      console.error(ex);
      resParam.message = 'WELBOX消込データCSVの出力に失敗しました。\n' + ex.message;
    } finally {
      spinner.close();
      Swal.fire({
        title: 'WELBOX消込データCSVを出力',
        text: resParam.message,
      }).then(() => location.reload(true));
    }
  };

  /**
   * ビューID指定（6428595）
   */
  kintone.events.on('app.record.index.show', async (event) => {
    if (String(event.viewId) !== '6428595') return event;

    if (!document.getElementById('welbox_export_button')) {
      const button = document.createElement('button');
      button.id = 'welbox_export_button';
      button.classList.add('kintoneplugin-button-dialog-ok');
      button.innerText = 'WELBOX_消し込みCSVを出力';
      kintone.app.getHeaderMenuSpaceElement().appendChild(button);
      button.onclick = ExportShippingReport_Main;
    }
  });
})();
