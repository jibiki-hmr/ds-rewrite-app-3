import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";
import { GraphqlClient } from "@shopify/shopify-api";

// ✅ MemorySessionStorage クラスを使って初期化（Vercel互換）
import * as sessionStorageMemory from "@shopify/shopify-app-session-storage-memory";

// ✅ fallback対応：defaultでも MemorySessionStorage から取得
const memoryStorageClass =
  sessionStorageMemory.MemorySessionStorage ??
  sessionStorageMemory.default?.MemorySessionStorage;

if (!memoryStorageClass) {
  throw new Error("❌ MemorySessionStorage クラスが見つかりません");
}

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.January25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new memoryStorageClass(), // ✅ クラスインスタンスで初期化
  distribution: AppDistribution.Custom,
  future: {
    unstable_newEmbeddedAuthStrategy: true,
    removeRest: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

// ✅ Shopify Admin GraphQL クライアント生成
export function createAdminClient(session) {
  if (!session?.shop || !session?.accessToken) {
    throw new Error("セッション情報が不足しています");
  }
  return new GraphqlClient(session);
}

// ✅ 各種エクスポート
export default shopify;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const sessionStorage = shopify.sessionStorage;
export const apiVersion = ApiVersion.January25;
