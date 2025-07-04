// app/routes/api.rewrite.tsx
import { json } from "@remix-run/node";
import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const action = async ({ request }) => {
  const { title, description } = await request.json();

  const prompt = `
以下の商品タイトルと説明文をもとに、日本語で魅力的な商品説明をリライトしてください。

【返答フォーマット】
【商品タイトル】
修正後の商品タイトル（最大40文字）

【商品説明】
商品の特徴を1文で要約し<p>〜</p>で囲んでください。
その下に【ポイント】と記し、商品の特徴を3〜5個、<li>タグを用いたHTML形式の箇条書きで記載してください。
最後に【注意事項】として以下のHTMLを必ず追加してください：
<p><strong>【注意事項】</strong></p>
<ul>
  <li><strong>写真と実物の色合いが若干異なる場合があります。</strong></li>
  <li><strong>手作業による測定のためサイズに多少の誤差がある場合がございます。予めご了承ください。</strong></li>
</ul>

【商品メタフィールド】
以下の形式で出力してください（最大4項目）：
・サイズ: specification.title1 / specification.details1
・材質・素材: specification.title2 / specification.details2
・用途: specification.title3 / specification.details3
・電源: specification.title4 / specification.details4

【SEOタイトル】
修正後のSEO向けタイトルの末尾に「｜誉PRINTING」を追加してください
（例：「多機能収納ボックス｜誉PRINTING」）

【SEOディスクリプション】
必ず120〜240文字で自然な日本語で要約してください。空欄にしないでください。

---
以下の商品情報を基に出力してください。

商品タイトル: ${title}
商品説明: ${description}
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
  });

  const result = completion.choices[0]?.message?.content || "";

  return json({ result });
};
