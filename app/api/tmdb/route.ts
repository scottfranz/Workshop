import { NextResponse } from "next/server";

const TMDB_BASE = "https://api.themoviedb.org/3";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");
  const type = searchParams.get("type") ?? "movie";

  if (!query) return NextResponse.json({ results: [] });

  const TMDB_KEY = process.env.TMDB_API_KEY;
  if (!TMDB_KEY) return NextResponse.json({ error: "TMDB_API_KEY not set" }, { status: 500 });

  const res = await fetch(
    `${TMDB_BASE}/search/${type}?query=${encodeURIComponent(query)}&api_key=${TMDB_KEY}&language=en-US&page=1`,
    { next: { revalidate: 3600 } }
  );
  const data = await res.json();

  const results = (data.results ?? []).slice(0, 6).map((r: any) => ({
    tmdb_id: r.id,
    title: r.title ?? r.name,
    year: (r.release_date ?? r.first_air_date ?? "").slice(0, 4),
    poster: r.poster_path ? `https://image.tmdb.org/t/p/w185${r.poster_path}` : null,
    type,
  }));

  return NextResponse.json({ results });
}
