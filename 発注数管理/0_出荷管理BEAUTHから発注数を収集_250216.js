/**
 * 出荷管理BEAUTHの値を発注数としてデータを収集する
 */
(() => {
  'use strict';

  const client = new KintoneRestAPIClient();
  const APP_ID = kintone.app.getId();

  const HC_APP_ID_SHIPPING_BEAUTH = 568; // 出荷管理BEAUTH
  const HC_APP_ID_MATTER = 514; // 案件管理
  const HC_APP_ID_SET_NUMBER = 501; // セット数管理
  const MEDIA_CODE = 'eecoto'; // BEAUTHプログラム用コード

  let dtNow = luxon.DateTime.local();
  let resParam = { status: 1, message: '' };

  const spinner = new Kuc.Spinner({
    text: '処理中...',
    container: document.body,
  });

  /**
   * Conditionを指定してレコードを一括取得
   * @param {*} appId
   * @param {*} queCond
   * @returns
   */
  const GetAllRecords = async (appId, queCond = '') => {
    try {
      return client.record
        .getAllRecords({ app: appId, query: queCond })
        .then(function (resp) {
          resParam.status = 1;
          return resp;
        })
        .catch(function (e) {
          console.log(e);
          resParam.status = 9;
          resParam.message = `アプリ[${appId}]からレコードの取得に失敗しました。\n` + e;
          return [];
        });
    } catch (ex) {
      console.log(ex);
      resParam.status = 9;
      resParam.message = `アプリ[${appId}]からレコードの取得に失敗しました。\n` + ex;
      return [];
    }
  };

  /**
   * メイン処理
   * @returns
   */
  const GatherShippingManageRecords_Main = async () => {
    try {
      spinner.open();

      // === 発注数レコード追加処理（呼び出しより前に配置）===
      const addOrderRecord = async (orderData) => {
        try {
          // 1) 登録
          const created = await client.record.addRecord({
            app: APP_ID, // ← このファイルは APP_ID を使用
            record: orderData,
          });

          const newId = created?.id;

          // 2) ID再取得（保険：ソースIDで一意取得する設計の場合）
          const checkId = async () => {
            if (newId) return newId;

            // ※アプリに「ソースID」フィールドが無い場合、この保険ロジックは削除してOK
            const recs = await client.record.getRecords({
              app: APP_ID,
              query: `ソースID = "${orderData['ソースID']?.value || ''}" limit 1`,
            });
            return recs.records?.[0]?.$id?.value || null;
          };

          const id = await checkId();
          if (!id) {
            console.error('🚨 レコードID取得不能（保険でも取得できず）', orderData);
            return null;
          }

          // 3) ルックアップ・発注先補完（案件管理→発注先）
          const after = await client.record.getRecord({ app: APP_ID, id });
          const vendor = after.record['発注先']?.value;
          const matterId = after.record['案件管理レコードID']?.value;

          if (!vendor && matterId) {
            console.warn(`⚠️ 発注先空欄 → 案件管理(${matterId})から補完`);
            const matter = await client.record.getRecord({ app: HC_APP_ID_MATTER, id: matterId });
            const autoVendor = matter.record['発注先']?.value;
            if (autoVendor) {
              await client.record.updateRecord({
                app: APP_ID,
                id,
                record: { 発注先: { value: autoVendor } },
              });
              console.log('✅ 発注先自動補完成功:', autoVendor);
            }
          }

          return id;
        } catch (e) {
          console.error('❌ addOrderRecord エラー', e, orderData);
          throw e;
        }
      };

      // 出荷管理のレコードを取得
      const queryBEAUTH = '掲載媒体名 = "eecoto" ' + 'and 注文日 >= LAST_MONTH() ' + 'and 数量 >= 1 ' + 'and 発注数管理にカウント not in ("済")';
      let shippingManageRecords = await GetAllRecords(HC_APP_ID_SHIPPING_BEAUTH, queryBEAUTH);
      console.log('出荷管理のレコード', shippingManageRecords);

      // 案件管理のレコードを取得
      let matterRecords = await GetAllRecords(HC_APP_ID_MATTER, '掲載媒体名 = "eecoto" and 案件グループID != ""');
      console.log('案件管理のレコード', matterRecords);

      // セット数管理のレコードを取得
      let setNumberRecords = await GetAllRecords(HC_APP_ID_SET_NUMBER);
      console.log('セット数管理のレコード', setNumberRecords);

      // 発注数管理のレコードを取得
      let orderNumberRecords = await GetAllRecords(APP_ID, '日付 >= LAST_MONTH()');
      console.log('発注数管理のレコード', orderNumberRecords);
      let arrAllOrderNums = [];

      /* 出荷管理のフィールド
            SKU：案件グループID
            注文日
            数量
            */

      // 出荷管理のレコードを案件グループIDでグループ化
      let groupedShippingRecords = shippingManageRecords.reduce((acc, rec) => {
        const key = rec.SKU.value;
        if (!acc[key]) acc[key] = [];
        acc[key].push(rec);
        return acc;
      }, {}); // 案件グループIDでグループ化
      console.log('案件グループID(SKU)でグループ化された出荷管理のレコード', groupedShippingRecords);
      // 案件グループIDでループ
      for (const groupId in groupedShippingRecords) {
        // 🧱 案件グループIDが空・null・undefined の場合はスキップ
        if (!groupId || groupId.trim() === '') {
          console.warn('⚠ 案件グループIDが空の出荷レコードをスキップ:', groupedShippingRecords[groupId]);
          continue;
        }

        let shippingRecs = groupedShippingRecords[groupId];

        // 注文日ごとの数量を取得
        let arrAmount = [];
        for (let ii = 0; ii < shippingRecs.length; ii++) {
          let shippingRec = shippingRecs[ii];
          let orderDate = shippingRec.注文日.value;
          let orderQuantity = shippingRec.数量.value;
          arrAmount.push({ 注文日: orderDate, 数量: orderQuantity });

          // カウント済みにする
          shippingRec.発注数管理にカウント.value = '済';
        }

        arrAllOrderNums.push({ 案件グループID: groupId, 注文日ごとの数量: arrAmount });
      }
      console.log('注文日ごとの数量', arrAllOrderNums);

      /* 発注数管理に必要なフィールド
            案件管理レコードID
            セット数管理ID
            最短賞味期限
            日付
            day_1～day_31
            最終申込日
            */

      let updateRecords = [];
      console.log('出荷管理のレコード', shippingManageRecords);
      for (let ii = 0; ii < arrAllOrderNums.length; ii++) {
        let shippingRec = arrAllOrderNums[ii];
        // 案件レコードを取得

        let matRec = matterRecords.find((rec) => {
          const skuShipping = String(shippingRec.案件グループID || '').trim(); // 出荷管理側
          const skuMatter = String(rec.案件グループID.value || '').trim(); // 案件管理側
          const mediaMatter = String(rec.掲載媒体名.value || '').toLowerCase(); // 案件管理の媒体名
          const mediaCode = MEDIA_CODE.toLowerCase(); // 固定コード

          return skuMatter === skuShipping && mediaMatter === mediaCode;
        });
        if (!matRec) {
          console.warn(`❌ 案件マッチ失敗: SKU=${shippingRec.案件グループID} / MEDIA=${MEDIA_CODE}（案件管理に該当媒体なし）`);
          console.log(
            '案件管理サンプル:',
            matterRecords.slice(0, 3).map((r) => ({
              案件グループID: r.案件グループID.value,
              掲載媒体名: r.掲載媒体名.value,
            }))
          );
          continue;
        }

        for (let jj = 0; jj < shippingRec.注文日ごとの数量.length; jj++) {
          // 生の注文日文字列を取得
          let rawDate = (shippingRec.注文日ごとの数量[jj].注文日 || '').trim();

          // ISO形式（例: 2025-10-23）としてパース
          let dtOrder = luxon.DateTime.fromISO(rawDate, { zone: 'Asia/Tokyo' });

          // ISO形式で無効なら、スラッシュ区切り（例: 2025/10/23）も試す
          if (!dtOrder.isValid) {
            dtOrder = luxon.DateTime.fromFormat(rawDate, 'yyyy/MM/dd');
          }

          // それでも無効なら、年号付きなどのパターンも試す（任意）
          if (!dtOrder.isValid) {
            dtOrder = luxon.DateTime.fromFormat(rawDate, 'yyyy年MM月dd日');
          }

          // まだ無効ならエラーログ出してスキップ
          if (!dtOrder.isValid) {
            console.warn(`❌ 無効な注文日フォーマット: "${rawDate}" (案件グループID: ${shippingRec.案件グループID})`);
            continue;
          }

          // ✅ 異常日付チェック（月が1〜12以外・日が1〜31以外）
          if (dtOrder.month < 1 || dtOrder.month > 12 || dtOrder.day < 1 || dtOrder.day > 31) {
            console.warn('注文日の月または日が異常です:', rawDate, '(month:', dtOrder.month, ', day:', dtOrder.day, ')');
            continue;
          }

          // === ここを追加 ===
          let dtFirst = dtOrder.startOf('month');

          // Luxonの有効性チェック
          if (!dtFirst.isValid) {
            console.warn('⚠ dtFirstが無効です:', rawDate, dtFirst.invalidExplanation);
            continue;
          }

          // 発注数管理から案件グループID＆日付でレコードを取得（堅牢化）
          let orderNumberRec = orderNumberRecords.find((rec) => {
            const orderMatterId = String(rec.案件管理レコードID?.value || '').trim(); // 発注数管理の案件管理レコードID
            const matterId = String(matRec.$id?.value || '').trim(); // 案件管理のID
            const dateValue = String(rec.日付?.value || '');
            return orderMatterId === matterId && dateValue === dtFirst.toFormat('yyyy-MM-dd');
          });
          if (!orderNumberRec) {
            const newId = await addOrderRecord({
              案件管理レコードID: { value: String(matRec.$id.value) },
              日付: { value: dtFirst.toFormat('yyyy-MM-dd') },

              // ▼オプション：重複防止のための一意キーを作るなら
              // ソースID: { value: `${matRec.$id.value}_${dtFirst.toFormat('yyyy-MM')}` },

              // ▼day_1〜day_31 をゼロ初期化したい場合（任意）
              // ...Object.fromEntries(Array.from({length:31}, (_,i)=>[`day_${i+1}`, {value: 0}])),
            });

            if (!newId) {
              console.warn('⚠ 新規レコード作成に失敗。次の注文日に進みます');
              continue;
            }

            const newRec = await client.record.getRecord({ app: APP_ID, id: newId });
            orderNumberRecords.push(newRec);
            orderNumberRec = newRec;
          }

          /* 発注数管理に販売数を加算（未定義でも0扱い） */

          // ✅ recData補正（recordが無い場合も考慮）
          const recData = orderNumberRec?.record ?? orderNumberRec;
          if (!recData) {
            console.warn('orderNumberRec が不正：', orderNumberRec);
            continue;
          }

          // ✅ 日付の日（1〜31）
          const numDay = dtOrder.get('day');

          // ✅ day_X フィールドが存在しない場合 0 を初期化
          const dayKey = `day_${numDay}`;
          if (!recData[dayKey]) {
            recData[dayKey] = { value: 0 };
          }

          // ✅ recordオブジェクトが無いケースに強制付与
          if (!recData.$id && orderNumberRec?.id) {
            recData.$id = { value: orderNumberRec.id };
          }

          const addQty = Number(shippingRec.注文日ごとの数量[jj].数量 || 0);
          const current = Number(recData[`day_${numDay}`]?.value || 0);
          recData[`day_${numDay}`] = { value: current + addQty };

          console.log('更新後の発注数管理のレコード', orderNumberRec);
          console.log('更新対象レコード数:', updateRecords.length);

          console.log('--- 発注数管理更新チェック ---');
          console.log('orderNumberRec:', orderNumberRec);

          // null 安全化 & デバッグ補助
          const safe案件管理レコードID = orderNumberRec?.record?.案件管理レコードID?.value ?? orderNumberRec?.案件管理レコードID?.value ?? '(未設定)';
          console.log('案件管理レコードID:', safe案件管理レコードID);

          console.log('注文日:', rawDate);
          console.log(
            '更新対象dayフィールド:',
            Object.keys(recData).filter((k) => k.startsWith('day_'))
          );
          console.log('追加数量(addQty):', addQty);
          console.log('更新前updateRecords件数:', updateRecords.length);

          // ✅ 再宣言せず、そのまま再利用
          const recordId = recData?.$id?.value || recData?.record?.$id?.value || recData?.id;
          if (!recordId) {
            console.warn('⚠ レコードIDが未定義のためスキップ:', recData);
            continue;
          }

          const dayFields = {};
          for (let i = 1; i <= 31; i++) {
            const key = `day_${i}`;
            if (recData[key]?.value !== undefined) {
              dayFields[key] = { value: recData[key].value };
            }
          }
          const existing = updateRecords.findIndex((r) => r.id === recordId);
          if (existing >= 0) {
            Object.assign(updateRecords[existing].record, dayFields);
          } else {
            if (existing >= 0) {
              Object.assign(updateRecords[existing].record, dayFields);
            } else {
              updateRecords.push({
                id: recordId,
                record: { ...dayFields }, // ←二重にならない指定
              });
            }
          }

          // === 更新後の状態確認 ===
          console.log('更新後updateRecords件数:', updateRecords.length);
          console.log('直近の更新対象:', updateRecords[updateRecords.length - 1]);
        }
      }

      // 発注数管理の更新用のデータを生成
      let upOrderNumData = [];
      for (let ii = 0; ii < updateRecords.length; ii++) {
        let recObj = updateRecords[ii];
        const recordId = recObj.id;
        const rec = recObj.record;
        const days = {};
        for (let i = 1; i <= 31; i++) {
          days[`day_${i}`] = { value: Number(rec[`day_${i}`]?.value || 0) };
        }
        if (!recordId) {
          console.warn('⚠ レコードIDが未定義のためスキップ:', rec);
          continue;
        }
        // --- 更新対象に追加 ---
        upOrderNumData.push({
          id: recordId,
          record: days,
        });
      }

      console.log('更新する発注数管理のレコード', upOrderNumData);
      // 発注数管理のレコードを更新
      const chunkSize = 100;
      for (let i = 0; i < upOrderNumData.length; i += chunkSize) {
        const chunk = upOrderNumData.slice(i, i + chunkSize);
        try {
          await client.record.updateAllRecords({ app: APP_ID, records: chunk });
        } catch (err) {
          console.error('updateAllRecords失敗:', err);
          for (const rec of chunk) {
            try {
              await client.record.updateRecord({ app: APP_ID, id: rec.id, record: rec.record });
            } catch (subErr) {
              console.warn('個別更新失敗:', rec.id, subErr);
            }
          }
        }
      }

      // 出荷管理の更新用のデータを生成
      let upShippingData = [];
      for (let ii = 0; ii < shippingManageRecords.length; ii++) {
        let rec = shippingManageRecords[ii];
        if (rec.発注数管理にカウント.value !== '済') continue;

        if (!rec.$id?.value && !rec.id) {
          console.warn('出荷管理IDが不明なためスキップ:', rec);
          continue;
        }

        upShippingData.push({
          id: rec.$id?.value || rec.id,
          record: {
            発注数管理にカウント: { value: '済' },
          },
        });
      }

      console.log('更新する出荷管理のレコード', upShippingData);
      // 出荷管理のレコードを更新
      const chunkSizeShipping = 100;
      for (let i = 0; i < upShippingData.length; i += chunkSizeShipping) {
        const chunk = upShippingData.slice(i, i + chunkSizeShipping);
        await client.record.updateAllRecords({
          app: HC_APP_ID_SHIPPING_BEAUTH,
          records: chunk,
        });
      }

      resParam.message = 'BEAUTHの注文数を収集しました。';
    } catch (error) {
      console.log(error);
      resParam.message = 'BEAUTHの注文数の取得に失敗しました。';
    } finally {
      spinner.close();
      await Swal.fire({
        title: 'BEAUTHの注文数の収集',
        text: resParam.message,
      });
      location.reload();
    }
  };

  /**
   * 一覧表示イベント
   * @returns
   */
  kintone.events.on('app.record.index.show', async (event) => {
    if (event.viewId != 6428024) return event;

    // ボタン
    if (document.getElementById('hc_button_1') !== null) return;
    var button1 = document.createElement('button');
    button1.id = 'hc_button_1';
    button1.classList.add('kintoneplugin-button-normal');
    button1.innerText = '出荷管理BEAUTHから発注数を収集';
    kintone.app.getHeaderMenuSpaceElement().appendChild(button1);

    button1.onclick = async () => {
      resParam = { status: 1, message: '' };
      await GatherShippingManageRecords_Main();
    };

    return event;
  });
})();
