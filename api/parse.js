async function uploadToCloudinary(imageBase64, mediaType) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) throw new Error('Cloudinary 환경변수 없음');

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = 'yangyoung-counseling';

  const { createHash } = await import('crypto');
  const sigStr = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
  const signature = createHash('sha1').update(sigStr).digest('hex');

  // Cloudinary는 data URI 형식으로 base64 직접 수신 가능
  const r = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      file: `data:${mediaType};base64,${imageBase64}`,
      api_key: apiKey,
      timestamp,
      signature,
      folder
    })
  });

  const data = await r.json();
  if (!r.ok || data.error) throw new Error(`Cloudinary 오류: ${JSON.stringify(data.error)}`);
  return data.secure_url;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageBase64, mediaType } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'imageBase64 필요' });

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY 없음' });

  const today = new Date().toISOString().slice(0, 10);

  const prompt = `이 이미지는 카카오톡 학생 상담 대화 스크린샷입니다.
아래 JSON 형식으로 정보를 추출하세요. JSON만 출력하고 다른 텍스트는 절대 포함하지 마세요.

{
  "date": "YYYY-MM-DD",
  "student": "학생 이름",
  "school": "학교명",
  "grade": "학년",
  "qna": [
    { "q": "학생 발화", "a": "선생님 답변" }
  ],
  "tags": ["태그"]
}

규칙:
- date: 카카오톡 대화 날짜. 형식은 반드시 YYYY-MM-DD. 이미지에서 찾기 어려우면 오늘(${today}) 사용. 절대 시각(예: 8:30, 오후 5시)을 날짜로 혼동하지 말 것.
- student: 채팅방 상대방 한국어 이름 그대로. 절대 번역하지 말 것.
- school: 학교명 한국어 그대로. 없으면 빈 문자열. 절대 영어로 번역하지 말 것.
- grade: 학년. 없으면 빈 문자열.
- qna: 카카오톡에서 오른쪽 노란색/초록색 말풍선 = 선생님(나)가 보낸 메시지 = a. 왼쪽 흰색/회색 말풍선 = 학생이 보낸 메시지 = q. 절대 반대로 혼동하지 말 것. 여러 개면 배열로.
- tags: 교재확인/시간표/수업조율/시험범위/수행평가/자료요청/수업질문/기타 중 해당하는 것만 선택.`;

  try {
    // 1. Cloudinary 이미지 업로드 (먼저)
    let imgUrl = null;
    try {
      imgUrl = await uploadToCloudinary(imageBase64, mediaType || 'image/png');
    } catch (e) {
      console.error('Cloudinary 실패:', e.message);
    }

    // 2. Claude AI 분석
    const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/png', data: imageBase64 } },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    const aiRes = await aiResponse.json();
    if (!aiResponse.ok) return res.status(500).json({ error: aiRes.error?.message || 'Claude API 오류' });

    const text = aiRes.content?.[0]?.text || '';
    // JSON 블록 추출 (앞뒤 텍스트 무시)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'JSON 추출 실패', raw: text });
    let parsed;
    try { parsed = JSON.parse(jsonMatch[0]); }
    catch { return res.status(500).json({ error: 'JSON 파싱 실패', raw: text }); }

    parsed.id = 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    parsed.imgs = imgUrl ? [imgUrl] : [];

    return res.status(200).json({ success: true, data: parsed, cloudinaryUrl: imgUrl });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
