// Addresses copied from Instagram, Google or a newsletter carry tracking codes
// ("?utm_source=ig&igsh=...", "?srsltid=...") or arrive wrapped in a redirect
// ("l.instagram.com/?u=..."). Shared by the add form and the server.

const TRACKING = /^(utm_.*|fbclid|gclid|gclsrc|gad_source|gad_campaignid|gbraid|wbraid|dclid|msclkid|twclid|ttclid|li_fat_id|igsh|igshid|srsltid|si|mc_cid|mc_eid|_ga|_gl|_kx|klaviyo_.*|ref|ref_src|ref_url|_pos|_sid|_ss|_psq|_fid|_v|pr_prod_strat|pr_rec_id|pr_rec_pid|pr_ref_pid|pr_seq|sc_.*|hsa_.*|_hs.*|mkt_tok|oly_.*|rb_clickid|s_cid|epik)$/i;

/** Redirect wrappers and the parameter holding the real address. */
function unwrap(u: URL): URL | null {
  const host = u.hostname.replace(/^www\./, "");
  const param = /^(l|lm)\.(instagram|facebook)\.com$/.test(host) || host === "l.messenger.com" ? "u"
    : /^google\.[a-z.]+$/.test(host) && u.pathname === "/url" ? (u.searchParams.has("q") ? "q" : "url")
      : null;
  const inner = param && u.searchParams.get(param);
  if (!inner) return null;
  try {
    return new URL(inner);
  } catch {
    return null;
  }
}

/**
 * The roaster address in whatever was pasted: the first web address in the text,
 * out of any redirect, without tracking codes or "#..." anchors. Returns the text
 * trimmed if there's no address in it.
 */
export function cleanPastedUrl(text: string): string {
  const s = text.trim();
  const token = s.match(/https?:\/\/[^\s"'<>]+/i)?.[0] ?? s.split(/\s+/).find((w) => /[a-z0-9-]\.[a-z]{2,}/i.test(w)) ?? s;
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(token) ? token : "https://" + token);
  } catch {
    return s;
  }
  for (let i = 0; i < 3; i++) {
    const inner = unwrap(u);
    if (!inner) break;
    u = inner;
  }
  u.hash = "";
  // Trailing punctuation from a sentence ("...roaster.com/shop.").
  u.pathname = u.pathname.replace(/[.,;:!?)]+$/, "");
  // A homepage never needs a query; anything there is tracking (Luna's "?_su_rec=...").
  if (u.pathname === "/") u.search = "";
  // Elsewhere keep what a shop may need ("?product_cat=coffee"), but not known trackers,
  // "_"-prefixed codes (Shopify apps' _pos, _sid, _su_rec...) or long tokens.
  for (const [key, value] of [...u.searchParams.entries()]) {
    if (TRACKING.test(key) || key.startsWith("_") || value.length > 64) u.searchParams.delete(key);
  }
  return u.toString().replace(/\/$/, "").replace(/\/\?/, "?");
}
