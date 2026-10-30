"use client";

import { formatPrice, sizedImage, type FeedItem } from "@/lib/feed";
import type { ViewMode } from "@/lib/storage";

interface Props {
  item: FeedItem;
  color: string;
  view: ViewMode;
  onHide: () => void;
  onRoaster: () => void;
}

export function ProductCard({ item, color, view, onHide, onRoaster }: Props) {
  const price = formatPrice(item.price, item.currency);
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
          <span className="price">{price ?? <span className="muted">See price</span>}</span>
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
          <span className="price">{price ?? <span className="muted">See price</span>}</span>
          <span className="sr-only">Opens {item.roasterName}&apos;s site in a new tab</span>
        </div>
      </div>
    </article>
  );
}

function BagPlaceholder() {
  return (
    <svg viewBox="0 0 100 125" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="100" height="125" fill="var(--fill)" />
      <path d="M38 44h24l3 7v28a3 3 0 0 1-3 3H38a3 3 0 0 1-3-3V51z" fill="none" stroke="var(--fg-3)" strokeWidth="1.2" />
      <path d="M35 51h30" stroke="var(--fg-3)" strokeWidth="1.2" />
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
