import { requireAuth } from './_auth.js';

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, date, studentName } = req.body;
  if (!text || !date || !studentName) {
    return res.status(400).json({ error: 'text, date, studentName required' });
  }

  const prompt = `다음은 학원 선생님과 학생 사이의 카카오톡 대화입니다.
날짜: ${date}
학생 이름: ${studentName}

대화 내용:
${text}

위 대화에서 실제 학습 상담 내용(질문, 답변, 수업 관련 내용)만 추출하세요.
단순 인사, 공지, "네", "감사합니다" 같은 의미 없는 메시지는 제외하세요.
실제 상담 내용이 없으면 null을 반환하세요.

반드시 아래 JSON 형식으로만 응답하세요 (마크다운 코드블록 없이):
{
  "student": "${studentName}",
  "date": "${date}",
  "qna": [
    {"q": "학생 질문 또는 학생 관련 내용", "a": "선생님 답변 또는 조치"}
  ],
  "tags": ["태그1", "태그2"],
  "summary": "한 줄 요약"
}

태그는 다음 중에서만 선택: 시간표, 수업조율, 교재확인, 시험범위, 수행평가, 자료요청, 수업질문, 기타, 출결관련, 숙제확인, 시험결과, 일정조율, 학습상담, 교재안내, 시험준비, 상담기록

실제 상담 내용이 없으면: null`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: 'Anthropic API error: ' + err });
    }

    const aiResult = await response.json();
    const raw = aiResult.content?.[0]?.text?.trim();

    if (!raw || raw === 'null') {
      return res.status(200).json({ data: null });
    }

    let parsed;
    try {
      const clean = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
      parsed = JSON.parse(clean);
    } catch (e) {
      return res.status(200).json({ data: null });
    }

    if (!parsed || !parsed.qna || parsed.qna.length === 0) {
      return res.status(200).json({ data: null });
    }

    return res.status(200).json({ data: parsed });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
