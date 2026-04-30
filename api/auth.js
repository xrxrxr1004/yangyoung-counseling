import { verifyAuth, setSessionCookie, clearSessionCookie } from './_auth.js';

export default async function handler(req, res) {
  const expected = process.env.SITE_PASSWORD;
  if (!expected) {
    return res.status(500).json({ error: 'SITE_PASSWORD 환경변수가 설정되어 있지 않습니다.' });
  }

  if (req.method === 'GET') {
    if (verifyAuth(req)) return res.status(200).json({ ok: true });
    return res.status(401).json({ error: 'unauthorized' });
  }

  if (req.method === 'POST') {
    const { password } = req.body || {};
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: '비밀번호가 필요합니다.' });
    }
    if (password !== expected) {
      return res.status(401).json({ error: '비밀번호가 틀렸습니다.' });
    }
    setSessionCookie(res, password);
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    clearSessionCookie(res);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
