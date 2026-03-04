async function kvGet(key) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    throw new Error('KV 환경변수 없음: KV_REST_API_URL 또는 KV_REST_API_TOKEN');
  }

  const r = await fetch(`${url}/get/${key}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store'
  });

  if (!r.ok) {
    const text = await r.text();
    throw new Error(`Upstash 오류 ${r.status}: ${text}`);
  }

  const data = await r.json();

  if (data.result === null || data.result === undefined) return [];

  try {
    return typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
  } catch {
    return [];
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const records = await kvGet('records');
    return res.status(200).json({ success: true, data: Array.isArray(records) ? records : [] });
  } catch (e) {
    console.error('records GET error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
