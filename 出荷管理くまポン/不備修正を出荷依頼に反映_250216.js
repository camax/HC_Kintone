/**
 * 不備修正した情報を出荷依頼に反映する
 */
(() =>
{
	"use strict";

	const client = new KintoneRestAPIClient();
	const APP_ID = kintone.app.getId();

	const HC_APP_ID_SHIPPING_REQUEST = HC.apps.出荷指示.id;

	const HC_APP_ID_SHIPPING_KUMAPON = HC.apps.出荷管理KUMAPON.id;
	const HC_APP_ID_SHIPPING_EECOTO = HC.apps.出荷管理EECOTO.id;	// BEAUTH
	const HC_APP_ID_SHIPPING_RIRO = HC.apps.出荷管理RIRO.id;
	const HC_APP_ID_SHIPPING_BENE = HC.apps.出荷管理BENE.id;
	const HC_APP_ID_SHIPPING_TPOINT = HC.apps.出荷管理TPOINT.id;
	const HC_APP_ID_SHIPPING_SHAHAN = HC.apps.出荷管理SHAHAN.id;
	const HC_APP_ID_SHIPPING_SAKADOIGAI = HC.apps.出荷管理SAKADOIGAI.id;
	const HC_APP_ID_SHIPPING_KAUCHE = HC.apps.出荷管理KAUCHE.id;

	let resParam = { status: 1, message: '' }


	const spinner = new Kuc.Spinner({
		text: '処理中...',
		container: document.body
	});





	/**
	 * Conditionを指定してレコードを一括取得
	 * @param {*} appId 
	 * @param {*} queCond 
	 * @returns 
	 */
	const GetAllRecords = async (appId, queCond) =>
	{
		try
		{
			return client.record.getAllRecords({ app: appId, condition: queCond })
				.then(function (resp)
				{
					resParam.status = 1;
					return resp;
				})
				.catch(function (e)
				{
					console.log(e);
					resParam.status = 9;
					resParam.message = `アプリ[${appId}]からレコードの取得に失敗しました。\n` + e;
					return;
				});
		}
		catch (ex)
		{
			console.log(ex);
			resParam.status = 9;
			resParam.message = `アプリ[${appId}]からレコードの取得に失敗しました。\n` + ex;
			return;
		}
	}

	/**
	 * 出荷管理アプリのレコードを更新
	 * @param {*} recData 
	 * @returns 
	 */
	const UpdateRecord = async (appId, recId, recData) =>
	{
		try
		{
			resParam.status = 1;
			await client.record.updateRecord({ app: appId, id: recId, record: recData });
		}
		catch (e)
		{
			console.log(e);
			resParam.status = 9;
			resParam.message = `レコードを更新できませんでした。\n` + e;
		}
	}

	/**
	 * 修正済みの値を取得
	 * @param {*} record 
	 * @returns 
	 */
	const getFixedValues = (record) =>
	{
		let objValues = {};

		// 媒体のフィールドに合わせ、取得
		switch (APP_ID)
		{
			case HC_APP_ID_SHIPPING_KUMAPON:
				objValues =
				{
					"送付先名": { value: record.送り先名.value },
					"送付先郵便番号": { value: record.送り先郵便番号.value },
					"送付先住所": { value: record.送り先都道府県.value + record.送り先住所１.value + record.送り先住所２.value },
					"送付先電話番号": { value: record.送り先電話番号.value },
				}
				break;
			case HC_APP_ID_SHIPPING_EECOTO:	// BEAUTH
				objValues =
				{
					"送付先名": { value: record.氏名.value },
					"送付先郵便番号": { value: record.郵便番号.value },
					"送付先住所": { value: record.住所.value },
					"送付先電話番号": { value: record.電話番号.value },
				}
				break;
			case HC_APP_ID_SHIPPING_RIRO:
				objValues =
				{
					"送付先名": { value: record.送り主名.value },
					"送付先郵便番号": { value: record.送り主郵便番号.value },
					"送付先住所": { value: record.送付主都道府県.value + record.送り主住所.value + record.送り主住所番地.value },
					"送付先電話番号": { value: record.送り主TEL.value },
				}
				break;
			case HC_APP_ID_SHIPPING_BENE:
				objValues =
				{
					"送付先名": { value: record.配送先名.value },
					"送付先郵便番号": { value: record.配送先郵便番号.value },
					"送付先住所": { value: record.配送先都道府県.value + record.配送先市区町村・番地.value + record.配送先建物・号室.value },
					"送付先電話番号": { value: record.配送先電話番号.value },
				}
				break;
			case HC_APP_ID_SHIPPING_TPOINT:	// V景品交換
				objValues =
				{
					"送付先名": { value: record.氏名_漢字.value },
					"送付先郵便番号": { value: record.郵便番号.value },
					"送付先住所": { value: record.住所.value },
					"送付先電話番号": { value: record.電話番号.value },
				}
				break;
			case HC_APP_ID_SHIPPING_SHAHAN:
				objValues =
				{
					"送付先名": { value: record.配送先氏名_姓.value + record.配送先氏名_名.value },
					"送付先郵便番号": { value: record.配送先郵便番号.value },
					"送付先住所": { value: record.配送先都道府県.value + record.配送先住所_郡市区.value + record.配送先住所_町名番地.value + record.配送先住所_建物名等.value },
					"送付先電話番号": { value: record.配送先電話番号.value },
				}
				break;
			case HC_APP_ID_SHIPPING_SAKADOIGAI:
				objValues =
				{
					"送付先名": { value: record.お届け先名称.value },
					"送付先郵便番号": { value: record.お届け先郵便番号.value },
					"送付先住所": { value: record.お届け先住所.value },
					"送付先電話番号": { value: record.お届け先TEL.value },
				}
				break;
			case HC_APP_ID_SHIPPING_KAUCHE:
				objValues =
				{
					"送付先名": { value: record.配送先_氏名.value },
					"送付先郵便番号": { value: record.配送先_郵便番号.value },
					"送付先住所": { value: record.配送先_都道府県.value + record.配送先_市区町村.value + record.配送先_丁目番地.value + record.配送先_建物・部屋番号.value },
					"送付先電話番号": { value: record.配送先_電話番号.value },
				}
				break;
			default:
				break;
		}

		return objValues;
	}

	/**
	 * 不備チェック
	 * @param {*} allRec 
	 */
	const CheckAddress = (objValues) =>
	{
		let errMsg = [];

		// 郵便番号
		if ('送付先郵便番号' in objValues)
		{
			let val = objValues['送付先郵便番号'].value;
			if (!val)
			{
				errMsg.push("郵便番号が空欄です。");
			}
			else
			{
				// ハイフンを除く
				val = val.replace(/-|ー|－/g, "");
				// 全角の場合、半角に置換
				val = val.replace(/[０-９]/g, function (s)
				{
					return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
				});
				// 桁数
				if (val.length !== 7)
				{
					errMsg.push("郵便番号が7桁ではありません。");
				}
			}
			objValues['送付先郵便番号'] = { value: val };
		}

		// 氏名
		if ('送付先名' in objValues && !objValues['送付先名'].value)
		{
			errMsg.push("氏名が空欄です。");
		}

		// 住所
		if ('送付先住所' in objValues)
		{
			let val = objValues['送付先住所'].value;
			if (!val)
			{
				errMsg.push("住所が空欄です。");
			}
			else
			{
				const cityRegex = /(.+?[市区町村])/;
				const cityMatch = val.match(cityRegex);
				if (!cityMatch)
				{
					errMsg.push("市区町村がありません。");
				}
				if (!/\d|[一二三四五六七八九]|[０-９]/.test(val))
				{
					errMsg.push("番地がありません。");
				}
			}
		}

		// 電話番号
		if ('送付先電話番号' in objValues)
		{
			let val = objValues['送付先電話番号'].value;
			if (!val)
			{
				errMsg.push("電話番号が空欄です。");
			}
			else
			{
				// ハイフンを除く
				val = val.replace(/-|ー|－/g, "");
				// 全角の場合、半角に置換
				val = val.replace(/[０-９]/g, function (s)
				{
					return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
				});
				// +81を0に置き換える
				val = val.replace(/\+81/g, "0");
				// 桁数
				if (val.length !== 10 && val.length !== 11)
				{
					errMsg.push("電話番号が10桁または11桁ではありません。");
				}
			}
			objValues['送付先電話番号'] = { value: val };
		}

		if (errMsg.length > 0)
		{
			objValues['送付先不備'] = { value: "不備あり" };
			objValues['不備内容'] = { value: errMsg.join("\n") };
		}
		else
		{
			objValues['送付先不備'] = { value: "修正済み" };
			objValues['不備内容'] = { value: "" };
		}
		return objValues;
	}

	/**
	 * メイン処理
	 * @returns 
	 */
	const updateCorrectMistakes = async (record) =>
	{
		try
		{
			spinner.open();

			// 出荷指示アプリのレコードを取得
			let recData = await GetAllRecords(HC_APP_ID_SHIPPING_REQUEST, `出荷管理アプリID = "${APP_ID}" and 出荷管理レコードID = "${record.$id.value}"`);
			if (recData.length == 0)
			{
				resParam.message = '出荷指示アプリのレコードが見つかりません。';
				return;
			}

			// 修正済みのデータを取得
			let fixedValues = getFixedValues(record);
			// 再度、不備チェック
			let errValues = CheckAddress(fixedValues);
			// 更新用のデータを生成
			let upRec = {
				...fixedValues,
				...errValues
			}

			let recTarget = recData[0];
			// 出荷指示アプリのレコードを更新
			let updatedRecs = await UpdateRecord(HC_APP_ID_SHIPPING_REQUEST, recTarget.$id.value, upRec);
			console.log("出荷指示アプリのレコードを更新", updatedRecs);
			if (resParam.status != 1) return;

			resParam.message = '不備修正を出荷依頼に反映しました。';

		}
		catch (error)
		{
			console.log(error);
			resParam.message = '不備修正を出荷依頼に反映できませんでした。';
		}
		finally
		{
			spinner.close();
			await Swal.fire({
				title: '不備修正を出荷依頼に反映',
				text: resParam.message,
			});
			location.reload(true);
		}
	}



	/**
	 * 一覧表示イベント
	 * @returns 
	 */
	kintone.events.on('app.record.detail.show', async (event) =>
	{
		let record = event.record;

		// ボタン
		if (document.getElementById('hc_button_1') !== null) return;
		var button1 = document.createElement('button');
		button1.id = 'hc_button_1';
		if (record.運用ステータス.value == '出荷依頼済み')
		{
			button1.classList.add('kintoneplugin-button-normal');
		}
		else
		{
			button1.classList.add('kintoneplugin-button-disabled');
		}
		button1.innerText = '不備修正を出荷依頼に反映';
		kintone.app.record.getHeaderMenuSpaceElement().appendChild(button1);

		button1.onclick = async () =>
		{
			resParam = { status: 1, message: '' }
			await updateCorrectMistakes(record);
		};

		return event;
	});

})();