import { NextResponse, type NextRequest } from "next/server";
import { suggestAddresses } from "@/lib/geocoding/mapbox";

// Client-facing wrapper around suggestAddresses() — used by
// AddressAutocomplete for the "adresse" field in the event/partner listing
// wizards. Distinct from /api/geocode: that route resolves one final
// city/address to a single pin (used by LocationPickerMap), this one
// returns a typeahead list of street-address candidates as the user types.
export async function POST(request: NextRequest) {
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
