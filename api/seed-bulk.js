// api/seed-bulk.js
// GET /api/seed-bulk 호출 시 public/all_records.json을 읽어 Upstash에 저장

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const KV_URL   = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;

  try {
    // 1. 기존 records 로드
    const existingRes = await fetch(`${KV_URL}/get/records`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });
    const existingData = await existingRes.json();
    const existing = existingData.result ? JSON.parse(existingData.result) : [];

    // 2. 새 데이터 로드 (public/all_records.json)
    const baseUrl = `https://${req.headers.host}`;
    const newRes = await fetch(`${baseUrl}/all_records.json`);
    if (!newRes.ok) throw new Error('all_records.json 로드 실패');
    const newRecords = await newRes.json();

    // 3. 중복 제거 병합 (student + date 기준)
    const existingKeys = new Set(existing.map(r => `${r.student}__${r.date}`));
    const toAdd = newRecords.filter(r => !existingKeys.has(`${r.student}__${r.date}`));
    const merged = [...existing, ...toAdd];

    // 4. Upstash 저장
    const saveRes = await fetch(`${KV_URL}/set/records`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(merged)
    });
    if (!saveRes.ok) throw new Error('Upstash 저장 실패');

    return res.json({
      success: true,
      existing: existing.length,
      added: toAdd.length,
      total: merged.length
    });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
