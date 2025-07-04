// app/routes/api.update-product.tsx
import { json } from "@remix-run/node";

export const action = async ({ request }) => {
  const { id, title, body_html, seo_title, seo_description, metafields } = await request.json();

  const SHOP = process.env.SHOPIFY_STORE_DOMAIN;
  const ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;

  try {
    // 🔁 商品本体の更新（title, descriptionHtml, SEO）
    const productUpdateRes = await fetch(`https://${SHOP}/admin/api/2024-01/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": ACCESS_TOKEN!,
      },
      body: JSON.stringify({
        query: `
          mutation productUpdate($input: ProductInput!) {
            productUpdate(input: $input) {
              product {
                id
                title
                descriptionHtml
                seo {
                  title
                  description
                }
              }
              userErrors {
                field
                message
              }
            }
          }
        `,
        variables: {
          input: {
            id,
            title,
            descriptionHtml: body_html,
            seo: {
              title: seo_title,
              description: seo_description,
            },
          },
        },
      }),
    });

    const updateResult = await productUpdateRes.json();

    // 🔁 Metafieldsの更新
    const metafieldUpdateRes = await fetch(`https://${SHOP}/admin/api/2024-01/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": ACCESS_TOKEN!,
      },
      body: JSON.stringify({
        query: `
          mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
            metafieldsSet(metafields: $metafields) {
              metafields {
                id
                key
              }
              userErrors {
                field
                message
              }
            }
          }
        `,
        variables: {
          metafields: metafields.map((field) => ({
            ownerId: id,
            namespace: field.namespace,
            key: field.key,
            type: field.type,
            value: field.value,
          })),
        },
      }),
    });

    const metafieldResult = await metafieldUpdateRes.json();

    return json({
      data: {
        productUpdate: updateResult.data?.productUpdate,
        metafieldsSet: metafieldResult.data?.metafieldsSet,
      },
    });
  } catch (error) {
    console.error("❌ 保存エラー:", error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
};
