import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/security/rate-limit";
import { suggestAddresses } from "@/lib/geocoding/mapbox";

// Client-facing wrapper around suggestAddresses() — used by
// AddressAutocomplete for the "adresse" field in the event/partner listing
// wizards. Distinct from /api/geocode: that route resolves one final
// city/address to a single pin (used by LocationPickerMap), this one
// returns a typeahead list of street-address candidates as the user types.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!rateLimit(`suggest:${user.id}`, 120, 60_000))
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const { query, city, language } = await request.json().catch(() => ({ query: "" }));

  if (typeof query !== "string" || !query.trim()) {
    return NextResponse.json({ suggestions: [] });
  }

  const suggestions = await suggestAddresses(query, {
    city: typeof city === "string" ? city : undefined,
    language:
      language === "en" ? "en" : language === "fr" ? "fr" : language === "es" ? "es" : undefined,
  });
  return NextResponse.json({ suggestions });
}
