import { Article } from "@/lib/schema";

function cleanSummary(value: string) {
  return value.replace(/&nbsp;|&#160;/gi, " ").replace(/\s+/g, " ").trim();
}

function extractDuration(text: string) {
  const match = text.match(/再生時間[:：]\s*([0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?)/);
  return match?.[1] ?? "";
}

function extractTags(text: string) {
  const match = text.match(/タグ[:：]\s*([^\n]+)/);
  if (!match) return [];
  return match[1]
    .split("/")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function hasJapanese(text: string) {
  return /[ぁ-んァ-ヶ一-龠]/.test(text);
}

function isThinTitle(title: string) {
  const trimmed = title.trim();
  if (!trimmed) return true;
  if (trimmed.length <= 3) return true;
  if (/^(AV|JAV)$/i.test(trimmed)) return true;
  if (/^-?short-/i.test(trimmed)) return true;
  if (/^[A-Z]{2,}\d{2,}/.test(trimmed)) return true;
  if (!hasJapanese(trimmed) && trimmed.length <= 14) return true;
  return false;
}

function isNoiseTag(tag: string) {
  const trimmed = tag.trim();
  if (!trimmed) return true;
  if (/^(AV|JAV)$/i.test(trimmed)) return true;
  if (/^[A-Z0-9_-]{2,}$/.test(trimmed) && !/[ぁ-んァ-ヶ一-龠]/.test(trimmed)) {
    return true;
  }
  if (trimmed.length === 1) return true;
  return false;
}

export function stripTagPrefix(tag: string) {
  return tag.replace(/^(genre|maker):/i, "").trim();
}

function shorten(text: string, max = 70) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

const ROLE_KEYWORDS = [
  "お姉さん",
  "巨乳",
  "美乳",
  "美尻",
  "スレンダー",
  "グラマー",
  "人妻",
  "熟女",
  "JK",
  "女子校生",
  "学生",
  "OL",
  "ナース",
  "メイド",
  "アイドル",
  "素人",
];

const SITUATION_KEYWORDS = ["ナンパ", "初撮り", "ハメ撮り", "逆レイプ", "寝取られ", "痴漢"];

const ACTION_KEYWORDS = [
  "フェラ",
  "クンニ",
  "騎乗位",
  "立ちバック",
  "バック",
  "手コキ",
  "指マン",
  "乳首",
  "パイズリ",
  "顔射",
  "潮吹き",
  "中出し",
  "口内",
  "ごっくん",
  "アナル",
  "電マ",
];

function pickTag(tags: string[], keywords: string[]) {
  return tags.find((tag) => keywords.some((key) => tag.includes(key))) ?? "";
}

function buildActionPhrase(tag: string) {
  if (!tag) return "";
  const map: Record<string, string> = {
    フェラ: "濃厚フェラで悶絶",
    クンニ: "クンニで敏感に乱れる",
    騎乗位: "騎乗位で腰振り",
    立ちバック: "立ちバックで激しく貫かれ",
    バック: "バックで激しく貫かれ",
    手コキ: "手コキで責めまくり",
    指マン: "指マンでとろける",
    乳首: "乳首責めで感じまくり",
    パイズリ: "パイズリで奉仕",
    顔射: "顔射でフィニッシュ",
    潮吹き: "連続潮吹きで絶頂",
    中出し: "中出しでイキまくり",
    口内: "口内で濃厚ごっくん",
    ごっくん: "ごっくんで満たされる",
    アナル: "アナルで悶絶",
    電マ: "電マでビクビク",
  };
  return map[tag] || `${tag}で悶絶`;
}

function buildTitleFromTags(tags: string[], actress: string) {
  const role = pickTag(tags, ROLE_KEYWORDS);
  const situation = pickTag(tags, SITUATION_KEYWORDS);
  const action1 = pickTag(tags, ACTION_KEYWORDS);
  const action2 = tags.find(
    (tag) =>
      tag !== action1 &&
      ACTION_KEYWORDS.some((key) => tag.includes(key))
  );

  const headline = role || actress || situation || action1 || tags[0] || "";
  const actionPhrase1 = buildActionPhrase(action1);
  const actionPhrase2 = buildActionPhrase(action2 || "");

  const parts: string[] = [];
  if (headline) {
    parts.push(`【${headline}】`);
  }
  const subject = actress ? `${actress}が` : role ? `${role}が` : "";
  if (subject) {
    parts.push(subject);
  }
  if (situation) {
    parts.push(`${situation}で`);
  }
  if (actionPhrase1) {
    parts.push(`${actionPhrase1}！`);
  }
  if (actionPhrase2) {
    parts.push(`さらに${actionPhrase2}！`);
  }
  if (!actionPhrase1 && !actionPhrase2) {
    parts.push("淫らに乱れる！");
  }

  const composed = parts.join("").replace(/\s+/g, " ").trim();
  return composed;
}

export function getTokyoMotionTags(
  item: Pick<Article, "summary" | "meta_genres">
) {
  const summary = cleanSummary(item.summary || "");
  const tags =
    (item.meta_genres && item.meta_genres.filter(Boolean))?.length
      ? (item.meta_genres || [])
      : extractTags(summary);
  return Array.from(
    new Set(
      tags.map((tag) => stripTagPrefix(tag).trim()).filter(Boolean)
    )
  );
}

export function buildTokyoMotionTitle(
  item: Pick<Article, "title" | "summary" | "meta_genres" | "related_actresses">
) {
  const title = cleanSummary(item.title);
  const actress = item.related_actresses?.[0] ?? "";
  const hasActress = actress && !title.includes(actress);
  if (title.startsWith("【") && title.includes("】")) {
    return hasActress ? `【${actress}】${title}` : title;
  }
  if (!isThinTitle(title) && (hasJapanese(title) || title.length >= 18)) {
    return hasActress ? `【${actress}】${title}` : title;
  }

  const tags = getTokyoMotionTags(item).filter((tag) => !isNoiseTag(tag));
  const composed = buildTitleFromTags(tags, actress);
  if (composed) return composed;
  if (hasActress) return `【${actress}】${title}`;
  return title;
}

export function buildTokyoMotionDescription(
  item: Pick<Article, "title" | "summary" | "meta_genres">
) {
  const summary = cleanSummary(item.summary || "");
  const duration = extractDuration(summary);
  const safeTags = getTokyoMotionTags(item).slice(0, 3);
  const parts: string[] = [];

  if (safeTags.length > 0) {
    parts.push(`タグ: ${safeTags.join(" / ")}`);
  }
  if (duration) {
    parts.push(`再生時間: ${duration}`);
  }

  if (parts.length === 0) {
    return shorten(summary, 60);
  }
  return parts.join(" | ");
}
