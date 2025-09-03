/**
 * GASのウェブAPIを実行し、出荷依頼データを取得する
 */
(() =>
{
	"use strict";

	const spinner = new Kuc.Spinner({
		text: "処理中...",
		container: document.body,
	});

	const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbz1JrmDDgk9HXWcDp2slAMArplABP24EQPBws8h0Hbi3_Fn1v3oQNT8Cb6thYoytRlP2Q/exec';
	const VIEW_ID = 6424111;

	let resParam = { status: 1, message: '' }

	/**
	 * fetchの実行
	 * @param {*} url 
	 * @param {*} param 
	 * @returns 
	 */
	const RunFetch = async (url, param) =>
	{
		let response = await fetch(url, param);

		if (response.ok)
		{
			let jsondata = await response.json();
			return jsondata;
		}
		else
		{
			return `Error: ${response.status} ${response.statusText}`;
		}
	}

	/**
	 * GASのウェブAPIを実行する Main
	 * @param {*}  
	 * @returns 
	 */
	const CallGAS_Main = async () =>
	{
		try
		{
			spinner.open();

			resParam.status = 1;

			// GASのウェブAPIを実行
			let response = await RunFetch(GAS_API_URL, { method: "GET" });
			console.log(response);

			resParam.message = '出荷依頼データを取得しました。';
		}
		catch (ex)
		{
			console.log(ex);
			resParam.message = '出荷依頼データの取得に失敗しました。\n\n' + ex.message;
		}
		finally
		{
			spinner.close();

			await Swal.fire({
				title: '出荷依頼データを取得',
				text: resParam.message
			});
			location.reload();
		}
	}


	kintone.events.on('app.record.index.show', async function (event)
	{
		if (event.viewId != VIEW_ID) return event;

		// ボタン
		if (!document.getElementById('hc_button'))
		{
			var button1 = document.createElement('button');
			button1.id = 'hc_button';
			button1.classList.add('kintoneplugin-button-dialog-ok');
			button1.innerText = '出荷依頼データを取得';
			kintone.app.getHeaderMenuSpaceElement().appendChild(button1);

			button1.onclick = async () =>
			{
				await CallGAS_Main();
			}
		}

	});

})();