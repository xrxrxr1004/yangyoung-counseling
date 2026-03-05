import Anthropic from "@anthropic-ai/sdk";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { daily, content, count, qna } = req.body;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    let prompt, system;

    if (daily) {
      // 오늘 전체 상담 취합 요약
      system = `당신은 학원 선생님들의 업무 보조 AI입니다.
오늘 하루 학생들과의 상담 내용 전체를 읽고, 선생님들이 퇴근 전 브리핑처럼 한눈에 볼 수 있도록 요약해주세요.

형식:
• 주요 이슈별로 2~4개 bullet point
• 각 bullet은 1~2문장, 구체적인 학생 이름 포함
• 예: "• 시험 범위 문의 다수 (김예지, 박서정) — 영어 2단원까지 확인 필요"
• 마크다운 없이 • 기호만 사용
• 전체 150자 이내`;
      prompt = `오늘 상담 ${count}건 내용:\n\n${content}`;
    } else {
      // 개별 요약 (미사용이지만 호환용으로 유지)
      if (!qna || !qna.length)
        return res.status(400).json({ error: "qna required" });
      system = `상담 대화를 읽고 핵심 내용을 한 줄(40자 이내)로 요약해. 예: '시험 범위 질문 → 영어 2단원 범위 안내'. 한국어만.`;
      prompt = qna
        .map((qa) => `학생: ${qa.q}\n선생님: ${qa.a || "(답변없음)"}`)
        .join("\n\n");
    }

    const msg = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      system,
      messages: [{ role: "user", content: prompt }],
    });

    const summary = msg.content?.[0]?.text?.trim() || "";
    res.status(200).json({ summary });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
