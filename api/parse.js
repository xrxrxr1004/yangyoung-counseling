export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageBase64, mediaType } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'imageBase64 필요' });

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY 환경변수 없음' });

  const prompt = `이 이미지는 카카오톡 학생 상담 대화 스크린샷입니다.
다음 JSON 형식으로 정확하게 추출해주세요. JSON만 출력하고 다른 텍스트는 절대 포함하지 마세요.

{
  "date": "YYYY-MM-DD",
  "student": "학생 이름",
  "school": "학교명 (없으면 빈 문자열)",
  "grade": "학년 (없으면 빈 문자열)",
  "qna": [
    { "q": "학생 발화 내용", "a": "선생님 답변 내용" }
  ],
  "tags": ["태그1", "태그2"]
}

규칙:
- date: 대화 날짜 (이미지에서 추출, 없으면 오늘 날짜)
- student: 채팅방 상대방 이름 (노란/파란 버블이 아닌 상대 이름)
- qna: 학생 발화를 q, 선생님(전재우님이 보냄 또는 노란 버블) 답변을 a로 구성
- tags: 교재확인/시간표/수업조율/시험범위/수행평가/자료요청/수업질문/기타 중 해당하는 것
- 이미지에 대화가 없거나 판독 불가면 student를 "알 수 없음"으로`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType || 'image/png',
                data: imageBase64
              }
            },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    const aiRes = await response.json();
    if (!response.ok) {
      return res.status(500).json({ error: aiRes.error?.message || 'Claude API 오류' });
    }

    const text = aiRes.content?.[0]?.text || '';
    // JSON 파싱 (마크다운 코드블록 제거)
    const clean = text.replace(/```json|```/g, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      return res.status(500).json({ error: 'JSON 파싱 실패', raw: text });
    }

    // id 자동 생성
    parsed.id = 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    parsed.imgs = [];

    return res.status(200).json({ success: true, data: parsed });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
