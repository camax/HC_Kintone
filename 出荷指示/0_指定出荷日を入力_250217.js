/**
 * 全媒体or媒体を選択し、指定出荷日を指定する
 */
(() => {
  'use strict';
  luxon.Settings.defaultLocale = 'ja';

  const client = new KintoneRestAPIClient();
  const APP_ID = kintone.app.getId();
  const APP_ID_MALL_MASTER = HC.apps.掲載媒体マスタ.id;

  const HC_MEMBER = ['kiyo@happy-campaign.co.jp', 'sae.seki', 'hc-assistant'];
  const BUTTON_ID = 'hc_button_shipdate_INDEX6428047';
  const BUTTON_LABEL = '媒体別 指定出荷日を入力（一般）'; // 旧BtoBと衝突しない固有ラベル

  // 区分の選択肢（モーダル表示用）
  const TRADE_OPTIONS = {
    両方: '両方', // (= 買取 OR 受発注)
    買取: '買取',
    受発注: '受発注',
  };

  let mallList = {};

  let resParam = { status: 1, message: '' };

  /**
   * 指定出荷日を設定する Main
   * @param {*} mallName
   * @param {*} shippingDate
   * @returns
   */
  const SetShippingDate_Main = async (mallName, tradeType, shippingDate) => {
    console.log('[INDEX6428047] SetShippingDate_Main start:', { mallName, tradeType, shippingDate });
    try {
      resParam.status = 1;

      // 対象のモール
      let malls = [mallName];
      if (mallName == '全媒体') {
        malls = Object.keys(mallList).filter((mall) => mall !== '全媒体');
      }

      // 対象のレコードを取得（区分条件を追加）
      let targetRecords = [];
      for (let ii = 0; ii < malls.length; ii++) {
        const mall = malls[ii];

        // 区分条件の生成
        let tradeCond = '';
        if (tradeType === '両方') {
          tradeCond = ' and 取引形式 in ("買取","受発注")';
        } else if (tradeType === '買取' || tradeType === '受発注') {
          tradeCond = ` and 取引形式 = "${tradeType}"`;
        }

        // 画面の絞り込み + 媒体 + 区分
        const cond = `${kintone.app.getQueryCondition()} and 掲載媒体名 = "${mall}"${tradeCond}`;
        console.log('[INDEX6428047] 取得条件:', cond);

        const records = await client.record.getAllRecords({ app: APP_ID, condition: cond });
        targetRecords.push(...records);
      }
      console.log('[INDEX6428047] 対象レコード件数（合計）:', targetRecords.length);

      if (targetRecords.length == 0) {
        resParam.message = '指定出荷日を設定するレコードがありません。';
        return;
      }

      // 更新用のデータを生成
      let upData = [];
      for (let ii = 0; ii < targetRecords.length; ii++) {
        let record = targetRecords[ii];
        upData.push({ id: record.レコード番号.value, record: { 指定出荷日: { value: shippingDate } } });
      }

      // 更新
      let resp = await client.record.updateAllRecords({ app: APP_ID, records: upData });
      if (resp.records.length > 0) {
        resParam.message = '指定出荷日を設定しました。';
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
        willClose: () => {
          location.reload(true);
        },
      });
    }
  };

  kintone.events.on('app.record.index.show', async function (event) {
    console.log('[INDEX6428047] start', {
      viewId: event.viewId,
      userCode: (function () {
        try {
          return kintone.getLoginUser().code;
        } catch (e) {
          return '(NG)';
        }
      })(),
      headerMenu: !!kintone.app.getHeaderMenuSpaceElement(),
      btnExists: !!document.getElementById(BUTTON_ID),
    });
    // --- [IF#1] 対象ビュー判定（6428047 以外なら何もしない）---
    if (event.viewId != 6428047) {
      console.log('[INDEX6428047] not target view -> exit', event.viewId);
      return event;
    }
    // --- [IF#2] 権限（許可ユーザー）判定 ---
    if (!HC_MEMBER.includes(kintone.getLoginUser().code)) {
      console.log('[INDEX6428047] not allowed user -> exit', kintone.getLoginUser().code);
      return event;
    }

    // 掲載媒体名の一覧を取得（ログ＆ガード付き）
    console.log('[INDEX6428047] step A: before fetch mall master');
    let mallRecords;
    try {
      mallRecords = await client.record.getAllRecords({
        app: APP_ID_MALL_MASTER,
        condition: '状態 not in ("無効") and グループ not in ("SDGs")',
      });
      console.log('[INDEX6428047] step B: mall master fetched', { count: mallRecords.length });
    } catch (e) {
      console.error('[INDEX6428047] mall master fetch FAILED', e);
      // 取得に失敗しても、後続のUI確認をできるよう空配列で継続
      mallRecords = [];
    }

    mallList = Object.fromEntries(mallRecords.map((record) => [record.掲載媒体名.value, record.掲載媒体名.value]));
    mallList['全媒体'] = '全媒体';
    console.log('[INDEX6428047] step C: mallList ready', { keys: Object.keys(mallList) });

    // --- [IF#3] ボタンを「必ず」存在させる（自己復活）---
    const ensureIndexButton = () => {
      const header = kintone.app.getHeaderMenuSpaceElement && kintone.app.getHeaderMenuSpaceElement();
      if (!header) {
        console.warn('[INDEX6428047] header is null -> retry later');
        return null;
      }
      let btn = document.getElementById(BUTTON_ID);
      if (!btn) {
        console.log('[INDEX6428047] step D: create button start');
        btn = document.createElement('button');
        btn.id = BUTTON_ID;
        btn.type = 'button';
        btn.classList.add('kintoneplugin-button-normal');
        btn.textContent = BUTTON_LABEL;
        header.appendChild(btn);
        console.log('[INDEX6428047] step E: button appended');
      }
      // 二重バインド防止
      if (btn && btn.dataset.hcBound !== '1') {
        btn.onclick = async () => {
          console.log('[INDEX6428047] step F: button clicked');
          const { value: targetMall } = await Swal.fire({
            title: '出荷日を指定する媒体を選択',
            input: 'select',
            inputOptions: mallList,
            inputPlaceholder: '媒体を選択してください',
            showCancelButton: true,
            inputValidator: (value) => new Promise((resolve) => resolve(value ? undefined : 'どちらかを選択してください')),
          });
          if (!targetMall) {
            console.log('[INDEX6428047] step F1: targetMall =', targetMall);
            resParam.message = '媒体の選択がキャンセルされました。';
            await Swal.fire({ title: '出荷日を指定', text: resParam.message, timer: 5000, timerProgressBar: true });
            return;
          }

          // --- 区分の選択（追加）---
          const { value: tradeType } = await Swal.fire({
            title: '対象の区分を選択',
            input: 'select',
            inputOptions: TRADE_OPTIONS, // 先頭で定義済み（両方/買取/受発注）
            inputValue: '両方', // 既定は「両方」
            inputPlaceholder: '区分を選択してください',
            showCancelButton: true,
            inputValidator: (value) => new Promise((resolve) => resolve(value ? undefined : 'どちらかを選択してください')),
          });
          if (!tradeType) {
            console.log('[INDEX6428047] step F1.5: tradeType =', tradeType);
            resParam.message = '区分の選択がキャンセルされました。';
            await Swal.fire({ title: '対象の区分を選択', text: resParam.message, timer: 5000, timerProgressBar: true });
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
            console.log('[INDEX6428047] step F2: shippingDate =', shippingDate);
            resParam.message = '指定出荷日の入力がキャンセルされました。';
            await Swal.fire({ title: '指定出荷日を入力', text: resParam.message, timer: 5000, timerProgressBar: true });
            return;
          }

          await SetShippingDate_Main(targetMall, tradeType, shippingDate);
        };
        btn.dataset.hcBound = '1';
      }
      return btn;
    };

    // まず即時実行（初回描画）
    const __btn = ensureIndexButton();

    // ヘッダが書き換わってボタンが消されても、即座に復活させる
    (() => {
      const header = kintone.app.getHeaderMenuSpaceElement && kintone.app.getHeaderMenuSpaceElement();
      if (!header) return;
      if (header.dataset.hcWatch === '1') return; // 二重監視防止
      const mo = new MutationObserver(() => {
        if (!document.getElementById(BUTTON_ID)) {
          console.warn('[INDEX6428047] button disappeared -> re-append');
          ensureIndexButton();
        }
      });
      mo.observe(header, { childList: true });
      header.dataset.hcWatch = '1';
    })();

    // 描画タイミング競合の保険：少し遅らせてもう一度確実に配置
    setTimeout(ensureIndexButton, 0);
    setTimeout(ensureIndexButton, 500);
  });
})();
