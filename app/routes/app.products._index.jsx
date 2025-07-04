// app/routes/app.products.jsx
import { Link } from "@remix-run/react";

export default function ProductsHome() {
  return (
    <div style={{ padding: 20 }}>
      <h1>📦 商品管理トップ</h1>
      <p>こちらから商品リストを表示してリライトできます。</p>

      <div style={{ marginTop: 20 }}>
        <Link to="/app/products/list">
          <button>📝 商品一覧を表示</button>
        </Link>
      </div>
    </div>
  );
}
