import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getExportData } from "@/lib/account/queries";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const data = await getExportData(supabase, user.id);
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="friendszy-donnees-${date}.json"`,
    },
  });
}
