import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    let records = await kv.get('records') || [];

    if (req.method === 'POST') {
      // Add new record
      const record = req.body;
      if (!record.id || !record.student || !record.date) {
        return res.status(400).json({ error: 'id, student, date required' });
      }
      records = [record, ...records];
      await kv.set('records', records);
      return res.status(200).json({ success: true, data: record });

    } else if (req.method === 'PUT') {
      // Update record
      const record = req.body;
      const idx = records.findIndex(r => r.id === record.id);
      if (idx === -1) return res.status(404).json({ error: 'Record not found' });
      records[idx] = record;
      await kv.set('records', records);
      return res.status(200).json({ success: true, data: record });

    } else if (req.method === 'DELETE') {
      // Delete record
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'id required' });
      records = records.filter(r => r.id !== id);
      await kv.set('records', records);
      return res.status(200).json({ success: true });

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
