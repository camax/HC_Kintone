// 共通/CommonUtils.js
// 各アプリで共通利用するユーティリティ関数群。
// 売価計算・掲載依頼・出荷指示など全てのアプリから参照可能。

window.HC_UTILS = {
  /**
   * 📅 日付フォーマット
   * 与えられたDateオブジェクトを "YYYY-MM-DD" 形式で返す。
   * @param {Date} date - 任意の日付。省略時は現在日付。
   * @returns {string} フォーマット済み日付文字列。
   * @example
   * HC_UTILS.formatDate(new Date('2025-10-28')) // "2025-10-28"
   */
  formatDate: (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,

  /**
   * 🔢 採番フォーマット生成
   * 媒体コードと日付文字列を元に、採番文字列を生成する。
   * @param {string} mall - 媒体名（例："TEMU"）
   * @param {string} dateStr - 日付文字列（例："20251028"）
   * @returns {string} 採番済み文字列（例："TEMU-20251028-001"）
   * @example
   * HC_UTILS.formatMallNumber('TEMU', '20251028') // "TEMU-20251028-001"
   */
  formatMallNumber: (mall, dateStr) => `${mall}-${dateStr}-001`,

  /**
   * ⚠️ 統一的なエラーハンドリング
   * 例外をコンソール出力し、呼び出し側で扱いやすいオブジェクトを返す。
   * @param {string} stage - エラー発生箇所（処理名など）
   * @param {Error} e - 例外オブジェクト
   * @param {object} [context] - 任意の追加情報（対象データなど）
   * @returns {object} { success: false, stage, message, context }
   * @example
   * try {
   *   throw new Error('API Error');
   * } catch(e) {
   *   const err = HC_UTILS.handleError('CreateRecord', e, { mall: 'temu' });
   *   console.log(err.message);
   * }
   */
  handleError: (stage, e, context) => {
    console.error(`[${stage}] Error:`, e, context);
    return { success: false, stage, message: e.message || e.toString(), context };
  },

  /**
   * 🧩 媒体固有ルールの適用
   * 各媒体固有の処理をまとめて行う（例：Temuでの掲載商品名補完など）
   * @param {string} mall - 媒体名
   * @param {object} record - 加工対象のレコードオブジェクト
   * @returns {object} 加工後のレコードオブジェクト
   * @example
   * const updated = HC_UTILS.applyMallSpecificRules('temu', record);
   */
  applyMallSpecificRules: (mall, record) => {
    if (mall === 'temu') {
      record['掲載商品名_その他'] = record['掲載商品名'] || record['商品名'] || '';
    }
    return record;
  },
};
