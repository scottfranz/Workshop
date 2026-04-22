"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV = [
  { href: "/", label: "Home", dot: null },
  { section: "Hobbies" },
  { href: "/coffee", label: "Coffee", dot: "#C4956A" },
  { href: "/coffee/log", label: "Bag Log", dot: null, sub: true },
  { href: "/coffee/discover", label: "Discover", dot: null, sub: true, badge: "new" },
  { href: "/garden", label: "Garden", dot: "#7A9E7E" },
  { href: "/books", label: "Reading", dot: "#5B7FA6" },
  { href: "/watching", label: "Movies & TV", dot: "#C9963A" },
  { href: "/writing", label: "Writing", dot: "#B5622A" },
  { href: "/podcasts", label: "Podcasts", dot: "#7B5EA7" },
  { section: "Other" },
  { href: "/projects", label: "Projects", dot: "#8C8070" },
];

const TABS = [
  { href: "/", label: "Home", icon: "⌂", children: null },
  { href: "/coffee", label: "Coffee", icon: "☕", children: [
    { href: "/coffee", label: "Stats" },
    { href: "/coffee/log", label: "Bag Log" },
    { href: "/coffee/discover", label: "Discover" },
  ]},
  { href: "/garden", label: "Garden", icon: "🌱", children: null },
  { href: "/books", label: "Reading", icon: "📖", children: null },
  { href: "/watching", label: "Movies", icon: "🎬", children: null },
  { href: "/writing", label: "Writing", icon: "✍︎", children: null },
  { href: "/podcasts", label: "Podcasts", icon: "🎙️", children: null },
  { href: "/projects", label: "Projects", icon: "◈", children: null },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  return (
    <>
      {/* Desktop sidebar */}
      <aside style={{
        background: "var(--ink)", color: "var(--cream)", display: "flex",
        flexDirection: "column", height: "100vh", position: "sticky", top: 0,
      }} className="desktop-sidebar">
        <div style={{ padding: "40px 28px 36px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 400 }}>The Workshop</div>
          <div style={{ fontSize: 11, fontWeight: 300, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-faint)", marginTop: 4 }}>Personal Dashboard</div>
        </div>
        <nav style={{ flex: 1, paddingTop: 28, overflowY: "auto" }}>
          {NAV.map((item, i) => {
            if ("section" in item) {
              return <div key={i} style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--ink-faint)", padding: "20px 28px 8px" }}>{item.section}</div>;
            }
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href!);
            return (
              <Link key={item.href} href={item.href!} style={{ textDecoration: "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: `10px ${item.sub ? "40px" : "28px"}`, fontSize: item.sub ? 13 : 14, color: active ? "var(--cream)" : "rgba(245,240,232,0.65)", background: active ? "rgba(255,255,255,0.08)" : "transparent", borderLeft: active ? "2px solid var(--coffee-light)" : "2px solid transparent", opacity: item.sub ? 0.85 : 1, transition: "all 0.15s" }}>
                  {item.dot && <span style={{ width: 8, height: 8, borderRadius: "50%", background: item.dot, flexShrink: 0 }} />}
                  {item.sub && <span style={{ fontSize: 10, color: "rgba(245,240,232,0.25)", marginLeft: -4 }}>└</span>}
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.badge && <span style={{ fontSize: 9, background: "rgba(255,255,255,0.12)", padding: "2px 6px", borderRadius: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>{item.badge}</span>}
                </div>
              </Link>
            );
          })}
        </nav>
        <div style={{ padding: "20px 28px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontSize: 12, color: "rgba(245,240,232,0.4)" }}>{today}</div>
        </div>
      </aside>

      {/* Mobile bottom tab bar */}
      <style>{`
        .mobile-tab-scroll::-webkit-scrollbar { display: none; }
        .mobile-tab-scroll { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
      <nav className="mobile-tabs" style={{ display: "none", position: "fixed", bottom: 0, left: 0, right: 0, background: "var(--ink)", borderTop: "1px solid rgba(255,255,255,0.1)", zIndex: 100, paddingBottom: "env(safe-area-inset-bottom)" }}>
        {/* Submenu popup */}
        {openMenu && (() => {
          const tab = TABS.find(t => t.href === openMenu);
          if (!tab?.children) return null;
          return (
            <>
              <div onClick={() => setOpenMenu(null)} style={{ position: "fixed", inset: 0, zIndex: 99 }} />
              <div style={{ position: "absolute", bottom: "calc(56px + env(safe-area-inset-bottom))", left: 0, right: 0, background: "var(--ink)", borderTop: "1px solid rgba(255,255,255,0.12)", zIndex: 101, padding: "8px 0" }}>
                {tab.children.map(child => (
                  <Link key={child.href} href={child.href} style={{ textDecoration: "none" }} onClick={() => setOpenMenu(null)}>
                    <div style={{ padding: "12px 28px", fontSize: 15, color: pathname === child.href ? "var(--coffee-light)" : "rgba(245,240,232,0.8)", fontFamily: "'Lato', sans-serif", background: pathname === child.href ? "rgba(255,255,255,0.06)" : "transparent" }}>
                      {child.label}
                    </div>
                  </Link>
                ))}
              </div>
            </>
          );
        })()}

        {/* Scrollable tab row */}
        <div
          className="mobile-tab-scroll"
          style={{ display: "flex", alignItems: "center", height: 56, overflowX: "auto", paddingLeft: 4, paddingRight: 4 }}
        >
          {TABS.map(tab => {
            const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
            const tabStyle: React.CSSProperties = {
              flexShrink: 0,
              minWidth: 64,
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              padding: "6px 8px",
              color: active ? "var(--coffee-light)" : "rgba(245,240,232,0.45)",
              transition: "color 0.15s",
              textDecoration: "none",
            };

            return tab.children ? (
              <button key={tab.href} onClick={() => setOpenMenu(openMenu === tab.href ? null : tab.href)} style={tabStyle}>
                <span style={{ fontSize: 18, lineHeight: 1 }}>{tab.icon}</span>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", fontFamily: "'Lato', sans-serif" }}>{tab.label}</span>
              </button>
            ) : (
              <Link key={tab.href} href={tab.href} style={tabStyle} onClick={() => setOpenMenu(null)}>
                <span style={{ fontSize: 18, lineHeight: 1 }}>{tab.icon}</span>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", fontFamily: "'Lato', sans-serif" }}>{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
