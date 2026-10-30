// The /api/roaster endpoint fetches URLs that anonymous visitors type in, so every
// request goes through here: public http(s) hosts only, no internal addresses,
// redirects re-checked hop by hop, bounded time and response size.

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const USER_AGENT = "BeanFeedBot/1.0 (+coffee discovery; respects robots and caches results)";
const MAX_BYTES = 6 * 1024 * 1024;
const MAX_REDIRECTS = 4;
const TIMEOUT_MS = 12_000;

export class FetchError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) || // CGNAT
      (a === 169 && b === 254) ||           // link-local / cloud metadata
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224                               // multicast + reserved
    );
  }
  const v6 = ip.toLowerCase();
  if (v6 === "::" || v6 === "::1") return true;
  const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateAddress(mapped[1]);
  return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v6);
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new FetchError("That doesn't look like a valid web address.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new FetchError("Only http and https links are supported.");
  if (url.username || url.password) throw new FetchError("Links with credentials aren't supported.");
  if (url.port && url.port !== "80" && url.port !== "443") throw new FetchError("Only standard web ports are supported.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    throw new FetchError("That address isn't on the public internet.");
  }
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => {
    throw new FetchError(`Couldn't find ${host}. Check the spelling?`);
  });
  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new FetchError("That address isn't on the public internet.");
  }
  return url;
}

async function readCapped(res: Response): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new FetchError("The store returned more data than we can handle.");
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

export interface FetchedText {
  url: string;
  status: number;
  contentType: string;
  body: string;
}

export async function safeFetchText(raw: string, accept = "application/json, text/html;q=0.9, */*;q=0.5"): Promise<FetchedText> {
  let current = raw;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await assertPublicUrl(current);
    let res: Response;
    try {
      res = await fetch(url, {
        redirect: "manual",
        headers: { "User-Agent": USER_AGENT, Accept: accept },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      const msg = err instanceof Error && err.name === "TimeoutError" ? "The store took too long to respond." : "Couldn't connect to the store.";
      throw new FetchError(msg);
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location")!, url).toString();
      continue;
    }
    return {
      url: url.toString(),
      status: res.status,
      contentType: res.headers.get("content-type") ?? "",
      body: await readCapped(res),
    };
  }
  throw new FetchError("Too many redirects.");
}

/** Fetch and parse JSON; returns null (rather than throwing) for non-2xx or non-JSON bodies. */
export async function safeFetchJson(raw: string): Promise<{ url: string; data: unknown } | null> {
  const res = await safeFetchText(raw, "application/json");
  if (res.status < 200 || res.status >= 300) return null;
  const trimmed = res.body.trimStart();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;
  try {
    return { url: res.url, data: JSON.parse(trimmed) };
  } catch {
    return null;
  }
}
