/**
 * 案件ごとの発注数の推移を表示
 * ・案件グループIDでセット数管理のレコードを取得
 * ・セット数管理のレコードから総セット数と残セット数を取得
 * ・総セット数と残セット数をスプレッドシートに表示
 */
(() => {
  'use strict';
  luxon.Settings.defaultLocale = 'ja';

  const client = new KintoneRestAPIClient();
  const HC_THIS_APP_URL = location.origin + '/k/' + kintone.app.getId() + '/';
  const HC_ORDER_AMOUNT_MANAGE_APP_ID = kintone.app.getId();
  const HC_SET_NUMBER_APP_ID = HC.apps.掲載セット数管理.id;
  const HC_MATTER_APP_ID = HC.apps.案件管理.id;

  const spinner = new Kuc.Spinner({
    text: '処理中...',
    container: document.body,
  });

  let resParam = { status: 1, message: '' };
  let spSheet = null;
  let dtNow = luxon.DateTime.local().startOf('day');
  let startDate = '';
  let endDate = '';
  let matterType = '';

  const arrDays = [];
  for (let ii = 28; ii >= 0; ii--) {
    let day = dtNow.minus({ days: ii });
    arrDays.push({ name: 'day_' + day.toFormat('d'), title: day.toFormat('M/d(ccc)'), width: 90, type: 'numeric', mask: '#,##0', readOnly: true, date: day });
  }

  // 表示する列情報
  const arrCols = [
    { name: '$id', title: '■', width: 36, type: 'text', readOnly: true, records: {} },
    { name: '案件グループID', title: '案件グループID', width: 150, type: 'text', readOnly: true },
    { name: '掲載媒体名', title: '掲載媒体名', width: 120, type: 'text', readOnly: true },
    { name: 'モール管理番号', title: 'モール管理番号', width: 150, type: 'text', readOnly: true },
    { name: '掲載商品名', title: '掲載商品名', width: 400, type: 'text', readOnly: true },
    { name: '月', title: '月', width: 30, type: 'checkbox', readOnly: true },
    { name: '火', title: '火', width: 30, type: 'checkbox', readOnly: true },
    { name: '水', title: '水', width: 30, type: 'checkbox', readOnly: true },
    { name: '木', title: '木', width: 30, type: 'checkbox', readOnly: true },
    { name: '金', title: '金', width: 30, type: 'checkbox', readOnly: true },
    { name: '総数', title: '総数', width: 66, type: 'numeric', mask: '#,##0', readOnly: true },
    { name: '残数', title: '残数', width: 66, type: 'numeric', mask: '#,##0', readOnly: true },
    { name: '前回発注数', title: '前回発注数', width: 100, type: 'numeric', mask: '#,##0', readOnly: true },
    { name: '申込数', title: '申込数', width: 60, type: 'numeric', mask: '#,##0' },
    { name: '発注', title: '発注', width: 40, type: 'checkbox' },
    ...arrDays,
    { name: '案件管理レコードID', title: '案件管理レコードID', width: 150, type: 'hidden', readOnly: true },
    { name: '前回発注日', title: '前回発注日', width: 110, type: 'hidden', options: { format: 'YYYY-MM-DD' }, readOnly: true },
    { name: '発注書レコードID_下書き', title: '発注書レコードID_下書き', width: 150, type: 'hidden', readOnly: true },
    { name: '発注番号_下書き', title: '発注番号_下書き', width: 150, type: 'hidden', readOnly: true },
    { name: '発注セット数_下書き', title: '発注セット数_下書き', width: 150, type: 'hidden', readOnly: true },
  ];

  /**
   * 条件にあうすべてのレコードを取得
   * @param {*} id
   * @param {*} condition
   * @param {*} order
   * @returns
   */
  const getAllRecordsWithCondition = async (id, condition = null, order = null) => {
    try {
      const records = await client.record.getAllRecords({
        app: id,
        condition: condition,
        orderBy: order,
      });
      return records;
    } catch (error) {
      resParam = { status: 9, message: 'レコードの取得中にエラーが発生しました:\n\n' + error.message };
      return [];
    }
  };

  /**
   * 一覧のレコードを案件管理レコードIDでグループ化
   * @param {*} records
   * @returns
   */
  const getGroupedRecords = (records) => {
    // 一覧のレコードを案件管理レコードIDでグループ化
    const firstDayOfThisMonth = luxon.DateTime.local().startOf('month');
    const firstDayOfLastMonth = firstDayOfThisMonth.minus({ months: 1 });

    const groupedRecords = records.reduce((acc, record) => {
      const recordId = record.案件管理レコードID.value;
      if (!acc[recordId]) {
        acc[recordId] = { lastMonth: null, thisMonth: null };
      }
      const recDate = luxon.DateTime.fromISO(record.日付.value);
      if (recDate.hasSame(firstDayOfLastMonth, 'month')) {
        acc[recordId].lastMonth = record;
      } else if (recDate.hasSame(firstDayOfThisMonth, 'month')) {
        acc[recordId].thisMonth = record;
      }
      return acc;
    }, {});

    let resRecords = Object.keys(groupedRecords).map((recordId) => {
      try {
        const last = groupedRecords[recordId].lastMonth?.案件グループID?.value;
        const current = groupedRecords[recordId].thisMonth?.案件グループID?.value;
        const result = last ?? current;
        if (!result) {
          console.warn(`⚠ 案件グループIDが取得できません（案件管理レコードID: ${recordId}）`, {
            lastMonthRecord: groupedRecords[recordId].lastMonth,
            thisMonthRecord: groupedRecords[recordId].thisMonth,
            lastMonthGroupId: last,
            thisMonthGroupId: current,
          });
        }
        return {
          案件管理レコードID: recordId,
          案件グループID: result ?? '',
          先月: groupedRecords[recordId].lastMonth,
          今月: groupedRecords[recordId].thisMonth,
        };
      } catch (e) {
        console.error(`❌ 案件グループID取得中にエラー発生（案件管理レコードID: ${recordId}）`, e);
        return {
          案件管理レコードID: recordId,
          案件グループID: '',
          先月: groupedRecords[recordId].lastMonth,
          今月: groupedRecords[recordId].thisMonth,
        };
      }
    });

    return resRecords;
  };

  /**
   * 1レコード追加
   * @param {*} id
   * @param {*} rec
   * @returns
   */
  const addOneRecord = async (id, rec) => {
    try {
      const record = await client.record.addRecord({
        app: id,
        record: rec,
      });
      return record;
    } catch (error) {
      resParam = { status: 9, message: 'レコードの追加中にエラーが発生しました:\n\n' + error.message };
      return [];
    }
  };

  /**
   * 1レコード取得
   * @param {*} id
   * @param {*} recordId
   * @returns
   */
  const getOneRecord = async (id, recordId) => {
    try {
      const resp = await client.record.getRecord({
        app: id,
        id: recordId,
      });
      return resp.record;
    } catch (error) {
      resParam = { status: 9, message: 'レコードの取得中にエラーが発生しました:\n\n' + error.message };
      return [];
    }
  };

  /**
   * Spreadsheet用のデータに変換
   * @returns
   */
  const createSpreadData = async () => {
    let arrRtn = [];
    resParam = { status: 1, message: '' };

    // 発注数管理のレコードを取得
    let orderAmountRecords = await getAllRecordsWithCondition(HC_ORDER_AMOUNT_MANAGE_APP_ID, `日付 >= LAST_MONTH()`, `案件グループID asc, 掲載媒体名 asc, 掲載商品名 asc`);

    // 発注数管理のレコードを案件管理レコードIDでグループ化する
    let groupedOrderAmountRecords = getGroupedRecords(orderAmountRecords);

    // セット数管理のレコードを全て取得
    let setNumberRecords = await getAllRecordsWithCondition(HC_SET_NUMBER_APP_ID);

    // 案件管理のレコードを全て取得
    let matterRecords = await getAllRecordsWithCondition(HC_MATTER_APP_ID, matterType ? `取引形式 in ("${matterType}")` : null);

    // グループ化したレコードをループ
    for (let ii = 0; ii < groupedOrderAmountRecords.length; ii++) {
      let objRow = {};

      // 案件グループIDが一致するセット数管理のレコードを取得
      let setNumRec = setNumberRecords.find((rec) => rec.案件グループID.value == groupedOrderAmountRecords[ii].案件グループID);
      // セット数管理のレコードがない場合、作成する
      if (!setNumRec) {
        let resp = await addOneRecord(HC_SET_NUMBER_APP_ID, {
          案件グループID: { value: groupedOrderAmountRecords[ii].案件グループID },
          // 掲載依頼レコードID
          // 掲載商品名
          // 掲載商品名_その他
          案件管理にセット数を反映: { value: ['反映済み'] },
        });
        // 作成したセット数管理のレコードを取得
        setNumRec = await getOneRecord(HC_SET_NUMBER_APP_ID, resp.id);
        // 作成したセット数管理のレコードをセット数管理の配列に追加
        setNumberRecords.push(setNumRec);
      }

      // 案件管理のレコードを取得
      let matterRec = matterRecords.find((rec) => rec.$id.value == groupedOrderAmountRecords[ii].案件管理レコードID);
      if (!matterRec) {
        continue;
      }

      [groupedOrderAmountRecords[ii].先月, groupedOrderAmountRecords[ii].今月].forEach((rec) => {
        if (rec) {
          objRow['$id'] = rec.$id.value;
          objRow['案件グループID'] = rec.案件グループID.value;
          objRow['掲載媒体名'] = rec.掲載媒体名.value;
          objRow['モール管理番号'] = matterRec ? matterRec.モール管理番号.value : '';
          objRow['掲載商品名'] = rec.掲載商品名.value;
          objRow['月'] = rec.発注頻度.value.includes('月') ? true : false;
          objRow['火'] = rec.発注頻度.value.includes('火') ? true : false;
          objRow['水'] = rec.発注頻度.value.includes('水') ? true : false;
          objRow['木'] = rec.発注頻度.value.includes('木') ? true : false;
          objRow['金'] = rec.発注頻度.value.includes('金') ? true : false;
          objRow['総数'] = setNumRec.セット数合計.value;
          objRow['残数'] = setNumRec.残セット数合計.value;
          objRow['前回発注数'] = rec.前回発注数.value;
          objRow['発注'] = true;
          // 日付セル
          arrDays.forEach((day) => {
            if (rec.月.value == day.date.toFormat('MM')) {
              objRow[day.name] = rec[day.name].value;
            }
          });
          objRow['案件管理レコードID'] = rec.案件管理レコードID.value;
          objRow['前回発注日'] = rec.前回発注日.value ? rec.前回発注日.value : objRow['前回発注日'];
          objRow['発注書レコードID_下書き'] = rec.発注書レコードID_下書き.value;
          objRow['発注番号_下書き'] = rec.発注番号_下書き.value;
          objRow['発注セット数_下書き'] = rec.発注セット数_下書き.value;
        }
      });

      // 申込セット数を計算
      let sumRequest = 0;
      let startDateAfterLastOrder = luxon.DateTime.fromISO(startDate);
      /*
			// 申込セット数を加算する開始日を取得（先月、今月の前回発注日のより新しい日付）
			let startDateAfterLastOrder = luxon.DateTime.fromMillis(
				Math.max(
					luxon.DateTime.fromISO(groupedOrderAmountRecords[ii].先月?.前回発注日.value || '1970-01-01').plus({ days: 1 }).toMillis(),
					luxon.DateTime.fromISO(groupedOrderAmountRecords[ii].今月?.前回発注日.value || '1970-01-01').plus({ days: 1 }).toMillis(),
					luxon.DateTime.fromISO(startDate).toMillis()
				)
			);
			// 買取の場合、開始日は設定期間とする
			if (matterType == '買取')
			{
				startDateAfterLastOrder = luxon.DateTime.fromISO(startDate);
			}
			*/
      arrDays.forEach((day) => {
        // 開始日～終了日の間であれば加算する
        if (day.date >= luxon.DateTime.fromISO(startDateAfterLastOrder) && day.date <= luxon.DateTime.fromISO(endDate)) {
          if (objRow[day.name]) sumRequest += parseInt(objRow[day.name]);
        }
      });
      objRow['申込数'] = sumRequest;

      arrRtn.push(objRow);
    }

    // 案件グループIDで昇順、掲載媒体名で昇順
    arrRtn.sort((a, b) => {
      const groupIdComparison = a['案件グループID'].localeCompare(b['案件グループID']);
      if (groupIdComparison !== 0) return groupIdComparison;
      return a['掲載媒体名'].localeCompare(b['掲載媒体名']);
    });

    return arrRtn;
  };

  /**
   * スプレッドシートを表示
   */
  const showSpreadsheet_Top = async () => {
    try {
      spinner.open();

      // スプレッドシートの読み込み時に呼び出される関数
      const fncLoad = (tbEle, spObj) => {
        resParam = { status: 1, message: '' };

        // 行でループ
        for (let ii = 0; ii < tbEle.jspreadsheet.rows.length; ii++) {
          let jsonRow = tbEle.jspreadsheet.getJsonRow(ii);

          let startDateAfterLastOrder = luxon.DateTime.fromISO(startDate);
          /*
					// 色を変更する開始日を取得
					let startDateAfterLastOrder = luxon.DateTime.fromMillis(
						Math.max(
							luxon.DateTime.fromISO(jsonRow.前回発注日 || '1970-01-01').plus({ days: 1 }).toMillis(),
							luxon.DateTime.fromISO(startDate).toMillis()
						)
					);
					if (matterType == '買取')
					{
						startDateAfterLastOrder = luxon.DateTime.fromISO(startDate);
					}
					*/

          // 列でループ
          for (let jj = 0; jj < arrCols.length; jj++) {
            let cell = tbEle.jspreadsheet.getCellFromCoords(jj, ii);

            // id列の場合、リンクを作成
            if (tbEle.jspreadsheet.getHeader(jj) == '■') {
              cell.innerHTML = `<a href="${HC_THIS_APP_URL}show?record=${cell.textContent}" target="_blank">■</a>`;
            }

            // セルの日付が開始日～終了日の間であればセルの背景色を変更
            if (arrCols[jj].date >= startDateAfterLastOrder && arrCols[jj].date <= luxon.DateTime.fromISO(endDate)) {
              cell.style.backgroundColor = '#ffd350';
            }

            /*
						if (matterType == '受発注')
						{
							// セルの日付が前回終了日以前であればセルの背景色を変更
							if (arrCols[jj].date <= luxon.DateTime.fromISO(jsonRow.前回発注日)) { cell.style.backgroundColor = '#9e9e9e'; }
						}
						*/
          }
        }
      };

      // 一度スプレッドシートを削除
      if (spSheet) {
        spSheet.destroy();
      }

      // スプレッドシートの要素を取得
      let ele = document.getElementById('spreadsheet');
      ele.style.paddingRight = '0px';
      // スプレッドシートを表示
      spSheet = jspreadsheet(ele, {
        data: await createSpreadData(),
        columns: arrCols,

        allowInsertColumn: false,
        allowInsertRow: false,
        allowDeleteColumn: false,
        allowDeleteRow: false,
        contextMenu: false,
        rowHeader: false,
        filters: true,

        tableOverflow: true,
        lazyLoading: true,
        tableWidth: window.innerWidth + 'px',
        tableHeight: window.innerHeight - ele.getBoundingClientRect().top - 10 + 'px',
        freezeColumns: arrCols.findIndex((col) => col.name === '発注') + 1,

        onload: fncLoad,
      });
    } catch (error) {
      console.error('スプレッドシートの表示中にエラーが発生しました:', error);
    } finally {
      spinner.close();
    }
  };

  kintone.events.on('app.record.index.show', async (event) => {
    if (event.viewId == 6427204) {
      matterType = '受発注';
    } else if (event.viewId == 6428079) {
      matterType = '買取';
    } else if (event.viewId == 6428188) {
      matterType = '';
    } else {
      return event;
    }

    try {
      // 開始日と終了日のDatePicker
      const startDateSelector = new Kuc.DatePicker({ id: 'eleStartDate', value: dtNow.minus({ days: 3 }).toISODate() });
      startDateSelector.style.verticalAlign = 'middle';
      startDate = startDateSelector.value;
      const endDateSelector = new Kuc.DatePicker({ id: 'eleEndDate', value: dtNow.toISODate() });
      endDateSelector.style.verticalAlign = 'middle';
      endDate = endDateSelector.value;
      startDateSelector.addEventListener('change', (e) => {
        startDate = e.target.value;
        if (startDate > endDate) {
          endDateSelector.value = startDate;
          endDate = startDate;
        }
      });
      endDateSelector.addEventListener('change', (e) => {
        endDate = e.target.value;
        if (startDate > endDate) {
          startDateSelector.value = endDate;
          startDate = endDate;
        }
      });

      kintone.app.getHeaderMenuSpaceElement().appendChild(startDateSelector);
      const lblWave = document.createElement('span');
      lblWave.textContent = '～';
      lblWave.style.verticalAlign = 'middle';
      kintone.app.getHeaderMenuSpaceElement().appendChild(lblWave);
      kintone.app.getHeaderMenuSpaceElement().appendChild(endDateSelector);

      const refreshSheet = new Kuc.Button({ text: '表示を更新' });
      refreshSheet.style.verticalAlign = 'middle';
      refreshSheet.addEventListener('click', async () => {
        await showSpreadsheet_Top();
      });
      kintone.app.getHeaderMenuSpaceElement().appendChild(refreshSheet);

      // Spreadsheetを表示
      showSpreadsheet_Top();
    } catch (error) {
      console.log(error);
      event.error = error.message;
    }
  });
})();
