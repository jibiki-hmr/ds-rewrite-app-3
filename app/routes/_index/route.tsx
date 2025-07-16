// app/routes/_index/route.tsx

import { redirect } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return redirect("/app/products/list");
};

export default function IndexRedirect() {
  return null;
}