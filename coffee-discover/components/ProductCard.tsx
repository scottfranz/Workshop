"use client";

import { formatPrice, sizedImage, type FeedItem } from "@/lib/feed";

export function ProductCard({ item, onHide, onRoaster }: { item: FeedItem; onHide: () => void; onRoaster: () => void }) {
  const price = formatPrice(item.price, item.currency);
  const image = sizedImage(item.image);
  return (
    <article className={`card${item.available ? "" : " sold-out"}`}>
      {/* The title link is the accessible one; this duplicate just makes the photo clickable. */}
      <a className="card-img" href={item.url} target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden="true">
        {image ? (
          <img src={image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
        ) : (
          <BagPlaceholder />
        )}
      </a>
      {!item.available ? <span className="badge sold">Sold out</span> : item.isNew && <span className="badge">New</span>}
      <button type="button" className="card-hide" onClick={onHide} aria-label={`Hide ${item.title}`} title="Hide this coffee">×</button>
      <div className="card-body">
        <button type="button" className="card-roaster" onClick={onRoaster} title={`Show only ${item.roasterName}`}>{item.roasterName}</button>
        <h3 className="card-title">
          <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a>
        </h3>
        {item.description && <p className="card-desc">{item.description}</p>}
        <div className="card-foot">
          <span className="price">{price ?? <span className="muted">See price</span>}</span>
          <span className="sr-only">Opens {item.roasterName}&apos;s site in a new tab</span>
        </div>
      </div>
    </article>
  );
}

function BagPlaceholder() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
      <rect width="100" height="100" fill="var(--surface-2)" />
      <path d="M32 24h36l4 10v42a6 6 0 0 1-6 6H34a6 6 0 0 1-6-6V34z" fill="var(--line)" />
      <path d="M28 34h44" stroke="var(--ink-3)" strokeWidth="2" opacity="0.4" />
      <ellipse cx="50" cy="58" rx="7" ry="10" transform="rotate(25 50 58)" fill="var(--ink-3)" opacity="0.5" />
    </svg>
  );
}

export function SkeletonCard() {
  return (
    <div className="card" aria-hidden="true">
      <div className="card-img skeleton" />
      <div className="card-body">
        <div className="skeleton" style={{ height: 12, width: "40%", borderRadius: 6 }} />
        <div className="skeleton" style={{ height: 18, width: "85%", borderRadius: 6, marginTop: 6 }} />
        <div className="skeleton" style={{ height: 14, width: "30%", borderRadius: 6, marginTop: 12 }} />
      </div>
    </div>
  );
}
