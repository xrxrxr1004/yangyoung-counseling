export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { daily, content, count } = req.body;

  if (!content) {
    return res.status(400).json({ error: "content required" });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 300,
        system: `당신은 학원 선생님들의 업무 보조 AI입니다.
학생들과의 상담 내용 전체를 읽고, 선생님들이 한눈에 볼 수 있도록 요약해주세요.

규칙:
- 주요 이슈별로 2~4개 bullet point (• 기호 사용)
- 각 bullet은 1~2문장, 구체적인 학생 이름 포함
- 예시: "• 시험 범위 문의 (김예지, 박서정) — 영어 2단원까지 확인 필요"
- 마크다운 없이 • 기호만 사용
- 전체 200자 이내
- 한국어로만`,
        messages: [
          {
            role: "user",
            content: `상담 ${count}건 내용:\n\n${content}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic API error:", response.status, err);
      return res.status(500).json({ error: `Anthropic error: ${response.status}` });
    }

    const data = await response.json();
    const summary = data.content?.[0]?.text?.trim() || "";
    return res.status(200).json({ summary });
  } catch (e) {
    console.error("summarize handler error:", e.message);
    return res.status(500).json({ error: e.message });
  }
}
