import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireEnv, getEnv } from "@/lib/env";

type ApprovalStatus = "pending" | "approved" | "rejected";

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
  const status = searchParams.get("status")?.toLowerCase();
  const limit = Math.min(500, Math.max(1, Number(searchParams.get("limit") ?? 200)));

  const client = getServiceClient();
  let query = client
    .from("tokyomotion_videos")
    .select("id,title,url,thumb_url,duration,tags,summary,published_at,fetched_at,approval_status")
    .order("published_at", { ascending: false })
    .limit(limit);
  if (status === "approved" || status === "rejected" || status === "pending") {
    if (status === "pending") {
      query = query.or("approval_status.is.null,approval_status.eq.pending");
    } else {
      query = query.eq("approval_status", status);
    }
  }
  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const body = (await request.json().catch(() => null)) as {
    id?: string;
    approval_status?: ApprovalStatus;
  } | null;
  if (!body?.id || !body?.approval_status) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  if (!["approved", "rejected", "pending"].includes(body.approval_status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const client = getServiceClient();
  const { error } = await client
    .from("tokyomotion_videos")
    .update({ approval_status: body.approval_status })
    .eq("id", body.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
