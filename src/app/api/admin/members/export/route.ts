import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listMembers, type RegisteredWithin } from "@/lib/admin/members-queries";
import type { ModerationStatus } from "@/lib/admin/types";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (request.cookies.get("admin_gate")?.value !== "granted")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { searchParams } = request.nextUrl;
  const members = await listMembers(
    supabase,
    {
      search: searchParams.get("search") ?? undefined,
      city: searchParams.get("city") ?? undefined,
      registeredWithin: (searchParams.get("registeredWithin") as RegisteredWithin) ?? "all",
      status: (searchParams.get("status") as ModerationStatus | "all") ?? "all",
    },
    2000
  );

  const header = [
    "id",
    "prenom",
    "nom",
    "ville",
    "age",
    "statut",
    "date_inscription",
    "derniere_connexion",
  ];
  const rows = members.map((m) =>
    [
      m.id,
      m.full_name ?? "",
      m.last_name ?? "",
      m.city ?? "",
      m.age?.toString() ?? "",
      m.moderation_status,
      m.created_at,
      m.last_seen_at ?? "",
    ]
      .map((v) => csvEscape(String(v)))
      .join(",")
  );
  const csv = [header.join(","), ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="friendszy-membres-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
