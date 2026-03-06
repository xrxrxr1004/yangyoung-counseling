export default async function handler(req, res) {
  const keyExists = !!process.env.ANTHROPIC_API_KEY;
  const keyPrefix = process.env.ANTHROPIC_API_KEY?.slice(0, 8) || '(없음)';
  const kvUrl = !!process.env.KV_REST_API_URL;
  const kvToken = !!process.env.KV_REST_API_TOKEN;

  // Anthropic API 실제 호출 테스트
  let apiTest = 'not tested';
  if (keyExists) {
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 10,
          messages: [{ role: 'user', content: '안녕' }],
        }),
      });
      apiTest = `HTTP ${r.status}`;
      if (!r.ok) {
        const t = await r.text();
        apiTest += ` / ${t.slice(0, 100)}`;
      }
    } catch (e) {
      apiTest = `fetch error: ${e.message}`;
    }
  }

  return res.status(200).json({ keyExists, keyPrefix, kvUrl, kvToken, apiTest });
}
