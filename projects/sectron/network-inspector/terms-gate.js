'use strict';
(() => {
  const termsVersion = '1.1';
  const dialog = document.getElementById('terms-dialog');
  const frame = document.getElementById('terms-frame');
  const shell = document.querySelector('.app-shell');
  if (!dialog || !frame || !shell) return;
  let accepted = false;
  shell.inert = true;
  const openGate = () => {
    if (!accepted && !dialog.open) dialog.showModal();
  };
  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
    const message = event.data;
    if (!message || message.version !== termsVersion) return;
    if (message.type === 'ni-terms-accept') {
      accepted = true;
      shell.inert = false;
      dialog.close();
    } else if (message.type === 'ni-terms-decline') {
      openGate();
    }
  });
  dialog.addEventListener('cancel', event => {
    if (!accepted) event.preventDefault();
  });
  dialog.addEventListener('close', () => {
    if (!accepted) openGate();
  });
  openGate();
})();
