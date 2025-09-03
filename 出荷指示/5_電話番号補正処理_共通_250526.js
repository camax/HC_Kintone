const updatePhoneNumbers = async () => {
  console.log('updatePhoneNumbers: 仮の関数が実行されました');
  // TODO: ここに電話番号の補正処理を実装する
};

kintone.events.on('app.record.index.show', async (event) => {
  // すでに実行済みフラグがあればスキップ
  if (window.__phoneFixExecuted) return event;
  window.__phoneFixExecuted = true;

  await updatePhoneNumbers();
  injectTestButton();

  return event;
});

const injectTestButton = () => {
  if (document.getElementById('btn_phonefix_test')) return;

  const btn = document.createElement('button');
  btn.id = 'btn_phonefix_test';
  btn.innerText = '📞 電話番号補正（手動実行）';
  btn.classList.add('kintoneplugin-button-normal');
  btn.onclick = async () => {
    await updatePhoneNumbers();
  };

  kintone.app.getHeaderMenuSpaceElement().appendChild(btn);
};
