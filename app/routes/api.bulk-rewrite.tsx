import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;
  const accessToken = session.accessToken;

  const formData = await request.formData();
  const idsJson = formData.get("ids");
  const template = formData.get("template") || "aliexpress";
  const cat_big = formData.get("cat_big") || "";
  const cat_mid = formData.get("cat_mid") || "";
  console.log("📦 受信したテンプレート:", template);
  const ids: string[] = JSON.parse((idsJson as string) || "[]");

  let updatedCount = 0;

  for (const id of ids) {
    try {
      const productQuery = `
        query {
          product(id: "${id}") {
            id
            title
            descriptionHtml
          }
        }
      `;
      const productRes = await fetch(`https://${shopDomain}/admin/api/2024-01/graphql.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken ?? "",
        },
        body: JSON.stringify({ query: productQuery }),
      });

      const productJson = await productRes.json();
      const product = productJson.data.product;

      const prompt = `
以下の商品情報をもとに、日本語の商品説明・SEO・メタフィールドをJSON形式で生成してください。
テンプレート種別：${template}

【元タイトル】
${product.title}

【元説明HTML】
${product.descriptionHtml}

【出力フォーマット】以下のJSON形式で返してください。

{
  "title": "40字以内の日本語タイトル",
  "bodyHtml": "<p>特徴要約</p><p><strong>【ポイント】</strong></p><ul><li>特徴1</li><li>特徴2</li><li>特徴3</li></ul><p><strong>【注意事項】</strong></p><ul><li><strong>写真と実物の色合いが若干異なる場合があります。</strong></li><li><strong>手作業による測定のためサイズに多少の誤差がある場合がございます。予めご了承ください。</strong></li></ul>",
  "seoTitle": "末尾に『｜誉PRINTING』をつけたタイトル",
  "seoDescription": "120〜240字の自然な日本語で要約",
  "specs": {
    "details1": "サイズに関する仕様",
    "details2": "素材・材質に関する仕様",
    "details3": "用途に関する仕様",
    "details4": "電源に関する仕様（なければ空文字）"
  }
}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
      });

      const raw = completion.choices[0]?.message?.content || "";
      const jsonStart = raw.indexOf("{");
      const jsonEnd = raw.lastIndexOf("}") + 1;
      const jsonContent = raw.slice(jsonStart, jsonEnd);
      const parsed = JSON.parse(jsonContent);

      const { title, bodyHtml, seoTitle, seoDescription, specs } = parsed;

      const productUpdateMutation = `
        mutation {
          productUpdate(product: {
            id: "${id}",
            title: "${title}",
            descriptionHtml: """${bodyHtml}""",
            templateSuffix: "${template}",
            seo: {
              title: "${seoTitle}",
              description: "${seoDescription}"
            }
          }) {
            product { id }
            userErrors { message }
          }
        }
      `;
      const updateRes = await fetch(`https://${shopDomain}/admin/api/2024-10/graphql.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken ?? "",
        },
        body: JSON.stringify({ query: productUpdateMutation }),
      });

      const updateJson = await updateRes.json();
      const updateErrors = updateJson.data.productUpdate.userErrors;
      if (updateErrors.length > 0) {
        console.error("❌ 商品更新エラー:", updateErrors);
        continue;
      }

      // ✅ 各メタフィールドを type 付きで登録
      const metafieldEntries = [
        { namespace: "spec", key: "details01", value: specs.details1, type: "multi_line_text_field" },
        { namespace: "spec", key: "details02", value: specs.details2, type: "multi_line_text_field" },
        { namespace: "spec", key: "details03", value: specs.details3, type: "multi_line_text_field" },
        { namespace: "spec", key: "details04", value: specs.details4, type: "multi_line_text_field" },
        { namespace: "dropshipping", key: "aliexpress", value: "海外発送", type: "single_line_text_field" },
        { namespace: "breadcrumbs", key: "cat_big", value: cat_big, type: "single_line_text_field" },
        { namespace: "breadcrumbs", key: "cat_mid", value: cat_mid, type: "single_line_text_field" }
      ].filter((entry) => entry.value?.trim());

      const metafieldsMutation = `
        mutation {
          metafieldsSet(metafields: [
            ${metafieldEntries
              .map(
                ({ namespace, key, value, type }) => `{
                  ownerId: "${id}",
                  namespace: "${namespace}",
                  key: "${key}",
                  type: "${type}",
                  value: """${value.replace(/"/g, '\\"')}"""
                }`
              )
              .join(",\n")}
          ]) {
            metafields { key value }
            userErrors { message }
          }
        }
      `;

      const metafieldRes = await fetch(`https://${shopDomain}/admin/api/2024-01/graphql.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken ?? "",
        },
        body: JSON.stringify({ query: metafieldsMutation }),
      });

      const metaJson = await metafieldRes.json();
      const metaErrors = metaJson.data.metafieldsSet.userErrors;
      if (metaErrors.length > 0) {
        console.error("❌ メタフィールドエラー:", metaErrors);
        continue;
      }

      updatedCount += 1;
    } catch (err) {
      console.error(`❌ 商品 ${id} の処理に失敗:`, err);
    }
  }

  return json({ status: "success", count: updatedCount });
}
