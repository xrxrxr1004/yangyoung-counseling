import { requireAuth } from './_auth.js';

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  async function getStudents() {
    const r = await fetch(`${url}/get/students`, { headers });
    const j = await r.json();
    return j.result ? JSON.parse(j.result) : [];
  }

  async function setStudents(students) {
    await fetch(`${url}/set/students`, {
      method: 'POST',
      headers,
      body: JSON.stringify(JSON.stringify(students)),
    });
  }

  if (req.method === 'GET') {
    const students = await getStudents();
    return res.status(200).json(students);
  }

  if (req.method === 'POST') {
    // 여러 학생 일괄 등록 or 단일 학생 등록
    const students = await getStudents();
    const incoming = Array.isArray(req.body) ? req.body : [req.body];

    for (const s of incoming) {
      const existing = students.findIndex((x) => x.name === s.name);
      if (existing !== -1) {
        // 기존 학생이면 교재 정보 업데이트
        students[existing] = { ...students[existing], ...s };
      } else {
        students.push({ ...s, id: 's' + Date.now() + Math.random().toString(36).slice(2, 6) });
      }
    }

    await setStudents(students);
    return res.status(200).json(students);
  }

  if (req.method === 'PUT') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id required' });
    const students = await getStudents();
    const idx = students.findIndex((s) => s.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    students[idx] = { ...students[idx], ...req.body, id };
    await setStudents(students);
    return res.status(200).json(students[idx]);
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id required' });
    let students = await getStudents();
    students = students.filter((s) => s.id !== id);
    await setStudents(students);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
