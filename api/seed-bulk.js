export default async function handler(req, res) {
  const KV_URL   = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;
  try {
    const existingRes = await fetch(`${KV_URL}/get/records`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
    const existingData = await existingRes.json();
    const existing = existingData.result ? JSON.parse(existingData.result) : [];
    const baseUrl = `https://${req.headers.host}`;
    const newRes = await fetch(`${baseUrl}/all_records.json`);
    if (!newRes.ok) throw new Error('all_records.json 로드 실패');
    const newRecords = await newRes.json();
    const existingKeys = new Set(existing.map(r => `${r.student}__${r.date}`));
    const toAdd = newRecords.filter(r => !existingKeys.has(`${r.student}__${r.date}`));
    const merged = [...existing, ...toAdd];
    await fetch(`${KV_URL}/set/records`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(merged) });
    return res.json({ success: true, existing: existing.length, added: toAdd.length, total: merged.length });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
