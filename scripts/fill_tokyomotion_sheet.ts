import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { google } from "googleapis";
import { fetchTokyoMotionPage } from "@/fetchers/fetch_tokyomotion_page";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

function readServiceAccount() {
  const jsonEnv = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (jsonEnv) {
    return JSON.parse(jsonEnv);
  }

  const fileEnv = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
  const filePath = fileEnv
    ? path.resolve(process.cwd(), fileEnv)
    : path.join(process.cwd(), "service_account.json");
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }

  return null;
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase();
}

function colToA1(col: number, row: number) {
  let n = col + 1;
  let letters = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return `${letters}${row}`;
}

async function run() {
  const spreadsheetId = process.env.GSHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error("Missing GSHEETS_SPREADSHEET_ID");
  }
  const sheetName = process.env.GSHEETS_TOKYOMOTION_SHEET_NAME || "tokyomotion";
  const dryRun = process.argv.includes("--dry-run");

  const serviceAccount = readServiceAccount();
  if (!serviceAccount) {
    throw new Error("Missing Google service account credentials");
  }

  const auth = new google.auth.JWT({
    email: serviceAccount.client_email,
    key: serviceAccount.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A1:Z`,
  });

  const rows = response.data.values ?? [];
  if (rows.length <= 1) {
    console.log("No data rows found.");
    return;
  }

  const headers = rows[0].map((header) => normalizeHeader(String(header)));
  const headerIndex = (name: string, fallback: number) => {
    const idx = headers.indexOf(name);
    return idx >= 0 ? idx : fallback;
  };

  const urlCol = headerIndex("url", 0);
  const titleCol = headerIndex("title", 1);
  const thumbCol = headerIndex("thumb_url", 2);
  const durationCol = headerIndex("duration", 3);
  const tagsCol = headerIndex("tags", 4);
  const summaryCol = headerIndex("summary", 5);
  const publishedCol = headerIndex("published_at", 6);

  const updates: { range: string; values: string[][] }[] = [];
  let processed = 0;
  let filled = 0;
  let skipped = 0;

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i] ?? [];
    const url = String(row[urlCol] ?? "").trim();
    if (!url) {
      skipped += 1;
      continue;
    }

    const hasTitle = String(row[titleCol] ?? "").trim() !== "";
    const hasThumb = String(row[thumbCol] ?? "").trim() !== "";
    const hasDuration = String(row[durationCol] ?? "").trim() !== "";
    const hasTags = String(row[tagsCol] ?? "").trim() !== "";
    const hasSummary = String(row[summaryCol] ?? "").trim() !== "";
    const hasPublished = String(row[publishedCol] ?? "").trim() !== "";
    const isComplete = hasTitle && hasThumb && hasDuration && hasTags && hasSummary && hasPublished;
    if (isComplete) {
      skipped += 1;
      continue;
    }

    processed += 1;
    const scraped = await fetchTokyoMotionPage(url);
    if (!scraped) {
      skipped += 1;
      continue;
    }

    const rowIndex = i + 1;
    const setCell = (col: number, value: string, alreadySet: boolean) => {
      if (alreadySet) return;
      if (!value) return;
      updates.push({ range: `${sheetName}!${colToA1(col, rowIndex)}`, values: [[value]] });
    };

    setCell(titleCol, scraped.title, hasTitle);
    setCell(thumbCol, scraped.thumb_url ?? "", hasThumb);
    setCell(durationCol, scraped.duration ?? "", hasDuration);
    setCell(tagsCol, scraped.tags.join(" / "), hasTags);
    setCell(summaryCol, scraped.summary, hasSummary);
    setCell(publishedCol, scraped.published_at ?? "", hasPublished);

    filled += 1;
  }

  if (dryRun) {
    console.log(`Dry run: processed=${processed} filled=${filled} skipped=${skipped}`);
    console.log(`Pending updates: ${updates.length}`);
    return;
  }

  if (updates.length === 0) {
    console.log(`No updates needed. processed=${processed} filled=${filled} skipped=${skipped}`);
    return;
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: updates,
    },
  });

  console.log(`Updated ${updates.length} cells. processed=${processed} filled=${filled} skipped=${skipped}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
