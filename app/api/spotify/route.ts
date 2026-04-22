import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ error: "Query too short" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=podcast&entity=podcastEpisode&limit=12`
    );

    if (!res.ok) throw new Error("iTunes search failed");
    const data = await res.json();

    const episodes = (data.results ?? []).map((ep: any) => ({
      spotify_id: String(ep.trackId),        // reusing the field name — stores iTunes trackId
      episode_title: ep.trackName ?? "Unknown Episode",
      show_name: ep.collectionName ?? "Unknown Show",
      artwork_url: ep.artworkUrl600 ?? ep.artworkUrl100 ?? null,
      release_date: ep.releaseDate ? ep.releaseDate.split("T")[0] : null,
      duration_ms: ep.trackTimeMillis ?? null,
      description: ep.description ?? ep.shortDescription ?? null,
      spotify_url: ep.trackViewUrl ?? null,  // links to Apple Podcasts instead
    }));

    return NextResponse.json({ episodes });
  } catch (err) {
    console.error("iTunes API error:", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
