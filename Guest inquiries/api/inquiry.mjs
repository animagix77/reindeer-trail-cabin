const guestOrigins = new Set(['https://reindeertrail.com', 'https://www.reindeertrail.com']);
const uuidPattern = /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;
const maxBodyBytes = 32_768;

function isReplyAddress(email) {
  if (typeof email !== 'string' || email.length > 254) return false;
  const parts = email.split('@');
  if (parts.length !== 2) return false;
  const [local, host] = parts;
  if (!local || local.length > 64 || local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
  if (!/^[a-z\d.!#$%&'*+/=?^_{}|~\x60-]+$/i.test(local)) return false;
  const labels = host.split('.');
  return labels.length >= 2 && labels.every(label => /^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(label));
}

export default {
  async fetch(request, env) {
    const headers = new Headers({ Vary: 'Origin', 'Cache-Control': 'no-store' });
    const result = (status, error) => Response.json(error ? { ok: false, error } : { ok: true }, { status, headers });
    const origin = request.headers.get('Origin');
    if (!guestOrigins.has(origin)) return result(403, 'origin_not_allowed');
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Allow', 'POST, OPTIONS');
    if (request.method === 'OPTIONS') {
      headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
      headers.set('Access-Control-Allow-Headers', 'Content-Type');
      headers.set('Access-Control-Max-Age', '600');
      return new Response(null, { status: 204, headers });
    }
    if (request.method !== 'POST') return result(405, 'method_not_allowed');
    const contentType = request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase();
    if (contentType !== 'application/json') return result(415, 'json_required');
    if (Number(request.headers.get('Content-Length')) > maxBodyBytes) return result(413, 'body_too_large');

    let data;
    try {
      const decoder = new TextDecoder();
      let body = '';
      let bytes = 0;
      for await (const chunk of request.body) {
        bytes += chunk.byteLength;
        if (bytes > maxBodyBytes) return result(413, 'body_too_large');
        body += decoder.decode(chunk, { stream: true });
      }
      data = JSON.parse(body + decoder.decode());
    } catch {
      return result(400, 'invalid_json');
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) return result(400, 'invalid_fields');
    if (typeof data.website === 'string' && data.website.trim()) return result(200);
    const { submissionId, name = '', email, message } = data;
    if (typeof submissionId !== 'string' || !uuidPattern.test(submissionId)) return result(422, 'invalid_submission_id');
    if (typeof name !== 'string' || name.length > 100 || /[\r\n\x00]/.test(name)) return result(422, 'invalid_name');
    if (!isReplyAddress(email)) return result(422, 'invalid_email');
    if (typeof message !== 'string' || message.length > 4000 || !message.trim()) return result(422, 'invalid_message');

    const settings = env?.RESEND_API_KEY ? env : globalThis.process?.env ?? {};
    const { CABIN_INQUIRY_FROM: from, CABIN_INQUIRY_TO: to, RESEND_API_KEY: key } = settings;
    if (!from || !to || !key) return result(503, 'delivery_unavailable');
    try {
      const delivery = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(7000),
        headers: {
          Authorization: 'Bearer ' + key,
          'Content-Type': 'application/json',
          'Idempotency-Key': 'cabin-inquiry/' + submissionId.toLowerCase(),
        },
        body: JSON.stringify({
          from,
          to: [to],
          reply_to: email,
          subject: 'Guest inquiry · The Reindeer Trail',
          text: [name.trim(), email].filter(Boolean).join('\n') + '\n\n' + message.trim(),
        }),
      });
      if (delivery.status === 429) return result(429, 'please_retry');
      if (delivery.status === 409) {
        const conflict = await delivery.json();
        return conflict.name === 'invalid_idempotent_request'
          ? result(409, 'submission_changed')
          : result(503, 'please_retry');
      }
      if (!delivery.ok) return result(502, 'delivery_unavailable');
      const receipt = await delivery.json();
      if (!receipt.id) return result(502, 'delivery_unavailable');
      return result(200);
    } catch {
      return result(503, 'please_retry');
    }
  },
};
