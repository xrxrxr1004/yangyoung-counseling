async function kvGet(key) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('KV 환경변수 없음');
  const r = await fetch(`${url}/get/${key}`, {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store'
  });
  if (!r.ok) throw new Error(`Upstash GET 오류 ${r.status}`);
  const data = await r.json();
  if (data.result === null || data.result === undefined) return [];
  try {
    const parsed = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

async function kvSet(key, value) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('KV 환경변수 없음');
  const r = await fetch(`${url}/set/${key}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'text/plain' },
    body: JSON.stringify(value)
  });
  if (!r.ok) { const text = await r.text(); throw new Error(`Upstash SET 오류 ${r.status}: ${text}`); }
  return r.json();
}

function calcGrade(admissionYear) {
  if (!admissionYear) return null;
  const now = new Date();
  const month = now.getMonth() + 1;
  const schoolYear = month >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const grade = schoolYear - admissionYear + 1;
  return (grade >= 1 && grade <= 3) ? grade : null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    let students = await kvGet('students');

    if (req.method === 'GET') {
      const enriched = students.map(s => ({ ...s, grade: calcGrade(s.admissionYear) }));
      return res.status(200).json({ success: true, data: enriched });
    }

    if (req.method === 'POST') {
      const body = req.body;
      const incoming = Array.isArray(body) ? body : [body];
      let added = 0, skipped = 0;
      for (const s of incoming) {
        if (!s.name) continue;
        const existing = students.find(x => x.name === s.name && x.school === s.school);
        if (!existing) {
          const id = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2,5);
          students.push({
            id,
            name: s.name,
            school: s.school || '',
            admissionYear: s.admissionYear ? Number(s.admissionYear) : null,
            publisher: s.publisher || '',
            textbook: s.textbook || '',
            subTextbook: s.subTextbook || ''
          });
          added++;
        } else {
          // 기존 학생 정보 업데이트 (교재 등 추가 가능)
          if (s.publisher) existing.publisher = s.publisher;
          if (s.textbook) existing.textbook = s.textbook;
          if (s.subTextbook) existing.subTextbook = s.subTextbook;
          if (s.admissionYear) existing.admissionYear = Number(s.admissionYear);
          skipped++;
        }
      }
      await kvSet('students', students);
      return res.status(200).json({ success: true, added, skipped });
    }

    if (req.method === 'PUT') {
      const s = req.body;
      if (!s || !s.id) return res.status(400).json({ error: 'id 필요' });
      const idx = students.findIndex(x => x.id === s.id);
      if (idx === -1) return res.status(404).json({ error: '학생을 찾을 수 없습니다.' });
      students[idx] = { ...students[idx], ...s };
      await kvSet('students', students);
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'id 필요' });
      students = students.filter(s => s.id !== id);
      await kvSet('students', students);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
