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
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body>
        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", minHeight: "100vh" }}>
          <Sidebar />
          <main style={{ background: "var(--warm-white)", overflowY: "auto" }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
