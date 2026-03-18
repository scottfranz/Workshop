import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "The Workshop",
  description: "Personal dashboard",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Workshop",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#1E1A14" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <style>{`
          @media (max-width: 768px) {
            .desktop-sidebar { display: none !important; }
            .mobile-tabs { display: block !important; }
            .layout-grid { grid-template-columns: 1fr !important; }
            .layout-main { padding-bottom: calc(56px + env(safe-area-inset-bottom)) !important; }
          }
        `}</style>
      </head>
      <body>
        <div className="layout-grid" style={{ display: "grid", gridTemplateColumns: "220px 1fr", minHeight: "100vh" }}>
          <Sidebar />
          <main className="layout-main" style={{ background: "var(--warm-white)", overflowY: "auto" }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
