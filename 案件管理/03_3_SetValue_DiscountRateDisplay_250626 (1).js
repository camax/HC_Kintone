(function () {
  'use strict';

  const EVENTS = ['app.record.detail.show', 'app.record.edit.show'];

  kintone.events.on(EVENTS, function (event) {
    const record = event.record;

    // 値を読み取り（念のため浮動小数に変換）
    const taxExcluded = parseFloat(record['売価_税抜']?.value);
    const retailExcluded = parseFloat(record['希望小売価格セット_税抜']?.value);
    const taxIncluded = parseFloat(record['売価_税込']?.value);
    const retailIncluded = parseFloat(record['希望小売価格セット_税込']?.value);

    // 再評価を促すために、売価_税抜/税込にダミーで同じ値を再設定
    if (!isNaN(taxExcluded)) {
      record['売価_税抜'].value = taxExcluded;
    }

    if (!isNaN(taxIncluded)) {
      record['売価_税込'].value = taxIncluded;
    }

    return event;
  });
})();
