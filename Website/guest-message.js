(() => {
  const form = document.getElementById('guest-message');
  const note = document.getElementById('guest-note');
  const status = document.getElementById('message-status');
  const inbox = document.getElementById('open-host-inbox');
  form.hidden = false;
  note.addEventListener('input', () => {
    note.setCustomValidity('');
    status.textContent = '';
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const message = note.value.trim();
    if (!message) {
      note.setCustomValidity('Write a message first.');
      note.reportValidity();
      return;
    }
    try {
      await navigator.clipboard.writeText(message);
      status.textContent = 'Copied. Open Airbnb and paste your message to send it.';
      inbox.focus();
    } catch {
      note.focus();
      note.select();
      status.textContent = 'Your message is selected. Choose Copy, then open Airbnb to paste and send it.';
    }
  });
})();
