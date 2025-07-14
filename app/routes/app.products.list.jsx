import { json } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { useState, useEffect, useRef } from "react";
import productListStylesHref from "../styles/products-list.css?url";

export function links() {
  return [{ rel: "stylesheet", href: productListStylesHref }];
}

export async function loader({ request }) {
  const { authenticate } = await import("../shopify.server");
  const { session } = await authenticate.admin(request);

  const fetchAllProducts = async () => {
    let hasNextPage = true;
    let endCursor = null;
    const allProducts = [];

    while (hasNextPage) {
      const query = `
        {
          products(first: 100${endCursor ? `, after: "${endCursor}"` : ""}) {
            pageInfo { hasNextPage }
            edges {
              cursor
              node {
                id
                title
                collections(first: 5) {
                  edges {
                    node { id title handle }
                  }
                }
                images(first: 1) {
                  edges {
                    node { url }
                  }
                }
                variants(first: 1) {
                  edges {
                    node {
                      fulfillmentService { handle }
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const response = await fetch(`https://${session.shop}/admin/api/2024-01/graphql.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": session.accessToken,
        },
        body: JSON.stringify({ query }),
      });

      const jsonRes = await response.json();
      const result = jsonRes?.data?.products;
      if (!result) throw new Error("商品データの取得に失敗しました。");

      for (const edge of result.edges) {
        const product = edge.node;
        const variant = product.variants.edges[0]?.node;
        const handle = variant?.fulfillmentService?.handle;
        if (handle === "dsers-fulfillment-service") {
          allProducts.push(product);
        }
      }

      return allProducts;
    }; // ✅ fetchAllProducts を正しく閉じる
    };

    const products = await fetchAllProducts();

    const collectionMap = new Map();
    for (const product of products) {
      product.collections.edges.forEach((edge) => {
        if (edge.node?.title && edge.node?.id) {
          collectionMap.set(edge.node.title, {
          id: edge.node.id,
          title: edge.node.title,
          handle: edge.node.handle,
        });
        }
      });
    }
    const collectionOptions = Array.from(collectionMap.values());

    return json({
      products,
      shop: session.shop.replace(".myshopify.com", ""),
      collectionOptions,
    });
}

