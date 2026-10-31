import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { REPORT_PATH, SITE_NAME, SITE_TAGLINE } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: SITE_TAGLINE,
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: "default" },
  referrer: "no-referrer",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f3ec" },
    { media: "(prefers-color-scheme: dark)", color: "#17120e" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <footer className="site-footer">
          <div className="wrap">
            <span>{SITE_NAME} · No accounts. No cookies. No tracking.</span>
            <span className="footer-links">
              <Link href="/about">How it works &amp; privacy</Link>
              <Link href={REPORT_PATH}>Report a problem</Link>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
