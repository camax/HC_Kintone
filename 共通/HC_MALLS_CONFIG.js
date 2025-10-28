// 共通/HC_MALLS_CONFIG.js
// 各媒体の設定：売価計算・掲載依頼・出荷指示アプリなどで共通利用
// 新媒体追加時はこのファイルに追記し、各アプリで最初に読み込むこと。

window.HC_MALLS_CONFIG = {
  // au PAY マーケット
  // fieldPrefix: フィールド名の接頭辞
  // hasCost: 原価情報を含むかどうか
  // hasProfit: 利益計算を行うかどうか
  au: { fieldPrefix: 'au', hasCost: false, hasProfit: true },

  // リロクラブ（福利厚生倶楽部）
  // fieldPrefix: フィールド名の接頭辞
  // hasCost: 原価情報を含む（福利厚生倶楽部は原価管理あり）
  // hasProfit: 利益計算を行う
  リロ: { fieldPrefix: 'リロ', hasCost: true, hasProfit: true },

  // eecoto（環境モール）
  // fieldPrefix: フィールド名の接頭辞
  // hasCost: 原価情報を含まない
  // hasProfit: 利益計算を行う
  eecoto: { fieldPrefix: 'eecoto', hasCost: false, hasProfit: true },

  // Temu（新媒体）2025-10-28追加
  // fieldPrefix: フィールド名の接頭辞
  // hasCost: 原価情報を含まない
  // hasProfit: 利益計算を行う
  temu: { fieldPrefix: 'temu', hasCost: false, hasProfit: true },
};
