import type { Metadata } from "next";
import Link from "next/link";
import { ReportForm } from "@/components/ReportForm";

export const metadata: Metadata = { title: "Report a problem" };

export default async function Report({ searchParams }: { searchParams: Promise<{ roaster?: string }> }) {
  const { roaster } = await searchParams;
  return (
    <main className="wrap">
      <article className="prose">
        <p><Link href="/">← Back to your feed</Link></p>
        <h1>Report a problem</h1>
        <p>
          A roaster that won&apos;t load, wrong prices or sizes, things that aren&apos;t coffee, or anything else that looks off.
          This goes straight to the person who runs Bean Feed.
        </p>
        <ReportForm initialRoaster={typeof roaster === "string" ? roaster.slice(0, 300) : ""} />
      </article>
    </main>
  );
}
