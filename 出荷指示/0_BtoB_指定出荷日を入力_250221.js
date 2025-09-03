/**
 * 全媒体or媒体を選択し、指定出荷日を指定する
 */
(() => {
  'use strict';
  luxon.Settings.defaultLocale = 'ja';
  // --- load marker for debugging ---
  console.log('[BtoB v2] 指定出荷日スクリプト 読み込みOK');

  const client = new KintoneRestAPIClient();
  const APP_ID = kintone.app.getId();
  const HC_APP_ID_IN_OUT_MANAGE = HC.apps.入出庫管理.id;

  const SDGs_GROUP_MALL_NAME = {
    Pontaパス: ['au', 'Pontaパス'],
    Vサンプル: ['Tサンプル', 'Vサンプル'],
  };

  const HC_MEMBER = ['kiyo@happy-campaign.co.jp', 'sae.seki', 'hc-assistant'];
  // 取引区分のフィールドコード（アプリのフィールドコードに合わせる）
  const TRADE_TYPE_FIELD = '取引形式';

  let mallList = {};

  let resParam = { status: 1, message: '' };

  /**
   * 入出庫管理に登録用のデータを生成
   * @param {*} records
   * @param {*} b2bArrivalDate
   */
  const CreateInOutManageData = async (records, b2bArrivalDate) => {
    let addData = [];
    let recOrg = {};
    recOrg['タイプ'] = { value: '納品' };
    recOrg['倉庫ID'] = { value: 105 };
    recOrg['納品ステータス'] = { value: '納品前' };
    recOrg['納品予定日'] = { value: b2bArrivalDate };
    for (let ii = 0; ii < records.length; ii++) {
      let record = records[ii];

      let itemsTable = record['商品情報'].value;
      for (let jj = 0; jj < itemsTable.length; jj++) {
        let item = itemsTable[jj].value;
        if (item['商品コード'].value === null || item['商品コード'].value === '') {
          continue;
        }

        // 有効な行なのでrecOrgをコピー
        let recData = { ...recOrg };

        recData['商品コード'] = { value: item['商品コード'].value };
        recData['発注バラ数'] = { value: Number(item['個数'].value) };
        recData['発注時の賞味期限'] = { value: item['賞味期限'].value };

        addData.push(recData);
      }
    }

    // 生成件数のログ（デバッグ用）
    console.log('[入出庫-生成] addData件数:', addData.length);
    if (addData.length > 0) {
      console.debug('[入出庫-生成サンプル(先頭)]', addData[0]);
    }
    return addData;
  };

  /**
   * 指定出荷日を設定する Main
   * @param {*} mallName
   * @param {*} shippingDate
   * @returns
   */
  const SetShippingDate_Main = async (mallName, shippingDate, tradeType) => {
    try {
      console.log('[BtoB v2] SetShippingDate_Main start:', { mallName, shippingDate, tradeType });
      resParam.status = 1;

      // 対象のモール
      let malls = SDGs_GROUP_MALL_NAME[mallName];
      if (mallName == '全媒体') {
        malls = Object.values(SDGs_GROUP_MALL_NAME).flat();
      }

      // 対象媒体ログ
      console.log('[BtoB] 選択媒体:', mallName);
      // 展開後の媒体一覧
      console.log('[BtoB] 展開媒体一覧:', malls);

      if (!malls || malls.length === 0) {
        console.warn('[BtoB] 対象媒体の展開結果が空です。キー名の誤りや未対応媒体の可能性:', mallName);
        resParam.message = `対象媒体（${mallName}）が未対応のため処理を中断しました。`;
        await Swal.fire({ icon: 'warning', title: '対象媒体なし', text: resParam.message });
        return; // ← ここで確実に終了
      }

      // 対象のレコードを取得
      let targetRecords = [];
      for (let ii = 0; ii < malls.length; ii++) {
        let mall = malls[ii];
        const base = kintone.app.getQueryCondition() || '';
        const condMall = `掲載媒体名 = "${mall}"`;
        let condTrade = '';
        if (tradeType === '買取' || tradeType === '受発注') {
          condTrade = `${TRADE_TYPE_FIELD} = "${tradeType}"`;
        } else if (tradeType === '両方') {
          // OR 条件（どちらか一致）
          condTrade = `${TRADE_TYPE_FIELD} in ("買取","受発注")`;
        }
        const condition = [base, condMall, condTrade].filter(Boolean).join(' and ');
        console.log('[BtoB] 取得条件:', condition);
        let records = await client.record.getAllRecords({ app: APP_ID, condition });
        targetRecords.push(...records);
      }

      // 対象レコード件数ログ
      console.log('[BtoB] 対象レコード件数:', targetRecords.length);

      if (targetRecords.length == 0) {
        resParam.message = '指定出荷日を設定するレコードがありません。';
        return;
      }

      // 出荷指示のレコード更新用のデータを生成
      let upData = [];
      console.log('[出荷指示-更新準備] 対象件数:', targetRecords.length);
      for (let ii = 0; ii < targetRecords.length; ii++) {
        let record = targetRecords[ii];
        upData.push({ id: record.レコード番号.value, record: { 指定出荷日: { value: shippingDate } } });
      }

      // 出荷指示のレコードを更新（ログ＋例外捕捉）
      let resp;
      try {
        console.log('[出荷指示-更新開始] 更新件数:', upData.length);
        resp = await client.record.updateAllRecords({ app: APP_ID, records: upData });
        console.log('[出荷指示-更新成功] 件数:', resp.records?.length, resp);
      } catch (e) {
        console.error('[出荷指示-更新失敗]', e);
        resParam.message = '指定出荷日の設定に失敗しました。（出荷指示の更新エラー）';
        await Swal.fire({
          icon: 'error',
          title: '指定出荷日を設定',
          text: resParam.message,
        });
        return;
      }

      if (resp.records && resp.records.length > 0) {
        resParam.message = '指定出荷日を設定しました。';

        // B2B納品予定日
        let b2bArrivalDate = luxon.DateTime.fromFormat(shippingDate, 'yyyy-MM-dd').plus({ days: 1 }).toFormat('yyyy-MM-dd');

        // 入出庫管理に登録用のデータを生成
        let addData = await CreateInOutManageData(targetRecords, b2bArrivalDate);

        // 生成結果をログ
        console.log('[入出庫-生成件数]', addData.length);
        if (addData.length === 0) {
          console.warn('[入出庫-警告] 生成データが0件。商品情報不足や個数0の可能性');
          resParam.message = '指定出荷日は設定しましたが、入出庫に登録する明細が生成されませんでした（商品情報の不足がないかご確認ください）。';
          await Swal.fire({
            icon: 'warning',
            title: '入出庫登録データなし',
            text: resParam.message,
          });
          return;
        }

        // 入出庫管理に登録（ログ＋例外捕捉）
        let respInOut;
        try {
          console.log('[入出庫-登録開始] 送信件数:', addData.length);
          respInOut = await client.record.addAllRecords({ app: HC_APP_ID_IN_OUT_MANAGE, records: addData });
          console.log('[入出庫-登録成功] 登録件数:', respInOut.records?.length, respInOut);
          if (respInOut.records && respInOut.records.length > 0) {
            resParam.message = '指定出荷日を設定し、入出庫管理に登録しました。';
          } else {
            console.warn('[入出庫-登録結果空] addAllRecordsの戻りが空');
            resParam.message = '指定出荷日は設定しましたが、入出庫管理の登録結果が空でした。';
          }
        } catch (error) {
          console.error('[入出庫-登録失敗]', error);
          resParam.message = '指定出荷日は設定しましたが、入出庫管理の登録でエラーが発生しました。詳細はコンソールをご確認ください。';
        }
      } else {
        resParam.message = '指定出荷日の設定に失敗しました。';
      }
    } catch (ex) {
      console.log(ex);
      resParam.message = '指定出荷日の設定に失敗しました。\n\n' + ex.message;
    } finally {
      await Swal.fire({
        title: '指定出荷日を設定',
        text: resParam.message,
      });
    }
  };

  kintone.events.on('app.record.index.show', async function (event) {
    console.log('[BtoB v2] index.show start: viewId=', event.viewId, 'url view=', new URL(location.href).searchParams.get('view'));
    const headerMenu = kintone.app.getHeaderMenuSpaceElement && kintone.app.getHeaderMenuSpaceElement();
    const headerSpace = kintone.app.getHeaderSpaceElement && kintone.app.getHeaderSpaceElement();
    console.log('[BtoB v2] headerMenu=', !!headerMenu, 'headerSpace=', !!headerSpace);
    if (event.viewId != 6428141) {
      console.warn('[BtoB v2] 非対象ビューのため終了: ', event.viewId);
      return event;
    }
    if (!HC_MEMBER.includes(kintone.getLoginUser().code)) {
      console.warn('[BtoB v2] HC_MEMBER 未登録のため本来は非表示ですが、デバッグのため表示を許可します。code:', kintone.getLoginUser().code);
      // return event; // ← 本番に戻すときはコメントアウトを外す
    }

    mallList = Object.keys(SDGs_GROUP_MALL_NAME).reduce((obj, key) => {
      obj[key] = key;
      return obj;
    }, {});
    mallList['全媒体'] = '全媒体';

    // ボタン
    // 既存の同名ボタン（他スクリプトが作ったもの）を掃除して衝突を避ける
    (() => {
      const header = kintone.app.getHeaderMenuSpaceElement();
      if (!header) return;
      const texts = ['指定出荷日を入力'];
      const btns = Array.from(header.querySelectorAll('button'));
      btns.forEach((b) => {
        if (texts.includes((b.textContent || '').trim()) && b.id !== 'hc_button_shipdate') {
          console.log('[BtoB v2] 旧ボタンを削除:', b);
          b.remove();
        }
      });
    })();

    // ボタンを取得 or 作成し、常に自分のハンドラに差し替える
    let button1 = document.getElementById('hc_button_shipdate');
    if (!button1) {
      button1 = document.createElement('button');
      button1.id = 'hc_button_shipdate';
      button1.classList.add('kintoneplugin-button-normal');
      button1.innerText = '指定出荷日を入力';
      kintone.app.getHeaderMenuSpaceElement().appendChild(button1);
      button1.innerText = '媒体別 指定出荷日を入力（v2）'; // 一時的な目印
      button1.type = 'button';
      console.log('[BtoB v2] ボタンを新規作成');
    } else {
      console.log('[BtoB v2] 既存ボタンを取得しハンドラを差し替え');
    }

    // 既存の onclick を上書きして当スクリプトの処理を必ず起動
    const handleShipDateClick = async (ev) => {
      // 二重起動ガード（連打/多重バインド対策）
      if (button1.dataset.hcBusy === '1') return;
      button1.dataset.hcBusy = '1';

      try {
        // クリック時の掃除（そのまま）
        (() => {
          const header = kintone.app.getHeaderMenuSpaceElement();
          if (!header) return;
          Array.from(header.querySelectorAll('button')).forEach((b) => {
            if ((b.textContent || '').trim() === '指定出荷日を入力' && b.id !== 'hc_button_shipdate') b.remove();
          });
        })();

        console.log('[BtoB v2] ボタン押下を検知');

        const { value: targetMall } = await Swal.fire({
          title: '出荷日を指定する媒体を選択',
          input: 'select',
          inputOptions: mallList,
          inputPlaceholder: '媒体を選択してください',
          showCancelButton: true,
          inputValidator: (value) => new Promise((resolve) => resolve(value ? undefined : 'どちらかを選択してください')),
        });
        if (!targetMall) {
          resParam.message = '媒体の選択がキャンセルされました。';
          await Swal.fire({ title: '出荷日を指定', text: resParam.message, timer: 5000, timerProgressBar: true });
          return;
        }

        // 区分の選択（買取 / 受発注 / 両方 = OR）
        const tradeOptions = { 両方: '両方', 買取: '買取', 受発注: '受発注' };
        const { value: tradeType } = await Swal.fire({
          title: '対象の区分を選択',
          input: 'select',
          inputOptions: tradeOptions,
          inputValue: '両方',
          inputPlaceholder: '区分を選択してください',
          showCancelButton: true,
          inputValidator: (v) => new Promise((r) => r(v ? undefined : 'どちらかを選択してください')),
        });
        if (!tradeType) {
          resParam.message = '区分の選択がキャンセルされました。';
          await Swal.fire({ title: '区分選択', text: resParam.message, timer: 5000, timerProgressBar: true });
          return;
        }

        const { value: shippingDate } = await Swal.fire({
          title: '指定出荷日を入力',
          text: '指定出荷日を入力してください。',
          icon: 'question',
          input: 'date',
          inputAttributes: { min: luxon.DateTime.local().toFormat('yyyy-MM-dd') },
          showCancelButton: true,
        });
        if (!shippingDate) {
          resParam.message = '指定出荷日の入力がキャンセルされました。';
          await Swal.fire({ title: '指定出荷日を入力', text: resParam.message, timer: 5000, timerProgressBar: true });
          return;
        }

        await SetShippingDate_Main(targetMall, shippingDate, tradeType);
      } finally {
        button1.dataset.hcBusy = '0';
      }
    };
    // 旧ボタンが押されてもログだけは拾う（処理は止めない）
    const header = kintone.app.getHeaderMenuSpaceElement && kintone.app.getHeaderMenuSpaceElement();
    if (header && !header.dataset.hcLogHooked) {
      header.addEventListener(
        'click',
        (ev) => {
          const t = ev.target;
          const label = (t.textContent || '').trim();
          if (label === '指定出荷日を入力' && t.id !== 'hc_button_shipdate') {
            console.log('[BtoB v2] 旧ボタンがクリックされました（v2ハンドラ未経由）', t);
            // 旧処理はそのまま動かす（stopしない）
          }
        },
        true
      ); // captureで先取り
      header.dataset.hcLogHooked = '1';
    }
    // v2ボタンのクリックは capture フェーズで1本化（二重発火防止）
    if (button1.dataset.hcBound !== '1') {
      button1.addEventListener('click', handleShipDateClick, { capture: true });
      button1.dataset.hcBound = '1';
    }
    // 任意でログを残したい場合は↓を追加
    // button1.addEventListener('click', () => console.log('[BtoB v2] capture でクリック検知'), { capture: true });
    // ヘッダ以外に旧ボタンが配置されているケースも検知（document 全体で捕捉）
    if (!window.__hcGlobalClickHook) {
      window.__hcGlobalClickHook = true;
      document.addEventListener(
        'click',
        (ev) => {
          const el = ev.target && (ev.target.closest ? ev.target.closest('button,a') : null);
          if (!el) return;
          const label = (el.textContent || '').trim();
          if (label === '指定出荷日を入力' && el.id !== 'hc_button_shipdate') {
            console.log('[BtoB v2] 旧ボタンがクリックされました（v2ハンドラ未経由 / document捕捉）', el);
            // 旧処理は止めない（ログのみ）
          }
        },
        true
      ); // captureで先取り
      console.log('[BtoB v2] document capture フックを設定しました');
    }
  });
})();
