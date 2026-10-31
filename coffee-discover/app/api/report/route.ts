import { NextResponse } from "next/server";

// "Report a problem" form → an email to the site owner via Resend.
// Configure in Vercel: RESEND_API_KEY and REPORT_EMAIL_TO (kept out of the code,
// since the repository is public). REPORT_EMAIL_FROM is optional; Resend's test
// sender can only deliver to the address that owns the Resend account.
// Nothing is stored or logged; the email is the only copy.

export const runtime = "nodejs";

const LIMIT = { roaster: 300, message: 3000, email: 200 };
const PER_HOUR = 5;
const recent = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const times = (recent.get(ip) ?? []).filter((t) => now - t < 3600_000);
  if (times.length >= PER_HOUR) return true;
  recent.set(ip, [...times, now]);
  if (recent.size > 5000) recent.delete(recent.keys().next().value!);
  return false;
}

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: Request) {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.REPORT_EMAIL_TO;
  if (!key || !to) return NextResponse.json({ error: "Reporting isn't set up yet." }, { status: 503 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Something went wrong sending that." }, { status: 400 });
  // Hidden field people never see: anything in it means a bot. Pretend it worked.
  if (clean(body.website, 100)) return NextResponse.json({ ok: true });

  const roaster = clean(body.roaster, LIMIT.roaster);
  const message = clean(body.message, LIMIT.message);
  const email = clean(body.email, LIMIT.email);
  if (message.length < 5) return NextResponse.json({ error: "Please say a little about what's wrong." }, { status: 400 });
  const replyTo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) return NextResponse.json({ error: "That's a lot of reports. Please try again later." }, { status: 429 });

  const subject = `Bean Feed report${roaster ? `: ${roaster.replace(/^https?:\/\//, "").slice(0, 60)}` : ""}`;
  const text = [
    ...(roaster ? [`Roaster: ${roaster}`] : []),
    replyTo ? `Reply to: ${replyTo}` : "No reply address given.",
    "",
    message,
  ].join("\n");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.REPORT_EMAIL_FROM || "Bean Feed <onboarding@resend.dev>",
      to: [to],
      subject,
      text,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!res?.ok) {
    console.error("report email failed", res?.status);
    return NextResponse.json({ error: "Couldn't send that right now. Please try again later." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
