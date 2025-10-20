(function () {
  'use strict';
  console.log('▶︎ zero-fill.js loaded'); // ← これが出るか確認

  var TABLE_CODE = '商品情報一覧';
  var FIELD_CASE = '商品情報一覧_ケース入数';
  var FIELD_ZERO = '商品情報一覧_ケース入数_ゼロ埋め';
  var events = ['app.record.create.show', 'app.record.edit.show', 'app.record.create.change.' + TABLE_CODE + '.' + FIELD_CASE, 'app.record.edit.change.' + TABLE_CODE + '.' + FIELD_CASE];
  kintone.events.on(events, function (event) {
    console.log('▶︎ zero‑fill event fired', event.type); // ← ここも出力があるか
    var rows = event.record[TABLE_CODE].value || [];
    rows.forEach(function (r, index) {
      const keys = Object.keys(r.value || {});
      const caseFieldKey = keys.find((k) => k.replace(/\s/g, '') === FIELD_CASE.replace(/\s/g, ''));
      let zeroFieldKey = keys.find((k) => k.replace(/\s/g, '') === FIELD_ZERO.replace(/\s/g, ''));

      console.log(`▶︎ row ${index + 1}: caseFieldKey =`, caseFieldKey, 'zeroFieldKey =', zeroFieldKey);
      if (!caseFieldKey || !zeroFieldKey) {
        console.warn(`⚠️ row ${index + 1}: Missing field keys. Current keys:`, keys);
      }

      // --- Fallback for zeroFieldKey if not found
      if (!zeroFieldKey) {
        // Try to find any field key that contains both the table code and 'ゼロ埋め'
        const fallbackZero = keys.find((k) => k.includes(TABLE_CODE) && k.includes('ゼロ埋め'));
        if (fallbackZero) {
          console.warn(`🔄 row ${index + 1}: Using fallback zeroFieldKey = ${fallbackZero}`);
          zeroFieldKey = fallbackZero;
        } else {
          console.error(`❌ row ${index + 1}: Failed to resolve zeroFieldKey forゼロ埋め`);
        }
      }

      try {
        if (caseFieldKey && zeroFieldKey) {
          const v = r.value[caseFieldKey]?.value;
          if (!r.value[zeroFieldKey]) {
            console.warn(`⚠️ row ${index + 1}: zeroFieldKey "${zeroFieldKey}" not initialized. Initializing now.`);
            r.value[zeroFieldKey] = { type: 'NUMBER', value: null };
          }
          r.value[zeroFieldKey].value = v === null || v === '' ? 0 : v;
        }
      } catch (e) {
        console.error(`❌ row ${index + 1}: Error while processing zero-fill`, e);
      }
    });
    return event;
  });
})();
