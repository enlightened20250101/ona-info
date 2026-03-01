import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireEnv, getEnv } from "@/lib/env";

function getAdminEmails() {
  const raw = getEnv("ADMIN_EMAILS", "");
  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

async function requireAdmin(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const supabaseUrl = requireEnv("SUPABASE_URL");
  const supabaseAnonKey = requireEnv("SUPABASE_ANON_KEY");
  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const adminEmails = getAdminEmails();
  if (adminEmails.length === 0) {
    return { error: NextResponse.json({ error: "Admin access not configured" }, { status: 403 }) };
  }
  if (!adminEmails.includes(data.user.email?.toLowerCase() ?? "")) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { token };
}

function getServiceClient() {
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") ?? 100)));

  const client = getServiceClient();
  let query = client.from("tag_stats").select("tag").order("work_count", { ascending: false });
  if (q) {
    query = query.ilike("tag", `%${q}%`);
  }
  const { data, error } = await query.limit(limit);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ tags: (data ?? []).map((row: { tag: string }) => row.tag) });
}
