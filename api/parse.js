async function uploadToCloudinary(imageBase64, mediaType) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = 'yangyoung-counseling';

  // 서명 생성 (Node.js crypto)
  const crypto = await import('crypto');
  const sigStr = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash('sha1').update(sigStr).digest('hex');

  const formData = new URLSearchParams();
  formData.append('file', `data:${mediaType};base64,${imageBase64}`);
  formData.append('api_key', apiKey);
  formData.append('timestamp', timestamp);
  formData.append('signature', signature);
  formData.append('folder', folder);

  const r = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: formData
  });

  if (!r.ok) {
    const text = await r.text();
    throw new Error(`Cloudinary 업로드 실패: ${text}`);
  }

  const data = await r.json();
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
- student: 채팅방 상대방 이름
- qna: 학생 발화를 q, 선생님 답변을 a로 구성
- tags: 교재확인/시간표/수업조율/시험범위/수행평가/자료요청/수업질문/기타 중 해당하는 것
- 이미지에 대화가 없거나 판독 불가면 student를 "알 수 없음"으로`;

  try {
    // 1. Claude AI로 텍스트 분석
    const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType || 'image/png', data: imageBase64 }
            },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    const aiRes = await aiResponse.json();
    if (!aiResponse.ok) {
      return res.status(500).json({ error: aiRes.error?.message || 'Claude API 오류' });
    }

    const text = aiRes.content?.[0]?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      return res.status(500).json({ error: 'JSON 파싱 실패', raw: text });
    }

    // 2. Cloudinary에 이미지 업로드
    let imgUrl = null;
    try {
      imgUrl = await uploadToCloudinary(imageBase64, mediaType || 'image/png');
    } catch (e) {
      console.error('Cloudinary 업로드 실패:', e.message);
      // 이미지 업로드 실패해도 텍스트 데이터는 저장
    }

    parsed.id = 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    parsed.imgs = imgUrl ? [imgUrl] : [];

    return res.status(200).json({ success: true, data: parsed });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
