/**
 * 掲載終了日から1ヶ月半の値を変更
 */
(() =>
{
	"use strict";

	const fieldEnd = '掲載終了日';
	const fieldHalf = '掲載終了日から1ヶ月半';

	// 掲載終了日から1ヶ月半の値を変更
	function updateHalfDate(record)
	{
		if (record[fieldEnd].value)
		{
			record[fieldHalf].value = luxon.DateTime.fromISO(record[fieldEnd].value).plus({ months: 1.5 }).toFormat('yyyy-MM-dd');
		}
		else
		{
			record[fieldHalf].value = "";
		}
	}

	/**
	 * フィールド変更時
	 */
	kintone.events.on([`app.record.create.change.${fieldEnd}`, `app.record.edit.change.${fieldEnd}`], (event) =>
	{
		{
			updateHalfDate(event.record);
		}
		return event;
	});

})();

