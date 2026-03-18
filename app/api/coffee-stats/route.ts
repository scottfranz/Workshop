import { NextResponse } from "next/server";
import { readAllBags } from "@/lib/sheets";

export async function GET() {
  try {
    const rows = await readAllBags();

    const ratings = rows.map((r: Record<string,string>) => parseFloat(r["My Rating"])).filter((n: number) => !isNaN(n));
    const prices = rows.map((r: Record<string,string>) => parseFloat(r["Price I Paid"]?.replace(/[$,]/g, ""))).filter((n: number) => !isNaN(n) && n > 0);

    // Cup price at 15g
    const cupPrices: number[] = [];
    rows.forEach((r: Record<string,string>) => {
      const price = parseFloat(r["Price I Paid"]?.replace(/[$,]/g, ""));
      const weight = parseFloat(r["Weight (grams)"]);
      if (!isNaN(price) && !isNaN(weight) && weight > 0) cupPrices.push(price / (weight / 15));
    });

    // Roasters by count
    const roasterCounts: Record<string, number> = {};
    rows.forEach((r: Record<string,string>) => { if (r["Roaster"]) roasterCounts[r["Roaster"]] = (roasterCounts[r["Roaster"]] ?? 0) + 1; });
    const topRoasters = Object.entries(roasterCounts).sort((a: [string,number], b: [string,number]) => b[1] - a[1]).slice(0, 8);

    // Countries
    const countryCounts: Record<string, number> = {};
    rows.forEach((r: Record<string,string>) => {
      if (!r["Country"]) return;
      r["Country"].split(" - ").forEach((c: string) => {
        const key = c.trim();
        if (key) countryCounts[key] = (countryCounts[key] ?? 0) + 1;
      });
    });
    const topCountries = Object.entries(countryCounts).sort((a: [string,number], b: [string,number]) => b[1] - a[1]).slice(0, 8);

    // Process
    const processCounts: Record<string, number> = {};
    rows.forEach((r: Record<string,string>) => { if (r["Process"]) processCounts[r["Process"]] = (processCounts[r["Process"]] ?? 0) + 1; });
    const topProcesses = Object.entries(processCounts).sort((a: [string,number], b: [string,number]) => b[1] - a[1]).slice(0, 6);

    // Rating distribution — reversed so highest is first
    const ratingBuckets = [
      { label: "8+",  count: ratings.filter((r: number) => r >= 8).length },
      { label: "7–8", count: ratings.filter((r: number) => r >= 7 && r < 8).length },
      { label: "6–7", count: ratings.filter((r: number) => r >= 6 && r < 7).length },
      { label: "4–6", count: ratings.filter((r: number) => r >= 4 && r < 6).length },
      { label: "0–4", count: ratings.filter((r: number) => r < 4).length },
    ];

    // Top rated bags
    const topRated = rows
      .filter((r: Record<string,string>) => r["My Rating"] && r["Roaster"] && r["Name"])
      .map((r: Record<string,string>) => ({ name: r["Name"], roaster: r["Roaster"], rating: parseFloat(r["My Rating"]) }))
      .filter((r: {rating:number}) => !isNaN(r.rating))
      .sort((a: {rating:number}, b: {rating:number}) => b.rating - a.rating)
      .slice(0, 5);

    // Recent bags by opened date
    const recentBags = rows
      .filter((r: Record<string,string>) => r["Opened Bag Date"] && r["Roaster"] && r["Name"])
      .map((r: Record<string,string>) => {
        const parts = r["Opened Bag Date"].trim().split("/");
        const year = parts[2]?.length === 2 ? "20" + parts[2] : parts[2];
        const dateStr = parts.length >= 3 ? `${year}-${parts[0].padStart(2,"0")}-${parts[1].padStart(2,"0")}` : "";
        return { name: r["Name"], roaster: r["Roaster"], openDate: dateStr, rating: r["My Rating"] ? parseFloat(r["My Rating"]) : null };
      })
      .filter((r: {openDate:string}) => r.openDate)
      .sort((a: {openDate:string}, b: {openDate:string}) => b.openDate.localeCompare(a.openDate))
      .slice(0, 5);

    // Ratings over time sorted by roast date
    const ratingsOverTime = rows
      .filter((r: Record<string,string>) => r["My Rating"] && r["Roast Date"])
      .map((r: Record<string,string>) => {
        const parts = r["Roast Date"].trim().split("/");
        const year = parts[2]?.length === 2 ? "20" + parts[2] : parts[2];
        const dateStr = parts.length >= 3 ? `${year}-${parts[0].padStart(2,"0")}-${parts[1].padStart(2,"0")}` : "";
        return { date: dateStr, rating: parseFloat(r["My Rating"]), name: r["Name"], roaster: r["Roaster"] };
      })
      .filter((r: {date:string; rating:number}) => r.date && !isNaN(r.rating))
      .sort((a: {date:string}, b: {date:string}) => a.date.localeCompare(b.date));

    return NextResponse.json({
      totalBags: rows.length,
      avgRating: ratings.length ? +(ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length).toFixed(2) : 0,
      avgPrice: prices.length ? +(prices.reduce((a: number, b: number) => a + b, 0) / prices.length).toFixed(2) : 0,
      avgCupPrice: cupPrices.length ? +(cupPrices.reduce((a: number, b: number) => a + b, 0) / cupPrices.length).toFixed(2) : 0,
      topRoasters,
      topCountries,
      topProcesses,
      ratingBuckets,
      topRated,
      recentBags,
      ratingsOverTime,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
