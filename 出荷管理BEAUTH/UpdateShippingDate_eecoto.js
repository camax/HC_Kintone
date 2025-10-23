
/**
 * [eecoto]
 * 出荷日の更新
 *  一覧で選択されたレコードの案件に登録されている商品のGDL出荷日を更新
 */
(() => {
   "use strict";

   const UpdateShippingDate = async () => {
      const client = new KintoneRestAPIClient();
      let resParam = {status:1, message:''};

      try {
         let records = await GetRecordsByList(client);
         if (records.length == 0) {
            return false;
         }

         let upRecords = [];
         // 「GDL出荷日」をボタンを押した日に変更
         let dtNow = luxon.DateTime.local().toFormat('yyyy-MM-dd');
         // 「運用ステータス」を「出荷済み」に変更
         let strStatus = "出荷済み";
         for (let record of records) {
            upRecords.push({
               id: record.$id.value,
               record: {
                  GDL出荷日: { value: dtNow },
                  運用ステータス: { value: strStatus }
               }
            });
         }

         resParam = await UpdateRecords(client, kintone.app.getId(), upRecords);

         if (resParam.status == 1) {
            swal({
               title: '出荷日の更新',
               text: 'GDL出荷日を一括更新しました。',
               icon: 'success',
               timer: 10000
            }).then(function () {
               location.reload(true);
            });

         } else {
            swal({
               title: '出荷日の更新',
               text: 'GDL出荷日の一括更新に失敗しました。',
               icon: 'error',
               timer: 10000
            }).then(function () {
               location.reload(true);
            });
         }

      } catch (ex) {
         console.log(ex)
         swal({
            title: '出荷日更新',
            text: 'GDL出荷日の一括更新に失敗しました。\n' + ex,
            icon: 'error',
            timer: 10000
         }).then(function () {
            location.reload(true);
         });
      }
   }

   /**
    * 一覧に表示されてるレコード取得
    */
   const GetRecordsByList = async (client) => {
      return client.record.getAllRecordsWithCursor({
         app: kintone.app.getId(),
         query: kintone.app.getQueryCondition(),

      }).then(function (response) {
         return response;
      })
   };

   /**
    * レコード一括更新
    */
   const UpdateRecords = async (client, appId, reqRecords) => {
      try {
         return client.record.updateAllRecords({
            app: appId,
            records: reqRecords
         })
            .then(async function (resp) {
               console.log(resp);
               return { status: 1 }

            }).catch(function (e) {
               console.log(e);
               return { status: 9, message: e }
            });

      }
      catch (ex) {
         console.log(ex);
         return { status: 9, message: e }
      }
   };

   kintone.events.on('app.record.index.show', function (event) {

      if (event.viewName === '出荷日更新') {
         if (document.getElementById('hc_button_1') !== null) {
            return;
         }

         var button2 = document.createElement('button');
         button2.id = 'hc_button_1';
         button2.classList.add('kintoneplugin-button-normal');
         button2.innerText = '出荷日更新';
         kintone.app.getHeaderMenuSpaceElement().appendChild(button2);

         const spinner = new Kuc.Spinner({
            text: '処理中...',
            container: document.body
         });

         button2.onclick = function () {
            swal({
               title: '出荷日更新',
               text: '一覧に表示されているレコードのGDL出荷日を一括更新',
               icon: 'info',
               buttons: true

            }).then(async (isOkButton) => {
               if (isOkButton) {
                  spinner.open();

                  try {
                     await UpdateShippingDate();
                  } catch (error) {
                     console.log(error);
                  } finally {
                     spinner.close();
                  }

               } else {
                  return false;
               }
            });
         };

         var targetField = document.getElementById('hc_button_1');
         tippy(targetField, {
            content: '「出荷数更新済み」のGDL出荷日を一括更新',
            arrow: true
         });
      }
   });

})();

