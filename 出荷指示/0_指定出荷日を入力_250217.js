/**
 * 全媒体or媒体を選択し、指定出荷日を指定する
 */
(() =>
{
	"use strict";
	luxon.Settings.defaultLocale = "ja";

	const client = new KintoneRestAPIClient();
	const APP_ID = kintone.app.getId();
	const APP_ID_MALL_MASTER = HC.apps.掲載媒体マスタ.id;

	const HC_MEMBER = [
		'kiyo@happy-campaign.co.jp',
		'sae.seki',
		'hc-assistant'
	];


	let mallList = {};

	let resParam = { status: 1, message: '' }





	/**
	 * 指定出荷日を設定する Main
	 * @param {*} mallName 
	 * @param {*} shippingDate 
	 * @returns 
	 */
	const SetShippingDate_Main = async (mallName, shippingDate) =>
	{
		try
		{
			resParam.status = 1;

			// 対象のモール
			let malls = [mallName];
			if (mallName == '全媒体')
			{
				malls = Object.keys(mallList).filter(mall => mall !== '全媒体');
			}

			// 対象のレコードを取得
			let targetRecords = [];
			for (let ii = 0; ii < malls.length; ii++)
			{
				let mall = malls[ii];
				let records = await client.record.getAllRecords({ app: APP_ID, condition: kintone.app.getQueryCondition() + ` and 掲載媒体名 = "${mall}"` });
				targetRecords.push(...records);
			}

			if (targetRecords.length == 0)
			{
				resParam.message = '指定出荷日を設定するレコードがありません。';
				return;
			}


			// 更新用のデータを生成
			let upData = [];
			for (let ii = 0; ii < targetRecords.length; ii++)
			{
				let record = targetRecords[ii];
				upData.push({ id: record.レコード番号.value, record: { 指定出荷日: { value: shippingDate } } });
			}


			// 更新
			let resp = await client.record.updateAllRecords({ app: APP_ID, records: upData });
			if (resp.records.length > 0)
			{
				resParam.message = '指定出荷日を設定しました。';
			}
			else
			{
				resParam.message = '指定出荷日の設定に失敗しました。';
			}

		}
		catch (ex)
		{
			console.log(ex);
			resParam.message = '指定出荷日の設定に失敗しました。\n\n' + ex.message;
		}
		finally
		{
			await Swal.fire({
				title: '指定出荷日を設定',
				text: resParam.message,
				willClose: () =>
				{
					location.reload(true);
				}
			});
		}
	}


	kintone.events.on('app.record.index.show', async function (event)
	{
		if (event.viewId != 6428047) return event;
		if (!HC_MEMBER.includes(kintone.getLoginUser().code)) return event;

		// 掲載媒体名の一覧を取得
		let mallRecords = await client.record.getAllRecords({ app: APP_ID_MALL_MASTER, condition: '状態 not in ("無効") and グループ not in ("SDGs")' });
		mallList = Object.fromEntries(mallRecords.map(record => [record.掲載媒体名.value, record.掲載媒体名.value]));
		mallList['全媒体'] = '全媒体';

		// ボタン
		if (!document.getElementById('hc_button_shipdate'))
		{
			var button1 = document.createElement('button');
			button1.id = 'hc_button_shipdate';
			button1.classList.add('kintoneplugin-button-normal');
			button1.innerText = '指定出荷日を入力';
			kintone.app.getHeaderMenuSpaceElement().appendChild(button1);

			button1.onclick = async () =>
			{
				const { value: targetMall } = await Swal.fire({
					title: '出荷日を指定する媒体を選択',
					input: 'select',
					inputOptions: mallList,
					inputPlaceholder: '媒体を選択してください',
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
								resolve('どちらかを選択してください');
							}
						});
					}
				});

				if (!targetMall)
				{
					resParam.message = '媒体の選択がキャンセルされました。';
					await Swal.fire({
						title: '出荷日を指定',
						text: resParam.message,
						timer: 5000,
						timerProgressBar: true,
						willClose: () => { }
					});
					return;
				}

				let { value: shippingDate } = await Swal.fire({
					title: "指定出荷日を入力",
					text: "指定出荷日を入力してください。",
					icon: "question",
					input: "date",
					inputAttributes: { min: luxon.DateTime.local().toFormat("yyyy-MM-dd"), },
					showCancelButton: true,
				});
				if (!shippingDate)
				{
					resParam.message = '指定出荷日の入力がキャンセルされました。';
					await Swal.fire({
						title: '指定出荷日を入力',
						text: resParam.message,
						timer: 5000,
						timerProgressBar: true,
						willClose: () => { }
					});
					return;
				}

				await SetShippingDate_Main(targetMall, shippingDate);
			}
		}

	});

})();