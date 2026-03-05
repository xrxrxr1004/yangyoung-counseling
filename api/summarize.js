import Anthropic from "@anthropic-ai/sdk";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { qna } = req.body;
  if (!qna || !qna.length)
    return res.status(400).json({ error: "qna required" });

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const qnaText = qna
    .map((qa) => `학생: ${qa.q}\n선생님: ${qa.a || "(답변없음)"}`)
    .join("\n\n");

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 150,
      system:
        "상담 대화를 읽고 핵심 내용을 한 줄(40자 이내)로 요약해. 누가 어떤 말을 했는지 중심으로. 예: '시험 범위 질문 → 영어 2단원 범위 안내' 형식. 한국어로만. 따옴표나 마크다운 없이 순수 텍스트만.",
      messages: [{ role: "user", content: qnaText }],
    });
    const summary = msg.content?.[0]?.text?.trim() || "";
    res.status(200).json({ summary });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
