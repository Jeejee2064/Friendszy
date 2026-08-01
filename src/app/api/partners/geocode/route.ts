import { NextResponse, type NextRequest } from "next/server";

type GeocodeResult = { latitude: number | null; longitude: number | null };

const NULL_RESULT: GeocodeResult = { latitude: null, longitude: null };

export async function POST(request: NextRequest) {
  const { city, address } = await request.json().catch(() => ({ city: "" }));

  if (typeof city !== "string" || !city.trim()) {
    return NextResponse.json({ error: "city is required" }, { status: 400 });
  }

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return NextResponse.json(NULL_RESULT);

  const query = [typeof address === "string" ? address.trim() : "", city.trim(), "Québec, Canada"]
    .filter(Boolean)
    .join(", ");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${encodeURIComponent(token)}&country=ca&limit=1`;
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return NextResponse.json(NULL_RESULT);

    const body = await response.json();
    const coordinates = body?.features?.[0]?.center;
    if (!Array.isArray(coordinates) || coordinates.length !== 2) {
      return NextResponse.json(NULL_RESULT);
    }

    const [longitude, latitude] = coordinates;
    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return NextResponse.json(NULL_RESULT);
    }

    return NextResponse.json({ latitude, longitude } satisfies GeocodeResult);
  } catch (err) {
    console.error("Mapbox geocoding failed", err);
    return NextResponse.json(NULL_RESULT);
  } finally {
    clearTimeout(timeout);
  }
}
