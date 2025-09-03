/**
 * 出荷指示アプリにSDGsの出荷依頼データを登録
 */
(() =>
{
	"use strict";
	luxon.Settings.defaultLocale = "ja";

	const client = new KintoneRestAPIClient();
	const HC_ORDER_AMOUNT_MANAGE_APP_ID = kintone.app.getId();
	const HC_MATTER_APP_ID = HC.apps.案件管理.id;
	const HC_ITEM_APP_ID = HC.apps.商品マスタ.id;
	const HC_CLIENT_APP_ID = HC.apps.取引先マスタ.id;
	const HC_SHIPPING_INSTRUCTION_APP_ID = HC.apps.出荷指示.id;

	const SDGs_GROUP_MALL_NAME = ["au", "Pontaパス", "Tサンプル", "Vサンプル"];

	const dtNow = luxon.DateTime.now();

	const spinner = new Kuc.Spinner({
		text: "処理中...",
		container: document.body,
	});


	let resParam = { status: 0, message: "" };


	/**
	 * 条件にあうすべてのレコードを取得
	 * @param {*} id
	 * @param {*} condition
	 * @param {*} order
	 * @returns
	 */
	const getAllRecordsWithCondition = async (id, condition = null, order = null) =>
	{
		try
		{
			const records = await client.record.getAllRecords({ app: id, condition: condition, orderBy: order, });
			return records;
		}
		catch (error)
		{
			resParam = {
				status: 9,
				message: "レコードの取得中にエラーが発生しました:\n\n" + error.message,
			};
			return [];
		}
	};

	/**
	 * レコードを一括追
	 * @param {*} appId
	 * @param {*} recData
	 * @returns
	 */
	const addSomeRecords = async (appId, recData) =>
	{
		try
		{
			return client.record.addAllRecords({ app: appId, records: recData })
				.then(function (resp)
				{
					resParam.status = 1;
					return resp;
				})
				.catch(function (e)
				{
					console.log(e);
					resParam.status = 9;
					resParam.message = `レコードを作成できませんでした。\n` + e;
					return;
				});
		}
		catch (ex)
		{
			console.log(ex);
			resParam.status = 9;
			resParam.message = `レコードを作成できませんでした。\n` + ex;
			return;
		}
	};

	/**
	 * SDGs用の出荷依頼データを登録
	 */
	const createSDGsShippingRecords_Top = async () =>
	{
		try
		{
			spinner.open();

			resParam = { status: 1, message: "" };

			let ele = document.getElementById("spreadsheet");
			let jsonData = [];
			// 表示されている行のデータを取得
			if (ele.jspreadsheet.results)
			{
				jsonData = ele.jspreadsheet.results.map((val, index) => ele.jspreadsheet.getJsonRow(val));
			}
			else
			{
				jsonData = ele.jspreadsheet.getJson();
			}
			console.log("取得したデータ:", jsonData);

			// 申込数が1以上のSDGs_GROUP_MALL_NAMEに絞る
			const orderData = jsonData.filter((row) => row.申込数 > 0 && SDGs_GROUP_MALL_NAME.includes(row["掲載媒体名"]));
			console.log("申込数が1以上 & SDGsのデータ:", orderData);

			if (orderData.length == 0)
			{
				resParam = { status: 9, message: "出荷依頼に登録するデータがありません。" };
				return;
			}

			// 案件管理のレコードを取得
			const matterRecords = await getAllRecordsWithCondition(HC_MATTER_APP_ID);
			console.log("案件管理のレコード:", matterRecords);

			// 商品マスタのレコードを取得
			const itemRecords = await getAllRecordsWithCondition(HC_ITEM_APP_ID);
			console.log("商品マスタのレコード:", itemRecords);

			// 取引先マスタのレコードを取得
			const clientRecords = await getAllRecordsWithCondition(HC_CLIENT_APP_ID);
			console.log("取引先マスタのレコード:", clientRecords);

			let reqData = [];

			// 対象のデータでループ
			for (let row of orderData)
			{
				// 案件レコード
				let matRec = matterRecords.find((rec) => rec.モール管理番号.value == row["モール管理番号"]);
				if (!matRec) continue;

				// 取引先のレコード
				let clientRec = clientRecords.find((rec) => rec.取引先名_部署名.value == matRec["発注先"].value);

				let itemTable = [];

				// 案件管理から商品情報を取得
				for (let ii = 1; ii <= 10; ii++)
				{
					let itemCode = matRec[`商品コード_${ii}`]?.value;
					if (!itemCode) continue;

					/*
					// 商品コードが一致する在庫レコードを取得
					let stockRecs = stockRecords.filter((rec) => rec.商品コード.value == itemGroup[0].商品コード.value);
					if (stockRecs.length == 0) continue;
					// 賞味期限が新しい順に並び替え
					stockRecs.sort((a, b) => { return (luxon.DateTime.fromISO(b.賞味期限.value).toMillis() - luxon.DateTime.fromISO(a.賞味期限.value).toMillis()); });
					// 最新の賞味期限
					deadLine = stockRecs[0].賞味期限.value
					*/

					// 在庫管理で賞味期限を運用するまでの暫定処置（商品マスタの賞味期限を使用）
					// 商品マスタのレコードを取得
					let itemRec = itemRecords.find((item) => item.商品コード.value == itemCode);
					if (!itemRec) continue;

					itemTable.push({
						value: {
							商品コード: { value: itemCode },
							セット入数: { value: matRec[`セット入数_${ii}`]?.value ? parseInt(matRec[`セット入数_${ii}`]?.value) : 0 },
							賞味期限: { value: itemRec.賞味期限.value },
						}
					});
				}

				if (itemTable.length == 0) continue;

				reqData.push({
					出荷管理アプリID: { value: HC_ORDER_AMOUNT_MANAGE_APP_ID },
					出荷管理レコードID: { value: row.$id },
					案件グループID: { value: matRec.案件グループID.value },
					案件レコードID: { value: matRec.$id.value },
					モール管理番号: { value: matRec.モール管理番号.value },
					納品タイプ: { value: clientRec.納品タイプ.value },
					出荷管理から取得日: { value: dtNow.toFormat("yyyy-MM-dd") },

					掲載媒体名: { value: matRec.掲載媒体名_表示用.value },
					商品情報: { value: itemTable },
					注文数: { value: row.申込数 },
					掲載商品名: { value: matRec.掲載商品名.value },
				});
			}

			console.log("出荷依頼登録用データ:", reqData);

			if (reqData.length == 0)
			{
				resParam = { status: 9, message: "出荷依頼に登録するデータがありません。" };
				return;
			}

			let res = await addSomeRecords(HC_SHIPPING_INSTRUCTION_APP_ID, reqData);
			console.log("出荷依頼登録結果:", res);
			resParam = { status: 1, message: "出荷依頼を作成しました。" };
		}
		catch (error)
		{
			console.error("出荷依頼登録中にエラーが発生しました:", error);
			resParam = { status: 9, message: "出荷依頼登録中にエラーが発生しました。" };
		}
		finally
		{
			spinner.close();

			let iconType = "success";
			let title = "成功";
			switch (resParam.status)
			{
				case 1:
					iconType = "success";
					title = "成功";
					break;
				case 9:
					iconType = "error";
					title = "エラー";
					break;
			}

			await Swal.fire({
				icon: iconType,
				title: title,
				text: resParam.message,
			});
		}
	};

	kintone.events.on("app.record.index.show", async (event) =>
	{
		if (event.viewId != 6427204 && event.viewId != 6428079) return event;

		try
		{
			// 発注書作成ボタン
			const createOrderButton = new Kuc.Button({
				text: "SDGs用の出荷依頼データを登録",
				type: "submit",
			});
			//createOrderButton.style.verticalAlign = 'middle';
			createOrderButton.style.marginLeft = "10px";
			createOrderButton.addEventListener("click", createSDGsShippingRecords_Top);
			kintone.app.getHeaderMenuSpaceElement().appendChild(createOrderButton);


		} catch (error)
		{
			console.log(error);
			event.error = error.message;
		}
	});
})();
