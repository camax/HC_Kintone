/**
 * セット数合計に各モールのセット数・売上_税抜・セット利益の合計値をセットする
 * 
 * ■ 条件
 * ・案件採用された各モールが対象
 * 
 * ■ トリガー
 * ・案件採用フラグが変更された場合
 * ・セット数・売上_税抜・セット利益が変更された場合
 */

(function ()
{
	"use strict";
	const malls = HC.malls;

	const SeSumValue = event =>
	{
		let record = event.record;
		let sumSetNumber = 0;
		let sumSaleNumber = 0;
		let sumSetProfit = 0;

		malls.forEach(mall =>
		{
			if (mall == '坂戸以外') return;

			let length = record['案件採用_' + mall].value.length;
			if (length == 1)
			{
				// 採用のモール[セット数]を加算
				let setNumber = Number(record['セット数_' + mall].value);

				// 採用のモール[売上_税抜]を加算
				let saleNumber = Number(record['売上_税抜_' + mall].value);

				// 採用のモール[セット利益]を加算
				let setProfit = Number(record['セット利益_' + mall].value);

				sumSetNumber += setNumber;
				sumSaleNumber += saleNumber;
				sumSetProfit += setProfit;
			}
		});

		event.record['媒体セット数合計'].value = sumSetNumber;
		event.record['媒体売上合計_税抜'].value = sumSaleNumber;
		event.record['媒体利益合計'].value = sumSetProfit;

		return event;
	}

	let eventsList = []
	malls.forEach(m =>
	{
		if (m == '坂戸以外') return;

		eventsList.push('app.record.create.change.案件採用_' + m);
		eventsList.push('app.record.edit.change.案件採用_' + m);
		eventsList.push('app.record.create.change.セット数_' + m);
		eventsList.push('app.record.edit.change.セット数_' + m);
		eventsList.push('app.record.create.change.売上_税抜_' + m);
		eventsList.push('app.record.edit.change.売上_税抜_' + m);
		eventsList.push('app.record.create.change.セット利益_' + m);
		eventsList.push('app.record.edit.change.セット利益_' + m);
	});
	kintone.events.on(eventsList, SeSumValue);

})();