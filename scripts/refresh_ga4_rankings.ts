import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

type RankingWindow = "daily" | "weekly" | "monthly";

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type RankingRow = {
  period: RankingWindow;
  slug: string;
  views: number;
  updated_at?: string;
};

function getSupabaseKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";
}

function buildClient() {
  const url = process.env.SUPABASE_URL || "";
  const key = getSupabaseKey();
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function readServiceAccount(): { client_email: string; private_key: string } {
  const jsonEnv =
    process.env.GA4_SERVICE_ACCOUNT_JSON ||
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON ||
    process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
  if (jsonEnv && jsonEnv.trim().startsWith("{")) {
    return JSON.parse(jsonEnv);
  }
  const fileEnv =
    process.env.GA4_SERVICE_ACCOUNT_FILE || process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
  const filePath = fileEnv
    ? path.resolve(process.cwd(), fileEnv)
    : path.join(process.cwd(), "service_account.json");
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }
  throw new Error("Missing GA4 service account JSON or file");
}

function getPropertyId() {
  const raw = process.env.GA4_PROPERTY_ID || "";
  if (!raw) throw new Error("Missing GA4_PROPERTY_ID");
  return raw.replace(/^properties\//, "");
}

function extractSlug(pagePath: string) {
  const cleaned = pagePath.split("?")[0] || "";
  const match = cleaned.match(/^\/works\/([^/]+)\/?$/);
  return match ? match[1] : null;
}

async function fetchRanking(period: RankingWindow, limit: number) {
  const propertyId = getPropertyId();
  const serviceAccount = readServiceAccount();
  const auth = new google.auth.JWT({
    email: serviceAccount.client_email,
    key: serviceAccount.private_key,
    scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
  });

  const analyticsData = google.analyticsdata({ version: "v1beta", auth });

  const dateRange =
    period === "daily"
      ? { startDate: "1daysAgo", endDate: "today" }
      : period === "weekly"
        ? { startDate: "7daysAgo", endDate: "today" }
        : { startDate: "30daysAgo", endDate: "today" };

  const response = await analyticsData.properties.runReport({
    property: `properties/${propertyId}`,
    requestBody: {
      dateRanges: [dateRange],
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "screenPageViews" }],
      dimensionFilter: {
        filter: {
          fieldName: "pagePath",
          stringFilter: { matchType: "BEGINS_WITH", value: "/works/" },
        },
      },
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: String(limit),
    },
  });

  const rows = response.data.rows ?? [];
  const agg = new Map<string, number>();

  rows.forEach((row) => {
    const pagePath = row.dimensionValues?.[0]?.value ?? "";
    const slug = extractSlug(pagePath);
    if (!slug) return;
    const views = Number(row.metricValues?.[0]?.value ?? "0") || 0;
    const prev = agg.get(slug) ?? 0;
    agg.set(slug, prev + views);
  });

  const sorted = Array.from(agg.entries())
    .map(([slug, views]) => ({ slug, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, limit);

  return sorted;
}

async function run() {
  const client = buildClient();
  const limit = Number(process.env.GA4_RANKING_LIMIT ?? "50");
  const periods: RankingWindow[] = ["daily", "weekly", "monthly"];

  for (const period of periods) {
    const rows = await fetchRanking(period, limit);
    const now = new Date().toISOString();
    const payload: RankingRow[] = rows.map((row) => ({
      period,
      slug: row.slug,
      views: row.views,
      updated_at: now,
    }));

    if (payload.length === 0) continue;

    await client.from("work_rankings").delete().eq("period", period);
    const { error } = await client.from("work_rankings").insert(payload as unknown as Json);
    if (error) throw error;

    console.log(`[${period}] inserted: ${payload.length}`);
  }
}

run().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
