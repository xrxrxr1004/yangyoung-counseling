export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { query, context, mode, history = [] } = req.body;
  if (!query) return res.status(400).json({ error: 'query required' });

  const systemPrompt = mode === 'B'
    ? `당신은 양영학원 상담 기록 분석 도우미입니다.
아래는 특정 학생(들)의 전체 상담 기록입니다. 이를 바탕으로 질문에 정확하게 답하세요.
날짜, 구체적인 Q&A 내용, 태그를 적극 활용하세요.
답변은 한국어로, 핵심만 간결하게 작성하세요. 불필요한 인사말 없이 바로 내용으로 시작하세요.

--- 상담 기록 ---
${context}
--- 끝 ---`
    : `당신은 양영학원 상담 기록 분석 도우미입니다.
아래는 전체 학생들의 상담 요약 데이터입니다(학생별 최근 태그/요약 포함).
이를 바탕으로 질문에 답하세요. 특정 학생 이름이 언급되지 않은 전반적인 질문에 답하는 용도입니다.
답변은 한국어로, 핵심만 간결하게 작성하세요. 불필요한 인사말 없이 바로 내용으로 시작하세요.

--- 전체 학생 요약 ---
${context}
--- 끝 ---`;

  // 히스토리에서 system role 제거 (Anthropic API는 system 별도)
  const messages = [
    ...history.filter(m => m.role === 'user' || m.role === 'assistant').slice(-6),
    { role: 'user', content: query }
  ];

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: systemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: err });
    }

    const data = await response.json();
    const answer = data.content?.[0]?.text || '응답 없음';
    return res.status(200).json({ answer });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
