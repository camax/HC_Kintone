(function () {
  'use strict';

  const FIELD_CODE = '残数';

  kintone.events.on('app.record.index.show', function (event) {
    const records = event.records;
    const elements = kintone.app.getFieldElements(FIELD_CODE);

    if (!elements || elements.length === 0) {
      console.warn('残数フィールドの要素が見つかりませんでした。');
      return event;
    }

    records.forEach((record, i) => {
      const value = Number(record[FIELD_CODE].value);
      const element = elements[i];

      if (elements.length <= i || !element) {
        console.warn(`行 ${i} の要素が取得できませんでした。スキップします。`);
        return;
      }

      const row = element.closest('tr');
      if (!row) {
        console.warn(`行 ${i} の tr 要素が見つかりませんでした。`);
        return;
      }

      if (value < -5) {
        row.style.backgroundColor = '#ffcccc'; // 濃い赤背景
        element.style.color = '#990000'; // 濃い赤文字
        element.style.fontWeight = 'bold';
        console.log(`【警告】残数が-5未満のレコード（index: ${i}, value: ${value}）に警告色を適用`);
      } else if (value < 0) {
        row.style.backgroundColor = '#ffe6e6'; // 薄赤背景
        element.style.color = '#b30000';
        element.style.fontWeight = 'bold';
        console.log(`残数マイナスのレコード（index: ${i}, value: ${value}）にハイライト適用`);
      } else if (value === 0) {
        row.style.backgroundColor = '#ffffcc'; // 黄色背景
        element.style.color = '#666600';
        element.style.fontWeight = 'bold';
        console.log(`残数ゼロのレコード（index: ${i}, value: ${value}）に注意色を適用`);
      }
    });

    return event;
  });

  kintone.events.on('app.record.detail.show', function (event) {
    const value = Number(event.record['残数']?.value ?? 0);
    const element = kintone.app.record.getFieldElement('残数');

    if (element) {
      if (value < -5) {
        element.style.backgroundColor = '#ffcccc';
        element.style.color = '#990000';
        element.style.fontWeight = 'bold';
        console.log('詳細画面：残数 < -5 → 濃赤適用');
      } else if (value < 0) {
        element.style.backgroundColor = '#ffe6e6';
        element.style.color = '#b30000';
        element.style.fontWeight = 'bold';
        console.log('詳細画面：残数 < 0 → 薄赤適用');
      } else if (value === 0) {
        element.style.backgroundColor = '#ffffcc';
        element.style.color = '#666600';
        element.style.fontWeight = 'bold';
        console.log('詳細画面：残数 = 0 → 黄色適用');
      } else {
        console.log('詳細画面：残数 > 0 → 色付けなし');
      }
    } else {
      console.warn('詳細画面：残数フィールドが見つかりませんでした');
    }

    return event;
  });
})();
