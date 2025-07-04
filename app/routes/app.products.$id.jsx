import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { useState } from "react";

// ■ Loader: 商品情報を取得
export const loader = async ({ request, params }) => {
  const { admin } = await authenticate.admin(request);
  const productId = `gid://shopify/Product/${params.id}`;

  const response = await admin.graphql(`
    query GetProduct($id: ID!) {
      product(id: $id) {
        id
        title
        descriptionHtml
      }
    }
  `, {
    variables: { id: productId }
  });

  const result = await response.json();

  return json({
    id: params.id,
    title: result.data.product.title,
    description: result.data.product.descriptionHtml,
  });
};

// ■ リライト結果から各要素を抽出
const extractFieldsFromResult = (result) => {
  const titleMatch = result.match(/【商品タイトル】\s*(.+)/);
  const newTitle = titleMatch?.[1]?.trim() ?? "";

  const seoTitleMatch = result.match(/【SEOタイトル】\s*(.+)/);
  const seoTitle = seoTitleMatch?.[1]?.trim() ?? "";

  const seoDescMatch = result.match(/【SEOディスクリプション】\s*([\s\S]*?)(?:\n【|$)/);
  const seoDescription = seoDescMatch?.[1]?.trim() ?? "";

  const specMatches = [...result.matchAll(/・(.+?):\s*(.+?)\s*\/\s*(.+)/g)];
  const details = {};
  for (const [, label, key, value] of specMatches) {
    const lower = label.toLowerCase();
    if (lower.includes("サイズ")) details.details1 = value.trim();
    if (lower.includes("材質") || lower.includes("素材")) details.details2 = value.trim();
    if (lower.includes("用途")) details.details3 = value.trim();
    if (lower.includes("電源")) details.details4 = value.trim();
  }

  // 商品説明を抽出し、【注意事項】を1回だけ残す
  const bodyMatch = result.match(/【商品説明】([\s\S]*?)(?=【商品メタフィールド】|【SEOタイトル】|【SEOディスクリプション】|$)/);
  let cleanDescription = bodyMatch?.[1]?.trim() ?? result;

  // 注意事項の重複除去と統一化
  cleanDescription = cleanDescription
    .replace(/(<p><strong>【注意事項】<\/strong><\/p>\s*<ul>[\s\S]*?<\/ul>)/g, "__NOTE__")
    .replace(/<p><strong>【注意事項】<\/strong><\/p>\s*<ul>[\s\S]*?<\/ul>/g, "")
    .replace(/【注意事項】[\s\S]*?(<\/ul>)/g, "")
    .replace(/__NOTE__/, `
<p><strong>【注意事項】</strong></p>
<ul>
  <li><strong>写真と実物の色合いが若干異なる場合があります。</strong></li>
  <li><strong>手作業による測定のためサイズに多少の誤差がある場合がございます。予めご了承ください。</strong></li>
</ul>`);

  return { newTitle, seoTitle, seoDescription, cleanDescription, details };
};

// ■ Component
export default function ProductRewritePage() {
  const { id, title: initialTitle, description: initialDescription } = useLoaderData();

  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [result, setResult] = useState("");

  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [details, setDetails] = useState({});

  // 🖊 OpenAIでリライト
  const handleRewrite = async () => {
    const res = await fetch("/api/rewrite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description }),
    });

    const data = await res.json();

    if (data.result) {
      const fields = extractFieldsFromResult(data.result);
      setTitle(fields.newTitle);
      setSeoTitle(fields.seoTitle);
      setSeoDescription(fields.seoDescription);
      setDetails(fields.details);
      setDescription(fields.cleanDescription);
      setResult(data.result);
    } else {
      setResult("リライトに失敗しました。");
    }
  };

  // 💾 Shopifyに保存
  const handleSave = async () => {
    const metafields = Object.entries(details).map(([key, value]) => ({
      namespace: "specification",
      key,
      type: "single_line_text_field",
      value,
    }));

    const res = await fetch("/api/update-product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: `gid://shopify/Product/${id}`,
        title: title,
        body_html: description,
        seo_title: seoTitle,
        seo_description: seoDescription,
        metafields,
      }),
    });

    const data = await res.json();

    const isSuccess =
      data &&
      data.data &&
      data.data.productUpdate &&
      data.data.productUpdate.userErrors &&
      data.data.productUpdate.userErrors.length === 0;

    if (isSuccess) {
      alert("✅ Shopifyに保存されました！");
    } else {
      alert("❌ 保存エラー: " + JSON.stringify(data));
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>📝 商品リライト - 商品ID: {id}</h1>

      <label>タイトル</label><br />
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={{ width: "100%", marginBottom: "1rem" }}
      /><br />

      <label>説明文</label><br />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={6}
        style={{ width: "100%", marginBottom: "1rem" }}
      ></textarea><br />

      <button onClick={handleRewrite}>🖊 リライト</button>

      {result && (
        <div style={{ marginTop: "2rem", whiteSpace: "pre-wrap", background: "#f3f3f3", padding: "1rem" }}>
          <h3>リライト結果：</h3>
          <div dangerouslySetInnerHTML={{ __html: description }} />
          <p><strong>SEOタイトル:</strong> {seoTitle}</p>
          <p><strong>SEOディスクリプション:</strong> {seoDescription}</p>
          <button style={{ marginTop: "1rem" }} onClick={handleSave}>💾 Shopifyに保存</button>
        </div>
      )}
    </div>
  );
}
