import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "The Workshop",
  description: "Personal dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
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
