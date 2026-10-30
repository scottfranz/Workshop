"use client";

import { pricePerCup, sizedImage, type FeedItem } from "@/lib/feed";
import type { Money } from "@/lib/money";
import type { ViewMode } from "@/lib/storage";

interface Props {
  item: FeedItem;
  cupGrams: number;
  /** Formats an amount in the visitor's chosen currency (or the store's). */
  money: (amount: number | null, currency: string | null, decimals?: number) => Money | null;
  color: string;
  view: ViewMode;
  onHide: () => void;
  onRoaster: () => void;
}

export function ProductCard({ item, cupGrams, money, color, view, onHide, onRoaster }: Props) {
  const price = money(item.price, item.currency);
  const cup = money(pricePerCup(item, cupGrams), item.currency, 2);
  const perCup = cup && <span className="per-cup" title={`About ${cupGrams} g of coffee per cup${cup.original ? ` (${cup.original} in the store's currency)` : ""}`}>{cup.text}/cup</span>;
  // "$22 · 12 oz", or just "$22" when the store doesn't say the size.
  const priceLine = price
    ? (
      <span className="price">
        <span title={price.original ? `${price.original} at the store` : undefined}>{price.text}</span>
        {item.size && <span className="size"> · {item.size.label}</span>}
      </span>
    )
    : <span className="muted">See price</span>;
  const image = sizedImage(item.image, view === "list" ? 160 : 600);
  const style = { "--rc": color } as React.CSSProperties;
  const status = !item.available && <span className="badge sold">Sold out</span>;
  const hide = (
    <button type="button" className="card-hide" onClick={onHide} aria-label={`Hide ${item.title}`} title="Hide this coffee">×</button>
  );
  const title = <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a>;
  // The title link is the accessible one; this duplicate just makes the photo clickable.
  const photo = (
    <a className="card-img" href={item.url} target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden="true">
      {image ? <img src={image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" /> : <BagPlaceholder />}
    </a>
  );

  if (view === "list") {
    return (
      <article className={`row${item.available ? "" : " sold-out"}`} style={style}>
        {photo}
        <div className="row-info">
          <h3 className="card-title">{title}</h3>
          <button type="button" className="row-roaster" onClick={onRoaster} title={`Show only ${item.roasterName}`}>
            <span className="roaster-dot" aria-hidden="true" />{item.roasterName}
          </button>
          {item.description && <p className="card-desc row-desc">{item.description}</p>}
        </div>
        <div className="row-side">
          {priceLine}
          {perCup}
          {status}
        </div>
        {hide}
      </article>
    );
  }

  return (
    <article className={`card${item.available ? "" : " sold-out"}`} style={style}>
      <div className="card-media">
        {photo}
        {status}
        {hide}
        <button type="button" className="roaster-tag" onClick={onRoaster} title={`Show only ${item.roasterName}`}>{item.roasterName}</button>
      </div>
      <div className="card-body">
        <h3 className="card-title">{title}</h3>
        {item.description && <p className="card-desc">{item.description}</p>}
        <div className="card-foot">
          {priceLine}
          {perCup}
          <span className="sr-only">Opens {item.roasterName}&apos;s site in a new tab</span>
        </div>
      </div>
    </article>
  );
}

function BagPlaceholder() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
      <rect width="100" height="100" fill="color-mix(in srgb, var(--rc, var(--ink-3)) 14%, var(--surface-2))" />
      <path d="M32 24h36l4 10v42a6 6 0 0 1-6 6H34a6 6 0 0 1-6-6V34z" fill="color-mix(in srgb, var(--rc, var(--ink-3)) 30%, var(--surface))" />
      <path d="M28 34h44" stroke="var(--rc, var(--ink-3))" strokeWidth="2" opacity="0.5" />
      <ellipse cx="50" cy="58" rx="7" ry="10" transform="rotate(25 50 58)" fill="var(--rc, var(--ink-3))" opacity="0.55" />
    </svg>
  );
}

export function SkeletonCard({ view = "grid" }: { view?: ViewMode }) {
  if (view === "list") {
    return (
      <div className="row" aria-hidden="true">
        <div className="card-img skeleton" />
        <div className="row-info">
          <div className="skeleton" style={{ height: 16, width: "60%", borderRadius: 6 }} />
          <div className="skeleton" style={{ height: 12, width: "30%", borderRadius: 6, marginTop: 8 }} />
        </div>
      </div>
    );
  }
  return (
    <div className="card" aria-hidden="true">
      <div className="card-media"><div className="card-img skeleton" /></div>
      <div className="card-body">
        <div className="skeleton" style={{ height: 18, width: "85%", borderRadius: 6 }} />
        <div className="skeleton" style={{ height: 14, width: "60%", borderRadius: 6, marginTop: 6 }} />
        <div className="skeleton" style={{ height: 14, width: "30%", borderRadius: 6, marginTop: 12 }} />
      </div>
    </div>
  );
}
