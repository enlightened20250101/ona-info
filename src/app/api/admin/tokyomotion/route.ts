import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireEnv, getEnv } from "@/lib/env";
import { fetchFanzaByCode } from "@/fetchers/fetch_fanza_by_code";

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

function sanitizeList(input: unknown) {
  if (Array.isArray(input)) {
    return input.map((value) => String(value).trim()).filter(Boolean);
  }
  if (typeof input === "string") {
    return input
      .split(/[,\n]/)
      .map((value) => value.trim())
      .filter(Boolean);
  }
  return [];
}

function extractFanzaCode(text: string) {
  if (!text) return "";
  const normalized = text.toUpperCase();
  const patterns = [
    /\b\d{2,4}[A-Z]{2,6}-\d{2,5}\b/g,
    /\b[A-Z]{2,6}-\d{2,5}\b/g,
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match && match[0]) {
      return match[0];
    }
  }
  return "";
}

async function resolveFanzaMeta(row: {
  id: string;
  title: string;
  summary: string | null;
  url: string;
}) {
  const fromText = `${row.title}\n${row.summary ?? ""}\n${row.url ?? ""}`;
  const code = extractFanzaCode(fromText);
  if (!code) {
    return { code: "", tags: [], actresses: [] };
  }
  const result = await fetchFanzaByCode(code);
  if (!result) {
    return { code, tags: [], actresses: [] };
  }
  return {
    code,
    tags: result.genre ?? [],
    actresses: result.actresses ?? [],
  };
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status")?.toLowerCase();
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") ?? 50)));
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const requestedOrder = searchParams.get("order") ?? "published_at";
  const order =
    requestedOrder === "published_at" ||
    requestedOrder === "fetched_at" ||
    requestedOrder === "title"
      ? requestedOrder
      : "published_at";
  const dir = searchParams.get("dir") === "asc" ? "asc" : "desc";
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const client = getServiceClient();
  let query = client
    .from("tokyomotion_videos")
    .select(
      "id,title,url,thumb_url,duration,tags,summary,published_at,fetched_at,approval_status,curated_tags,curated_actresses,fanza_code,curation_ready",
      {
        count: "exact",
      }
    )
    .order(order, { ascending: dir === "asc" })
    .range(from, to);
  if (status === "approved" || status === "rejected" || status === "pending" || status === "published") {
    if (status === "pending") {
      query = query.or("approval_status.is.null,approval_status.eq.pending");
    } else if (status === "approved") {
      query = query.eq("approval_status", "approved").or("curation_ready.is.null,curation_ready.eq.false");
    } else if (status === "published") {
      query = query
        .eq("approval_status", "approved")
        .eq("curation_ready", true)
        .not("curated_tags", "is", null)
        .not("curated_actresses", "is", null);
    } else {
      query = query.eq("approval_status", status);
    }
  }
  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    items: data ?? [],
    page,
    perPage: limit,
    total: count ?? null,
  });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const body = (await request.json().catch(() => null)) as {
    id?: string;
    approval_status?: ApprovalStatus;
    curated_tags?: string[] | string;
    curated_actresses?: string[] | string;
    resolve_fanza?: boolean;
    curation_ready?: boolean;
  } | null;
  if (!body?.id) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  if (body.approval_status && !["approved", "rejected", "pending"].includes(body.approval_status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const client = getServiceClient();
  const { data: current, error: fetchError } = await client
    .from("tokyomotion_videos")
    .select("id,title,summary,url,curated_tags,curated_actresses,tags,fanza_code,curation_ready")
    .eq("id", body.id)
    .maybeSingle();
  if (fetchError || !current) {
    return NextResponse.json({ error: fetchError?.message ?? "Not found" }, { status: 404 });
  }

  const updatePayload: Record<string, unknown> = {};
  const nextTags =
    body.curated_tags !== undefined
      ? sanitizeList(body.curated_tags)
      : sanitizeList(current.curated_tags);
  const nextActresses =
    body.curated_actresses !== undefined
      ? sanitizeList(body.curated_actresses)
      : sanitizeList(current.curated_actresses);

  if (body.curated_tags !== undefined) {
    updatePayload.curated_tags = nextTags.length > 0 ? nextTags : null;
  }
  if (body.curated_actresses !== undefined) {
    updatePayload.curated_actresses = nextActresses.length > 0 ? nextActresses : null;
  }

  if (body.resolve_fanza) {
    try {
      const resolved = await resolveFanzaMeta(current);
      if (!resolved.code) {
        return NextResponse.json({ error: "作品コードが見つかりませんでした。" }, { status: 400 });
      }
      if (resolved.tags.length === 0 || resolved.actresses.length === 0) {
        return NextResponse.json(
          { error: "FANZAからタグ/女優情報を取得できませんでした。" },
          { status: 400 }
        );
      }
      updatePayload.curated_tags = resolved.tags;
      updatePayload.curated_actresses = resolved.actresses;
      updatePayload.fanza_code = resolved.code;
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "FANZA取得に失敗しました。" },
        { status: 500 }
      );
    }
  }

  if (body.approval_status === "approved") {
    let tags = body.curated_tags !== undefined ? nextTags : sanitizeList(current.curated_tags);
    let actresses =
      body.curated_actresses !== undefined
        ? nextActresses
        : sanitizeList(current.curated_actresses);

    if (tags.length === 0 || actresses.length === 0) {
      try {
        const resolved = await resolveFanzaMeta(current);
        if (resolved.code && resolved.tags.length > 0 && resolved.actresses.length > 0) {
          tags = resolved.tags;
          actresses = resolved.actresses;
          updatePayload.curated_tags = resolved.tags;
          updatePayload.curated_actresses = resolved.actresses;
          updatePayload.fanza_code = resolved.code;
        }
      } catch {
        // ignore
      }
    }

    const nextReady = body.curation_ready ?? current.curation_ready;
    if (body.curation_ready !== false && !nextReady) {
      return NextResponse.json({ error: "公開には公開設定が必要です。" }, { status: 400 });
    }
  }

  if (body.curation_ready === true) {
    updatePayload.approval_status = "approved";
  }

  if (body.approval_status) {
    updatePayload.approval_status = body.approval_status;
  }

  if (body.curation_ready !== undefined) {
    updatePayload.curation_ready = body.curation_ready;
  }

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json({ ok: true });
  }

  const { error } = await client
    .from("tokyomotion_videos")
    .update(updatePayload)
    .eq("id", body.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    curated_tags: updatePayload.curated_tags ?? current.curated_tags ?? null,
    curated_actresses: updatePayload.curated_actresses ?? current.curated_actresses ?? null,
    fanza_code: updatePayload.fanza_code ?? current.fanza_code ?? null,
    curation_ready:
      updatePayload.curation_ready ?? current.curation_ready ?? null,
  });
}