export default function ProductList() {
  const { products, shop, collectionOptions } = useLoaderData();
  const fetcher = useFetcher();

  const [selectedIds, setSelectedIds] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterKeyword, setFilterKeyword] = useState("");
  const [showOnlyEnglish, setShowOnlyEnglish] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState("");
  const [collectionSearch, setCollectionSearch] = useState("");
  const [template, setTemplate] = useState("aliexpress");
  const [productType, setProductType] = useState("");
  const [catBigInput, setCatBigInput] = useState({ id: "", title: "" });
  const [catMidInput, setCatMidInput] = useState({ id: "", title: "" });
  const [showCatBigSuggestions, setShowCatBigSuggestions] = useState(false);
  const [showCatMidSuggestions, setShowCatMidSuggestions] = useState(false);

  const catBigRef = useRef(null);
  const catMidRef = useRef(null);

  const filteredCatBigOptions = collectionOptions
  .filter((col) =>
    col.title.toLowerCase().includes(catBigInput.title.toLowerCase())
  )
  .slice(0, 20);
  const filteredCatMidOptions = collectionOptions
  .filter((col) =>
    col.title.toLowerCase().includes(catMidInput.title.toLowerCase())
  )
  .slice(0, 20);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (catBigRef.current && !catBigRef.current.contains(event.target)) {
        setShowCatBigSuggestions(false);
      }
      if (catMidRef.current && !catMidRef.current.contains(event.target)) {
        setShowCatMidSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const pageSize = 50;

  const filteredCollections = collectionSearch.trim()
    ? collectionOptions.filter((col) =>
        col.title.toLowerCase().includes(collectionSearch.toLowerCase())
      ).slice(0, 20)
    : [];

  const filteredProducts = products.filter((p) => {
    const title = p.title.toLowerCase();
    const matchKeyword = !filterKeyword || title.includes(filterKeyword.toLowerCase());
    const matchEnglish = !showOnlyEnglish || /[a-zA-Z]/.test(p.title);
    const collectionTitles = p.collections.edges.map((e) => e.node?.title);
    const matchCollection = !selectedCollection || collectionTitles.includes(selectedCollection);
    return matchKeyword && matchEnglish && matchCollection;
  });

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAllOnPage = () => {
    const allIdsOnPage = paginatedProducts.map((p) => p.id);
    const allSelected = allIdsOnPage.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !allIdsOnPage.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...allIdsOnPage])));
    }
  };

  const handleBulkRewrite = () => {
    if (selectedIds.length === 0) return;
    fetcher.submit(
      {
        ids: JSON.stringify(selectedIds),
        template,
        cat_big: catBigInput.id,
        cat_mid: catMidInput.id,
        product_type: productType,
        cat_mid_handle: catMidInput.handle,
      },
      { method: "post", action: "/api/bulk-rewrite" }
    );
  };

  return (
    <div>
      <h1>商品一覧</h1>

      {/* ✅ リライト中・完了メッセージ */}
      {fetcher.state === "submitting" && (
        <p style={{ color: "#2563eb", fontWeight: "bold", marginTop: "8px" }}>
          ⏳ リライト中...
        </p>
      )}
      {fetcher.state === "idle" && fetcher.data?.status === "success" && (
        <div className="message-success" style={{ color: "green", marginTop: "8px" }}>
          ✅ {fetcher.data.count} 件のリライトが完了しました！
        </div>
      )}

    <h2>商品絞込み</h2>
      {/* ✅ キーワード検索＋英語フィルター */}
      <div style={{ marginBottom: "12px" }}>
        <input
          type="text"
          placeholder="キーワード検索（タイトル）"
          value={filterKeyword}
          onChange={(e) => setFilterKeyword(e.target.value)}
          style={{ padding: "6px", width: "300px", marginRight: "12px" }}
        />
        <label style={{ fontSize: "14px" }}>
          <input
            type="checkbox"
            checked={showOnlyEnglish}
            onChange={(e) => setShowOnlyEnglish(e.target.checked)}
            style={{ marginRight: "6px" }}
          />
          「英語」を含む商品名のみ
        </label>
      </div>

      {/* ✅ コレクション検索・選択 */}
      <div style={{ marginBottom: "12px" }}>
        <input
          type="text"
          placeholder="コレクション名で検索"
          value={collectionSearch}
          onChange={(e) => setCollectionSearch(e.target.value)}
          style={{ padding: "6px", width: "300px" }}
        />
        {filteredCollections.length > 0 && (
          <ul style={{
            listStyle: "none", margin: "6px 0", padding: 0,
            maxHeight: "120px", overflowY: "auto", border: "1px solid #ccc",
            width: "300px", background: "#fff"
          }}>
            {filteredCollections.map((col) => (
              <li
                key={col.id}
                onClick={() => setSelectedCollection(col.title)}
                style={{ cursor: "pointer", padding: "4px 8px", backgroundColor: selectedCollection === col.title ? "#eee" : "transparent" }}
              >
                {col.title}
              </li>
            ))}
            {selectedCollection && (
              <li
                style={{ color: "#888", cursor: "pointer", padding: "4px 8px" }}
                onClick={() => setSelectedCollection("")}
              >
                × 絞り込み解除
              </li>
            )}
          </ul>
        )}
      </div>

      <h2>リライト設定</h2>
      {/* ✅ テンプレート選択 */}
      <div style={{ marginBottom: "12px" }}>
        <strong>テンプレート選択：</strong>
        <label style={{ marginLeft: "12px" }}>
          <input
            type="radio"
            value="aliexpress"
            checked={template === "aliexpress"}
            onChange={() => setTemplate("aliexpress")}
          />
          aliexpress
        </label>
        <label style={{ marginLeft: "12px" }}>
          <input
            type="radio"
            value="alibaba"
            checked={template === "alibaba"}
            onChange={() => setTemplate("alibaba")}
          />
          alibaba
        </label>
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label><strong>商品タイプ（product_type）</strong></label><br />
        <input
          type="text"
          placeholder="例：ネオンサイン、バナーなど"
          value={productType}
          onChange={(e) => setProductType(e.target.value)}
          style={{ padding: "6px", width: "300px" }}
        />
      </div>

      {/* ✅ パンくず大カテ入力 */}
      <div style={{ marginBottom: "12px", position: "relative" }} ref={catBigRef}>
        <label><strong>パンくず大カテ（cat_big）</strong></label><br />
        <input
          type="text"
          placeholder="コレクション名を入力..."
          value={catBigInput.title}
          onChange={(e) => {
            setCatBigInput({ ...catBigInput, title: e.target.value });
            setShowCatBigSuggestions(true);
          }}
          onFocus={() => setShowCatBigSuggestions(true)}
          style={{ padding: "6px", width: "300px" }}
        />
        {showCatBigSuggestions && filteredCatBigOptions.length > 0 && (
            <ul style={{
              listStyle: "none",
              padding: "0",
              marginTop: "4px",
              border: "1px solid #ccc",
              maxHeight: "120px",
              overflowY: "auto",
              backgroundColor: "#fff",
              position: "absolute",
              zIndex: 10,
              width: "300px",
            }}>
              {filteredCatBigOptions.map((option) => (
                <li
                  key={option.id}
                  onClick={() => {
                    setCatBigInput(option);
                    setShowCatBigSuggestions(false);
                  }}
                  style={{
                    padding: "6px",
                    cursor: "pointer",
                    borderBottom: "1px solid #eee",
                    backgroundColor: catBigInput.id === option.id ? "#f0f0f0" : "white"
                  }}
                >
                  {option.title}
                </li>
              ))}
            </ul>
          )}
        </div>

      {/* ✅ パンくず中カテ入力 */}
      <div style={{ marginBottom: "12px", position: "relative" }} ref={catMidRef}>
        <label><strong>パンくず中カテ（cat_mid）</strong></label><br />
        <input
          type="text"
          placeholder="コレクション名を入力..."
          value={catMidInput.title}
          onChange={(e) => {
            setCatMidInput({ id: "", title: e.target.value, handle: "" });
            setShowCatMidSuggestions(true);
          }}
          onFocus={() => setShowCatMidSuggestions(true)}
          style={{ padding: "6px", width: "300px" }}
        />
        {showCatMidSuggestions && filteredCatMidOptions.length > 0 && (
        <ul style={{
          listStyle: "none",
          padding: "0",
          marginTop: "4px",
          border: "1px solid #ccc",
          maxHeight: "120px",
          overflowY: "auto",
          backgroundColor: "#fff",
          position: "absolute",
          zIndex: 10,
          width: "300px",
        }}>
          {filteredCatMidOptions.map((option) => (
            <li
              key={option.id}
              onClick={() => {
                console.log("🟢 選択した中カテ option:", option); // ← ここで handle が含まれているか確認！
                setCatMidInput(option);
                setShowCatMidSuggestions(false);
              }}
              style={{
                padding: "6px",
                cursor: "pointer",
                borderBottom: "1px solid #eee",
                backgroundColor: catMidInput.id === option.id ? "#f0f0f0" : "white"
              }}
            >
              {option.title}
            </li>
          ))}
        </ul>
      )}
    </div>

      {/* ✅ 一括処理と選択カウント */}
      <div style={{ marginBottom: "12px" }}>
        <button onClick={handleBulkRewrite} disabled={selectedIds.length === 0 || fetcher.state !== "idle"}>
          一括リライト＆保存
        </button>
        <button onClick={toggleSelectAllOnPage} style={{ marginLeft: "12px" }}>
          {paginatedProducts.every((p) => selectedIds.includes(p.id))
            ? "このページをすべて解除"
            : "このページをすべて選択"}
        </button>
        <span style={{ marginLeft: "12px", color: "#555" }}>
          選択中: {selectedIds.length} 件
        </span>
      </div>

      {/* ✅ 商品テーブル */}
      <table className="product-table">
        <thead>
          <tr>
            <th>✔</th>
            <th>画像</th>
            <th>商品ID</th>
            <th>商品名</th>
          </tr>
        </thead>
        <tbody>
          {paginatedProducts.map((product) => (
            <tr key={product.id}>
              <td>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(product.id)}
                  onChange={() => toggleSelect(product.id)}
                />
              </td>
              <td>
                {product.images.edges[0]?.node.url ? (
                  <img src={product.images.edges[0].node.url} style={{ width: "50px", height: "50px" }} />
                ) : (
                  <div style={{ width: "50px", height: "50px", background: "#eee" }} />
                )}
              </td>
              <td>
                <a
                  href={`https://admin.shopify.com/store/${shop}/products/${product.id.replace("gid://shopify/Product/", "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {product.id.replace("gid://shopify/Product/", "")}
                </a>
              </td>
              <td>{product.title}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ✅ ページネーション */}
      <div style={{ marginTop: "16px" }}>
        <button
          onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
          disabled={currentPage === 1}
        >
          ← 前へ
        </button>
        <span style={{ margin: "0 12px" }}>{currentPage} / {totalPages}</span>
        <button
          onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
          disabled={currentPage === totalPages}
        >
          次へ →
        </button>
      </div>
    </div>
  );
}