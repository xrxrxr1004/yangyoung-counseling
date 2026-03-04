async function kvGet(key) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('KV 환경변수 없음');

  const r = await fetch(`${url}/get/${key}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`Upstash GET 오류 ${r.status}`);

  const data = await r.json();
  if (data.result === null || data.result === undefined) return [];
  try {
    return typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
  } catch {
    return [];
  }
}

async function kvSet(key, value) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('KV 환경변수 없음');

  // Upstash REST API: body를 text/plain으로 전송
  const serialized = JSON.stringify(value);
  const r = await fetch(`${url}/set/${key}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'text/plain'
    },
    body: serialized
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`Upstash SET 오류 ${r.status}: ${text}`);
  }
  return r.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    let records = await kvGet('records');

    if (req.method === 'POST') {
      const rec = req.body;
      if (!rec || !rec.id || !rec.student) {
        return res.status(400).json({ error: '필수 항목 누락 (id, student)' });
      }
      if (!records.find(r => r.id === rec.id)) {
        records.unshift(rec);
      }
      await kvSet('records', records);
      return res.status(200).json({ success: true, data: rec });
    }

    if (req.method === 'PUT') {
      const rec = req.body;
      if (!rec || !rec.id) {
        return res.status(400).json({ error: '필수 항목 누락 (id)' });
      }
      const idx = records.findIndex(r => r.id === rec.id);
      if (idx === -1) return res.status(404).json({ error: '기록을 찾을 수 없습니다.' });
      records[idx] = rec;
      await kvSet('records', records);
      return res.status(200).json({ success: true, data: rec });
    }

    if (req.method === 'DELETE') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'id 필요' });
      records = records.filter(r => r.id !== id);
      await kvSet('records', records);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (e) {
    console.error('record error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
