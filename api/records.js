import { requireAuth } from './_auth.js';

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    return res.status(500).json({ error: 'KV env missing', kvUrl: !!url, kvToken: !!token });
  }

  try {
    const r = await fetch(`${url}/get/records`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!r.ok) {
      const bodyText = await r.text();
      return res.status(500).json({ error: 'KV GET failed', status: r.status, body: bodyText.slice(0, 300) });
    }
    const j = await r.json();
    if (j.result === null || j.result === undefined) {
      return res.status(200).json({ data: [] });
    }
    let records;
    try {
      records = typeof j.result === 'string' ? JSON.parse(j.result) : j.result;
    } catch (parseErr) {
      return res.status(500).json({ error: 'JSON parse failed', detail: parseErr.message, sample: String(j.result).slice(0, 200) });
    }
    return res.status(200).json({ data: Array.isArray(records) ? records : [] });
  } catch (e) {
    return res.status(500).json({ error: 'records fetch threw', detail: e.message, stack: e.stack?.split('\n').slice(0, 5).join(' | ') });
  }
}
