// /**
//  * くまポンの掲載フラグが有効だったら、くまポン売価。
//  * くまポンが有効ではなく、AUにフラグがたってたら、au。フラグが立たなかったら、計算なし。
//  *
//  * ■ 条件
//  * ・案件採用された各モールが対象 au < くまポン
//  *   くまポンの掲載フラグが有効だったら、くまポンの売価（税込）がコピーされる。
//  *   くまポンの掲載フラグが無効で、auで掲載フラグが有効だった場合は、auの売価（税込）がコピーされる。
//  *   両方にフラグがたってない場合は計算しない。
//  *
//  * ■ トリガー
//  * ・くまポン・auの案件採用フラグが変更された場合
//  * ・案件採用フラグが立っている場合に、売価（税抜）が変更された場合
//  */

// (function () {
//   'use strict';
//   console.log('🟢 テスト用スクリプト読み込み成功');
//   const malls = ['au', 'くまポン'];

//   const SeSumValue = (event) => {
//     console.log('▶ SeSumValue triggered');
//     let record = event.record;

//     console.log('record["売価_税込_くまポン"]:', record['売価_税込_くまポン']);
//     const rawKumapon = record['売価_税込_くまポン']?.value;
//     const rawFallback = record['売価_税込_1_kumapon']?.value;

//     const kumaponPrice = Number(rawKumapon || 0);
//     const fallbackPrice = Number(rawFallback || 0);

//     console.log('売価_税込_くまポン:', rawKumapon, '→', kumaponPrice);
//     console.log('売価_税込_1_kumapon:', rawFallback, '→', fallbackPrice);

//     const price = kumaponPrice > 0 ? kumaponPrice : fallbackPrice;

//     console.log('決定した価格（税込）:', price);

//     const fields = ['売価_税抜_リロ', '売価_税抜_ベネ', '売価_税抜_おためし', '売価_税抜_Tポイント', '売価_税抜_社販'];

//     fields.forEach((field) => {
//       if (record[field]) {
//         record[field].value = price;
//         console.log(`✅ ${field} に ${price} を設定`);
//       } else {
//         console.warn(`⚠️ ${field} フィールドが存在しません`);
//       }
//     });

//     return event;
//   };

//   // 常に実行させる（表示時、保存時）
//   kintone.events.on(['app.record.create.show', 'app.record.edit.show', 'app.record.create.submit', 'app.record.edit.submit'], SeSumValue);

//   kintone.events.on(['app.record.create.show', 'app.record.edit.show'], (event) => {
//     console.log('🟢 レコード画面が開かれました');
//     return event;
//   });
// })();


// // (function () {
// //   'use strict';

// //   const malls = ['au', 'くまポン'];

// //   const SeSumValue = (event) => {
// //     let record = event.record;

// //     // くまポンが採用されているか
// //     const isKumaponAdopted = record['案件採用_くまポン'].value.length > 0;
// //     // auが採用されているか
// //     const isAuAdopted = record['案件採用_au'].value.length > 0;

// //     let price = 0;

// //     if (isKumaponAdopted) {
// //       // くまポンが採用されている場合
// //       price = record['売価_税込_くまポン'].value;
// //     } else if (isAuAdopted) {
// //       // auが採用されている場合
// //       price = record['売価_税込_au'].value;
// //     }

// //     // 納価（税抜）フィールドに値を設定
// //     record['売価_税抜_リロ'].value = price;
// //     record['売価_税抜_ベネ'].value = price;
// //     record['売価_税抜_おためし'].value = price;
// //     record['売価_税抜_Tポイント'].value = price;
// //     record['売価_税抜_社販'].value = price;

// //     return event;
// //   };

// //   const events = [
// //     'app.record.create.show',
// //     'app.record.edit.show',
// //     'app.record.create.submit',
// //     'app.record.edit.submit',
// //     'app.record.create.change.案件採用_くまポン',
// //     'app.record.edit.change.案件採用_くまポン',
// //     'app.record.create.change.案件採用_au',
// //     'app.record.edit.change.案件採用_au',
// //     'app.record.create.change.売価_税抜_くまポン',
// //     'app.record.edit.change.売価_税抜_くまポン',
// //     'app.record.create.change.売価_税抜_au',
// //     'app.record.edit.change.売価_税抜_au',
// //   ];

// //   kintone.events.on(events, SeSumValue);
// // })();