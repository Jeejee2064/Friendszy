import { NextResponse, type NextRequest } from "next/server";
import { geocodeAddress } from "@/lib/geocoding/mapbox";

// Client-facing wrapper around geocodeAddress() — used by every "pin
// picker" flow (partner listings, events, ...) via LocationPickerMap.
// Server components that just need coordinates (no client round-trip)
// should call geocodeAddress() directly instead of hitting this route.
export async function POST(request: NextRequest) {
  const { city, address } = await request.json().catch(() => ({ city: "" }));

  if (typeof city !== "string" || !city.trim()) {
    return NextResponse.json({ error: "city is required" }, { status: 400 });
  }

  const result = await geocodeAddress(city, typeof address === "string" ? address : undefined);
  return NextResponse.json(result ?? { latitude: null, longitude: null });
}
