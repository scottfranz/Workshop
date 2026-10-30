# Bean Feed

A public coffee discovery site. Follow the roasters you like and see their new
bags in one feed. No accounts, no cookies, no tracking: each visitor's roaster
list is stored in their own browser's localStorage.

## How it works

- **`app/api/roaster`**: the only server code. Given a store URL it detects the
  platform and returns a normalised list of coffees. Responses are CDN-cached
  (`s-maxage=1800`) so everyone following the same roaster shares one fetch.
- **`lib/scrapers/`**: one adapter per platform, each a pure parser plus a small fetcher.
  | Platform | Source |
  |---|---|
  | Shopify | `/products.json` (+ `/meta.json` for name and currency); collection links supported |
  | WooCommerce | Public Store API `/wp-json/wc/store/v1/products`; `/product-category/...` links narrow it |
  | Squarespace | `?format=json` on the shop page; finds the shop from the homepage nav if needed |
  | Square Online | Store IDs from the page, then its `/app/store/api/v28/.../products` JSON API; `/shop/<name>/<id>` links narrow it |
| Big Cartel | `/products.json` + `/store.json` |
  | Anything else | schema.org JSON-LD on the page, then up to 24 linked product pages |
- **`lib/scrapers/filter.ts`**: drops gear, merch, gift cards and subscriptions.
- **`lib/scrapers/safeFetch.ts`**: every outbound request goes through this. Public
  hosts only (blocks private, loopback and metadata IPs, checked again on each redirect),
  with time and size limits.
- **`lib/storage.ts`**: localStorage state, plus share links (`/#follow=...`) to move a list between devices.
- **`lib/feed.ts`**: "new" logic. A bag is new if the store published it in the last 14 days,
  or if it appeared after you followed the roaster.

## Develop

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # parser, detection, SSRF and feed-logic tests
LIVE_URLS=https://roaster.com,https://other.com npm run test:live   # try real stores
npm run typecheck
```

## Deploy (Vercel)

New Project → import this repo → set **Root Directory** to `coffee-discover`. No
environment variables are needed.

Rename the app in `lib/site.ts`.
