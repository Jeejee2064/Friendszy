import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/security/rate-limit";
import { geocodeAddress } from "@/lib/geocoding/mapbox";

// Client-facing wrapper around geocodeAddress() — used by every "pin
// picker" flow (partner listings, events, ...) via LocationPickerMap.
// Server components that just need coordinates (no client round-trip)
// should call geocodeAddress() directly instead of hitting this route.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!rateLimit(`geocode:${user.id}`, 30, 60_000))
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const { city, address } = await request.json().catch(() => ({ city: "" }));

  if (typeof city !== "string" || !city.trim()) {
    return NextResponse.json({ error: "city is required" }, { status: 400 });
  }

  const result = await geocodeAddress(city, typeof address === "string" ? address : undefined);
  return NextResponse.json(result ?? { latitude: null, longitude: null });
}
