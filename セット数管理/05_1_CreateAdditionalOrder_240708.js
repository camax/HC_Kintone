/**
 * 追加発注の発注書を作成
 * 「追加発注の発注書を作成」ボタンで開始
 * 変更元が空欄、変更先が入力済み、追加発注の発注書が入力済みのもの
 */
(() =>
{
	"use strict";

	const HC_MATTER_APP_ID = HC.apps.案件管理.id;
	const HC_ORDER_APP_ID = HC.apps.発注書.id;

	const client = new KintoneRestAPIClient();

	let resParam = {
		code: 0,
		message: ""
	}


	/**
	 * 案件管理から、案件グループIDが一致する案件レコードを取得
	 * @param {*} groupId 
	 * @returns 
	 */
	const getMatterRecords = async (groupId) =>
	{
		try
		{
			let resp = await client.record.getRecords({
				app: HC_MATTER_APP_ID,
				query: '案件グループID = "@id"'.replace('@id', groupId),
			});
			return resp.records;
		}
		catch (error)
		{
			resParam.code = 1;
			resParam.message = "案件管理から案件グループIDが一致するレコードの取得に失敗しました。\n\n" + error.message;
		}
	};

	/**
	 * 発注番号を取得
	 * @returns 
	 */
	const GetOrderNumber = async () =>
	{
		let dayName = luxon.DateTime.local().toFormat('yyyyMMdd');
		try
		{
			let resp = await client.record.getRecords({
				app: HC_ORDER_APP_ID,
				fields: ["発注番号"],
				query: '発注番号 like "@id" order by 発注番号 desc limit 1 offset 0'.replace('@id', dayName)
			});

			let resNum = "";
			try
			{
				if (resp.records.length >= 1)
				{
					let curNumberSplit = resp.records[0]["発注番号"].value.split('-');
					let newNum = parseInt(curNumberSplit[curNumberSplit.length - 1]) + 1;
					resNum = "HCH-" + dayName + "-" + newNum;
				}
			}
			finally
			{
				if (resNum === "") resNum = "HCH-" + dayName + "-1";
			}
			return resNum;
		}
		catch (error)
		{
			resParam.code = 1;
			resParam.message = "発注番号の取得に失敗しました。\n\n" + error.message;
		}
	}

	/**
	 * 発注書にレコードを新規作成
	 * @param {*} recData 
	 * @returns 
	 */
	const AddOrderRecord = async (recData) =>
	{
		try
		{
			let resp = await client.record.addRecord({
				app: HC_ORDER_APP_ID,
				record: recData
			});
			return resp.id;
		}
		catch (error)
		{
			resParam.code = 1;
			resParam.message = "発注書レコードの新規作成に失敗しました。\n\n" + error.message;
		}
	};

	/**
	 * セット数管理のレコードを更新
	 * @param {*} recId 
	 * @param {*} recData 
	 * @returns 
	 */
	const UpdateManageSetNumRecord = async (recId, recData) =>
	{
		try
		{
			let resp = await client.record.updateRecord({
				app: kintone.app.getId(),
				id: recId,
				record: recData
			});
			return resp;
		}
		catch (error)
		{
			resParam.code = 1;
			resParam.message = "セット数管理のレコード更新に失敗しました。\n\n" + error.message;
		}
	};


	/**
	 * 追加発注の発注書を作成のメイン処理
	 * @param {*} record 
	 * @returns 
	 */
	const Main_CreateAdditionalOrder = async (record) =>
	{
		console.log(record);

		// 追加発注の行を取得
		let arrFlag = record["総セット数変更履歴"].value.filter(row =>
		{
			if (row.value["変更元"].value == "" && row.value["変更先"].value != "" && row.value["追加発注の発注書"].value == "") return row;
		});
		console.log(arrFlag);
		if (!arrFlag.length)
		{
			resParam.code = 1;
			resParam.message = "テーブルに追加発注の条件にあうデータがありません。";
			return;
		}
		// セット数の合計
		let setQtySum = arrFlag.reduce((sum, row) => { return sum + Number(row.value["増減数量"].value) }, 0);
		console.log(setQtySum);

		// 案件グループID
		let groupId = record["案件グループID"].value;
		console.log(groupId);
		if (!groupId)
		{
			resParam.code = 1;
			resParam.message = "案件グループIDが入力されていません。";
			return;
		}

		// 案件管理から、案件グループIDが一致する案件レコードを取得
		let matterRecords = await getMatterRecords(groupId);
		console.log(matterRecords);
		if (resParam.code != 0) return;
		if (!matterRecords.length)
		{
			resParam.code = 1;
			resParam.message = "案件管理アプリに、案件グループIDが一致するレコードが存在しません。";
			return;
		}

		// 商品コードとセット入数を取得
		let arrProd = [];
		for (let ii = 1; ii <= 10; ii++)
		{
			if (matterRecords[0]["商品コード_" + ii].value && matterRecords[0]["セット入数_" + ii].value)
			{
				arrProd.push({
					value: {
						'発注商品金額表_商品コード': { value: matterRecords[0]["商品コード_" + ii].value },
						'発注商品金額表_数量': { value: Number(matterRecords[0]["セット入数_" + ii].value) * setQtySum }
					}
				});
			}
		}
		console.log(arrProd);

		// 発注書用のデータを作成
		let orderNum = await GetOrderNumber();
		if (resParam.code != 0) return;
		let orderRecData = {
			'発注番号': { value: orderNum },
			'発注商品金額表': { value: arrProd },
		}
		console.log(orderRecData);
		// 発注書レコードを新規作成
		let orderId = await AddOrderRecord(orderRecData);
		console.log(orderId);
		if (resParam.code != 0) return;

		// セット数管理のテーブルに発注書番号を入力
		let arrTable = record["総セット数変更履歴"].value;
		arrTable.forEach(row =>
		{
			if (row.value["変更元"].value == "" && row.value["変更先"].value != "" && row.value["追加発注の発注書"].value == "")
			{
				row.value["追加発注の発注書"].value = orderNum;
			}
			return row;
		});
		let resUpdate = await UpdateManageSetNumRecord(record.$id.value, { '総セット数変更履歴': { value: arrTable } })
		console.log(resUpdate);
		if (resParam.code != 0) return;

		resParam.code = 0;
		resParam.message = "追加発注の発注書を作成しました。";

		return;
	}

	kintone.events.on('app.record.detail.show', function (event)
	{
		let spButton = kintone.app.record.getSpaceElement('space_AdditionalOrder');
		if (!spButton) return event;

		var button1 = document.createElement('button');
		button1.id = 'hc_button_1';
		button1.innerText = '追加発注の発注書を作成';

		spButton.appendChild(button1);

		// 追加発注の有無を確認
		// 変更元が空欄、変更先が入力済み、追加発注の発注書が入力済みのもの
		let arrFlag = event.record["総セット数変更履歴"].value.filter(row =>
		{
			if (row.value["変更元"].value == "" && row.value["変更先"].value != "" && row.value["追加発注の発注書"].value == "") return row;
		});
		if (arrFlag.length)
		{
			button1.classList.add('kintoneplugin-button-dialog-ok');
		}
		else
		{
			button1.classList.add('kintoneplugin-button-disabled');
			button1.disabled = true;
		}

		const spinner = new Kuc.Spinner({
			text: '処理中...',
			container: document.body
		});

		button1.onclick = function ()
		{
			swal({
				title: '追加発注',
				text: '増減数量分の追加発注の発注書を作成します。',
				icon: 'info',
				buttons: true

			}).then(async (isOkButton) =>
			{
				if (isOkButton)
				{
					spinner.open();

					try
					{
						await Main_CreateAdditionalOrder(event.record);
					} catch (error)
					{
						console.log(error);
					} finally
					{
						spinner.close();
						let iconRes = 'success';
						if (resParam.code != 0) iconRes = 'error';
						await swal({
							title: '追加発注',
							text: resParam.message,
							icon: iconRes
						})
						location.reload();
					}
				}
				else
				{
					return false;
				}
			});
		};
	});

})();

