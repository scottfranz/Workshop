"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
  { section: "Other" },
  { href: "/projects", label: "Projects", dot: "#8C8070" },
];

// Bottom tab bar items for mobile
const TABS = [
  { href: "/", label: "Home", icon: "⌂" },
  { href: "/coffee", label: "Coffee", icon: "☕" },
  { href: "/garden", label: "Garden", icon: "🌱" },
  { href: "/books", label: "Reading", icon: "📖" },
  { href: "/watching", label: "Movies", icon: "🎬" },
  { href: "/writing", label: "Writing", icon: "✍︎" },
  { href: "/projects", label: "Projects", icon: "◈" },
];

export default function Sidebar() {
  const pathname = usePathname();

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  return (
    <>
      {/* Desktop sidebar */}
      <aside style={{
        background: "var(--ink)",
        color: "var(--cream)",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        position: "sticky",
        top: 0,
      }} className="desktop-sidebar">
        <div style={{ padding: "40px 28px 36px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 400 }}>
            The Workshop
          </div>
          <div style={{ fontSize: 11, fontWeight: 300, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-faint)", marginTop: 4 }}>
            Personal Dashboard
          </div>
        </div>

        <nav style={{ flex: 1, paddingTop: 28, overflowY: "auto" }}>
          {NAV.map((item, i) => {
            if ("section" in item) {
              return (
                <div key={i} style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: "0.2em",
                  textTransform: "uppercase", color: "var(--ink-faint)",
                  padding: "20px 28px 8px",
                }}>
                  {item.section}
                </div>
              );
            }
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href!);
            return (
              <Link key={item.href} href={item.href!} style={{ textDecoration: "none" }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: `10px ${item.sub ? "40px" : "28px"}`,
                  fontSize: item.sub ? 13 : 14,
                  color: active ? "var(--cream)" : "rgba(245,240,232,0.65)",
                  background: active ? "rgba(255,255,255,0.08)" : "transparent",
                  borderLeft: active ? "2px solid var(--coffee-light)" : "2px solid transparent",
                  opacity: item.sub ? 0.85 : 1,
                  transition: "all 0.15s",
                }}>
                  {item.dot && <span style={{ width: 8, height: 8, borderRadius: "50%", background: item.dot, flexShrink: 0 }} />}
                  {item.sub && <span style={{ fontSize: 10, color: "rgba(245,240,232,0.25)", marginLeft: -4 }}>└</span>}
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.badge && (
                    <span style={{ fontSize: 9, background: "rgba(255,255,255,0.12)", padding: "2px 6px", borderRadius: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                      {item.badge}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        <div style={{ padding: "20px 28px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontSize: 12, color: "rgba(245,240,232,0.4)" }}>
            {today}
          </div>
        </div>
      </aside>

      {/* Mobile bottom tab bar */}
      <nav className="mobile-tabs" style={{
        display: "none",
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: "var(--ink)",
        borderTop: "1px solid rgba(255,255,255,0.1)",
        zIndex: 100,
        paddingBottom: "env(safe-area-inset-bottom)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center", height: 56 }}>
          {TABS.map(tab => {
            const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
            return (
              <Link key={tab.href} href={tab.href} style={{ textDecoration: "none", flex: 1 }}>
                <div style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                  padding: "6px 0",
                  color: active ? "var(--coffee-light)" : "rgba(245,240,232,0.45)",
                  transition: "color 0.15s",
                }}>
                  <span style={{ fontSize: 18, lineHeight: 1 }}>{tab.icon}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", fontFamily: "'Lato', sans-serif" }}>{tab.label}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
