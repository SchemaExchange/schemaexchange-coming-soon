// The coming-soon page's early-access form (a Vercel function, free on Hobby). Replaces FormSubmit (owner,
// 2026-11-06: it was down and never sent its activation email).
//   GET  /api/early-access → a new quick-check sum { q: "6 + 8", t, sig } (sig = HMAC of the answer + time)
//   POST /api/early-access → checks the sum, the time and the fields, then emails hello@ through Resend
// The sum is checked HERE, so a bot can't skip it by posting straight to this address.
// Settings (Vercel → Project → Settings → Environment Variables, never in the code):
//   RESEND_API_KEY  a Resend API key with "Sending access" for schemaexchange.com
//   FORM_SECRET     any long random text (signs the sums)
const crypto = require("node:crypto");

const TO = "hello@schemaexchange.com";
const FROM = "SchemaExchange <notify@schemaexchange.com>";
const MIN_MS = 3000; // bots send in an instant
const MAX_MS = 2 * 60 * 60 * 1000; // a sum is valid for 2 hours

const sign = (answer, t) => crypto.createHmac("sha256", process.env.FORM_SECRET).update(`${answer}|${t}`).digest("base64url");

function sameSig(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

const text = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// The email (owner, 2026-11-06: "a centred box, logo on top, SCHEMA EXCHANGE under it, the details, a footer, the
// page's dotted background"). Email apps only understand tables + inline styles, and block SVG / CSS patterns, so
// the logo and the dot tile are PNGs on the site. Everything a visitor typed is escaped: no HTML gets through.
const SITE = "https://schemaexchange.com";
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function siteLink(website) {
  const host = website.replace(/^https?:\/\//i, "").split(/[/?#\s]/)[0];
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host)) return esc(website); // not an address: show it as plain text
  return `<a href="https://${esc(host)}" style="color:#3fd0d4;text-decoration:none">${esc(website)}</a>`;
}

function emailHtml({ name, email, website, message }) {
  const font = "font-family:Inter,'Segoe UI',Helvetica,Arial,sans-serif";
  const row = (label, value) => `
    <tr><td style="padding:12px 0;border-top:1px solid #12323a;${font}">
      <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#8aa7ac">${label}</div>
      <div style="margin-top:4px;font-size:15px;line-height:1.5;color:#e8f3f4">${value}</div>
    </td></tr>`;
  const first = esc(name.split(/\s+/)[0]);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><title>Early access request</title></head>
<body style="margin:0;padding:0;background:#020d10">
<div style="display:none;max-height:0;overflow:hidden">${esc(name)} asked for early access${website ? ` (${esc(website)})` : ""}.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#020d10" background="${SITE}/email-dots.png"
  style="background:#020d10 url('${SITE}/email-dots.png') repeat">
<tr><td align="center" style="padding:40px 16px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px">
  <tr><td align="center" style="padding-bottom:28px">
    <img src="${SITE}/email-lockup.png" width="166" height="50" alt="SchemaExchange" style="display:block;border:0">
  </td></tr>
  <tr><td bgcolor="#061a1f" style="background:#061a1f;border:1px solid #12323a;border-radius:24px;padding:28px 28px 24px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="${font};padding-bottom:6px">
        <div style="display:inline-block;border:1px solid #1d5d63;border-radius:999px;padding:4px 12px;font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:#3fd0d4">Early access</div>
        <div style="margin-top:14px;font-size:22px;font-weight:700;color:#ffffff">New early access request</div>
        <div style="margin-top:6px;font-size:14px;line-height:1.6;color:#b9cfd2">${esc(name)} would like to try SchemaExchange.</div>
      </td></tr>
      ${row("Name", esc(name))}
      ${row("Email", `<a href="mailto:${esc(email)}" style="color:#3fd0d4;text-decoration:none">${esc(email)}</a>`)}
      ${row("Website", website ? siteLink(website) : `<span style="color:#8aa7ac">Not given</span>`)}
      <tr><td style="padding:12px 0 4px;border-top:1px solid #12323a;${font}">
        <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#8aa7ac">Message</div>
        <div style="margin-top:8px;padding:14px 16px;background:#020d10;border:1px solid #12323a;border-radius:16px;font-size:15px;line-height:1.6;color:#e8f3f4;white-space:pre-wrap">${message ? esc(message) : `<span style="color:#8aa7ac">No message</span>`}</div>
      </td></tr>
      <tr><td align="center" style="padding-top:22px">
        <a href="mailto:${esc(email)}?subject=${encodeURIComponent("Your SchemaExchange early access")}" style="display:inline-block;background:#3fd0d4;color:#020d10;${font};font-size:15px;font-weight:600;text-decoration:none;border-radius:999px;padding:12px 26px">Reply to ${first}</a>
      </td></tr>
    </table>
  </td></tr>
  <tr><td align="center" style="padding:22px 8px 0;${font};font-size:12px;line-height:1.7;color:#8aa7ac">
    Sent from the early-access form on <a href="${SITE}" style="color:#8aa7ac">schemaexchange.com</a>.<br>
    Pressing Reply answers ${esc(name)} directly.<br>© ${new Date().getFullYear()} SchemaExchange
  </td></tr>
  </table>
</td></tr>
</table>
</body></html>`;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!process.env.FORM_SECRET || !process.env.RESEND_API_KEY) return res.status(500).json({ error: "setup" });

  if (req.method === "GET") {
    const a = 2 + crypto.randomInt(8), b = 1 + crypto.randomInt(9), t = Date.now();
    return res.status(200).json({ q: `${a} + ${b}`, t, sig: sign(a + b, t) });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "method" });

  const body = req.body && typeof req.body === "object" ? req.body : {};
  if (body._honey) return res.status(200).json({ ok: true }); // the hidden trap field: pretend it worked

  const age = Date.now() - Number(body.t);
  if (!(age >= 0) || age > MAX_MS || !sameSig(sign(Number(body.check), Number(body.t)), body.sig)) return res.status(400).json({ error: "check" });
  if (age < MIN_MS) return res.status(400).json({ error: "fast" });

  const name = text(body.name, 100), email = text(body.email, 200), website = text(body.website, 200), message = text(body.message, 3000);
  if (!name || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) return res.status(400).json({ error: "fields" });

  const lines = [`Name: ${name}`, `Email: ${email}`, `Website: ${website || "(not given)"}`, "", message || "(no message)", "", "Sent from the early-access form on schemaexchange.com. Reply to answer them."];
  const sent = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [TO], reply_to: email, subject: `Early access request from ${name}`, html: emailHtml({ name, email, website, message }), text: lines.join("\n") }),
  }).catch(() => null);
  if (!sent || !sent.ok) {
    console.error("early-access: Resend refused", sent && sent.status, sent && (await sent.text().catch(() => "")));
    return res.status(502).json({ error: "send" });
  }
  return res.status(200).json({ ok: true });
};
