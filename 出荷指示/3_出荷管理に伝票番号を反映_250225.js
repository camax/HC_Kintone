/**
 * 出荷管理に伝票番号を反映する
 */
(() =>
{
	"use strict";
	luxon.Settings.defaultLocale = "ja";

	const client = new KintoneRestAPIClient();
	const APP_ID = kintone.app.getId();

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
			resParam.message = "出荷依頼データの一覧を取得する処理に失敗しました。\n\n" + error.message;
		}
	}

	/**
	 * 出荷管理に伝票票番号を反映する
	 * @param {*} appId 
	 * @param {*} records 
	 * @returns 
	 */
	const updateShippingManage = async (appId, records) =>
	{
		try
		{
			return await client.record.updateAllRecords({ app: appId, records: records });
		}
		catch (error)
		{
			resParam.status = 9;
			resParam.message = "出荷管理に伝票番号を反映する処理に失敗しました。\n\n" + error.message;
		}
	}

	/**
	 * 各モールの出荷管理に伝票番号を反映
	 * @param {*} records 
	 */
	const ReflectShippingManage = async (records) =>
	{
		try
		{
			// 全レコードを出荷管理アプリID（モール別）にグループ化
			let groupedByMallAppId = Object.groupBy(records, record => record.出荷管理アプリID.value);

			let resRtn = [];

			// モールごとに出荷管理に伝票番号を反映
			for (let appId in groupedByMallAppId)
			{
				let appRecords = groupedByMallAppId[appId];

				let mallRecords = [];
				// 同じモールの出荷依頼をまとめて出荷管理に伝票番号を反映
				for (let ii = 0; ii < appRecords.length; ii++)
				{
					let shipRecord = appRecords[ii];

					// 伝票番号
					let strTicketNumber = shipRecord.伝票番号.value;
					// 配送業者
					let strDeliveryCompany = shipRecord.配送業者.value;

					// 伝票番号を出荷管理に反映
					mallRecords.push({
						id: shipRecord.出荷管理レコードID.value,
						record: {
							伝票No: { value: strTicketNumber },
							追跡番号: { value: strTicketNumber },
							送り状番号: { value: strTicketNumber },
							配達伝票番号: { value: strTicketNumber },
							伝票番号: { value: strTicketNumber },
							配送伝票番号: { value: strTicketNumber },
							伝票番号: { value: strTicketNumber },

							配送業者: { value: strDeliveryCompany },
							運送会社: { value: strDeliveryCompany },

							GDL出荷日: { value: shipRecord.指定出荷日.value },
							発送日: { value: shipRecord.指定出荷日.value },
							出荷日: { value: shipRecord.指定出荷日.value },

							運用ステータス: { value: "出荷済み" }
						}
					});
				}

				// モールごとに出荷管理に伝票番号を反映
				let respReflect = await updateShippingManage(appId, mallRecords);
				resRtn.push({ app: appId, records: mallRecords, result: respReflect });
			}

			return resRtn;
		}
		catch (error)
		{
			resParam.status = 9;
			resParam.message = "出荷管理に伝票番号を反映する処理に失敗しました。\n\n" + error.message;
		}
	}

	/**
	 * 出荷依頼の「出荷管理へ反映日」を更新する
	 * @param {*} records 
	 * @returns 
	 */
	const UpdateReflectDate = async (listRecords, resReflect) =>
	{
		try
		{
			let dtNow = luxon.DateTime.local().toFormat('yyyy-MM-dd');
			let arrRecords = [];
			let resRtn = [];
			for (let ii = 0; ii < listRecords.length; ii++)
			{
				// 対象モールの結果に含まれている場合、反映日を更新
				if (resReflect.find(item => item.app == listRecords[ii].出荷管理アプリID.value)
					&& resReflect.find(item => item.result.records.find(record => record.id == listRecords[ii].出荷管理レコードID.value)))
				{
					arrRecords.push({ id: listRecords[ii].$id.value, record: { 出荷管理へ反映日: { value: dtNow } } });
				}
			}
			return await client.record.updateAllRecords({ app: APP_ID, records: arrRecords });
		}
		catch (error)
		{
			resParam.status = 9;
			resParam.message = "出荷依頼の「出荷管理へ反映日」を更新する処理に失敗しました。\n\n" + error.message;
		}
	}

	/**
	 * 出荷管理に伝票番号を反映する Main
	 * @returns 
	 */
	const ReflectShippingManage_Main = async () =>
	{
		try
		{
			resParam.status = 1;

			// 一覧に表示されているレコードを取得
			let allRecords = await GetShippingRecords();
			if (resParam.status != 1) return;

			// 各モールの出荷管理に伝票番号を反映
			let respReflect = await ReflectShippingManage(allRecords);
			console.log(respReflect);
			if (resParam.status != 1) return;

			// 出荷依頼の「出荷管理へ反映日」を更新
			let respUpdate = await UpdateReflectDate(allRecords, respReflect);
			console.log(respUpdate);
			if (resParam.status != 1) return;

			resParam.message = '出荷管理に伝票番号を反映しました。\n';
		}
		catch (ex)
		{
			console.log(ex);
			resParam.message = '出荷管理に伝票番号を反映に失敗しました。\n\n' + ex.message;
		}
		finally
		{
			await Swal.fire({
				title: '出荷管理に伝票番号を反映',
				text: resParam.message,
				willClose: () =>
				{
					location.reload(true);
				}
			});
		}
	}


	kintone.events.on('app.record.index.show', function (event)
	{
		if (event.viewId != 6428145) return event;

		// ボタン
		if (!document.getElementById('hc_button_exp'))
		{
			var button1 = document.createElement('button');
			button1.id = 'hc_button_exp';
			button1.classList.add('kintoneplugin-button-dialog-ok');
			button1.innerText = '各モールの出荷管理に伝票番号を反映';
			kintone.app.getHeaderMenuSpaceElement().appendChild(button1);

			button1.onclick = async () =>
			{
				await ReflectShippingManage_Main();
			}
		}

	});

})();