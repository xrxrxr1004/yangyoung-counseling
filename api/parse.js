export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageBase64, mediaType = 'image/png' } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'imageBase64 required' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 1000,
        system: `카카오톡 학생 상담 대화 스크린샷을 분석해서 순수 JSON만 반환하세요. 마크다운 없이.
형식: {"date":"YYYY-MM-DD","student":"이름","school":"학교명(풀네임)","grade":"학년","qna":[{"q":"학생말","a":"선생님말"}],"tags":["태그"]}
규칙:
- 선생님 메시지: 노란색/오른쪽 말풍선
- 학교 약칭 풀어쓰기: 충남여고→충남여자고등학교, 대전외고→대전외국어고등학교, 지족고→대전지족고등학교, 공사부고→공주사범대학교부설고등학교
- tags는 시간표/수업조율/교재확인/시험범위/수행평가/자료요청/수업질문/기타 중 해당하는 것 선택
- 날짜는 스크린샷 상단에서 추출, 없으면 오늘 날짜
- 채팅방 제목에서 학생 이름과 학교 추출`,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            { type: 'text', text: '이 카카오 상담 스크린샷을 JSON으로 추출해주세요.' }
          ]
        }]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: err?.error?.message || `Claude API error ${response.status}` });
    }

    const data = await response.json();
    const text = data.content.filter(c => c.type === 'text').map(c => c.text).join('');
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    return res.status(200).json({ success: true, data: parsed });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
