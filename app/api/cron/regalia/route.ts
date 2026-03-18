// app/api/cron/regalia/route.ts
// Runs daily at 9am UTC via Vercel cron (see vercel.json).
// Also callable manually at /api/cron/regalia?secret=YOUR_CRON_SECRET for testing.

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  fetchRegaliaSchedule,
  schedulesAreDifferent,
  getEntryStartingTomorrow,
  type RegaliaEntry,
} from "@/lib/regalia";
import { sendEmail, scheduleUpdatedEmail, shippingReminderEmail } from "@/lib/email";

export const maxDuration = 60; // Vercel max for hobby plan

export async function GET(req: Request) {
  // Allow manual trigger with secret, or Vercel's internal cron header
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
  const results = { scheduleChanged: false, reminderSent: false, error: null as string | null };

  try {
    // 1. Fetch fresh schedule from Regalia
    log.push("Fetching Regalia subscription page…");
    const { entries: freshEntries, fetchedAt, error: fetchError } = await fetchRegaliaSchedule();

    if (fetchError) {
      log.push(`Fetch error: ${fetchError}`);
      results.error = fetchError;
      return NextResponse.json({ ...results, log }, { status: 200 });
    }

    log.push(`Found ${freshEntries.length} entries`);

    // 2. Load stored schedule from Supabase
    const { data: stored } = await supabase
      .from("regalia_schedule")
      .select("entries")
      .eq("id", 1)
      .single();

    const storedEntries: RegaliaEntry[] = stored?.entries ?? [];

    // 3. Check if schedule changed
    const changed = schedulesAreDifferent(storedEntries, freshEntries);

    if (changed && freshEntries.length > 0) {
      log.push("Schedule changed — updating Supabase and sending email");

      // Upsert into Supabase
      await supabase.from("regalia_schedule").upsert({
        id: 1,
        entries: freshEntries,
        updated_at: fetchedAt,
      });

      // Send schedule update email
      await sendEmail({
        to: emailTo,
        subject: "Regalia updated their subscription schedule ☕",
        html: scheduleUpdatedEmail(freshEntries),
      });

      results.scheduleChanged = true;
      log.push("Schedule update email sent");
    } else {
      log.push("No schedule changes detected");
    }

    // 4. Check for shipping window starting tomorrow
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

    return NextResponse.json({ ...results, fetchedAt, entriesFound: freshEntries.length, log });

  } catch (err) {
    const message = String(err);
    log.push(`Unexpected error: ${message}`);
    return NextResponse.json({ ...results, error: message, log }, { status: 500 });
  }
}
