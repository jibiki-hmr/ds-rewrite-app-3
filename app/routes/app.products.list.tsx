// app/routes/app.products.list.tsx

import { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server"; // ← ✅ こちら！

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  return null;
}

export default function ProductListPage() {
  return (
    <div style={{ padding: "2rem" }}>
      <h1>商品リスト</h1>
      <p>このページは Shopify 管理画面の左メニューから開ける追加ページです。</p>
    </div>
  );
}
