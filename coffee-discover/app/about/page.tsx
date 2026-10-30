import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = { title: "How it works & privacy" };

export default function About() {
  return (
    <main className="wrap">
      <article className="prose">
        <p><Link href="/">← Back to your feed</Link></p>
        <h1>How {SITE_NAME} works</h1>
        <p>
          Follow the roasters you like and {SITE_NAME} checks their online shops for coffees. When a new bag shows up, it&apos;s
          marked <strong>New</strong> and floats to the top of your feed.
        </p>

        <h2>What we store, and where</h2>
        <p>
          Your list of roasters, the coffees you&apos;ve hidden and when you last visited are saved in <em>your browser&apos;s local storage</em>.
          They never leave your device. There are no accounts, cookies, analytics, ads or third-party scripts.
        </p>
        <p>
          Clearing your browser data will clear your list. To move your list to another device, use the share link under
          <strong> Roasters</strong>. Opening it adds those roasters to whatever you already follow. The link holds only the roasters&apos; web addresses, in the part of the URL that browsers don&apos;t send to servers.
        </p>

        <h2>What our server sees</h2>
        <p>
          To read a roaster&apos;s shop, your browser asks our server for that roaster&apos;s web address. The server fetches the store&apos;s public
          product listing and sends back a tidy list of coffees. Those results are cached and shared by everyone following the same roaster,
          which keeps traffic to roasters&apos; sites low. We don&apos;t log who asked.
        </p>
        <p>
          Coffee photos load directly from each roaster&apos;s image host, with no referrer sent.
        </p>

        <h2>Which shops work</h2>
        <ul>
          <li><strong>Shopify</strong>, <strong>WooCommerce</strong>, <strong>Squarespace</strong>, <strong>Square Online</strong> and <strong>Big Cartel</strong> shops are read from their built-in product feeds.</li>
          <li>Other shops work if they publish product details for search engines (most do). We read those from the page you give us and up to 24 product pages linked from it.</li>
          <li>If a homepage doesn&apos;t work, try the link to the roaster&apos;s coffee page. A specific collection link narrows your feed to just that collection.</li>
        </ul>

        <h2>How &ldquo;new&rdquo; is decided</h2>
        <p>
          A coffee is new if the shop says it was published in the last two weeks, or if it appeared after you started following that roaster.
          Gear, merch, gift cards and subscriptions are filtered out automatically.
        </p>
      </article>
    </main>
  );
}
