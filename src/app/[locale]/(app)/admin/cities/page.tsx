import { createClient } from "@/lib/supabase/server";
import { getCities } from "@/lib/profile/queries";
import { AdminCitiesClient } from "./admin-cities-client";

export default async function AdminCitiesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Auth + is_admin are already enforced by the parent AdminLayout — user is
  // guaranteed non-null here.
  const cities = await getCities(supabase);

  return <AdminCitiesClient adminId={user!.id} initialCities={cities} />;
}
