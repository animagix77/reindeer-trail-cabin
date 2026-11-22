(() => {
  const form = document.getElementById('guest-message');
  const note = document.getElementById('guest-note');
  const status = document.getElementById('message-status');
  const inbox = document.getElementById('open-host-inbox');
  const email = document.getElementById('guest-email');
  const website = document.getElementById('guest-website');
  const submit = document.getElementById('message-submit');
  const endpoint = form.dataset.endpoint;
  const direct = Boolean(endpoint && window.fetch && window.crypto?.randomUUID);
  let previousPayload;
  let submissionId;

  if (direct) {
    document.getElementById('guest-reply').hidden = false;
    email.disabled = false;
    email.required = true;
    website.disabled = false;
    submit.textContent = 'Send message';
    document.getElementById('message-hint').textContent = 'Your note goes to Binh and Rose. We’ll reply by email.';
    inbox.textContent = 'Message on Airbnb';
  }
  form.hidden = false;
  form.addEventListener('input', () => {
    note.setCustomValidity('');
    email.setCustomValidity('');
    status.textContent = '';
  });

  async function copyForAirbnb(message) {
    try {
      await navigator.clipboard.writeText(message);
      status.textContent = 'Copied. Open Airbnb and paste your message to send it.';
      inbox.focus();
    } catch {
      note.focus();
      note.select();
      status.textContent = 'Your message is selected. Choose Copy, then open Airbnb to paste and send it.';
    }
  }

  async function sendMessage(message) {
    const fields = { email: email.value.trim(), message, website: website.value };
    const payload = JSON.stringify(fields);
    if (payload !== previousPayload) {
      submissionId = crypto.randomUUID();
      previousPayload = payload;
    }
    submit.disabled = true;
    note.readOnly = email.readOnly = true;
    submit.textContent = 'Sending…';
    status.textContent = 'Sending your message.';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        redirect: 'error',
        referrerPolicy: 'origin',
        body: JSON.stringify({ ...fields, submissionId }),
        signal: controller.signal,
      });
      const result = await response.json();
      if (response.ok && result.ok === true) {
        form.reset();
        previousPayload = undefined;
        status.textContent = 'Thanks for writing. Your message was sent to Binh and Rose.';
      } else if (result.error === 'invalid_email') {
        status.textContent = 'Check your email address and try again.';
      } else if (response.status === 429) {
        status.textContent = 'Please wait a moment and try sending again. Your note is still here.';
      } else {
        if (result.error === 'submission_changed') previousPayload = undefined;
        throw new Error('Delivery unconfirmed');
      }
    } catch {
      status.textContent = 'We couldn’t confirm delivery. Your note is still here. Try again or message us on Airbnb.';
    } finally {
      clearTimeout(timeout);
      note.readOnly = email.readOnly = false;
      submit.disabled = false;
      submit.textContent = 'Send message';
    }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submit.disabled) return;
    const message = note.value.trim();
    if (!message) {
      note.setCustomValidity('Write a message first.');
      note.reportValidity();
      return;
    }
    if (direct) await sendMessage(message);
    else await copyForAirbnb(message);
  });
})();
