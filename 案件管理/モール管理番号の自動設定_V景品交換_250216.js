(async () =>
{
	"use strict";

	const MALL_NUM_PREFIX_TP = "HC";
	const HC_MATTER_APP_ID = kintone.app.getId();

	let nextNumber = "";

	/**
	 * モール管理番号を取得（'HCyyyyMMdd001'）
	 */
	const GetUniqueMallNumberTpoint = async () =>
	{
		let date = luxon.DateTime.now();
		let mallNumPrefix = MALL_NUM_PREFIX_TP + date.toFormat('yyyyMMdd');

		// 案件管理から該当するレコードを取得
		let matterRecords = await new KintoneRestAPIClient().record.getRecords({
			app: HC_MATTER_APP_ID,
			query: `掲載媒体名 = "Tポイント" order by モール管理番号 desc limit 100`,
			fields: ["モール管理番号"]
		});

		let mallNumber = null;
		if (matterRecords.records.length == 0)
		{
			mallNumber = mallNumPrefix + "001";
		}
		else
		{
			// 今日の日付(yyyyMMdd)のモール管理番号だけにする
			let filteredRecords = matterRecords.records.filter(record => record.モール管理番号.value.startsWith(mallNumPrefix));
			if (filteredRecords.length == 0)
			{
				mallNumber = mallNumPrefix + "001";
			}
			else
			{
				// 降順にソート
				filteredRecords.sort((a, b) => b.モール管理番号.value.localeCompare(a.モール管理番号.value));
				// 最後の3文字
				let lastThree = filteredRecords[0].モール管理番号.value.slice(-3);

				mallNumber = mallNumPrefix + (Number(lastThree) + 1).toString().padStart(3, '0');
			}
		}
		return mallNumber;
	}

	/**
	 * 表示時のイベント
	 */
	kintone.events.on(['app.record.create.show', 'app.record.edit.show'], async (event) =>
	{
		nextNumber = await GetUniqueMallNumberTpoint();
	});

	/**
	 * 保存成功時のイベント
	 */
	kintone.events.on([
		'app.record.create.change.掲載媒体名_表示用',
		'app.record.edit.change.掲載媒体名_表示用'
	], (event) =>
	{
		let record = event.record;

		// 掲載媒体名がTポイントの場合
		if (record["掲載媒体名"].value == "Tポイント")
		{
			// 入力済みの場合、skip
			if (record["モール管理番号"].value) return event;

			// モール管理番号を設定（'HCyyyyMMdd001'）
			record["モール管理番号"].value = nextNumber;
		}

		return event;
	});


})();
