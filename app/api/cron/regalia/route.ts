import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  fetchRegaliaSchedule,
  schedulesAreDifferent,
  getEntryStartingTomorrow,
  fetchTandemSampler,
  tandemSamplersAreDifferent,
  type RegaliaEntry,
  type TandemEntry,
} from "@/lib/regalia";
import { sendEmail, scheduleUpdatedEmail, shippingReminderEmail, tandemSamplerEmail } from "@/lib/email";

export const maxDuration = 60;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  const isManual = searchParams.get("secret") === process.env.CRON_SECRET;

  if (!isVercelCron && !isManual) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const emailTo = process.env.NOTIFICATION_EMAIL;
  if (!emailTo) {
    return NextResponse.json({ error: "NOTIFICATION_EMAIL not set" }, { status: 500 });
  }

  const log: string[] = [];
  const results = { scheduleChanged: false, reminderSent: false, tandemChanged: false, error: null as string | null };

  try {
    // ── Regalia ──────────────────────────────────────────────────────────────
    log.push("Fetching Regalia subscription page…");
    const { entries: freshEntries, fetchedAt, error: fetchError } = await fetchRegaliaSchedule();

    if (fetchError) {
      log.push(`Fetch error: ${fetchError}`);
      results.error = fetchError;
    } else {
      log.push(`Found ${freshEntries.length} entries`);

      const { data: stored } = await supabase
        .from("regalia_schedule")
        .select("entries")
        .eq("id", 1)
        .single();

      const storedEntries: RegaliaEntry[] = stored?.entries ?? [];
      const changed = schedulesAreDifferent(storedEntries, freshEntries);

      if (changed && freshEntries.length > 0) {
        log.push("Schedule changed — updating Supabase and sending email");
        await supabase.from("regalia_schedule").upsert({ id: 1, entries: freshEntries, updated_at: fetchedAt });
        await sendEmail({
          to: emailTo,
          subject: "Regalia updated their subscription schedule ☕",
          html: scheduleUpdatedEmail(freshEntries),
        });
        results.scheduleChanged = true;
        log.push("Schedule update email sent");
      } else {
        log.push("No Regalia schedule changes detected");
      }

      const tomorrowEntry = getEntryStartingTomorrow(freshEntries);
      if (tomorrowEntry) {
        log.push(`Shipping reminder: ${tomorrowEntry.name} starts tomorrow`);
        await sendEmail({
          to: emailTo,
          subject: `Your Regalia bag ships tomorrow — ${tomorrowEntry.name}`,
          html: shippingReminderEmail(tomorrowEntry),
        });
        results.reminderSent = true;
        log.push("Shipping reminder sent");
      }
    }

    // ── Tandem ───────────────────────────────────────────────────────────────
    log.push("Fetching Tandem sampler page…");
    const { entries: freshTandem, error: tandemError } = await fetchTandemSampler();

    if (tandemError) {
      log.push(`Tandem fetch error: ${tandemError}`);
    } else {
      log.push(`Found ${freshTandem.length} Tandem coffees`);

      const { data: storedTandem } = await supabase
        .from("regalia_schedule")
        .select("entries")
        .eq("id", 2)
        .single();

      const storedTandemEntries: TandemEntry[] = storedTandem?.entries ?? [];
      const tandemChanged = tandemSamplersAreDifferent(storedTandemEntries, freshTandem);

      if (tandemChanged && freshTandem.length > 0) {
        log.push("Tandem sampler changed — updating Supabase and sending email");
        await supabase.from("regalia_schedule").upsert({ id: 2, entries: freshTandem, updated_at: new Date().toISOString() });
        await sendEmail({
          to: emailTo,
          subject: "Tandem's sampler pack has new coffees ☕",
          html: tandemSamplerEmail(freshTandem),
        });
        results.tandemChanged = true;
        log.push("Tandem update email sent");
      } else {
        log.push("No Tandem sampler changes detected");
      }
    }

    return NextResponse.json({ ...results, fetchedAt: new Date().toISOString(), log });

  } catch (err) {
    const message = String(err);
    log.push(`Unexpected error: ${message}`);
    return NextResponse.json({ ...results, error: message, log }, { status: 500 });
  }
}
