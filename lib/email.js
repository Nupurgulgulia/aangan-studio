// Designer handoff and escalation alerts by email, through Resend (https://resend.com).
// Email was chosen over Telegram for the handoff: every designer already has a work inbox, the brief is long enough to
// want a proper layout, and it leaves a searchable record. Without RESEND_API_KEY each send reports "skipped".

const escHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Plain text becomes a simple HTML email: one paragraph per line, plus a button to the dashboard.
export function toHtml(text, link) {
  const body = String(text).split('\n').map((l) => (l ? `<p style="margin:0 0 6px">${escHtml(l)}</p>` : '<br>')).join('');
  const button = link
    ? `<p style="margin:16px 0 0"><a href="${escHtml(link)}" style="background:#0176d3;color:#fff;padding:9px 16px;border-radius:4px;text-decoration:none;font-weight:600">Open in the dashboard</a></p>`
    : '';
  return `<div style="font:14px/1.5 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#181818;max-width:560px">${body}${button}</div>`;
}

export async function sendEmail({ to, subject, text, link }, fetchImpl = fetch) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) return { skipped: true, reason: !key ? 'no Resend key' : 'no email address on file' };
  const res = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'Aangan Studio <onboarding@resend.dev>',
      to: [to],
      subject,
      text: link ? `${text}\n\nOpen in the dashboard: ${link}` : text,
      html: toHtml(text, link),
    }),
  });
  let body = {};
  try { body = await res.json(); } catch { /* empty body */ }
  if (!res.ok || !body.id) return { skipped: true, reason: body.message || `resend error ${res.status}` };
  return { sent: true, message_id: String(body.id) };
}

export function dashboardLink(path = '') {
  const base = (process.env.APP_URL || '').replace(/\/$/, '');
  return base ? `${base}/${path}` : null;
}
