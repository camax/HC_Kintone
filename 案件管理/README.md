🧩 README — Kintone「案件管理」アプリ カスタムスクリプト一覧

概要

このディレクトリには、「案件管理」アプリのカスタム JavaScript 群が格納されています。
目的は、案件登録〜掲載モール連携〜商品マスタ反映までの一連の業務プロセスを自動化・可視化することです。

スクリプトは機能別に整理されており、
• 自動計算／自動補完
• ステータス制御
• 一覧ビュー UI 操作
• 外部アプリ連携（変更依頼管理・掲載モール各アプリ・商品マスタ）
に大別されます。

⸻

📂 ファイル一覧と機能概要

【1】データ連携・業務アクション系（03*1*〜）

1-1. 03_1_CreateRecodeToCsvApp_250305.js

掲載モール連携処理の中核。案件管理一覧から各モールアプリにレコードを一括生成。
• 一覧に「掲載モール レコード発行」ボタンを追加
• SweetAlert でモール選択 → 選択モールに対応したアプリへ一括登録
• 各モール専用のデータマッピング関数（SetReqRecodeBy 〇〇）を定義
• 送信バリデーション（フォームスキーマ・サニタイズ）
• 送信後に案件の掲載モール連携ステータス更新
• HC_DEBUG による詳細ログ出力対応
• 対応モール：au / eecoto / kumapon / riro / bene / otameshi / tpoint

主なイベント:
app.record.index.show（View ID: 6428194）

⸻

1-2. 03_1_CreateChangeRequestBySpreadsheet.js

案件一覧をスプレッドシート形式で表示し、変更依頼管理アプリにレコードを一括生成。
• jspreadsheet で案件一覧を表形式表示
• チェック ON レコードを対象に変更依頼を作成
• 変更依頼グループ ID を自動採番 (CR-yyyyMMddHHmmss)
• 変更後フィールド（掲載終了日・賞味期限・発送日・セット数）を登録
• 生成後、変更依頼管理アプリを新タブで開く
• Kuc.Spinner による進行表示

主なイベント:
app.record.index.show（View ID: 6425844）

⸻

【2】補助ロジック・ID 生成系（03*2*〜）

2-1. 03_2_UpdateSEQValue.js

SEQ\_モラタメの自動設定。
• 新規・編集時の保存成功イベントで SEQ 値を自動入力
• 空欄のみ更新対象
• レコード ID をそのまま SEQ に採用

イベント:
app.record.create.submit.success, app.record.edit.submit.success

⸻

【3】フィールド自動設定・補助機能系（03*3*〜）

3-1. 03_3_SetValue_FieldPostingDays.js

掲載終了日から残日数を算出して「掲載残日数」へ反映。
• 現在日付との差分（日単位）を自動計算
• luxon 利用

イベント:
app.record.create.show, app.record.edit.show, app.record.detail.show,
app.record.create.change.掲載終了日, app.record.edit.change.掲載終了日

⸻

3-2. 03_3_SetValue_PostingEndDate.js

初回発送日からクチコミ終了日を自動算出。
• 発送日が 15 日以前 → 翌月 15 日
• 発送日が 16 日以降 → 翌月末日

イベント:
app.record.create.change.初回発送日, app.record.edit.change.初回発送日

⸻

3-3. 03_3_SetValue_StatusChangeUser.js

ステータス変更ユーザー制御。
• 編集・作成・一覧編集時に非活性化
• 掲載ステータス変更時にログインユーザーを自動入力

イベント:
表示: app.record.create.show, app.record.edit.show, app.record.index.edit.show
変更: app.record.create.change.掲載ステータス, app.record.edit.change.掲載ステータス, app.record.index.edit.change.掲載ステータス

⸻

3-4. 03_3_SetValue_DiscountRateDisplay_250626.js

売価・希望小売価格の再評価補助。
• 売価*税抜・売価*税込の値を再設定して再計算をトリガー
• 詳細／編集画面で自動実行

イベント:
app.record.detail.show, app.record.edit.show

⸻

【4】アラート・可視化系

4-1. 03\_残数アラート表示\_250619.js

残数フィールドをもとに行の背景色を変更。
• 残数 < -5 → 濃赤（重大アラート）
• 残数 < 0 → 薄赤（注意）
• 残数 = 0 → 黄色（警告）
• 一覧・詳細画面両対応

イベント:
app.record.index.show, app.record.detail.show

⸻

【5】補助・自動入力・UI 制御系

5-1. 掲載終了日から 1 ヶ月半\_241011.js

