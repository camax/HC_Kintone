/*
 * サブテーブル「商品情報」内の「個数」合計 ÷ 親「注文数」
 * を「セット入数合計」に反映する。
 * - 画面プレビュー反映（個数/注文数の変更時）
 * - 保存時に最終反映
 * - 一覧ヘッダーに全レコード一括埋め込みボタン
 */
(function () {
  'use strict';

  // ===== 設定 =====
  const SUBTABLE_FIELD_CODE = '商品情報'; // サブテーブル
  const SUBTABLE_COUNT_CODE = '個数'; // サブテーブル内の列
  const PARENT_ORDER_QTY_CODE = '注文数'; // 分母
  const TOTAL_FIELD_CODE = 'セット入数合計'; // 出力先（数値）

  const api = (p, m, b) => kintone.api(kintone.api.url(p, true), m, b);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // サブテーブル個数の合計
  function sumCountFromSubtable(record) {
    const rows = record[SUBTABLE_FIELD_CODE]?.value || [];
    let sum = 0;
    for (const row of rows) {
      const v = Number(row.value[SUBTABLE_COUNT_CODE]?.value);
      if (!Number.isNaN(v)) sum += v;
    }
    return sum;
  }

  // 合計/注文数（丸めなし、分母0は0）
  function calcTotal(sumCount, orderQty) {
    const d = Number(orderQty) || 0;
    if (d === 0) return 0;
    return sumCount / d;
  }

  // プレビュー反映
  function preview(event) {
    const rec = event.record;
    const sum = sumCountFromSubtable(rec);
    const total = calcTotal(sum, rec[PARENT_ORDER_QTY_CODE]?.value);
    if (rec[TOTAL_FIELD_CODE]) rec[TOTAL_FIELD_CODE].value = total;
    return event;
  }

  // 保存直前に最終反映
  function beforeSubmit(event) {
    const rec = event.record;
    const sum = sumCountFromSubtable(rec);
    const total = calcTotal(sum, rec[PARENT_ORDER_QTY_CODE]?.value);
    if (rec[TOTAL_FIELD_CODE]) rec[TOTAL_FIELD_CODE].value = total;
    return event;
  }

  // 個数 or 注文数が変わったら即時再計算
  const changeEvents = [`app.record.create.change.${SUBTABLE_COUNT_CODE}`, `app.record.edit.change.${SUBTABLE_COUNT_CODE}`, `app.record.index.edit.change.${SUBTABLE_COUNT_CODE}`, `app.record.create.change.${PARENT_ORDER_QTY_CODE}`, `app.record.edit.change.${PARENT_ORDER_QTY_CODE}`, `app.record.index.edit.change.${PARENT_ORDER_QTY_CODE}`];
  kintone.events.on(changeEvents, preview);
  kintone.events.on(['app.record.create.show', 'app.record.edit.show'], preview);
  kintone.events.on(['app.record.create.submit', 'app.record.edit.submit'], beforeSubmit);
})();
