// lib/email.ts
// Sends emails via Resend. https://resend.com

const RESEND_API = "https://api.resend.com/emails";

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: EmailPayload): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY not set");

  const from = process.env.EMAIL_FROM ?? "The Workshop <notifications@yourdomain.com>";

  const res = await fetch(RESEND_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error ${res.status}: ${err}`);
  }
}

// ── Email templates ──────────────────────────────────────────────────────────

export function scheduleUpdatedEmail(entries: Array<{
  startDate: string; endDate: string; name: string; origin: string | null; tastingNotes: string | null;
}>): string {
  const rows = entries.map(e => {
    const start = new Date(e.startDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const end = new Date(e.endDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const notes = e.tastingNotes
      ? `<p style="margin:4px 0 0; color:#8C8070; font-size:13px; font-style:italic">${e.tastingNotes}</p>`
      : "";
    return `
      <tr>
        <td style="padding:12px 16px; border-bottom:1px solid #DDD5C8; font-size:13px; color:#8C8070; white-space:nowrap">${start} – ${end}</td>
        <td style="padding:12px 16px; border-bottom:1px solid #DDD5C8">
          <strong style="font-size:14px; color:#1E1A14">${e.name}</strong>
          ${e.origin ? `<span style="color:#8C8070; font-size:13px"> · ${e.origin}</span>` : ""}
          ${notes}
        </td>
      </tr>`;
  }).join("");

  return `
    <div style="font-family:'Georgia',serif; max-width:600px; margin:0 auto; background:#FAF8F3; border:1px solid #DDD5C8; border-radius:8px; overflow:hidden">
      <div style="background:#1E1A14; padding:28px 32px">
        <div style="font-size:20px; color:#F5F0E8; font-style:italic">The Workshop</div>
        <div style="font-size:11px; color:#8C8070; letter-spacing:0.12em; text-transform:uppercase; margin-top:4px">Coffee · Regalia update</div>
      </div>
      <div style="padding:32px">
        <h2 style="font-size:22px; color:#1E1A14; margin:0 0 8px">Regalia updated their schedule ☕</h2>
        <p style="color:#4A4438; font-size:14px; line-height:1.6; margin:0 0 28px">The Easy Subscription shipping calendar has changed. Here's what's coming up:</p>
        <table style="width:100%; border-collapse:collapse; border:1px solid #DDD5C8; border-radius:6px; overflow:hidden">
          <thead>
            <tr style="background:#F5F0E8">
              <th style="padding:10px 16px; text-align:left; font-size:10px; letter-spacing:0.12em; text-transform:uppercase; color:#8C8070; font-weight:700">Window</th>
              <th style="padding:10px 16px; text-align:left; font-size:10px; letter-spacing:0.12em; text-transform:uppercase; color:#8C8070; font-weight:700">Coffee</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="margin:24px 0 0; font-size:12px; color:#8C8070">
          <a href="https://regaliacoffee.com/products/the-easy-subscription" style="color:#C4956A">View on Regalia ↗</a>
        </p>
      </div>
    </div>`;
}

export function shippingReminderEmail(entry: {
  name: string; origin: string | null; startDate: string; endDate: string; tastingNotes: string | null;
}): string {
  const start = new Date(entry.startDate + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" });
  const end = new Date(entry.endDate + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" });

  return `
    <div style="font-family:'Georgia',serif; max-width:600px; margin:0 auto; background:#FAF8F3; border:1px solid #DDD5C8; border-radius:8px; overflow:hidden">
      <div style="background:#1E1A14; padding:28px 32px">
        <div style="font-size:20px; color:#F5F0E8; font-style:italic">The Workshop</div>
        <div style="font-size:11px; color:#8C8070; letter-spacing:0.12em; text-transform:uppercase; margin-top:4px">Coffee · Regalia reminder</div>
      </div>
      <div style="padding:32px">
        <p style="font-size:14px; color:#8C8070; margin:0 0 12px">Your next bag ships tomorrow ☕</p>
        <h2 style="font-size:26px; color:#1E1A14; margin:0 0 8px; font-style:italic">${entry.name}</h2>
        ${entry.origin ? `<p style="font-size:14px; color:#C4956A; margin:0 0 24px; font-weight:700">${entry.origin}</p>` : "<div style='margin-bottom:24px'></div>"}
        <div style="background:#F5F0E8; border:1px solid #DDD5C8; border-radius:6px; padding:16px 20px; margin-bottom:24px">
          <div style="font-size:10px; letter-spacing:0.12em; text-transform:uppercase; color:#8C8070; margin-bottom:6px">Shipping window</div>
          <div style="font-size:15px; color:#1E1A14; font-weight:700">${start} – ${end}</div>
        </div>
        ${entry.tastingNotes ? `
        <div style="border-left:3px solid #C4956A; padding-left:16px; margin-bottom:24px">
          <div style="font-size:10px; letter-spacing:0.12em; text-transform:uppercase; color:#8C8070; margin-bottom:6px">Tasting notes</div>
          <div style="font-size:14px; color:#4A4438; font-style:italic; line-height:1.6">${entry.tastingNotes}</div>
        </div>` : ""}
        <p style="font-size:12px; color:#8C8070; margin:0">
          <a href="https://regaliacoffee.com/products/the-easy-subscription" style="color:#C4956A">View subscription page ↗</a>
        </p>
      </div>
    </div>`;
}

export function showroomNewProductsEmail(products: Array<{ name: string; url: string; slug: string }>): string {
  const rows = products.map(p => `
    <tr>
      <td style="padding:12px 16px; border-bottom:1px solid #DDD5C8">
        <a href="${p.url}" style="font-size:14px; font-weight:700; color:#1E1A14; text-decoration:none">${p.name}</a>
      </td>
    </tr>`).join("");

  return `
    <div style="font-family:'Georgia',serif; max-width:600px; margin:0 auto; background:#FAF8F3; border:1px solid #DDD5C8; border-radius:8px; overflow:hidden">
      <div style="background:#1E1A14; padding:28px 32px">
        <div style="font-size:20px; color:#F5F0E8; font-style:italic">The Workshop</div>
        <div style="font-size:11px; color:#8C8070; letter-spacing:0.12em; text-transform:uppercase; margin-top:4px">Coffee · Showroom update</div>
      </div>
      <div style="padding:32px">
        <h2 style="font-size:22px; color:#1E1A14; margin:0 0 8px">New green coffee${products.length > 1 ? "s" : ""} on Showroom ☕</h2>
        <p style="color:#4A4438; font-size:14px; line-height:1.6; margin:0 0 28px">
          ${products.length} new product${products.length > 1 ? "s have" : " has"} been added to the green coffee catalog:
        </p>
        <table style="width:100%; border-collapse:collapse; border:1px solid #DDD5C8; border-radius:6px; overflow:hidden">
          <tbody>${rows}</tbody>
        </table>
        <p style="margin:24px 0 0; font-size:12px; color:#8C8070">
          <a href="https://showroomcoffee.com/category/green-coffee/" style="color:#C4956A">View all green coffees on Showroom ↗</a>
        </p>
      </div>
    </div>`;
}

export function tandemSamplerEmail(entries: Array<{ name: string; origin: string | null }>): string {
  const rows = entries.map(e => `
    <tr>
      <td style="padding:12px 16px; border-bottom:1px solid #DDD5C8">
        <strong style="font-size:14px; color:#1E1A14">${e.name}</strong>
        ${e.origin ? `<span style="color:#8C8070; font-size:13px"> · ${e.origin}</span>` : ""}
      </td>
    </tr>`).join("");

  return `
    <div style="font-family:'Georgia',serif; max-width:600px; margin:0 auto; background:#FAF8F3; border:1px solid #DDD5C8; border-radius:8px; overflow:hidden">
      <div style="background:#1E1A14; padding:28px 32px">
        <div style="font-size:20px; color:#F5F0E8; font-style:italic">The Workshop</div>
        <div style="font-size:11px; color:#8C8070; letter-spacing:0.12em; text-transform:uppercase; margin-top:4px">Coffee · Tandem Sampler update</div>
      </div>
      <div style="padding:32px">
        <h2 style="font-size:22px; color:#1E1A14; margin:0 0 8px">Tandem's sampler has changed ☕</h2>
        <p style="color:#4A4438; font-size:14px; line-height:1.6; margin:0 0 28px">The Single Origin Sampler Pack is now featuring these four coffees:</p>
        <table style="width:100%; border-collapse:collapse; border:1px solid #DDD5C8; border-radius:6px; overflow:hidden">
          <tbody>${rows}</tbody>
        </table>
        <p style="margin:24px 0 0; font-size:12px; color:#8C8070">
          <a href="https://www.tandemcoffee.com/products/tandem-sampler" style="color:#C4956A">View on Tandem ↗</a>
        </p>
      </div>
    </div>`;
}
