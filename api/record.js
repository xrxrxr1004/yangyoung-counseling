import { requireAuth } from './_auth.js';

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  async function getRecords() {
    const r = await fetch(`${url}/get/records`, { headers });
    const j = await r.json();
    return j.result ? JSON.parse(j.result) : [];
  }

  async function setRecords(records) {
    await fetch(`${url}/set/records`, {
      method: 'POST',
      headers,
      body: JSON.stringify(JSON.stringify(records)),
    });
  }

  if (req.method === 'GET') {
    const { id } = req.query;
    const records = await getRecords();
    if (id) {
      const rec = records.find((r) => r.id === id);
      if (!rec) return res.status(404).json({ error: 'Not found' });
      return res.status(200).json(rec);
    }
    return res.status(200).json(records);
  }

  if (req.method === 'POST') {
    const records = await getRecords();
    const rec = { ...req.body, id: 'r' + Date.now() + Math.random().toString(36).slice(2, 6) };
    records.push(rec);
    await setRecords(records);
    return res.status(200).json(rec);
  }

  if (req.method === 'PUT') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id required' });
    const records = await getRecords();
    const idx = records.findIndex((r) => r.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    records[idx] = { ...records[idx], ...req.body, id };
    await setRecords(records);
    return res.status(200).json(records[idx]);
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id required' });
    let records = await getRecords();
    records = records.filter((r) => r.id !== id);
    await setRecords(records);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
