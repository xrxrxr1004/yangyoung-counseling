async function kvGet(key) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  const r = await fetch(`${url}/get/${key}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await r.json();
  return data.result ? JSON.parse(data.result) : null;
}

async function kvSet(key, value) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  await fetch(`${url}/set/${key}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(JSON.stringify(value))
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    let records = await kvGet('records') || [];

    if (req.method === 'POST') {
      const record = req.body;
      if (!record.id || !record.student || !record.date)
        return res.status(400).json({ error: 'id, student, date required' });
      records = [record, ...records];
      await kvSet('records', records);
      return res.status(200).json({ success: true, data: record });

    } else if (req.method === 'PUT') {
      const record = req.body;
      const idx = records.findIndex(r => r.id === record.id);
      if (idx === -1) return res.status(404).json({ error: 'Record not found' });
      records[idx] = record;
      await kvSet('records', records);
      return res.status(200).json({ success: true, data: record });

    } else if (req.method === 'DELETE') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'id required' });
      records = records.filter(r => r.id !== id);
      await kvSet('records', records);
      return res.status(200).json({ success: true });

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
