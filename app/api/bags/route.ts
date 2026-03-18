import { NextResponse } from "next/server";
import { appendBagRow } from "@/lib/sheets";

// Column order matches the sheet exactly:
// My Rating | Roast Date | Opened Bag Date | Roaster | Name | Country | Region |
// Producer | Farm/Washing Station | Harvest Date | Variety | Altitude (masl) |
// Process | clean/funk | Roast Level | development | Roaster Notes | My Notes |
// Weight (grams) | Price I Paid | Price per cup

export async function POST(req: Request) {
  try {
    const b = await req.json();

    const price = parseFloat(b.price) || 0;
    const weight = parseFloat(b.weight) || 0;
    const pricePerCup = weight > 0 ? ((price / weight) * 15).toFixed(2) : "";

    const row = [
      b.rating       ?? "",
      b.roastDate    ?? "",
      b.openedDate   ?? "",
      b.roaster      ?? "",
      b.name         ?? "",
      b.country      ?? "",
      b.region       ?? "",
      b.producer     ?? "",
      b.farm         ?? "",
      b.harvestDate  ?? "",
      b.variety      ?? "",
      b.altitude     ?? "",
      b.process      ?? "",
      b.cleanFunk    ?? "",
      b.roastLevel   ?? "",
      b.development  ?? "",
      b.roasterNotes ?? "",
      b.myNotes      ?? "",
      weight         || "",
      price > 0 ? `$${price.toFixed(2)}` : "$0.00",
      pricePerCup,
    ];

    await appendBagRow(row);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
