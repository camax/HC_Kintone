/**
 * 伝票番号CSVを取り込む
 * ［伝票番号CSVをUL］ボタンで実行
 */
(() =>
{
	"use strict";
	luxon.Settings.defaultLocale = 'ja';

	const client = new KintoneRestAPIClient();
	const APP_ID = kintone.app.getId();

	let resParam = { status: 1, message: '' }






	/**
	 * CSVファイルを読み込む
	 * @param {*} file 
	 * @returns 
	 */
	const readFile = (file) =>
	{
		return new Promise((resolve) =>
		{
			let reader = new FileReader();
			reader.onload = async (e) => 
			{
				// 読み込んだ結果をresolveする
				resolve(e.target.result);
			};
			// 読み込む
			reader.readAsText(file, 'UTF-8');
		});
	}

	/**
	 * CSVのデータを配列に変換
	 * @param {*} text 
	 * @returns 
	 */
	const convertToArray = (text) =>
	{
		// CSVのデータを配列に変換する処理
		let lines = text.split(/\r\n|\n/);
		let result = [];

		for (let ii = 0; ii < lines.length; ii++)
		{
			let currentline = lines[ii].split(',');

			for (let jj = 0; jj < currentline.length; jj++)
			{
				// 前後の"を削除する
				currentline = currentline.map((ele) =>
				{
					if (ele.slice(0, 1) == "\"") { ele = ele.slice(1); }
					if (ele.slice(-1) == "\"") { ele = ele.slice(0, -1); }
					return ele;
				});
			}
			result.push(currentline);
		}

		return result;
	}

	/**
	 * レコードを更新
	 * @param {*} arrData 
	 * @returns 
	 */
	const UpdateShippingInstructionRecords = async (arrData) =>
	{
		try 
		{
			let dtNow = luxon.DateTime.local().toFormat('yyyy-MM-dd');
			let dataRecords = [];
			for (let ii = 0; ii < arrData.length; ii++)
			{
				let rec = arrData[ii];
				if (rec[0] === null || rec[0] === "") continue;
				if (rec[1] === null || rec[1] === "") continue;
				if (isNaN(rec[0]) || isNaN(rec[1])) continue;	// 数値でない場合skip
				let objRec = {
					id: rec[1],
					record: {
						伝票番号: { value: rec[0] },
						発送日: { value: rec[2] },
						伝票番号CSVの取込日: { value: dtNow }
					}
				}
				dataRecords.push(objRec);
			}
			return await client.record.updateAllRecords({ app: APP_ID, records: dataRecords });
		}
		catch (error)
		{
			resParam.status = 9;
			resParam.message = error;
		}
	}


	/**
	 * 伝票番号CSVを取り込むMain
	 * @returns 
	 */
	const ImportShippingNumber_Main = async (file) =>
	{
		try
		{
			resParam.status = 1;

			// CSVの中身を取得
			let textCSV = await readFile(file);
			console.log(textCSV);

			// CSVのデータを配列に変換
			let arrCSV = convertToArray(textCSV);
			console.log(arrCSV);
			if (resParam.status !== 1) return;

			// レコードを更新（レコード番号、伝票番号）
			let respWMS = await UpdateShippingInstructionRecords(arrCSV);
			console.log(respWMS);
			if (resParam.status !== 1) return;

			resParam.message = '伝票番号CSVの取込に成功しました。\n';

		}
		catch (ex)
		{
			console.log(ex);
			resParam.message = '伝票番号CSVの取込に失敗しました。\n\n' + ex.message;
		}
		finally
		{
			await Swal.fire({
				title: '伝票番号CSVを取込',
				text: resParam.message,
			});
			location.reload(true);
		}
	}


	kintone.events.on('app.record.index.show', function (event)
	{
		if (event.viewId != 6427059) return event;

		// ファイル選択ボタン（非表示）
		if (document.getElementById('hc_button_imp') !== null) return;
		var input1 = document.createElement('input');
		input1.id = 'hc_button_imp';
		input1.type = 'file';
		input1.accept = '.csv';
		input1.style = 'display:none';
		kintone.app.getHeaderMenuSpaceElement().appendChild(input1);
		input1.addEventListener("click", (event) =>
		{
			event.target.value = '';
		});
		input1.addEventListener("change", async (event) =>
		{
			const file = event.target.files[0];
			await ImportShippingNumber_Main(file);
		});

		// ボタン（ファイル選択ボタンのclickイベントを発火）
		if (document.getElementById('hc_button_1') !== null) return;
		var button1 = document.createElement('button');
		button1.id = 'hc_button_1';
		button1.classList.add('kintoneplugin-button-dialog-ok');
		button1.innerText = '伝票番号CSVをUL';
		kintone.app.getHeaderMenuSpaceElement().appendChild(button1);

		button1.onclick = () =>
		{
			if (input1)
			{
				input1.click();
			}
		};
	});

})();