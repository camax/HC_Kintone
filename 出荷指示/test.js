/**
 * 各モールの出荷管理アプリから出荷依頼データを収集する
 * ［各モールの注文データを収集］ボタンで実行
 * 適用アプリ：出荷指示
 * 案件レコードを取得できなかった場合、対象をリスト出力する
 * ◆在庫管理が機能するまで、一時的に在庫チェックをOFFにしている◆
 */

/**
 * Excelで0から始まる文字列が消えないようにする
 * @param {string} val - 文字列として処理したい値（郵便番号・電話番号など）
 * @returns {string} Excelで文字列扱いされる形式
 */
const formatForExcel = (val) => {
  if (!val) return '';
  return `"="${val}"`;
};

(() =>
{
	"use strict";

	const client = new KintoneRestAPIClient();
	const APP_ID = kintone.app.getId();

	const HC_APP_ID_SHIPPING_AU = HC.apps.出荷管理AU.id;
	const HC_APP_ID_SHIPPING_TSAMPLE = HC.apps.出荷管理TSAMPLE.id;
	const HC_APP_ID_SHIPPING_KUMAPON = HC.apps.出荷管理KUMAPON.id;
	const HC_APP_ID_SHIPPING_EECOTO = HC.apps.出荷管理EECOTO.id;	// BEAUTH
	const HC_APP_ID_SHIPPING_RIRO = HC.apps.出荷管理RIRO.id;
	const HC_APP_ID_SHIPPING_BENE = HC.apps.出荷管理BENE.id;
	const HC_APP_ID_SHIPPING_TPOINT = HC.apps.出荷管理TPOINT.id;
	const HC_APP_ID_SHIPPING_SHAHAN = HC.apps.出荷管理SHAHAN.id;
	const HC_APP_ID_SHIPPING_SAKADOIGAI = HC.apps.出荷管理SAKADOIGAI.id;
	const HC_APP_ID_SHIPPING_KAUCHE = HC.apps.出荷管理KAUCHE.id;

	const HC_APP_ID_MATTER = HC.apps.案件管理.id;
	const HC_APP_ID_ITEM = HC.apps.商品マスタ.id;
	const HC_APP_ID_STOCK = HC.apps.在庫管理.id;
	const HP_APP_ID_WAREHOUSE = HC.apps.倉庫マスタ.id;

	const HC_MEMBER = [
		'kiyo@happy-campaign.co.jp',
		'sae.seki',
		'hc-assistant'
	];

	let shipRecords = {
		//au: [],
		//Tサンプル: [],
		くまポン: [],
		eecoto: [],	// BEAUTH
		リロ: [],
		ベネ: [],
		Tポイント: [],
		社販: [],
		坂戸以外: [],
		KAUCHE: []
	}
	let mattRecords = [];
	let itemRecords = [];
	let stockRecords = [];
	let warehouseRecords = [];

	let mallManageNumber = {
		くまポン: "ID_くまポン用",
		eecoto: "SKU",	// BEAUTH
		リロ: "商品コード",
		ベネ: "メニューNo",
		Tポイント: "商品コード",
		社販: "品番",
		坂戸以外: "モール管理番号",
		KAUCHE: "商品管理番号"
	}

	let dtExecute = luxon.DateTime.local().toFormat('yyyy-MM-dd');
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
					resParam.message = `アプリ[${appId}]からレコードの取得に失敗しました.\n` + e;
					return;
				});
		}
		catch (ex)
		{
			console.log(ex);
			resParam.status = 9;
			resParam.message = `アプリ[${appId}]からレコードの取得に失敗しました.\n` + ex;
			return;
		}
	}

	/**
	 * 出荷管理アプリから「出荷依頼」のデータを取得
	 * @returns
	 */
	const GetShippingRecords = async () =>
	{
		// 出荷管理au
		shipRecords.au = await GetAllRecords(HC_APP_ID_SHIPPING_AU, '運用ステータス in ("出荷依頼")');
		if (resParam.status != 1) return;
		// 出荷管理Tサンプル
		shipRecords.Tサンプル = await GetAllRecords(HC_APP_ID_SHIPPING_TSAMPLE, '運用ステータス in ("出荷依頼")');
		if (resParam.status != 1) return;
		// 出荷管理くまポン
		shipRecords.くまポン = await GetAllRecords(HC_APP_ID_SHIPPING_KUMAPON, '運用ステータス in ("出荷依頼")');
		if (resParam.status != 1) return;
		// 出荷管理BEAUTH
		shipRecords.eecoto = await GetAllRecords(HC_APP_ID_SHIPPING_EECOTO, '運用ステータス in ("出荷依頼")');
		if (resParam.status != 1) return;
		// 出荷管理リロクラブ
		shipRecords.リロ = await GetAllRecords(HC_APP_ID_SHIPPING_RIRO, '運用ステータス in ("出荷依頼")');
		if (resParam.status != 1) return;
		// 出荷管理ベネフィットワン
		shipRecords.ベネ = await GetAllRecords(HC_APP_ID_SHIPPING_BENE, '運用ステータス in ("出荷依頼")');
		if (resParam.status != 1) return;
		// 出荷管理Tポイント
		shipRecords.Tポイント = await GetAllRecords(HC_APP_ID_SHIPPING_TPOINT, '運用ステータス in ("出荷依頼")');
		if (resParam.status != 1) return;
		// 出荷管理社販
		shipRecords.社販 = await GetAllRecords(HC_APP_ID_SHIPPING_SHAHAN, '運用ステータス in ("出荷依頼")');
		if (resParam.status != 1) return;
		// 出荷管理坂戸以外
		shipRecords.坂戸以外 = await GetAllRecords(HC_APP_ID_SHIPPING_SAKADOIGAI, '運用ステータス in ("出荷依頼")');
		if (resParam.status != 1) return;
		// 出荷管理モラタメ（GDL出荷なし）
		// 出荷管理KAUCHE
		shipRecords.KAUCHE = await GetAllRecords(HC_APP_ID_SHIPPING_KAUCHE, '運用ステータス in ("出荷依頼")');
		if (resParam.status != 1) return;

		return;
	}

	/**
	 * 案件レコードを取得
	 * @returns
	 */
	const GetMatterRecords = async () =>
	{
		mattRecords = await GetAllRecords(HC_APP_ID_MATTER);
		if (resParam.status != 1) return;
	}

	/**
	 * 商品マスタレコードを取得
	 * @returns
	 */
	const GetItemRecords = async () =>
	{
		itemRecords = await GetAllRecords(HC_APP_ID_ITEM, '');
		if (resParam.status != 1) return;
	}

	/**
	 * 在庫管理レコードを取得
	 * @returns
	 */
	const GetStockRecords = async () =>
	{
		stockRecords = await GetAllRecords(HC_APP_ID_STOCK, '');
		if (resParam.status != 1) return;
	}

	/**
	 * 倉庫マスタのレコードを取得
	 * @returns
	 */
	const GetWarehouseRecords = async () =>
	{
		warehouseRecords = await GetAllRecords(HP_APP_ID_WAREHOUSE, '');
		if (resParam.status != 1) return;
	}


	/**
	 * 出荷指示アプリ用にデータを生成（au）
	 * @returns
	 */
	const CreateDataForShipInstruction_AU = async () =>
	{
		let arrRtn = [];

		for (let ii = 0; ii < shipRecords.au.length; ii++)
		{
			// 案件レコードを取得
			let mattRec = mattRecords.find(record => record.掲載媒体名.value === "au" && record.モール管理番号.value === shipRecords.au[ii].PJTID.value);
			if (mattRec)
			{
				let itemInfos = [];
				// 案件の商品1～10でループ
				for (let jj = 1; jj <= 10; jj++)
				{
					// 商品レコードを取得
					if (!mattRec['商品コード_' + jj].value) continue;
					let itemRec = itemRecords.find(record => record.商品コード.value === mattRec['商品コード_' + jj].value);
					if (!itemRec) continue;

					// 必要バラ数
					let needBara = shipRecords.au[ii].数量.value * mattRec['セット入数_' + jj].value;

					// 在庫管理のレコードを取得
					let stockRecs = stockRecords.filter(record =>
						record.商品コード.value === mattRec['商品コード_' + jj].value &&
						(mattRec.最短賞味期限.value === null || record.賞味期限.value >= mattRec.最短賞味期限.value) &&
						parseInt(record.在庫数.value) >= needBara
					);
					// stockRecsを賞味期限の昇順にする
					stockRecs.sort((a, b) => new Date(a.賞味期限.value) - new Date(b.賞味期限.value));
					// 賞味期限が最も早いレコードを取得
					let stockRec = stockRecs.length ? stockRecs[0] : null;
					// 一時的に在庫数を減らす
					stockRec ? stockRec.在庫数.value = parseInt(stockRec.在庫数.value) - needBara : "";

					// 商品情報を作成
					itemInfos.push({
						value: {
							商品コード: { value: mattRec['商品コード_' + jj].value },
							セット入数: { value: mattRec['セット入数_' + jj].value },
							賞味期限: { value: stockRec ? stockRec.賞味期限.value : "" },
							//不足: { value: stockRec ? "" : "不足" },
							ロケーション: { value: stockRec ? stockRec.ロケーション.value : "" },
							備考: { value: stockRec ? stockRec.備考.value : "" },
						}
					});
				}
				if (itemInfos.length)
				{
					arrRtn.push({
						出荷管理アプリID: { value: HC_APP_ID_SHIPPING_AU },
						出荷管理レコードID: { value: shipRecords.au[ii].$id.value },
						案件グループID: { value: mattRec.案件グループID.value },
						案件レコードID: { value: mattRec.$id.value },
						モール管理番号: { value: mattRec.モール管理番号.value },
						出荷管理から取得日: { value: dtExecute },

						商品情報: { value: itemInfos },

						掲載媒体名: { value: mattRec.掲載媒体名_表示用.value },
						注文番号: { value: shipRecords.au[ii].seq.value },
						注文日: { value: luxon.DateTime.fromISO(shipRecords.au[ii].申込日時.value).toFormat('yyyy-MM-dd') },
						注文数: { value: shipRecords.au[ii].数量.value },
						掲載商品名: { value: mattRec.掲載商品名.value },
						//配送日指定: { value: "" },
						時間帯指定: { value: "0" },
						サイズ: { value: mattRec.配送サイズ_GDL.value },
						//のし: { value: "" },

						/*
						注文者名: { value: shipRecords.au[ii].会員名.value },
						注文者かな: { value: shipRecords.au[ii].会員かな.value },
						注文者郵便番号: { value: shipRecords.au[ii].会員郵便番号.value },
						注文者住所: { value: shipRecords.au[ii].会員都道府県.value + shipRecords.au[ii].会員住所１.value + shipRecords.au[ii].会員住所２.value },
						注文者電話番号: { value: shipRecords.au[ii].会員電話番号.value },

						送付先名: { value: shipRecords.au[ii].送り先名.value },
						送付先かな: { value: shipRecords.au[ii].送り先かな.value },
						送付先郵便番号: { value: shipRecords.au[ii].送り先郵便番号.value },
						送付先住所: { value: shipRecords.au[ii].送り先都道府県.value + shipRecords.au[ii].送り先住所１.value + shipRecords.au[ii].送り先住所２.value },
						送付先電話番号: { value: shipRecords.au[ii].送り先電話番号.value },
						*/

						配送業者: { value: mattRec.配送業者.value },
					});
				}
			}
		}
		return arrRtn;
	}
	/**
	 * 出荷指示アプリ用にデータを生成（Tサンプル）
	 * @returns
	 */
	const CreateDataForShipInstruction_TSAMPLE = async () =>
	{
		let arrRtn = [];

		for (let ii = 0; ii < shipRecords.Tサンプル.length; ii++)
		{
			// 案件レコードを取得
			let mattRec = mattRecords.find(record => record.掲載媒体名.value === "Tサンプル" && record.モール管理番号.value === shipRecords.Tサンプル[ii].PJTID.value);
			if (mattRec)
			{
				let itemInfos = [];
				// 案件の商品1～10でループ
				for (let jj = 1; jj <= 10; jj++)
				{
					// 商品レコードを取得
					if (!mattRec['商品コード_' + jj].value) continue;
					let itemRec = itemRecords.find(record => record.商品コード.value === mattRec['商品コード_' + jj].value);
					if (!itemRec) continue;

					// 必要バラ数
					let needBara = shipRecords.Tサンプル[ii].数量.value * mattRec['セット入数_' + jj].value;

					// 在庫管理のレコードを取得
					let stockRecs = stockRecords.filter(record =>
						record.商品コード.value === mattRec['商品コード_' + jj].value &&
						(mattRec.最短賞味期限.value === null || record.賞味期限.value >= mattRec.最短賞味期限.value) &&
						parseInt(record.在庫数.value) >= needBara
					);
					// stockRecsを賞味期限の昇順にする
					stockRecs.sort((a, b) => new Date(a.賞味期限.value) - new Date(b.賞味期限.value));
					// 賞味期限が最も早いレコードを取得
					let stockRec = stockRecs.length ? stockRecs[0] : null;
					// 一時的に在庫数を減らす
					stockRec ? stockRec.在庫数.value = parseInt(stockRec.在庫数.value) - needBara : "";

					// 商品情報を作成
					itemInfos.push({
						value: {
							商品コード: { value: mattRec['商品コード_' + jj].value },
							セット入数: { value: mattRec['セット入数_' + jj].value },
							賞味期限: { value: stockRec ? stockRec.賞味期限.value : "" },
							//不足: { value: stockRec ? "" : "不足" },
							ロケーション: { value: stockRec ? stockRec.ロケーション.value : "" },
							備考: { value: stockRec ? stockRec.備考.value : "" },
						}
					});
				}
				if (itemInfos.length)
				{
					arrRtn.push({
						出荷管理アプリID: { value: HC_APP_ID_SHIPPING_TSAMPLE },
						出荷管理レコードID: { value: shipRecords.Tサンプル[ii].$id.value },
						案件グループID: { value: mattRec.案件グループID.value },
						案件レコードID: { value: mattRec.$id.value },
						モール管理番号: { value: mattRec.モール管理番号.value },
						出荷管理から取得日: { value: dtExecute },

						商品情報: { value: itemInfos },

						掲載媒体名: { value: mattRec.掲載媒体名_表示用.value },
						注文番号: { value: shipRecords.Tサンプル[ii].seq.value },
						注文日: { value: luxon.DateTime.fromISO(shipRecords.Tサンプル[ii].申込日時.value).toFormat('yyyy-MM-dd') },
						注文数: { value: shipRecords.Tサンプル[ii].数量.value },
						掲載商品名: { value: mattRec.掲載商品名.value },
						//配送日指定: { value: "" },
						時間帯指定: { value: "0" },
						サイズ: { value: mattRec.配送サイズ_GDL.value },
						//のし: { value: "" },

						/*
						注文者名: { value: shipRecords.Tサンプル[ii].会員名.value },
						注文者かな: { value: shipRecords.Tサンプル[ii].会員かな.value },
						注文者郵便番号: { value: shipRecords.Tサンプル[ii].会員郵便番号.value },
						注文者住所: { value: shipRecords.Tサンプル[ii].会員都道府県.value + shipRecords.Tサンプル[ii].会員住所１.value + shipRecords.Tサンプル[ii].会員住所２.value },
						注文者電話番号: { value: shipRecords.Tサンプル[ii].会員電話番号.value },

						送付先名: { value: shipRecords.Tサンプル[ii].送り先名.value },
						送付先かな: { value: shipRecords.Tサンプル[ii].送り先かな.value },
						送付先郵便番号: { value: shipRecords.Tサンプル[ii].送り先郵便番号.value },
						送付先住所: { value: shipRecords.Tサンプル[ii].送り先都道府県.value + shipRecords.Tサンプル[ii].送り先住所１.value + shipRecords.Tサンプル[ii].送り先住所２.value },
						送付先電話番号: { value: shipRecords.Tサンプル[ii].送り先電話番号.value },
						*/

						配送業者: { value: mattRec.配送業者.value },
					});

				}
			}
		}
		return arrRtn;
	}
	/**
	 * 出荷指示アプリ用にデータを生成（くまポン & WELBOX 兼用）
	 * @returns
	 */
	const CreateDataForShipInstruction_KUMAPON = async () =>
	{
		let arrRtn = [];

		// 「くまポン」アプリから取得した全レコード（くまポンとWELBOXを含む）でループ
		for (let ii = 0; ii < shipRecords.くまポン.length; ii++)
		{
			const shipRec = shipRecords.くまポン[ii];
			// レコードに「媒体名」フィールドが存在しない場合、デフォルトで「くまポン」として扱う
			const mediaName = (shipRec.媒体名 && shipRec.媒体名.value) ? shipRec.媒体名.value : 'くまポン';

			// 案件レコードを、レコード自身の媒体名を使って検索
			let mattRec = mattRecords.find(record =>
				record.掲載媒体名.value === mediaName &&
				record.モール管理番号.value === shipRec[mallManageNumber.くまポン].value
			);

			if (mattRec)
			{
				let itemInfos = [];
				// 案件の商品1～10でループ
				for (let jj = 1; jj <= 10; jj++)
				{
					// 商品レコードを取得
					if (!mattRec['商品コード_' + jj].value) continue;
					let itemRec = itemRecords.find(record => record.商品コード.value === mattRec['商品コード_' + jj].value);
					if (!itemRec) continue;

					// 必要バラ数
					let needBara = shipRec.数量.value * mattRec['セット入数_' + jj].value;

					// 在庫管理のレコードを取得
					let stockRecs = stockRecords.filter(record =>
						record.商品コード.value === mattRec['商品コード_' + jj].value &&
						(mattRec.最短賞味期限.value === null || record.賞味期限.value >= mattRec.最短賞味期限.value) &&
						parseInt(record.在庫数.value) >= needBara
					);
					// stockRecsを賞味期限の昇順にする
					stockRecs.sort((a, b) => new Date(a.賞味期限.value) - new Date(b.賞味期限.value));
					// 賞味期限が最も早いレコードを取得
					let stockRec = stockRecs.length ? stockRecs[0] : null;
					// 一時的に在庫数を減らす
					stockRec ? stockRec.在庫数.value = parseInt(stockRec.在庫数.value) - needBara : "";

					// 商品情報を作成
					itemInfos.push({
						value: {
							商品コード: { value: mattRec['商品コード_' + jj].value },
							セット入数: { value: mattRec['セット入数_' + jj].value },
							賞味期限: { value: stockRec ? stockRec.賞味期限.value : "" },
							//不足: { value: stockRec ? "" : "不足" },
							ロケーション: { value: stockRec ? stockRec.ロケーション.value : "" },
							備考: { value: stockRec ? stockRec.備考.value : "" },
						}
					});
				}

				if (itemInfos.length)
				{
					let warehouseRec = warehouseRecords.find(record => record.倉庫ID.value == "103");

					// 出荷指示アプリに登録するレコード本体を作成
					let newRecord = {
						出荷管理アプリID: { value: HC_APP_ID_SHIPPING_KUMAPON },
						出荷管理レコードID: { value: shipRec.$id.value },
						案件グループID: { value: mattRec.案件グループID.value },
						案件レコードID: { value: mattRec.$id.value },
						モール管理番号: { value: mattRec.モール管理番号.value },
						出荷管理から取得日: { value: dtExecute },
						商品情報: { value: itemInfos },
						掲載媒体名: { value: mattRec.掲載媒体名_表示用.value },
						注文番号: { value: shipRec.購入番号.value },
						注文日: { value: luxon.DateTime.fromISO(shipRec.購入日時.value).toFormat('yyyy-MM-dd') },
						注文数: { value: shipRec.数量.value },
						掲載商品名: { value: mattRec.掲載商品名.value },
						時間帯指定: { value: "0" },
						サイズ: { value: mattRec.配送サイズ_GDL.value },
						注文者名: { value: shipRec.会員名.value },
						注文者かな: { value: shipRec.会員かな.value },
						注文者郵便番号: { value: shipRec.会員郵便番号.value },
						注文者住所: { value: shipRec.会員都道府県.value + shipRec.会員住所１.value + (shipRec.会員住所２ ? shipRec.会員住所２.value : '') },
						注文者電話番号: { value: shipRec.会員電話番号.value },
						送付先名: { value: shipRec.送り先名.value },
						送付先かな: { value: shipRec.送り先かな.value },
						送付先郵便番号: { value: shipRec.送り先郵便番号.value },
						送付先住所: { value: shipRec.送り先都道府県.value + shipRec.送り先住所１.value + (shipRec.送り先住所２ ? shipRec.送り先住所２.value : '') },
						送付先電話番号: { value: shipRec.送り先電話番号.value },
						ご依頼主名: { value: warehouseRec.倉庫名.value },
						ご依頼主郵便番号: { value: warehouseRec.郵便番号.value },
						ご依頼主住所: { value: warehouseRec.住所.value },
						ご依頼主電話番号: { value: warehouseRec.電話番号.value },
						配送業者: { value: mattRec.配送業者.value },
					};

					// 【追加要望】WELBOXの場合のみ「記事欄1」に自動記入
					if (mediaName === 'WELBOX') {
						newRecord['記事欄1'] = { value: 'WELBOX' };
					}

					arrRtn.push(newRecord);
				}
			}
		}
		return arrRtn;
	}
	/**
	 * 出荷指示アプリ用にデータを生成（eecoto）
	 * @returns
	 */
	const CreateDataForShipInstruction_EECOTO = async () =>
	{
		let arrRtn = [];

		for (let ii = 0; ii < shipRecords.eecoto.length; ii++)
		{
			// 案件レコードを取得
			let mattRec = mattRecords.find(record => record.掲載媒体名.value === "eecoto" && record.案件グループID.value === shipRecords.eecoto[ii][mallManageNumber.eecoto].value);
			if (mattRec)
			{
				let itemInfos = [];
				// 案件の商品1～10でループ
				for (let jj = 1; jj <= 10; jj++)
				{
					// 商品レコードを取得
					if (!mattRec['商品コード_' + jj].value) continue;
					let itemRec = itemRecords.find(record => record.商品コード.value === mattRec['商品コード_' + jj].value);
					if (!itemRec) continue;

					// 必要バラ数
					let needBara = shipRecords.eecoto[ii].数量.value * mattRec['セット入数_' + jj].value;

					// 在庫管理のレコードを取得
					let stockRecs = stockRecords.filter(record =>
						record.商品コード.value === mattRec['商品コード_' + jj].value &&
						(mattRec.最短賞味期限.value === null || record.賞味期限.value >= mattRec.最短賞味期限.value) &&
						parseInt(record.在庫数.value) >= needBara
					);
					// stockRecsを賞味期限の昇順にする
					stockRecs.sort((a, b) => new Date(a.賞味期限.value) - new Date(b.賞味期限.value));
					// 賞味期限が最も早いレコードを取得
					let stockRec = stockRecs.length ? stockRecs[0] : null;
					// 一時的に在庫数を減らす
					stockRec ? stockRec.在庫数.value = parseInt(stockRec.在庫数.value) - needBara : "";

					// 商品情報を作成
					itemInfos.push({
						value: {
							商品コード: { value: mattRec['商品コード_' + jj].value },
							セット入数: { value: mattRec['セット入数_' + jj].value },
							賞味期限: { value: stockRec ? stockRec.賞味期限.value : "" },
							//不足: { value: stockRec ? "" : "不足" },
							ロケーション: { value: stockRec ? stockRec.ロケーション.value : "" },
							備考: { value: stockRec ? stockRec.備考.value : "" },
						}
					});
				}
				if (itemInfos.length)
				{
					let warehouseRec = warehouseRecords.find(record => record.倉庫ID.value == "104");
					arrRtn.push({
						出荷管理アプリID: { value: HC_APP_ID_SHIPPING_EECOTO },
						出荷管理レコードID: { value: shipRecords.eecoto[ii].$id.value },
						案件グループID: { value: mattRec.案件グループID.value },
						案件レコードID: { value: mattRec.$id.value },
						モール管理番号: { value: mattRec.モール管理番号.value },
						出荷管理から取得日: { value: dtExecute },

						商品情報: { value: itemInfos },

						掲載媒体名: { value: mattRec.掲載媒体名_表示用.value },
						注文番号: { value: shipRecords.eecoto[ii].注文ID.value },
						注文日: { value: shipRecords.eecoto[ii].注文日.value },
						注文数: { value: shipRecords.eecoto[ii].数量.value },
						掲載商品名: { value: mattRec.掲載商品名.value },
						//配送日指定: { value: "" },
						時間帯指定: { value: "0" },
						サイズ: { value: mattRec.配送サイズ_GDL.value },
						//のし: { value: "" },

						注文者名: { value: shipRecords.eecoto[ii].氏名_請求者情報.value },
						//注文者かな: { value: shipRecords.eecoto[ii].会員かな.value },
						注文者郵便番号: { value: shipRecords.eecoto[ii].郵便番号_請求者情報.value },
						注文者住所: { value: shipRecords.eecoto[ii].住所_請求者情報.value },
						//注文者電話番号: { value: shipRecords.eecoto[ii].会員電話番号.value },

						送付先名: { value: shipRecords.eecoto[ii].氏名.value },
						//送付先かな: { value: shipRecords.eecoto[ii].送り先かな.value },
						送付先郵便番号: { value: shipRecords.eecoto[ii].郵便番号.value },
						送付先住所: { value: shipRecords.eecoto[ii].住所.value },
						送付先電話番号: { value: shipRecords.eecoto[ii].電話番号.value },

						ご依頼主名: { value: warehouseRec.倉庫名.value },
						ご依頼主郵便番号: { value: warehouseRec.郵便番号.value },
						ご依頼主住所: { value: warehouseRec.住所.value },
						ご依頼主電話番号: { value: warehouseRec.電話番号.value },

						配送業者: { value: mattRec.配送業者.value },
					});
				}
			}
		}
		return arrRtn;
	}
	/**
	 * 出荷指示アプリ用にデータを生成（リロクラブ）
	 * @returns
	 */
	const CreateDataForShipInstruction_RIRO = async () =>
	{
		let arrRtn = [];

		for (let ii = 0; ii < shipRecords.リロ.length; ii++)
		{
			// 案件レコードを取得
			let mattRec = mattRecords.find(record => record.掲載媒体名.value === "リロ" && record.モール管理番号.value === shipRecords.リロ[ii][mallManageNumber.リロ].value);
			if (mattRec)
			{
				let itemInfos = [];
				// 案件の商品1～10でループ
				for (let jj = 1; jj <= 10; jj++)
				{
					// 商品レコードを取得
					if (!mattRec['商品コード_' + jj].value) continue;
					let itemRec = itemRecords.find(record => record.商品コード.value === mattRec['商品コード_' + jj].value);
					if (!itemRec) continue;

					// 必要バラ数
					let needBara = shipRecords.リロ[ii].数量.value * mattRec['セット入数_' + jj].value;

					// 在庫管理のレコードを取得
					let stockRecs = stockRecords.filter(record =>
						record.商品コード.value === mattRec['商品コード_' + jj].value &&
						(mattRec.最短賞味期限.value === null || record.賞味期限.value >= mattRec.最短賞味期限.value) &&
						parseInt(record.在庫数.value) >= needBara
					);
					// stockRecsを賞味期限の昇順にする
					stockRecs.sort((a, b) => new Date(a.賞味期限.value) - new Date(b.賞味期限.value));
					// 賞味期限が最も早いレコードを取得
					let stockRec = stockRecs.length ? stockRecs[0] : null;
					// 一時的に在庫数を減らす
					stockRec ? stockRec.在庫数.value = parseInt(stockRec.在庫数.value) - needBara : "";

					// 商品情報を作成
					itemInfos.push({
						value: {
							商品コード: { value: mattRec['商品コード_' + jj].value },
							セット入数: { value: mattRec['セット入数_' + jj].value },
							賞味期限: { value: stockRec ? stockRec.賞味期限.value : "" },
							//不足: { value: stockRec ? "" : "不足" },
							ロケーション: { value: stockRec ? stockRec.ロケーション.value : "" },
							備考: { value: stockRec ? stockRec.備考.value : "" },
						}
					});
				}
				if (itemInfos.length)
				{
					arrRtn.push({
						出荷管理アプリID: { value: HC_APP_ID_SHIPPING_RIRO },
						出荷管理レコードID: { value: shipRecords.リロ[ii].$id.value },
						案件グループID: { value: mattRec.案件グループID.value },
						案件レコードID: { value: mattRec.$id.value },
						モール管理番号: { value: mattRec.モール管理番号.value },
						出荷管理から取得日: { value: dtExecute },

						商品情報: { value: itemInfos },

						掲載媒体名: { value: mattRec.掲載媒体名_表示用.value },
						注文番号: { value: shipRecords.リロ[ii].注文番号.value },
						注文日: { value: shipRecords.リロ[ii].受付日.value },
						注文数: { value: shipRecords.リロ[ii].数量.value },
						掲載商品名: { value: mattRec.掲載商品名.value },
						//配送日指定: { value: "" },
						時間帯指定: { value: "0" },
						サイズ: { value: mattRec.配送サイズ_GDL.value },
							のし: { value: shipRecords.リロ[ii].のし区分.value },

						注文者名: { value: shipRecords.リロ[ii].送り主名.value },
						注文者かな: { value: shipRecords.リロ[ii].送り主名_カナ.value },
						注文者郵便番号: { value: shipRecords.リロ[ii].送り主郵便番号.value },
						注文者住所: { value: shipRecords.リロ[ii].送付主都道府県.value + shipRecords.リロ[ii].送り主住所.value + shipRecords.リロ[ii].送り主住所番地.value },
						注文者電話番号: { value: shipRecords.リロ[ii].送り主TEL.value },

						送付先名: { value: shipRecords.リロ[ii].お届け先名称.value },
						送付先かな: { value: shipRecords.リロ[ii].お届け先名称_カナ.value },
						送付先郵便番号: { value: shipRecords.リロ[ii].お届け先郵便番号.value },
						送付先住所: { value: shipRecords.リロ[ii].お届け先都道府県.value + shipRecords.リロ[ii].お届け先住所.value + shipRecords.リロ[ii].お届け先番地.value },
						送付先電話番号: { value: shipRecords.リロ[ii].お届け先TEL.value },

						ご依頼主名: { value: shipRecords.リロ[ii].送り主名.value },
						ご依頼主郵便番号: { value: shipRecords.リロ[ii].送り主郵便番号.value },
						ご依頼主住所: { value: shipRecords.リロ[ii].送付主都道府県.value + shipRecords.リロ[ii].送り主住所.value + shipRecords.リロ[ii].送り主住所番地.value },
						ご依頼主電話番号: { value: shipRecords.リロ[ii].送り主TEL.value },

						配送業者: { value: mattRec.配送業者.value },
					});
				}
			}
		}
		return arrRtn;
	}
	/**
	 * 出荷指示アプリ用にデータを生成（ベネフィット・ワン）
	 * @returns
	 */
	const CreateDataForShipInstruction_BENE = async () =>
	{
		let arrRtn = [];

		for (let ii = 0; ii < shipRecords.ベネ.length; ii++)
		{
			// 案件レコードを取得
			let mattRec = mattRecords.find(record => record.掲載媒体名.value === "ベネ" && record.モール管理番号.value === shipRecords.ベネ[ii][mallManageNumber.ベネ].value);
			if (mattRec)
			{
				let itemInfos = [];
				// 案件の商品1～10でループ
				for (let jj = 1; jj <= 10; jj++)
				{
					// 商品レコードを取得
					if (!mattRec['商品コード_' + jj].value) continue;
					let itemRec = itemRecords.find(record => record.商品コード.value === mattRec['商品コード_' + jj].value);
					if (!itemRec) continue;

					// 必要バラ数
					let needBara = shipRecords.ベネ[ii].数量.value * mattRec['セット入数_' + jj].value;

					// 在庫管理のレコードを取得
					let stockRecs = stockRecords.filter(record =>
						record.商品コード.value === mattRec['商品コード_' + jj].value &&
						(mattRec.最短賞味期限.value === null || record.賞味期限.value >= mattRec.最短賞味期限.value) &&
						parseInt(record.在庫数.value) >= needBara
					);
					// stockRecsを賞味期限の昇順にする
					stockRecs.sort((a, b) => new Date(a.賞味期限.value) - new Date(b.賞味期限.value));
					// 賞味期限が最も早いレコードを取得
					let stockRec = stockRecs.length ? stockRecs[0] : null;
					// 一時的に在庫数を減らす
					stockRec ? stockRec.在庫数.value = parseInt(stockRec.在庫数.value) - needBara : "";

					// 商品情報を作成
					itemInfos.push({
						value: {
							商品コード: { value: mattRec['商品コード_' + jj].value },
							セット入数: { value: mattRec['セット入数_' + jj].value },
							賞味期限: { value: stockRec ? stockRec.賞味期限.value : "" },
							//不足: { value: stockRec ? "" : "不足" },
							ロケーション: { value: stockRec ? stockRec.ロケーション.value : "" },
							備考: { value: stockRec ? stockRec.備考.value : "" },
						}
					});
				}
				if (itemInfos.length)
				{
					// 送付先の不備を確認
					let strErrMsg = shipRecords.ベネ[ii]['配送先市区町村・番地'].value ? Number.isNaN(new Date(shipRecords.ベネ[ii]['配送先市区町村・番地'].value).getTime()) ? "" : "送付先住所が不正です" : "";

					arrRtn.push({
						出荷管理アプリID: { value: HC_APP_ID_SHIPPING_BENE },
						出荷管理レコードID: { value: shipRecords.ベネ[ii].$id.value },
						案件グループID: { value: mattRec.案件グループID.value },
						案件レコードID: { value: mattRec.$id.value },
						モール管理番号: { value: mattRec.モール管理番号.value },
						出荷管理から取得日: { value: dtExecute },

						商品情報: { value: itemInfos },

						掲載媒体名: { value: mattRec.掲載媒体名_表示用.value },
						注文番号: { value: shipRecords.ベネ[ii].受付番号.value },
						注文日: { value: luxon.DateTime.fromISO(shipRecords.ベネ[ii].受注日.value).toFormat('yyyy-MM-dd') },
						注文数: { value: shipRecords.ベネ[ii].数量.value },
						掲載商品名: { value: mattRec.掲載商品名.value },
						//配送日指定: { value: "" },
						時間帯指定: { value: "0" },
						サイズ: { value: mattRec.配送サイズ_GDL.value },
						のし: { value: shipRecords.ベネ[ii].のし_ラッピング種別.value + "/" + shipRecords.ベネ[ii].のし用途_ラッピング名称.value },

						注文者名: { value: shipRecords.ベネ[ii].送り主氏名.value },
						注文者かな: { value: shipRecords.ベネ[ii].送り主フリガナ.value },
						注文者郵便番号: { value: shipRecords.ベネ[ii].送り主郵便番号.value },
						注文者住所: { value: shipRecords.ベネ[ii].送り主都道府県.value + shipRecords.ベネ[ii]['送り主市区町村・番地'].value + shipRecords.ベネ[ii]['送り主建物・号室'].value },
						注文者電話番号: { value: shipRecords.ベネ[ii].送り主電話番号.value },

						送付先名: { value: shipRecords.ベネ[ii].配送先名.value },
						送付先かな: { value: shipRecords.ベネ[ii].配送先名カナ.value },
						送付先郵便番号: { value: shipRecords.ベネ[ii].配送先郵便番号.value },
						送付先住所: { value: shipRecords.ベネ[ii].配送先都道府県.value + shipRecords.ベネ[ii]['配送先市区町村・番地'].value + shipRecords.ベネ[ii]['配送先建物・号室'].value },
						送付先電話番号: { value: shipRecords.ベネ[ii].配送先電話番号.value },

						ご依頼主名: { value: shipRecords.ベネ[ii].送り主氏名.value },
						ご依頼主郵便番号: { value: shipRecords.ベネ[ii].送り主郵便番号.value },
						ご依頼主住所: { value: shipRecords.ベネ[ii].送り主都道府県.value + shipRecords.ベネ[ii]['送り主市区町村・番地'].value + shipRecords.ベネ[ii]['送り主建物・号室'].value },
						ご依頼主電話番号: { value: shipRecords.ベネ[ii].送り主電話番号.value },

						配送業者: { value: mattRec.配送業者.value },

						送付先不備: { value: strErrMsg ? '不備あり' : '' },
						不備内容: { value: strErrMsg ? strErrMsg : '' },
					});
				}
			}
		}
		return arrRtn;
	}
	/**
	 * 出荷指示アプリ用にデータを生成（Tポイント）
	 * @returns
	 */
	const CreateDataForShipInstruction_TPOINT = async () =>
	{
		let arrRtn = [];

		for (let ii = 0; ii < shipRecords.Tポイント.length; ii++)
		{
			// 案件レコードを取得
			let mattRec = mattRecords.find(record => record.掲載媒体名.value === "Tポイント" && record.モール管理番号.value === shipRecords.Tポイント[ii][mallManageNumber.Tポイント].value);
			if (mattRec)
			{
				let itemInfos = [];
				// 案件の商品1～10でループ
				for (let jj = 1; jj <= 10; jj++)
				{
					// 商品レコードを取得
					if (!mattRec['商品コード_' + jj].value) continue;
					let itemRec = itemRecords.find(record => record.商品コード.value === mattRec['商品コード_' + jj].value);
					if (!itemRec) continue;

					// 必要バラ数
					let needBara = shipRecords.Tポイント[ii].商品申込数量.value * mattRec['セット入数_' + jj].value;

					// 在庫管理のレコードを取得
					let stockRecs = stockRecords.filter(record =>
						record.商品コード.value === mattRec['商品コード_' + jj].value &&
						(mattRec.最短賞味期限.value === null || record.賞味期限.value >= mattRec.最短賞味期限.value) &&
						parseInt(record.在庫数.value) >= needBara
					);
					// stockRecsを賞味期限の昇順にする
					stockRecs.sort((a, b) => new Date(a.賞味期限.value) - new Date(b.賞味期限.value));
					// 賞味期限が最も早いレコードを取得
					let stockRec = stockRecs.length ? stockRecs[0] : null;
					// 一時的に在庫数を減らす
					stockRec ? stockRec.在庫数.value = parseInt(stockRec.在庫数.value) - needBara : "";

					// 商品情報を作成
					itemInfos.push({
						value: {
							商品コード: { value: mattRec['商品コード_' + jj].value },
							セット入数: { value: mattRec['セット入数_' + jj].value },
							賞味期限: { value: stockRec ? stockRec.賞味期限.value : "" },
							//不足: { value: stockRec ? "" : "不足" },
							ロケーション: { value: stockRec ? stockRec.ロケーション.value : "" },
							備考: { value: stockRec ? stockRec.備考.value : "" },
						}
					});
				}
				if (itemInfos.length)
				{
					let warehouseRec = warehouseRecords.find(record => record.倉庫ID.value == "103");
					arrRtn.push({
						出荷管理アプリID: { value: HC_APP_ID_SHIPPING_TPOINT },
						出荷管理レコードID: { value: shipRecords.Tポイント[ii].$id.value },
						案件グループID: { value: mattRec.案件グループID.value },
						案件レコードID: { value: mattRec.$id.value },
						モール管理番号: { value: mattRec.モール管理番号.value },
						出荷管理から取得日: { value: dtExecute },

						商品情報: { value: itemInfos },

						掲載媒体名: { value: mattRec.掲載媒体名_表示用.value },
						注文番号: { value: shipRecords.Tポイント[ii].オーダー番号.value },
						注文日: { value: luxon.DateTime.fromFormat(shipRecords.Tポイント[ii].申込日時.value, 'yyyyMMddHHmmss').toFormat('yyyy-MM-dd') },
						注文数: { value: shipRecords.Tポイント[ii].商品申込数量.value },
						掲載商品名: { value: mattRec.掲載商品名.value },
						//配送日指定: { value: "" },
						時間帯指定: { value: "0" },
						サイズ: { value: mattRec.配送サイズ_GDL.value },
						//のし: { value: shipRecords.Tポイント[ii].のし_ラッピング種別.value + "/" + shipRecords.Tポイント[ii].のし用途_ラッピング名称.value },

						注文者名: { value: shipRecords.Tポイント[ii].氏名_漢字.value },
						//注文者かな: { value: shipRecords.Tポイント[ii].送り主フリガナ.value },
						注文者郵便番号: { value: shipRecords.Tポイント[ii].郵便番号.value },
						注文者住所: { value: shipRecords.Tポイント[ii].住所.value },
						注文者電話番号: { value: shipRecords.Tポイント[ii].電話番号.value },

						送付先名: { value: shipRecords.Tポイント[ii].氏名_漢字.value },
						//送付先かな: { value: shipRecords.Tポイント[ii].配送先名カナ.value },
						送付先郵便番号: { value: shipRecords.Tポイント[ii].郵便番号.value },
						送付先住所: { value: shipRecords.Tポイント[ii].住所.value },
						送付先電話番号: { value: shipRecords.Tポイント[ii].電話番号.value },

						ご依頼主名: { value: warehouseRec.倉庫名.value },
						ご依頼主郵便番号: { value: warehouseRec.郵便番号.value },
						ご依頼主住所: { value: warehouseRec.住所.value },
						ご依頼主電話番号: { value: warehouseRec.電話番号.value },

						配送業者: { value: mattRec.配送業者.value },
					});
				}
			}
		}
		return arrRtn;
	}
	/**
	 * 出荷指示アプリ用にデータを生成（社販）
	 * @returns
	 */
	const CreateDataForShipInstruction_SHAHAN = async () =>
	{
		let arrRtn = [];

		for (let ii = 0; ii < shipRecords.社販.length; ii++)
		{
			// 案件レコードを取得
			let mattRec = mattRecords.find(record => record.掲載媒体名.value === "社販" && record.モール管理番号.value === shipRecords.社販[ii][mallManageNumber.社販].value);
			if (mattRec)
			{
				let itemInfos = [];
				// 案件の商品1～10でループ
				for (let jj = 1; jj <= 10; jj++)
				{
					// 商品レコードを取得
					if (!mattRec['商品コード_' + jj].value) continue;
					let itemRec = itemRecords.find(record => record.商品コード.value === mattRec['商品コード_' + jj].value);
					if (!itemRec) continue;

					// 必要バラ数
					let needBara = shipRecords.社販[ii].数量.value * mattRec['セット入数_' + jj].value;

					// 在庫管理のレコードを取得
					let stockRecs = stockRecords.filter(record =>
						record.商品コード.value === mattRec['商品コード_' + jj].value &&
						(mattRec.最短賞味期限.value === null || record.賞味期限.value >= mattRec.最短賞味期限.value) &&
						parseInt(record.在庫数.value) >= needBara
					);
					// stockRecsを賞味期限の昇順にする
					stockRecs.sort((a, b) => new Date(a.賞味期限.value) - new Date(b.賞味期限.value));
					// 賞味期限が最も早いレコードを取得
					let stockRec = stockRecs.length ? stockRecs[0] : null;
					// 一時的に在庫数を減らす
					stockRec ? stockRec.在庫数.value = parseInt(stockRec.在庫数.value) - needBara : "";

					// 商品情報を作成
					itemInfos.push({
						value: {
							商品コード: { value: mattRec['商品コード_' + jj].value },
							セット入数: { value: mattRec['セット入数_' + jj].value },
							賞味期限: { value: stockRec ? stockRec.賞味期限.value : "" },
							//不足: { value: stockRec ? "" : "不足" },
							ロケーション: { value: stockRec ? stockRec.ロケーション.value : "" },
							備考: { value: stockRec ? stockRec.備考.value : "" },
						}
					});
				}
				if (itemInfos.length)
				{
					// 送付先の不備を確認
					let strErrMsg = shipRecords.社販[ii]['配送先住所_町名番地'].value ? Number.isNaN(new Date(shipRecords.社販[ii]['配送先住所_町名番地'].value).getTime()) ? "" : "送付先住所が不正です" : "";

					arrRtn.push({
						出荷管理アプリID: { value: HC_APP_ID_SHIPPING_SHAHAN },
						出荷管理レコードID: { value: shipRecords.社販[ii].$id.value },
						案件グループID: { value: mattRec.案件グループID.value },
						案件レコードID: { value: mattRec.$id.value },
						モール管理番号: { value: mattRec.モール管理番号.value },
						出荷管理から取得日: { value: dtExecute },

						商品情報: { value: itemInfos },

						掲載媒体名: { value: mattRec.掲載媒体名_表示用.value },
						注文番号: { value: shipRecords.社販[ii].注文サプライヤID.value },
						注文日: { value: luxon.DateTime.fromISO(shipRecords.社販[ii].注文日.value).toFormat('yyyy-MM-dd') },
						注文数: { value: shipRecords.社販[ii].数量.value },
						掲載商品名: { value: mattRec.掲載商品名.value },
						配送日指定: { value: shipRecords.社販[ii].お届け日指定.value ? luxon.DateTime.fromISO(shipRecords.社販[ii].お届け日指定.value).toFormat('yyyy-MM-dd') : "" },
						時間帯指定: {
							value:
								shipRecords.社販[ii].時間帯指定.value === "指定なし" || shipRecords.社販[ii].時間帯指定.value === "指定無し" ? "00" :
									shipRecords.社販[ii].時間帯指定.value === "午前中" ? "01" :
										shipRecords.社販[ii].時間帯指定.value === "0～10時" ? "06" :
											shipRecords.社販[ii].時間帯指定.value === "10～12時" ? "10" :
												shipRecords.社販[ii].時間帯指定.value === "11～13時" ? "11" :
													shipRecords.社販[ii].時間帯指定.value === "12～14時" ? "12" :
														shipRecords.社販[ii].時間帯指定.value === "13～15時" ? "13" :
															shipRecords.社販[ii].時間帯指定.value === "14～16時" ? "14" :
																shipRecords.社販[ii].時間帯指定.value === "15～17時" ? "15" :
																	shipRecords.社販[ii].時間帯指定.value === "16～18時" ? "16" :
																		shipRecords.社販[ii].時間帯指定.value === "17～19時" ? "17" :
																			shipRecords.社販[ii].時間帯指定.value === "18～20時" ? "18" :
																				shipRecords.社販[ii].時間帯指定.value === "19～21時" ? "19" :
																					shipRecords.社販[ii].時間帯指定.value === "20～22時" ? "20" :
																						shipRecords.社販[ii].時間帯指定.value === "21～23時" ? "21" :
																							shipRecords.社販[ii].時間帯指定.value === "22～24時" ? "22" :
																								shipRecords.社販[ii].時間帯指定.value === "18～21時" ? "04" : "00"
						},
						サイズ: { value: mattRec.配送サイズ_GDL.value },
						//のし: { value: shipRecords.社販[ii].のし_ラッピング種別.value + "/" + shipRecords.社販[ii].のし用途_ラッピング名称.value },

						注文者名: { value: shipRecords.社販[ii].送り主氏名_姓.value + shipRecords.社販[ii].送り主氏名_名.value },
						注文者かな: { value: shipRecords.社販[ii].送り主カナ_姓.value + shipRecords.社販[ii].送り主カナ_名.value },
						注文者郵便番号: { value: shipRecords.社販[ii].送り主郵便番号.value },
						注文者住所: { value: shipRecords.社販[ii].送り主都道府県.value + shipRecords.社販[ii].送り主住所_郡市区.value + shipRecords.社販[ii].送り主住所_町名番地.value + shipRecords.社販[ii].送り主住所_建物名等.value },
						注文者電話番号: { value: shipRecords.社販[ii].送り主電話番号.value },

						送付先名: { value: shipRecords.社販[ii].配送先氏名_姓.value + shipRecords.社販[ii].配送先氏名_名.value },
						送付先かな: { value: shipRecords.社販[ii].配送先カナ_姓.value + shipRecords.社販[ii].配送先カナ_名.value },
						送付先郵便番号: { value: shipRecords.社販[ii].配送先郵便番号.value },
						送付先住所: { value: shipRecords.社販[ii].配送先都道府県.value + shipRecords.社販[ii].配送先住所_郡市区.value + shipRecords.社販[ii].配送先住所_町名番地.value + shipRecords.社販[ii].配送先住所_建物名等.value },
						送付先電話番号: { value: shipRecords.社販[ii].配送先電話番号.value },

						ご依頼主名: { value: shipRecords.社販[ii].送り主氏名_姓.value + shipRecords.社販[ii].送り主氏名_名.value },
						ご依頼主郵便番号: { value: shipRecords.社販[ii].送り主郵便番号.value },
						ご依頼主住所: { value: shipRecords.社販[ii].送り主都道府県.value + shipRecords.社販[ii].送り主住所_郡市区.value + shipRecords.社販[ii].送り主住所_町名番地.value + shipRecords.社販[ii].送り主住所_建物名等.value },
						ご依頼主電話番号: { value: shipRecords.社販[ii].送り主電話番号.value },

						配送業者: { value: mattRec.配送業者.value },

						送付先不備: { value: strErrMsg ? '不備あり' : '' },
						不備内容: { value: strErrMsg ? strErrMsg : '' },
					});
				}
			}
		}
		return arrRtn;
	}
	/**
	 * 出荷指示アプリ用にデータを生成（坂戸以外）
	 * @returns
	 */
	const CreateDataForShipInstruction_SAKADOIGAI = async () =>
	{
		let arrRtn = [];

		for (let ii = 0; ii < shipRecords.坂戸以外.length; ii++)
		{
			// 案件レコードを取得
			let mattRec = mattRecords.find(record => record.掲載媒体名.value === "坂戸以外" && record.モール管理番号.value === shipRecords.坂戸以外[ii][mallManageNumber.坂戸以外].value);
			if (mattRec)
			{
				let itemInfos = [];
				// 案件の商品1～10でループ
				for (let jj = 1; jj <= 10; jj++)
				{
					// 商品レコードを取得
					if (!mattRec['商品コード_' + jj].value) continue;
					let itemRec = itemRecords.find(record => record.商品コード.value === mattRec['商品コード_' + jj].value);
					if (!itemRec) continue;

					// 必要バラ数
					let needBara = shipRecords.坂戸以外[ii].数量.value * mattRec['セット入数_' + jj].value;

					// 在庫管理のレコードを取得
					let stockRecs = stockRecords.filter(record =>
						record.商品コード.value === mattRec['商品コード_' + jj].value &&
						(mattRec.最短賞味期限.value === null || record.賞味期限.value >= mattRec.最短賞味期限.value) &&
						parseInt(record.在庫数.value) >= needBara
					);
					// stockRecsを賞味期限の昇順にする
					stockRecs.sort((a, b) => new Date(a.賞味期限.value) - new Date(b.賞味期限.value));
					// 賞味期限が最も早いレコードを取得
					let stockRec = stockRecs.length ? stockRecs[0] : null;
					// 一時的に在庫数を減らす
					stockRec ? stockRec.在庫数.value = parseInt(stockRec.在庫数.value) - needBara : "";

					// 商品情報を作成
					itemInfos.push({
						value: {
							商品コード: { value: mattRec['商品コード_' + jj].value },
							セット入数: { value: mattRec['セット入数_' + jj].value },
							賞味期限: { value: stockRec ? stockRec.賞味期限.value : "" },
							//不足: { value: stockRec ? "" : "不足" },
							ロケーション: { value: stockRec ? stockRec.ロケーション.value : "" },
							備考: { value: stockRec ? stockRec.備考.value : "" },
						}
					});
				}
				if (itemInfos.length)
				{
					let warehouseRec = warehouseRecords.find(record => record.倉庫ID.value == "103");
					arrRtn.push({
						出荷管理アプリID: { value: HC_APP_ID_SHIPPING_SAKADOIGAI },
						出荷管理レコードID: { value: shipRecords.坂戸以外[ii].$id.value },
						案件グループID: { value: mattRec.案件グループID.value },
						案件レコードID: { value: mattRec.$id.value },
						モール管理番号: { value: mattRec.モール管理番号.value },
						出荷管理から取得日: { value: dtExecute },

						商品情報: { value: itemInfos },

						掲載媒体名: { value: mattRec.掲載媒体名_表示用.value },
						注文番号: { value: shipRecords.坂戸以外[ii].$id.value },
						注文日: { value: shipRecords.坂戸以外[ii].受付日.value },
						注文数: { value: shipRecords.坂戸以外[ii].数量.value },
						掲載商品名: { value: mattRec.掲載商品名.value },
						//配送日指定: { value: luxon.DateTime.fromFormat(shipRecords.坂戸以外[ii].お届け日指定.value, 'yyyy-MM-dd hh:mm').toFormat('yyyy-MM-dd') },
						時間帯指定: { value: "0" },
						サイズ: { value: mattRec.配送サイズ_GDL.value },
						//のし: { value: shipRecords.坂戸以外[ii].のし_ラッピング種別.value + "/" + shipRecords.坂戸以外[ii].のし用途_ラッピング名称.value },

						/*
						注文者名: { value: shipRecords.坂戸以外[ii].送り主氏名_姓.value + shipRecords.坂戸以外[ii].送り主氏名_名.value },
						注文者かな: { value: shipRecords.坂戸以外[ii].送り主カナ_姓.value + shipRecords.坂戸以外[ii].送り主カナ_名.value },
						注文者郵便番号: { value: shipRecords.坂戸以外[ii].送り主郵便番号.value },
						注文者住所: { value: shipRecords.坂戸以外[ii].送り主都道府県.value + shipRecords.坂戸以外[ii].送り主住所_郡市区.value + shipRecords.坂戸以外[ii].送り主住所_町名番地.value + shipRecords.坂戸以外[ii].送り主住所_建物名等.value },
						注文者電話番号: { value: shipRecords.坂戸以外[ii].送り主電話番号.value },
						*/

						送付先名: { value: shipRecords.坂戸以外[ii].お届け先名称.value },
						送付先かな: { value: shipRecords.坂戸以外[ii].お届け先名称_カナ.value },
						送付先郵便番号: { value: shipRecords.坂戸以外[ii].お届け先郵便番号.value },
						送付先住所: { value: shipRecords.坂戸以外[ii].お届け先住所.value },
						送付先電話番号: { value: shipRecords.坂戸以外[ii].お届け先TEL.value },

						ご依頼主名: { value: warehouseRec.倉庫名.value },
						ご依頼主郵便番号: { value: warehouseRec.郵便番号.value },
						ご依頼主住所: { value: warehouseRec.住所.value },
						ご依頼主電話番号: { value: warehouseRec.電話番号.value },

						配送業者: { value: mattRec.配送業者.value },
					});
				}
			}
		}
		return arrRtn;
	}
	/**
	 * 出荷指示アプリ用にデータを生成（KAUCHE）
	 * @returns
	 */
	const CreateDataForShipInstruction_KAUCHE = async () =>
	{
		let arrRtn = [];

		for (let ii = 0; ii < shipRecords.KAUCHE.length; ii++)
		{
			// 案件レコードを取得
			let mattRec = mattRecords.find(record => record.掲載媒体名.value === "おためし" && record.モール管理番号.value === shipRecords.KAUCHE[ii][mallManageNumber.KAUCHE].value);
			if (mattRec)
			{
				let itemInfos = [];
				// 案件の商品1～10でループ
				for (let jj = 1; jj <= 10; jj++)
				{
					// 商品レコードを取得
					if (!mattRec['商品コード_' + jj].value) continue;
					let itemRec = itemRecords.find(record => record.商品コード.value === mattRec['商品コード_' + jj].value);
					if (!itemRec) continue;

					// 必要バラ数
					let needBara = mattRec['セット入数_' + jj].value;

					// 在庫管理のレコードを取得
					let stockRecs = stockRecords.filter(record =>
						record.商品コード.value === mattRec['商品コード_' + jj].value &&
						(mattRec.最短賞味期限.value === null || record.賞味期限.value >= mattRec.最短賞味期限.value) &&
						parseInt(record.在庫数.value) >= needBara
					);
					// stockRecsを賞味期限の昇順にする
					stockRecs.sort((a, b) => new Date(a.賞味期限.value) - new Date(b.賞味期限.value));
					// 賞味期限が最も早いレコードを取得
					let stockRec = stockRecs.length ? stockRecs[0] : null;
					// 一時的に在庫数を減らす
					stockRec ? stockRec.在庫数.value = parseInt(stockRec.在庫数.value) - needBara : "";

					// 商品情報を作成
					itemInfos.push({
						value: {
							商品コード: { value: mattRec['商品コード_' + jj].value },
							セット入数: { value: mattRec['セット入数_' + jj].value },
							賞味期限: { value: stockRec ? stockRec.賞味期限.value : "" },
							//不足: { value: stockRec ? "" : "不足" },
							ロケーション: { value: stockRec ? stockRec.ロケーション.value : "" },
							備考: { value: stockRec ? stockRec.備考.value : "" },
						}
					});
				}
				if (itemInfos.length)
				{
					// 送付先の不備を確認
					let strErrMsg1 = shipRecords.KAUCHE[ii].配送先_丁目番地.value ? Number.isNaN(new Date(shipRecords.KAUCHE[ii].配送先_丁目番地.value).getTime()) ? "" : "送付先住所が不正です" : "";
					let strErrMsg2 = shipRecords.KAUCHE[ii].配送先_建物・部屋番号.value ? Number.isNaN(new Date(shipRecords.KAUCHE[ii].配送先_建物・部屋番号.value).getTime()) ? "" : "送付先住所が不正です" : "";

					let warehouseRec = warehouseRecords.find(record => record.倉庫ID.value == "103");
					arrRtn.push({
						出荷管理アプリID: { value: HC_APP_ID_SHIPPING_KAUCHE },
						出荷管理レコードID: { value: shipRecords.KAUCHE[ii].$id.value },
						案件グループID: { value: mattRec.案件グループID.value },
						案件レコードID: { value: mattRec.$id.value },
						モール管理番号: { value: mattRec.モール管理番号.value },
						出荷管理から取得日: { value: dtExecute },

						商品情報: { value: itemInfos },

						掲載媒体名: { value: mattRec.掲載媒体名_表示用.value },
						注文番号: { value: shipRecords.KAUCHE[ii].注文番号.value },
						注文日: { value: luxon.DateTime.fromJSDate(new Date(shipRecords.KAUCHE[ii].注文日時.value)).toFormat('yyyy-MM-dd') },
						注文数: { value: 1 },
						掲載商品名: { value: mattRec.掲載商品名.value },
						//配送日指定: { value: luxon.DateTime.fromFormat(shipRecords.坂戸以外[ii].お届け日指定.value, 'yyyy-MM-dd hh:mm').toFormat('yyyy-MM-dd') },
						時間帯指定: { value: "0" },
						サイズ: { value: mattRec.配送サイズ_GDL.value },
						//のし: { value: shipRecords.坂戸以外[ii].のし_ラッピング種別.value + "/" + shipRecords.坂戸以外[ii].のし用途_ラッピング名称.value },

						/*
						注文者名: { value: shipRecords.坂戸以外[ii].送り主氏名_姓.value + shipRecords.坂戸以外[ii].送り主氏名_名.value },
						注文者かな: { value: shipRecords.坂戸以外[ii].送り主カナ_姓.value + shipRecords.坂戸以外[ii].送り主カナ_名.value },
						注文者郵便番号: { value: shipRecords.坂戸以外[ii].送り主郵便番号.value },
						注文者住所: { value: shipRecords.坂戸以外[ii].送り主都道府県.value + shipRecords.坂戸以外[ii].送り主住所_郡市区.value + shipRecords.坂戸以外[ii].送り主住所_町名番地.value + shipRecords.坂戸以外[ii].送り主住所_建物名等.value },
						注文者電話番号: { value: shipRecords.坂戸以外[ii].送り主電話番号.value },
						*/

						送付先名: { value: shipRecords.KAUCHE[ii].配送先_氏名.value },
						//送付先かな: { value: shipRecords.KAUCHE[ii].お届け先名称_カナ.value },
						送付先郵便番号: { value: shipRecords.KAUCHE[ii].配送先_郵便番号.value },
						送付先住所: { value: shipRecords.KAUCHE[ii].配送先_都道府県.value + shipRecords.KAUCHE[ii].配送先_市区町村.value + shipRecords.KAUCHE[ii].配送先_丁目番地.value + shipRecords.KAUCHE[ii].配送先_建物・部屋番号.value },
						送付先電話番号: { value: shipRecords.KAUCHE[ii].配送先_電話番号.value },

						ご依頼主名: { value: warehouseRec.倉庫名.value },
						ご依頼主郵便番号: { value: warehouseRec.郵便番号.value },
						ご依頼主住所: { value: warehouseRec.住所.value },
						ご依頼主電話番号: { value: warehouseRec.電話番号.value },

						配送業者: { value: mattRec.配送業者.value },

						送付先不備: { value: strErrMsg1 || strErrMsg2 ? '不備あり' : '' },
						不備内容: { value: strErrMsg1 ? strErrMsg1 : strErrMsg2 ? strErrMsg2 : '' },
					});
				}
			}
		}
		return arrRtn;
	}

	/**
	 * 出荷管理のレコードURLを追加
	 * @param {*} allRec
	 */
	const AddRecordUrl = (allRec) =>
	{
		for (let ii = 0; ii < allRec.length; ii++)
		{
			allRec[ii]['出荷管理のレコードURL'] = { value: `https://s4i8kg86wpie.cybozu.com/k/${allRec[ii].出荷管理アプリID.value}/show#record=${allRec[ii].出荷管理レコードID.value}` };
		}
		return allRec;
	}

