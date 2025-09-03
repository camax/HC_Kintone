(function ()
{
  "use strict";

  const client = new KintoneRestAPIClient();

  const UpdateMatterRecord = async (id, record) =>
  {
    try
    {
      let resp = await client.record.updateRecord({
        app: kintone.app.getId(),
        id: id,
        record: record
      });

      console.log(resp);
      return { status: 0 }
    }
    catch (ex)
    {
      console.log(ex);
      return { status: 9, message: ex }
    }
  };


  /**
   * 保存成功時のイベント
   */
  kintone.events.on([
    'app.record.create.submit.success',
    'app.record.edit.submit.success'
  ], async (event) =>
  {
    let record = event.record;

    // 入力済みの場合、skip
    if (record["SEQ_モラタメ"].value.trim()) return event;

    let res = await UpdateMatterRecord(record.$id.value, { ["SEQ_モラタメ"]: { value: record.$id.value } });
    if (res.status)
    {
      console.log(res);
      alert(res.message);
    }

    return event;
  });


})();
