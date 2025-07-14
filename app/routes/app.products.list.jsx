
import { json } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { useState, useEffect, useRef } from "react";
import productListStylesHref from "../styles/products-list.css?url";

export function links() {
  return [{ rel: "stylesheet", href: productListStylesHref }];
}

// ... loader関数省略（前と同じ）

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
  const [showCatBigSuggestions, setShowCatBigSuggestions] = useState(false);
  const [showCatMidSuggestions, setShowCatMidSuggestions] = useState(false);

  const catBigRef = useRef(null);
  const catMidRef = useRef(null);

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
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredCatBigOptions = collectionOptions.filter((col) =>
    col.toLowerCase().includes(catBigInput.toLowerCase())
  ).slice(0, 20);

  const filteredCatMidOptions = collectionOptions.filter((col) =>
    col.toLowerCase().includes(catMidInput.toLowerCase())
  ).slice(0, 20);

  return (
    <>
      {/* cat_big */}
      <div ref={catBigRef} style={{ position: "relative", marginBottom: "12px" }}>
        <label>パンくず大カテ</label><br />
        <input
          type="text"
          value={catBigInput}
          onChange={(e) => {
            setCatBigInput(e.target.value);
            setShowCatBigSuggestions(true);
          }}
          onFocus={() => setShowCatBigSuggestions(true)}
        />
        {showCatBigSuggestions && filteredCatBigOptions.length > 0 && (
          <ul style={{ position: "absolute", background: "#fff", zIndex: 1000 }}>
            {filteredCatBigOptions.map((option) => (
              <li
                key={option}
                onClick={() => {
                  setCatBigInput(option);
                  setShowCatBigSuggestions(false);
                }}
                style={{ cursor: "pointer", padding: "4px" }}
              >
                {option}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* cat_mid */}
      <div ref={catMidRef} style={{ position: "relative", marginBottom: "12px" }}>
        <label>パンくず中カテ</label><br />
        <input
          type="text"
          value={catMidInput}
          onChange={(e) => {
            setCatMidInput(e.target.value);
            setShowCatMidSuggestions(true);
          }}
          onFocus={() => setShowCatMidSuggestions(true)}
        />
        {showCatMidSuggestions && filteredCatMidOptions.length > 0 && (
          <ul style={{ position: "absolute", background: "#fff", zIndex: 1000 }}>
            {filteredCatMidOptions.map((option) => (
              <li
                key={option}
                onClick={() => {
                  setCatMidInput(option);
                  setShowCatMidSuggestions(false);
                }}
                style={{ cursor: "pointer", padding: "4px" }}
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
