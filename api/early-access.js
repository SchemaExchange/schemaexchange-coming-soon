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
    body: JSON.stringify({ from: FROM, to: [TO], reply_to: email, subject: `Early access request from ${name}`, text: lines.join("\n") }),
  }).catch(() => null);
  if (!sent || !sent.ok) {
    console.error("early-access: Resend refused", sent && sent.status, sent && (await sent.text().catch(() => "")));
    return res.status(502).json({ error: "send" });
  }
  return res.status(200).json({ ok: true });
};
