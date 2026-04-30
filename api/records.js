import { requireAuth } from './_auth.js';

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  const r = await fetch(`${url}/get/records`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const j = await r.json();
  const records = j.result ? JSON.parse(j.result) : [];
  return res.status(200).json({ data: records });
}
