/**
 * 消込データCSVを出力する
 */
(() =>
{
	"use strict";
	luxon.Settings.defaultLocale = "ja";

	const client = new KintoneRestAPIClient();
	const APP_ID = kintone.app.getId();

	const spinner = new Kuc.Spinner({
		text: '処理中...',
		container: document.body
	});

	const csvFields = {
		数量: '数量',
		会員名: '会員名',
		会員かな: '会員かな',
		会員郵便番号: '会員郵便番号',
		会員都道府県: '会員都道府県',
		会員住所１: '会員住所１',
		会員住所２: '会員住所２',
		会員電話番号: '会員電話番号',
		送り先名: '送り先名',
		送り先かな: '送り先かな',
		送り先郵便番号: '送り先郵便番号',
		送り先都道府県: '送り先都道府県',
		送り先住所１: '送り先住所１',
		送り先住所２: '送り先住所２',
		送り先電話番号: '送り先電話番号',
		購入日時: '購入日時',
		Dealタイトル: 'Dealタイトル',
		購入番号: '購入番号',
		情報コード: '情報コード',
		uniq_1: 'uniq_1',
		uniq_2: 'uniq_2',
		email: 'email',
		年齢: '年齢',
		発送予定日: '発送予定日',
		ID_くまポン用: 'ID（くまポン用）',
		店舗用商品ID: '店舗用商品ID',
		販売価格: '販売価格',
		支払額: '支払額',
		発注日: '発注日',
		発注予定日: '発注予定日',
		メモ: 'メモ',
		発送トークン: '発送トークン',
		発送ステータス: '発送ステータス',
		発送日: '発送日',
		伝票No: '伝票No',
		配送業者: '配送業者'
	};


	// 今日
	let dtNow = luxon.DateTime.local();
	let resParam = { status: 1, message: '' }


	/**
	 * 一覧に表示されているレコードを全て取得する
	 * @returns 
	 */
	const GetShippingRecords = async () =>
	{
		try
		{
			let strQuery = kintone.app.getQuery();
			let [strCondition, strOrder] = strQuery.split(/order by|limit/i).map(part => part.trim());
			return await client.record.getAllRecords({ app: APP_ID, condition: strCondition, orderBy: strOrder });
		}
		catch (error)
		{
			resParam.status = 9;
			resParam.message = "消込データCSVの一覧を取得する処理に失敗しました。\n\n" + error.message;
		}
	}

	/**
	 * 出力用のデータを生成
	 * @param {*} records 
	 * @returns 
	 */
	const GenerateOutputData = (records) =>
	{
		let arrData = [];
		for (let ii = 0; ii < records.length; ii++)
		{
			let record = records[ii];
			let dataEntry = {};
			for (const key in csvFields)
			{
				if (csvFields.hasOwnProperty(key))
				{
					dataEntry[key] = { value: record[key].value };
					if (key == '購入日時')
					{
						let dt = luxon.DateTime.fromISO(record[key].value);
						dataEntry[key] = { value: dt.toFormat('yyyy/MM/dd HH:mm:ss') };
					}
				}
			}
			arrData.push(dataEntry);
		}

		return arrData;
	}

	/**
	 * カンマ区切りのCSV形式に変換
	 * @param {*} arrObj 
	 * @returns 
	 */
	const TransformToCSV = (arrObj) =>
	{
		let header = "\"" + Object.values(csvFields).join("\",\"") + "\"\n";

		let body = arrObj.map((row) =>
		{
			row = Object.keys(csvFields).map((item) =>
			{
				let val = row[item].value;
				// ダブルクォーテーションをダブルクォーテーションx2に変換
				if (val) { val = String(val).replace(/\"/g, "\"\""); }
				return val;
			}).join("\",\"");
			return "\"" + row + "\"";
		}).join("\n");

		return header + body;
	}

	/**
	 * CSVファイルを出力
	 */
	const exportCSV = (csvData, filename) =>
	{
		//出力ファイル名
		let exportedFilenmae = (filename || 'exportCSV') + '.csv';

		//BLOBに変換
		let bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
		let blob = new Blob([bom, csvData], { type: 'text/csv;charset=utf-8' });

		//anchorを生成してclickイベントを呼び出す。
		let link = document.createElement("a");
		if (link.download !== undefined)
		{
			let url = URL.createObjectURL(blob);
			link.setAttribute("href", url);
			link.setAttribute("download", exportedFilenmae);
			link.style.visibility = 'hidden';
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
		}
	}

	/**
	 * 運用ステータスを「消込データ出力済み」に変更
	 * @param {*} records 
	 * @returns 
	 */
	const UpdateStatus = async (records) =>
	{
		try
		{
			let arrRecords = [];
			for (let ii = 0; ii < records.length; ii++)
			{
				arrRecords.push({ id: records[ii].$id.value, record: { 運用ステータス: { value: '消込データ出力済み' } } });
			}
			return await client.record.updateAllRecords({ app: APP_ID, records: arrRecords });
		}
		catch (error)
		{
			resParam.status = 9;
			resParam.message = "運用ステータスを「消込データ出力済み」に変更する処理に失敗しました。\n\n" + error.message;
		}
	}

	/**
	 * 消込データCSVを出力する Main
	 * @returns 
	 */
	const ExportShippingReport_Main = async () =>
	{
		try
		{
			spinner.open();

			resParam.status = 1;

			// 一覧に表示されているレコードを取得
			let reportRecords = await GetShippingRecords();
			if (resParam.status != 1) return;

			// 配送業者でグループ化
			let groupRecords = Object.groupBy(reportRecords, rec => rec.配送業者.value);

			for (let shipper in groupRecords)
			{
				let shipperRecords = groupRecords[shipper];

				// 出力用のデータを生成
				let arrData = GenerateOutputData(shipperRecords);
				console.log(shipper, arrData);

				// カンマ区切りのCSV形式に変換
				let csvData = TransformToCSV(arrData);

				// CSVで書き出し
				exportCSV(csvData, dtNow.toFormat('yyyyMMdd') + '_くまポン_消込用_' + shipper);
			}

			// 運用ステータスを「消込データ出力済み」に変更
			let resp = await UpdateStatus(reportRecords);
			if (resParam.status != 1) return;

			resParam.message = '消込データCSVを出力しました。';

		}
		catch (ex)
		{
			console.log(ex);
			resParam.message = '消込データCSVの出力に失敗しました。\n\n' + ex.message;
		}
		finally
		{
			spinner.close();
			await Swal.fire({
				title: '消込データCSVを出力',
				text: resParam.message,
			});
			location.reload(true);
		}
	}


	kintone.events.on('app.record.index.show', function (event)
	{
		if (event.viewId != 6425354) return event;

		// ボタン
		if (!document.getElementById('hc_button_exp'))
		{
			let button1 = document.createElement('button');
			button1.id = 'hc_button_exp';
			button1.classList.add('kintoneplugin-button-dialog-ok');
			button1.innerText = '消込データCSVを出力';
			kintone.app.getHeaderMenuSpaceElement().appendChild(button1);

			button1.onclick = async () =>
			{
				await ExportShippingReport_Main();
			}
		}

	});

})();