async function kvGet(key) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  const r = await fetch(`${url}/get/${key}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await r.json();
  if (!data.result) return null;
  try {
    return typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
  } catch {
    return data.result;
  }
}

async function kvSet(key, value) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  const r = await fetch(`${url}/set/${key}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(value)
  });
  return r.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    let records = (await kvGet('records')) || [];

    if (req.method === 'POST') {
      // 새 기록 추가
      const rec = req.body;
      if (!rec || !rec.id || !rec.student) {
        return res.status(400).json({ error: '필수 항목 누락 (id, student)' });
      }
      // 중복 id 방지
      if (!records.find(r => r.id === rec.id)) {
        records.unshift(rec);
      }
      await kvSet('records', records);
      return res.status(200).json({ success: true, data: rec });
    }

    if (req.method === 'PUT') {
      // 기존 기록 수정
      const rec = req.body;
      if (!rec || !rec.id) {
        return res.status(400).json({ error: '필수 항목 누락 (id)' });
      }
      const idx = records.findIndex(r => r.id === rec.id);
      if (idx === -1) {
        return res.status(404).json({ error: '기록을 찾을 수 없습니다.' });
      }
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
    return res.status(500).json({ error: e.message });
  }
}
