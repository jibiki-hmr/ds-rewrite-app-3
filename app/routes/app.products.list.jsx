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
          products(first: 100${endCursor ? `, after: \"${endCursor}\"` : ""}) {
            pageInfo {
              hasNextPage
            }
            edges {
              cursor
              node {
                id
                title
                collections(first: 5) {
                  edges {
                    node {
                      id
                      title
                    }
                  }
                }
                images(first: 1) {
                  edges {
                    node {
                      url
                    }
                  }
                }
                variants(first: 1) {
                  edges {
                    node {
                      fulfillmentService {
                        handle
                      }
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

      hasNextPage = result.pageInfo.hasNextPage;
      endCursor = result.edges.length > 0 ? result.edges[result.edges.length - 1].cursor : null;
    }

    return allProducts;
  };

  const products = await fetchAllProducts();

  const collectionSet = new Set();
  for (const product of products) {
    product.collections.edges.forEach((edge) => {
      if (edge.node?.title) {
        collectionSet.add(edge.node.title);
      }
    });
  }
  const collectionOptions = Array.from(collectionSet);

  return json({ products, shop: session.shop.replace(".myshopify.com", ""), collectionOptions });
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

  const [catBigInput, setCatBigInput] = useState("");
  const [catMidInput, setCatMidInput] = useState("");
const catBigRef = useRef(null);
const catMidRef = useRef(null);


  const pageSize = 50;

  const filteredCatBigOptions = collectionOptions.filter((col) =>
    col.toLowerCase().includes(catBigInput.toLowerCase())
  ).slice(0, 20);
  const filteredCatMidOptions = collectionOptions.filter((col) =>
    col.toLowerCase().includes(catMidInput.toLowerCase())
  ).slice(0, 20);

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

  useEffect(() => {
  const handleClickOutside = (event) => {
    if (catBigRef.current && !catBigRef.current.contains(event.target)) {
      setCatBigInput(catBigInput); // 入力は保持、候補だけ閉じるなら別state管理可
    }
    if (catMidRef.current && !catMidRef.current.contains(event.target)) {
      setCatMidInput(catMidInput);
    }
  };

  document.addEventListener("mousedown", handleClickOutside);
  return () => {
    document.removeEventListener("mousedown", handleClickOutside);
  };
}, []);

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
        cat_big: catBigInput,
        cat_mid: catMidInput,
      },
      { method: "post", action: "/api/bulk-rewrite" }
    );
  };

  const filteredCollections = collectionSearch.trim()
    ? collectionOptions.filter((name) =>
        name.toLowerCase().includes(collectionSearch.toLowerCase())
      ).slice(0, 20)
    : [];

  return (
    <div>
      <h1>商品一覧</h1>

      {fetcher.state === "submitting" && (
        <p style={{ color: "#2563eb", fontWeight: "bold", marginTop: "8px" }}>
          ⏳ リライト中...
        </p>
      )}
      {fetcher.state === "idle" && fetcher.data?.status === "success" && (
        <div className="message-success">
          ✅ {fetcher.data.count} 件のリライトが完了しました！
        </div>
      )}

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

      {/* cat_big input */}
      <div style={{ marginBottom: "12px" }}>
        <label><strong>パンくず大カテ（cat_big）</strong></label><br />
        <input
          type="text"
          placeholder="コレクション名を入力..."
          value={catBigInput}
          onChange={(e) => setCatBigInput(e.target.value)}
          style={{ padding: "6px", width: "300px" }}
        />
        {catBigInput && filteredCatBigOptions.length > 0 && (
          <ul style={{
            listStyle: "none", padding: "4px", marginTop: "4px",
            maxHeight: "120px", overflowY: "auto", border: "1px solid #ccc",
            width: "300px", background: "#fff", position: "absolute", zIndex: 10
          }}>
            {filteredCatBigOptions.map((option) => (
              <li
                key={option}
                onClick={() => setCatBigInput(option)}
                style={{
                  padding: "6px",
                  cursor: "pointer",
                  backgroundColor: catBigInput === option ? "#eee" : "transparent"
                }}
              >
                {option}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* cat_mid input */}
      <div style={{ marginBottom: "12px" }}>
        <label><strong>パンくず中カテ（cat_mid）</strong></label><br />
        <input
          type="text"
          placeholder="コレクション名を入力..."
          value={catMidInput}
          onChange={(e) => setCatMidInput(e.target.value)}
          style={{ padding: "6px", width: "300px" }}
        />
        {catMidInput && filteredCatMidOptions.length > 0 && (
          <ul style={{
            listStyle: "none", padding: "4px", marginTop: "4px",
            maxHeight: "120px", overflowY: "auto", border: "1px solid #ccc",
            width: "300px", background: "#fff", position: "absolute", zIndex: 10
          }}>
            {filteredCatMidOptions.map((option) => (
              <li
                key={option}
                onClick={() => setCatMidInput(option)}
                style={{
                  padding: "6px",
                  cursor: "pointer",
                  backgroundColor: catMidInput === option ? "#eee" : "transparent"
                }}
              >
                {option}
              </li>
            ))}
          </ul>
        )}
      </div>

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

      <div style={{ marginBottom: "12px" }}>
        <input
          type="text"
          placeholder="コレクション名で検索"
          value={collectionSearch}
          onChange={(e) => setCollectionSearch(e.target.value)}
          style={{ padding: "6px", width: "300px" }}
        />
        {filteredCollections.length > 0 && (
          <ul style={{ listStyle: "none", margin: "6px 0", padding: 0, maxHeight: "120px", overflowY: "auto" }}>
            {filteredCollections.map((col) => (
              <li
                key={col}
                onClick={() => setSelectedCollection(col)}
                style={{ cursor: "pointer", padding: "4px 8px", backgroundColor: selectedCollection === col ? "#eee" : "transparent" }}
              >
                {col}
              </li>
            ))}
            {selectedCollection && (
              <li style={{ color: "#888", cursor: "pointer", padding: "4px 8px" }} onClick={() => setSelectedCollection("")}>× 絞り込み解除</li>
            )}
          </ul>
        )}
      </div>

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

      <table className="product-table">
        <thead>
          <tr>
            <th className="checkbox-cell">✔</th>
            <th className="img-cell">画像</th>
            <th className="id-cell">商品ID</th>
            <th className="title-cell">商品名</th>
          </tr>
        </thead>
        <tbody>
          {paginatedProducts.map((product) => (
            <tr key={product.id}>
              <td className="checkbox-cell">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(product.id)}
                  onChange={() => toggleSelect(product.id)}
                />
              </td>
              <td className="img-cell">
                {product.images.edges[0]?.node.url ? (
                  <img
                    src={product.images.edges[0].node.url}
                    alt=""
                    style={{ width: "50px", height: "50px", objectFit: "contain" }}
                  />
                ) : (
                  <div style={{ width: "50px", height: "50px", backgroundColor: "#eee" }} />
                )}
              </td>
              <td className="id-cell">
                <a
                  href={`https://admin.shopify.com/store/${shop}/products/${product.id.replace("gid://shopify/Product/", "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {product.id.replace("gid://shopify/Product/", "")}
                </a>
              </td>
              <td className="title-cell" title={product.title}>{product.title}</td>
            </tr>
          ))}
        </tbody>
      </table>

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