/**
 * 住所不備の確認
 * @param {*} allRec
 * @returns
 */
const CheckAddress = (allRec) =>
	{
		/*
		郵便番号：空欄、ハイフン抜き、桁数、全角NG
		氏名：空欄
		住所：市区町村、番地の抜けている
		電話番号：空欄、ハイフン抜きの桁数（10 ～ 11桁）、半角
		*/
		for (let ii = 0; ii < allRec.length; ii++)
		{
			let errMsg = [];

    // 郵便番号
    if ('送付先郵便番号' in allRec[ii])
      {
          let val = allRec[ii]['送付先郵便番号'].value;
          if (!val)
          {
              errMsg.push("郵便番号が空欄です。");
          }
          else
          {
              val = val.replace(/-|ー|－/g, "");
              val = val.replace(/[０-９]/g, (s) => {
                  return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
              });

              // ✅ 追加した修正
              if (val.length < 7) {
                  val = val.padStart(7, '0');
              }
              if (val.length !== 7) {
                  errMsg.push("郵便番号が7桁ではありません。");
              }
          }
          allRec[ii]['送付先郵便番号'] = { value: val };
      }

			// 氏名
			if ('送付先名' in allRec[ii] && !allRec[ii].送付先名.value)
			{
				errMsg.push("氏名が空欄です。");
			}

			// 住所
			if ('送付先住所' in allRec[ii])
			{
				let val = allRec[ii].送付先住所.value;
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
			if ('送付先電話番号' in allRec[ii])
			{
				let val = allRec[ii]['送付先電話番号'].value;
				if (!val)
				{
					errMsg.push("電話番号が空欄です。");
				}
				else
				{
					val = val.replace(/-|ー|－/g, "");
					val = val.replace(/[０-９]/g, (s) => {
						return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
					});
					// ✅ 修正ポイント：先頭の +81 または 81 を 0 に変換
					val = val.replace(/^(+81|81)/, "0");
					val = val.startsWith("0") ? val : "0" + val;

					if (val.length !== 10 && val.length !== 11)
					{
						errMsg.push("電話番号が10桁または11桁ではありません。");
					}
				}
				allRec[ii]['送付先電話番号'] = { value: val };
			}

			if (errMsg.length)
			{
				allRec[ii]['送付先不備'] = { value: '不備あり' };
				if ('不備内容' in allRec[ii])
				{
					allRec[ii]['不備内容'] = { value: allRec[ii].不備内容.value + "\n" + errMsg.join("\n") };
				} else
				{
					allRec[ii]['不備内容'] = { value: errMsg.join("\n") };
				}
				continue;
			}
		}

		return allRec;
	}

	/**
	 * 出荷管理のデータを出荷指示アプリ用に生成
	 * @returns
	 */
	const CreateDataForShipInstruction = async () =>
	{
		let allRec = [];

		/*
		// au
		let rec_AU = await CreateDataForShipInstruction_AU();
		if (rec_AU.length) allRec = allRec.concat(rec_AU);

		// Tサンプル
		let rec_TSAMPLE = await CreateDataForShipInstruction_TSAMPLE();
		if (rec_TSAMPLE.length) allRec = allRec.concat(rec_TSAMPLE);
		*/

		// くまポン
		let rec_KUMAPON = await CreateDataForShipInstruction_KUMAPON();
		if (rec_KUMAPON.length) allRec = allRec.concat(rec_KUMAPON);

		// eecoto
		let rec_EECOTO = await CreateDataForShipInstruction_EECOTO();
		if (rec_EECOTO.length) allRec = allRec.concat(rec_EECOTO);

		// リロ
		let rec_RIRO = await CreateDataForShipInstruction_RIRO();
		if (rec_RIRO.length) allRec = allRec.concat(rec_RIRO);

		// ベネ
		let rec_BENE = await CreateDataForShipInstruction_BENE();
		if (rec_BENE.length) allRec = allRec.concat(rec_BENE);

		// Tポイント
		let rec_TPOINT = await CreateDataForShipInstruction_TPOINT();
		if (rec_TPOINT.length) allRec = allRec.concat(rec_TPOINT);

		// 社販
		let rec_SHAHAN = await CreateDataForShipInstruction_SHAHAN();
		if (rec_SHAHAN.length) allRec = allRec.concat(rec_SHAHAN);

		// 坂戸以外
		let rec_SAKADOIGAI = await CreateDataForShipInstruction_SAKADOIGAI();
		if (rec_SAKADOIGAI.length) allRec = allRec.concat(rec_SAKADOIGAI);

		// KAUCHE
		let rec_KAUCHE = await CreateDataForShipInstruction_KAUCHE();
		if (rec_KAUCHE.length) allRec = allRec.concat(rec_KAUCHE);

		// レコードURLを追加
		allRec = AddRecordUrl(allRec);

		// 住所不備確認
		allRec = CheckAddress(allRec);

    // 電話番号補正
    allRec = FixPhoneNumbers(allRec);

		return allRec;
	}

	/**
	 * 出荷指示アプリにレコードを一括作成
	 * @param {*} recData
	 * @returns
	 */
	const AddRecordsForShipInstruction = async (recData) =>
	{
		try
		{
			return client.record.addAllRecords({ app: APP_ID, records: recData })
				.then(function (resp)
				{
					resParam.status = 1;
					return resp;
				})
				.catch(function (e)
				{
					console.log(e);
					resParam.status = 9;
					resParam.message = `出荷指示アプリにレコードを作成できませんでした.\n` + e;
					return;
				});
		}
		catch (ex)
		{
			console.log(ex);
			resParam.status = 9;
			resParam.message = `出荷指示アプリにレコードを作成できませんでした.\n` + ex;
			return;
		}
	}

	/**
	 * 出荷管理アプリのレコードを更新
	 * @param {*} recData
	 * @returns
	 */
	const UpdateAllRecords = async (appId, recData) =>
	{
		try
		{
			resParam.status = 1;
			await client.record.updateAllRecords({ app: appId, records: recData });
		}
		catch (e)
		{
			console.log(e);
			resParam.status = 9;
			resParam.message = `レコードを更新できませんでした.\n` + e;
		}
	}

	/**
	 * 出荷管理アプリの「運用ステータス」を"出荷依頼済み"変更
	 * @param {*} recData
	 * @returns
	 */
	const UpdateShippingRecords = async (recData) =>
	{
		for (const key in shipRecords)
		{
			if (shipRecords.hasOwnProperty(key))
			{
				let appId = "";
				switch (key)
				{
					/*
					case "au":
						appId = HC_APP_ID_SHIPPING_AU;
						break;
					case "Tサンプル":
						appId = HC_APP_ID_SHIPPING_TSAMPLE;
						break;
					*/
					case "くまポン":
						appId = HC_APP_ID_SHIPPING_KUMAPON;
						break;
					case "eecoto":
						appId = HC_APP_ID_SHIPPING_EECOTO;
						break;
					case "リロ":
						appId = HC_APP_ID_SHIPPING_RIRO;
						break;
					case "ベネ":
						appId = HC_APP_ID_SHIPPING_BENE;
						break;
					case "Tポイント":
						appId = HC_APP_ID_SHIPPING_TPOINT;
						break;
					case "社販":
						appId = HC_APP_ID_SHIPPING_SHAHAN;
						break;
					case "坂戸以外":
						appId = HC_APP_ID_SHIPPING_SAKADOIGAI;
						break;
					case "KAUCHE":
						appId = HC_APP_ID_SHIPPING_KAUCHE;
						break;
				}
				let addedRecords = recData.filter(record => record["出荷管理アプリID"].value == appId);
				let gatherRecords = shipRecords[key];
				let updateRecords = [];

				for (let ii = 0; ii < gatherRecords.length; ii++)
				{
					let findRecord = addedRecords.find(record => record["出荷管理レコードID"].value == gatherRecords[ii].$id.value);
					if (findRecord)
					{
						updateRecords.push({
							id: gatherRecords[ii].$id.value,
							record: { "運用ステータス": { value: "出荷依頼済み" } }
						});
					}
				}

				if (updateRecords.length > 0)
				{
					await UpdateAllRecords(appId, updateRecords);
				}
			}
		}
	}

	/**
	 * メイン処理
	 * @returns
	 */
	const GatherShippingRecords_Main = async () =>
	{
		try
		{
			spinner.open();

			// 実行日
			dtExecute = luxon.DateTime.local().toFormat('yyyy-MM-dd');

			// 出荷管理アプリから「出荷依頼」のデータを取得
			await GetShippingRecords();
			console.log("✅ 出荷依頼データ取得完了", shipRecords);
			if (resParam.status != 1) return;

			// 案件レコードを取得
			await GetMatterRecords();
      console.log("✅ 案件レコード取得完了:", mattRecords);
			if (resParam.status != 1) return;

			// 商品マスタのレコードを取得
			await GetItemRecords();
      console.log("✅ 商品マスタ取得完了:", itemRecords);
			if (resParam.status != 1) return;

			// 在庫管理のレコードを取得
			await GetStockRecords();
			console.log("✅ 在庫管理取得完了:", stockRecords);
			if (resParam.status != 1) return;

			// 倉庫マスタのレコードを取得
			await GetWarehouseRecords();
			console.log("✅ 倉庫マスタ取得完了:", warehouseRecords);
			if (resParam.status != 1) return;



			// 出荷指示アプリ用にデータを生成
			let recData = await CreateDataForShipInstruction();
			console.log("✅ 出荷指示アプリ用データ生成完了:", recData);
			if (resParam.status != 1) return;

			if (recData.length == 0)
			{
				resParam.message = '登録できる注文データがありませんでした。';
				return;
			}

			// 出荷指示アプリにレコード追加
			let addedRecs = await AddRecordsForShipInstruction(recData);
			console.log("出荷指示アプリにレコード追加", addedRecs);
			if (resParam.status != 1) return;

			// 出荷管理アプリの「運用ステータス」を"出荷依頼済み"変更
			await UpdateShippingRecords(recData);
			if (resParam.status != 1) return;

			resParam.message = '各モールの注文データを収集しました。';

		}
		catch (error)
		{
			console.log(error);
			resParam.message = '各モールの注文データの取得に失敗しました。';
		}
		finally
		{
			spinner.close();
			await Swal.fire({
				title: '注文データの収集',
				text: resParam.message,
			});
			location.reload(true);
		}
	}



	/**
	 * 一覧表示イベント
	 * @returns
	 */
	kintone.events.on('app.record.index.show', async (event) =>
	{
		if (event.viewId != 6428047) return event;
		if (!HC_MEMBER.includes(kintone.getLoginUser().code)) return event;

		// ボタン
		if (document.getElementById('hc_button_1') !== null) return;
		var button1 = document.createElement('button');
		button1.id = 'hc_button_1';
		button1.classList.add('kintoneplugin-button-normal');
		button1.innerText = '各モールの注文データを収集';
		kintone.app.getHeaderMenuSpaceElement().appendChild(button1);

		button1.onclick = async () =>
		{
			resParam = { status: 1, message: '' }
			await GatherShippingRecords_Main();
		};

		return event;
	});

})();

/**
 * ご依頼主名・媒体名に基づいて電話番号を補正
 */
const FixPhoneNumbers = (allRec) => {
  console.log("▶ ご依頼主電話番号 上書き処理 開始");
  allRec.forEach((record, i) => {
      const senderName = record['ご依頼主名']?.value || '';
      const mediaName = record['掲載媒体名']?.value || '';
      console.log(`📦 record[${i}] ご依頼主名: ${senderName}, 掲載媒体名: ${mediaName}`);

      if (senderName === 'ハッピーキャンペーン柏センター') {
          console.log(`➡ ご依頼主電話番号を 050-1722-7845 に上書き`);
          record['ご依頼主電話番号'].value = '050-1722-7845';
      } else if (mediaName === 'BEAUTH') {
          console.log(`➡ ご依頼主電話番号を 050-1807-4570 に上書き`);
          record['ご依頼主電話番号'].value = '050-1807-4570';
      }
  });
  console.log("✅ ご依頼主電話番号 上書き処理 完了");
  return allRec;
};