掲載終了日＋ 1.5 ヶ月を「掲載終了日から 1 ヶ月半」フィールドに自動反映。
• luxon で 1.5 ヶ月を加算
• 終了日が空なら空欄に戻す

イベント:
app.record.create.change.掲載終了日, app.record.edit.change.掲載終了日

⸻

5-2. モール管理番号の自動設定\_V 景品交換\_250216.js

「T ポイント」媒体のモール管理番号を自動生成。
• 掲載媒体名が「T ポイント」の場合、
HCYYYYMMDD001 形式で採番（当日単位連番）
• 既存レコードを検索して最大値を+1

イベント:
• 表示時に採番準備
• 掲載媒体名変更時に自動設定

⸻

5-3. hideGroup_ItemInfo_250317.js

商品情報グループの非表示制御。
• 詳細画面表示時に、商品コードが空のブロックを非表示
• 商品\_1 グループ〜商品\_10 グループを対象に非表示化

イベント:
app.record.detail.show

⸻

5-4. タグの値を設定\_250317.js

タグフィールドの自動制御。
• タグフィールドを編集不可に設定
• 「タグ選択」フィールド変更時に、タグ値をカンマ区切りで反映

イベント:
表示: app.record.create.show, app.record.edit.show, app.record.index.edit.show
変更: app.record.create.change.タグ選択, app.record.edit.change.タグ選択, app.record.index.edit.change.タグ選択

⸻

5-5. 商品マスタの掲載ステータスを更新\_250404.js

案件側の掲載状況をもとに、商品マスタの掲載ステータスを一括更新。
• 案件管理で「掲載済」の商品コードを抽出
• 商品マスタの対応コードに「掲載済」を付与
• ボタン操作（Kuc.Button）で実行

イベント:
app.record.index.show（View ID: 6414768, 6428250）

⸻

🔁 推奨読み込み順

順番 ファイル名 種別 備考
1 03*3_SetValue_StatusChangeUser.js フィールド制御 ステータス変更ユーザー非活性化
2 03_3_SetValue_PostingEndDate.js 自動計算 初回発送 → クチコミ終了日
3 03_3_SetValue_FieldPostingDays.js 自動計算 掲載残日数算出
4 掲載終了日から 1 ヶ月半\_241011.js 自動計算 掲載終了日＋ 1.5 ヶ月
5 03_3_SetValue_DiscountRateDisplay_250626.js 計算補助 再評価トリガー
6 タグの値を設定\_250317.js 補助制御 タグ選択反映
7 hideGroup_ItemInfo_250317.js 表示制御 商品情報グループの非表示
8 モール管理番号の自動設定\_V 景品交換\_250216.js 自動採番 T ポイント専用モール管理番号
9 03_2_UpdateSEQValue.js ID 管理 SEQ 自動採番
10 03*残数アラート表示\_250619.js ビジュアル 残数アラート
11 03_1_CreateChangeRequestBySpreadsheet.js 変更依頼連携 スプレッドシート UI ＋連携
12 03_1_CreateRecodeToCsvApp_250305.js モール連携 外部アプリ連携メイン
13 商品マスタの掲載ステータスを更新\_250404.js 業務更新 商品マスタ一括更新

⸻

⚙️ 注意事項
• すべてのスクリプトより前に HC.apps および HC.domain を定義する共通設定 JS を読み込むこと。
• 一部スクリプトは外部ライブラリ（luxon, SweetAlert2, jspreadsheet, Kuc）を利用します。
• 各種 ViewID（例：6428194, 6425844）は環境に合わせて修正可能。
• ログインユーザー ID で制御される処理（例：商品マスタ更新）は HC_MEMBER_ID で定義されています。

⸻

📁 構成ツリー

案件管理/
├── 03*1_CreateRecodeToCsvApp_250305.js
├── 03_1_CreateChangeRequestBySpreadsheet.js
├── 03_2_UpdateSEQValue.js
├── 03_3_SetValue_FieldPostingDays.js
├── 03_3_SetValue_PostingEndDate.js
├── 03_3_SetValue_StatusChangeUser.js
├── 03_3_SetValue_DiscountRateDisplay_250626.js
├── 03*残数アラート表示\_250619.js
├── 掲載終了日から 1 ヶ月半\_241011.js
├── モール管理番号の自動設定\_V 景品交換\_250216.js
├── hideGroup_ItemInfo_250317.js
├── タグの値を設定\_250317.js
└── 商品マスタの掲載ステータスを更新\_250404.js
