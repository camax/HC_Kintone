/**
 * 伝票番号取込済から、対象月を選び、出荷実績を出力する
 */
(() =>
{
	"use strict";
	luxon.Settings.defaultLocale = "ja";

	const client = new KintoneRestAPIClient();
	const APP_ID = kintone.app.getId();
	const FILE_NAME = '_出荷実績';

	const spinner = new Kuc.Spinner({
		text: "処理中...",
		container: document.body,
	});


	let resParam = { status: 1, message: '' }

	// 出荷実績のCSVの項目
	let csvFields = {
		レコード番号: '$id',
		掲載商品名: '掲載商品名',
		注文数: '注文数',
		発送日: '発送日',
		配送業者: '配送業者',
		伝票番号: '伝票番号',
		配送サイズ: '配送サイズ',
		配送費: '配送費',
		注文数x配送費: '注文数x配送費'
	}

	let targetDuration = [];
	let dtNow = luxon.DateTime.local();


	/**
	 * 対象のレコードを取得する
	 * @param {*} duration 
	 * @returns
	 */
	const GetTargetRecords = async (duration) =>
	{
		try
		{
			let strCondition = `伝票番号CSVの取込日 != "" and 
				伝票番号 != "" and 
				BtoB != "1" and 
				発送日 >= "${duration[0]}" and 
				発送日 <= "${duration[1]}"`;
			let strOrder = `発送日 asc, レコード番号 asc`;
			return await client.record.getAllRecords({ app: APP_ID, condition: strCondition, orderBy: strOrder });
		} catch (error)
		{
			resParam.status = 9;
			resParam.message = '対象のレコードを取得する処理に失敗しました。\n\n' + error.message;
		}
	};

	/**	
	 * レコードから商品ごとのデータに変換
	 * @param {*} records 
	 * @returns 
	 */
	const FlattenRecords = (records) =>
	{
		let flatData = [];
		for (const record of records)
		{
			if (record.商品情報.value.length == 0) continue;

			let commonRow = {};
			for (const key in record)
			{
				if (record.hasOwnProperty(key))
				{
					commonRow[key] = record[key];
				}
			}

			for (let ii = 0; ii < record.商品情報.value.length; ii++)
			{
				let item = record.商品情報.value[ii].value;
				let itemRow = {};
				for (const key in item)
				{
					itemRow[key] = item[key];
				}
				flatData.push(Object.assign({}, commonRow, itemRow));
			}
		}
		return flatData;
	};

	/**
	 * JSONをカンマ区切りのCSV形式に変換
	 */
	const JsonToCSV = (json) =>
	{
		let header = '"' + Object.keys(csvFields).join('","') + '"\n';

		let body = json
			.map((row) =>
			{
				let strRow = Object.values(csvFields)
					.map((item) =>
					{
						if (item == '') return '';
						let val = row[item].value;
						// ダブルクォーテーションをダブルクォーテーションx2に変換
						if (val)
						{
							val = String(val).replace(/\"/g, '""');
						}
						return val;
					})
					.join('","');
				return '"' + strRow + '"';
			})
			.join('\n');

		return header + body;
	};

	/**
	 * CSVファイルを出力
	 */
	const exportCSV = (csvData, filename) =>
	{
		//出力ファイル名
		var exportedFilenmae = (filename || 'exportCSV') + '.csv';

		//BLOBに変換
		var bom = new Uint8Array([0xef, 0xbb, 0xbf]); //ここでUTF-8を指定
		var blob = new Blob([bom, csvData], { type: 'text/csv;charset=utf-8' });

		//anchorを生成してclickイベントを呼び出す。
		var link = document.createElement('a');
		if (link.download !== undefined)
		{
			var url = URL.createObjectURL(blob);
			link.setAttribute('href', url);
			link.setAttribute('download', exportedFilenmae);
			link.style.visibility = 'hidden';
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
		}
	};

	/**
	 * 出荷実績を出力する Main
	 * @param {*}  
	 * @returns 
	 */
	const ExportShippingDetails_Main = async () =>
	{
		try
		{
			spinner.open();

			resParam.status = 1;

			console.log("対象の月", targetDuration);
			if (targetDuration.length == 0)
			{
				resParam.status = 9;
				resParam.message = '対象の月が選択されていません。';
				return;
			}

			// 対象のレコードを取得
			let records = await GetTargetRecords(targetDuration);
			console.log("対象のレコード", records);
			if (resParam.status != 1) return;
			if (records.length == 0)
			{
				resParam.message = '対象のレコードがありません。';
				return;
			}

			/*
			//  レコードから商品ごとのデータに変換
			let flatData = await FlattenRecords(records);
			console.log("商品ごとのレコード", flatData);
			if (resParam.status != 1) return;
			if (flatData.length == 0)
			{
				resParam.message = '商品ごとのレコードがありません。';
				return;
			}
			*/

			// 対象のレコードをカンマ区切りのCSV形式に変換
			let csvData = JsonToCSV(records);
			//console.log("CSVデータ", csvData);

			// CSVを出力
			await exportCSV(csvData, dtNow.toFormat('yyyyMMdd') + FILE_NAME + '_' + targetDuration[0].toFormat('yyyy年MM月'));

			resParam.message = '出荷実績を出力しました。';

		}
		catch (ex)
		{
			console.log(ex);
			resParam.message = 'BtoBピッキング明細の出力に失敗しました。\n\n' + ex.message;
		}
		finally
		{
			spinner.close();

			await Swal.fire({
				title: 'BtoBピッキング明細を出力',
				text: resParam.message
			});
		}
	}


	kintone.events.on('app.record.index.show', async function (event)
	{
		if (event.viewId != 6427178) return event;

		// ボタン
		if (!document.getElementById('hc_button_details'))
		{
			var button1 = document.createElement('button');
			button1.id = 'hc_button_details';
			button1.classList.add('kintoneplugin-button-dialog-ok');
			button1.innerText = '出荷実績を出力';
			kintone.app.getHeaderMenuSpaceElement().appendChild(button1);

			button1.onclick = async () =>
			{
				let optMonth = { "今月": "今月", "先月": "先月", "先々月": "先々月" };

				const { value: selMonth } = await Swal.fire({
					title: '出力対象の月を選択',
					input: 'select',
					inputOptions: optMonth,
					inputPlaceholder: '月を選択してください',
					showCancelButton: true,
					inputValidator: (value) =>
					{
						return new Promise((resolve) =>
						{
							if (value)
							{
								resolve();
							} else
							{
								resolve('選択してください');
							}
						});
					}
				});

				if (!selMonth)
				{
					resParam.message = '月の選択がキャンセルされました。';
					await Swal.fire({
						title: '出荷実績を出力',
						text: resParam.message,
						timer: 5000,
						timerProgressBar: true,
						willClose: () => { }
					});
					return;
				}

				targetDuration = [];
				switch (selMonth)
				{
					case "今月":
						targetDuration = [luxon.DateTime.local().startOf('month'), luxon.DateTime.local().endOf('month')];
						break;
					case "先月":
						targetDuration = [luxon.DateTime.local().minus({ months: 1 }).startOf('month'), luxon.DateTime.local().minus({ months: 1 }).endOf('month')];
						break;
					case "先々月":
						targetDuration = [luxon.DateTime.local().minus({ months: 2 }).startOf('month'), luxon.DateTime.local().minus({ months: 2 }).endOf('month')];
						break;
				}

				await ExportShippingDetails_Main();
			}
		}

	});

})();