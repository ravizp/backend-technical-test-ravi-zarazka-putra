import { createApp } from "../../src/app.js";

const app = createApp();

type Method = "GET" | "POST" | "PATCH" | "DELETE";

interface Options {
  token?: string;
  body?: unknown;
}

interface ApiResponse<T = Record<string, unknown>> {
  status: number;
  body: T;
}

/** Fire a request at the real Hono app and return `{ status, body }`. */
export async function api<T = Record<string, unknown>>(
  method: Method,
  path: string,
  { token, body }: Options = {},
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;

  const init: RequestInit = { method, headers };
  if (body !== undefined) {
    headers["content-type"] = "application/json";
    init.body = JSON.stringify(body);
  }

  const res = await app.request(path, init);
  const isJson = res.headers.get("content-type")?.includes("application/json");
  return { status: res.status, body: (isJson ? await res.json() : null) as T };
}
