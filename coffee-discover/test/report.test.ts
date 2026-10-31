import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const post = (body: unknown, ip = "1.2.3.4") =>
  new Request("http://localhost/api/report", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(body) });

describe("report form email", () => {
  let sent: { url: string; init: RequestInit }[];
  beforeEach(() => {
    vi.resetModules();
    sent = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => { sent.push({ url, init }); return new Response("{}", { status: 200 }); }));
    process.env.RESEND_API_KEY = "re_test";
    process.env.REPORT_EMAIL_TO = "owner@example.com";
  });
  afterEach(() => { vi.unstubAllGlobals(); delete process.env.RESEND_API_KEY; delete process.env.REPORT_EMAIL_TO; });

  it("emails the report to the owner, with the reporter as reply-to", async () => {
    const { POST } = await import("@/app/api/report/route");
    const res = await POST(post({ roaster: "https://sweetbloomcoffee.com", message: "Hirwa shows as available but isn't.", email: "fan@example.com" }));
    expect(res.status).toBe(200);
    expect(sent[0].url).toBe("https://api.resend.com/emails");
    const body = JSON.parse(String(sent[0].init.body));
    expect(body).toMatchObject({ to: ["owner@example.com"], reply_to: "fan@example.com", subject: "Bean Feed report: sweetbloomcoffee.com" });
    expect(body.text).toContain("Hirwa shows as available");
  });

  it("silently drops bot submissions that fill the hidden field", async () => {
    const { POST } = await import("@/app/api/report/route");
    expect((await POST(post({ message: "buy cheap stuff", website: "spam.example" }))).status).toBe(200);
    expect(sent).toHaveLength(0);
  });

  it("rejects empty messages and limits reports per visitor", async () => {
    const { POST } = await import("@/app/api/report/route");
    expect((await POST(post({ message: "hi" }))).status).toBe(400);
    for (let i = 0; i < 5; i++) expect((await POST(post({ message: "Something is off here." }, "9.9.9.9"))).status).toBe(200);
    expect((await POST(post({ message: "Something is off here." }, "9.9.9.9"))).status).toBe(429);
  });

  it("says so when email isn't configured", async () => {
    delete process.env.RESEND_API_KEY;
    const { POST } = await import("@/app/api/report/route");
    expect((await POST(post({ message: "Something is off here." }))).status).toBe(503);
  });
});
