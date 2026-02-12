import { Article } from "@/lib/schema";

const TAG_MAP: Record<string, string[]> = {
  newcomer: ["新人", "デビュー", "初登場", "初作品"],
  exclusive: ["独占", "独占配信", "限定", "独占販売"],
  highres: ["4K", "高画質", "HD", "FHD"],
  sale: ["セール", "キャンペーン", "期間限定", "割引", "特価"],
  ranking: ["ランキング", "人気", "上位", "注目"],
  actress: ["女優", "注目女優", "新人女優", "人気女優"],
  release: ["本日配信", "先行配信", "本日発売", "新作"],
  drama: ["ドラマ", "ストーリー", "恋愛", "シナリオ"],
  fetish: ["フェチ", "マニア", "こだわり"],
  cosplay: ["コスプレ", "制服", "コスチューム"],
  genre: ["ジャンル", "カテゴリ", "テーマ"],
  compilation: ["総集編", "ベスト", "まとめ"],
  feature: ["特集", "ピックアップ", "特別企画"],
  event: ["イベント", "フェア", "キャンペーン"],
};

const TAG_SUMMARIES: Record<string, string> = {
  newcomer: "新人・デビュー作の動きが活発なタグです。",
  exclusive: "独占配信・限定販売に関連する話題をまとめています。",
  highres: "高画質・4K関連の注目作が集まるタグです。",
  sale: "セールや期間限定のキャンペーン情報に関するタグです。",
  ranking: "ランキング上位や話題作の動きを追跡しています。",
  actress: "注目女優や話題の出演情報をまとめるタグです。",
  release: "本日配信や新作リリースに関するタグです。",
  drama: "ドラマ性の高い作品やストーリー重視の作品が集まります。",
  fetish: "フェチ志向の作品やテーマ性の強い作品を集めています。",
  cosplay: "コスプレや制服系の作品にフォーカスしたタグです。",
  genre: "ジャンル別の動向をまとめるタグです。",
  compilation: "総集編やベスト盤などまとめ作品が中心です。",
  feature: "特集記事やピックアップ企画の動向をまとめています。",
  event: "イベントやフェア、短期企画に関するタグです。",
};

export function extractTags(text: string) {
  const found = new Set<string>();
  Object.entries(TAG_MAP).forEach(([tag, keywords]) => {
    if (keywords.some((keyword) => text.includes(keyword))) {
      found.add(tag);
    }
  });
  return Array.from(found);
}

export function extractMetaTagsFromBody(body: string) {
  const tags: string[] = [];
  const lines = body.split("\n");
  lines.forEach((line) => {
    if (line.startsWith("メーカー:")) {
      const maker = line.replace("メーカー:", "").trim();
      if (maker) tags.push(`maker:${maker}`);
    }
    if (line.startsWith("ジャンル:")) {
      const genres = line.replace("ジャンル:", "").split("/").map((g) => g.trim());
      genres.filter(Boolean).forEach((genre) => tags.push(`genre:${genre}`));
    }
  });
  return tags;
}

export function normalizeTag(tag: string) {
  if (!tag) return "";
  let value = tag.trim();
  try {
    value = decodeURIComponent(value);
  } catch {
    // ignore malformed escape sequences
  }
  if (value.startsWith("#")) {
    value = value.slice(1);
  }
  return value.trim();
}

export function tagLabel(tag: string) {
  const normalized = normalizeTag(tag);
  if (!normalized) return "タグ";
  if (normalized.startsWith("maker:")) {
    return normalized.replace("maker:", "");
  }
  if (normalized.startsWith("genre:")) {
    return normalized.replace("genre:", "");
  }
  const labels: Record<string, string> = {
    newcomer: "新人",
    exclusive: "独占",
    highres: "高画質",
    sale: "セール",
    ranking: "ランキング",
    actress: "女優",
    release: "配信",
    drama: "ドラマ",
    fetish: "フェチ",
    cosplay: "コスプレ",
    genre: "ジャンル",
    compilation: "総集編",
    feature: "特集",
    event: "イベント",
  };
  return labels[normalized] ?? normalized;
}

export function tagSummary(tag: string) {
  const normalized = normalizeTag(tag);
  if (!normalized) return "関連作品やトピックをまとめたタグです。";
  return TAG_SUMMARIES[normalized] ?? "関連作品やトピックをまとめたタグです。";
}

export function tagKeywords(tag: string) {
  const normalized = normalizeTag(tag);
  if (!normalized) return [];
  if (normalized.startsWith("maker:")) return [normalized.replace("maker:", "")];
  if (normalized.startsWith("genre:")) return [normalized.replace("genre:", "")];
  return TAG_MAP[normalized] ?? [];
}

export function pickRelatedWorks(works: Article[], tags: string[], limit = 6) {
  if (tags.length === 0) return works.slice(0, limit).map((work) => work.slug);

  const keywords = tags.flatMap((tag) => TAG_MAP[tag] ?? []);
  const filtered = works.filter((work) =>
    keywords.some((keyword) => work.title.includes(keyword))
  );

  const result = filtered.length > 0 ? filtered : works;
  return result.slice(0, limit).map((work) => work.slug);
}
