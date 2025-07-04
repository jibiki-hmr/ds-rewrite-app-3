import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";
import { GraphqlClient } from "@shopify/shopify-api";

// ✅ CJS default import に完全対応
import sessionStorageMemory from "@shopify/shopify-app-session-storage-memory";

// ✅ ここで関数かどうかを安全に判定して使う
const inMemorySessionStorage =
  typeof sessionStorageMemory === "function"
    ? sessionStorageMemory
    : sessionStorageMemory.inMemorySessionStorage;

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.January25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: inMemorySessionStorage(), // ✅ どちらの形式でも動作する
  distribution: AppDistribution.AppStore,
  future: {
    unstable_newEmbeddedAuthStrategy: true,
    removeRest: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export function createAdminClient(session) {
  if (!session?.shop || !session?.accessToken) {
    throw new Error("セッション情報が不足しています");
  }
  return new GraphqlClient(session);
}

export default shopify;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const sessionStorage = shopify.sessionStorage;
export const apiVersion = ApiVersion.January25;
