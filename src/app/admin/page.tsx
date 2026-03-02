"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { buildTokyoMotionTitle } from "@/lib/eroterest";

type TokyoMotionAdminItem = {
  id: string;
  title: string;
  url: string;
  thumb_url: string | null;
  duration: string | null;
  tags: string[];
  curated_tags: string[] | null;
  curated_actresses: string[] | null;
  fanza_code: string | null;
  curation_ready: boolean | null;
  summary: string | null;
  published_at: string | null;
  fetched_at: string;
  approval_status: string | null;
};

type ApprovalStatus = "pending" | "approved" | "rejected";
type SortKey = "published_at" | "fetched_at" | "title";
type SortDir = "desc" | "asc";

const STATUS_LABEL: Record<ApprovalStatus, string> = {
  pending: "未選択",
  approved: "承認",
  rejected: "非公開",
};

export default function AdminPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const supabase = useMemo(() => {
    if (!supabaseUrl || !supabaseAnonKey) return null;
    if (!/^https?:\/\//i.test(supabaseUrl)) return null;
    return createClient(supabaseUrl, supabaseAnonKey);
  }, [supabaseUrl, supabaseAnonKey]);

  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<TokyoMotionAdminItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ApprovalStatus | "published" | "all">("pending");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);
  const [total, setTotal] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("published_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [toast, setToast] = useState<{ message: string; status: ApprovalStatus } | null>(null);
  const [tagOptions, setTagOptions] = useState<string[]>([]);
  const [actressOptions, setActressOptions] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<
    Record<
      string,
      {
        tags: string[];
        actresses: string[];
        tagInput: string;
        actressInput: string;
      }
    >
  >({});

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSessionToken(data.session?.access_token ?? null);
    });
  }, [supabase]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!supabase) {
      setError("Supabase設定が見つかりません。");
      return;
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.session) {
      setError(error?.message ?? "ログインに失敗しました。");
      return;
    }
    setSessionToken(data.session.access_token);
  }

  async function handleLogout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSessionToken(null);
    setItems([]);
  }

  async function fetchItems() {
    if (!sessionToken) return;
    setLoading(true);
    setError(null);
    try {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
      params.set("page", String(page));
      params.set("limit", String(perPage));
      params.set("order", sortKey);
      params.set("dir", sortDir);
      const query = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`/api/admin/tokyomotion${query}`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data = (await res.json()) as {
        items: TokyoMotionAdminItem[];
        total?: number | null;
        page?: number;
        perPage?: number;
      };
      setItems(data.items);
      setTotal(data.total ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: string, status: ApprovalStatus) {
    if (!sessionToken) return;
    setError(null);
    setLoading(true);
    try {
      const draft = drafts[id];
      const res = await fetch("/api/admin/tokyomotion", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id,
          approval_status: status,
          curated_tags: draft?.tags?.map((tag) => tag.replace(/^(genre|maker):/i, "").trim()),
          curated_actresses: draft?.actresses,
        }),
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const payload = (await res.json().catch(() => null)) as
        | { curated_tags?: string[] | null; curated_actresses?: string[] | null; fanza_code?: string | null; curation_ready?: boolean | null }
        | null;
      setItems((prev) => {
        const next = prev.map((item) =>
          item.id === id ? { ...item, approval_status: status } : item
        );
        if (statusFilter === "all") {
          return next;
        }
        if (statusFilter === "pending" && status !== "pending") {
          return next.filter((item) => item.id !== id);
        }
        if (statusFilter === "approved" && status !== "approved") {
          return next.filter((item) => item.id !== id);
        }
        if (statusFilter === "rejected" && status !== "rejected") {
          return next.filter((item) => item.id !== id);
        }
        if (statusFilter === "published") {
          return next.filter((item) => item.id !== id);
        }
        return next;
      });
      if (payload?.curated_tags || payload?.curated_actresses || payload?.fanza_code) {
        setItems((prev) =>
          prev.map((item) =>
            item.id === id
              ? {
                  ...item,
                  curated_tags: (payload.curated_tags ?? item.curated_tags) as string[] | null,
                  curated_actresses: (payload.curated_actresses ?? item.curated_actresses) as string[] | null,
                  fanza_code: payload.fanza_code ?? item.fanza_code,
                  curation_ready: payload.curation_ready ?? item.curation_ready,
                }
              : item
          )
        );
      }
      setToast({ message: `${STATUS_LABEL[status]}に変更しました。`, status });
      window.setTimeout(() => setToast(null), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新に失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  function normalizeList(values: string[]) {
    return Array.from(
      new Set(values.map((value) => value.replace(/^(genre|maker):/i, "").trim()).filter(Boolean))
    );
  }

  function updateDraft(id: string, patch: Partial<{ tags: string[]; actresses: string[]; tagInput: string; actressInput: string }>) {
    setDrafts((prev) => {
      const next = { ...prev };
      const current = next[id] ?? { tags: [], actresses: [], tagInput: "", actressInput: "" };
      next[id] = { ...current, ...patch };
      return next;
    });
  }

  function toggleTag(id: string, tag: string) {
    const draft = drafts[id];
    if (!draft) return;
    const normalized = tag.replace(/^(genre|maker):/i, "").trim();
    if (!normalized) return;
    if (draft.tags.includes(normalized)) {
      updateDraft(id, { tags: draft.tags.filter((item) => item !== normalized) });
    } else {
      updateDraft(id, { tags: normalizeList([...draft.tags, normalized]) });
    }
  }

  function buildPreviewTitle(item: TokyoMotionAdminItem) {
    const draft = drafts[item.id];
    return buildTokyoMotionTitle({
      title: item.title,
      summary: item.summary ?? "",
      meta_genres: draft?.tags ?? [],
      related_actresses: draft?.actresses ?? [],
      slug: `tm-${item.id}`,
    });
  }

  function addTag(id: string) {
    const draft = drafts[id];
    if (!draft?.tagInput) return;
    const nextTags = normalizeList([...draft.tags, draft.tagInput]);
    updateDraft(id, { tags: nextTags, tagInput: "" });
  }

  function removeTag(id: string, tag: string) {
    const draft = drafts[id];
    if (!draft) return;
    updateDraft(id, { tags: draft.tags.filter((item) => item !== tag) });
  }

  function addActress(id: string) {
    const draft = drafts[id];
    if (!draft?.actressInput) return;
    const nextActresses = normalizeList([...draft.actresses, draft.actressInput]);
    updateDraft(id, { actresses: nextActresses, actressInput: "" });
  }

  function removeActress(id: string, name: string) {
    const draft = drafts[id];
    if (!draft) return;
    updateDraft(id, { actresses: draft.actresses.filter((item) => item !== name) });
  }

  async function saveCuration(id: string) {
    if (!sessionToken) return;
    const draft = drafts[id];
    if (!draft) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/tokyomotion", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id,
          curated_tags: draft.tags.map((tag) => tag.replace(/^(genre|maker):/i, "").trim()),
          curated_actresses: draft.actresses,
        }),
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const payload = (await res.json().catch(() => null)) as
        | { curated_tags?: string[] | null; curated_actresses?: string[] | null; fanza_code?: string | null; curation_ready?: boolean | null }
        | null;
      if (payload?.curated_tags || payload?.curated_actresses || payload?.fanza_code) {
        setItems((prev) =>
          prev.map((item) =>
            item.id === id
              ? {
                  ...item,
                  curated_tags: (payload.curated_tags ?? item.curated_tags) as string[] | null,
                  curated_actresses: (payload.curated_actresses ?? item.curated_actresses) as string[] | null,
                  fanza_code: payload.fanza_code ?? item.fanza_code,
                  curation_ready: payload.curation_ready ?? item.curation_ready,
                }
              : item
          )
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新に失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  async function resolveFanza(id: string) {
    if (!sessionToken) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/tokyomotion", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, resolve_fanza: true }),
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const payload = (await res.json()) as {
        curated_tags?: string[] | null;
        curated_actresses?: string[] | null;
        fanza_code?: string | null;
        curation_ready?: boolean | null;
      };
      const normalizedTags = (payload.curated_tags ?? []).map((tag) =>
        tag.replace(/^(genre|maker):/i, "").trim()
      );
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                curated_tags: (normalizedTags.length ? normalizedTags : item.curated_tags) as
                  | string[]
                  | null,
                curated_actresses: (payload.curated_actresses ?? item.curated_actresses) as string[] | null,
                fanza_code: payload.fanza_code ?? item.fanza_code,
                curation_ready: payload.curation_ready ?? item.curation_ready,
              }
            : item
        )
      );
      setDrafts((prev) => {
        const next = { ...prev };
        const current = next[id] ?? { tags: [], actresses: [], tagInput: "", actressInput: "" };
        next[id] = {
          ...current,
          tags: (normalizedTags.length ? normalizedTags : current.tags) as string[],
          actresses: (payload.curated_actresses ?? current.actresses) as string[],
        };
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "FANZA取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  async function setCurationReady(id: string, ready: boolean) {
    if (!sessionToken) return;
    setError(null);
    setLoading(true);
    try {
      const current = items.find((item) => item.id === id);
      const draft = drafts[id];
      const res = await fetch("/api/admin/tokyomotion", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id,
          curation_ready: ready,
          approval_status: current?.approval_status ?? undefined,
          curated_tags: draft?.tags,
          curated_actresses: draft?.actresses,
        }),
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const payload = (await res.json()) as { curation_ready?: boolean | null };
      setItems((prev) => {
        const next = prev.map((item) =>
          item.id === id
            ? {
                ...item,
                curation_ready: payload.curation_ready ?? item.curation_ready,
              }
            : item
        );
        if (statusFilter === "approved" && payload.curation_ready) {
          return next.filter((item) => item.id !== id);
        }
        if (statusFilter === "published" && payload.curation_ready === false) {
          return next.filter((item) => item.id !== id);
        }
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新に失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (sessionToken) {
      fetchItems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken, statusFilter, page, perPage, sortKey, sortDir]);

  useEffect(() => {
    if (!sessionToken) return;
    const fetchOptions = async () => {
      try {
        const [tagRes, actressRes] = await Promise.all([
          fetch("/api/admin/tokyomotion/tags?limit=200", {
            headers: { Authorization: `Bearer ${sessionToken}` },
          }),
          fetch("/api/admin/tokyomotion/actresses?limit=200", {
            headers: { Authorization: `Bearer ${sessionToken}` },
          }),
        ]);
        if (tagRes.ok) {
          const data = (await tagRes.json()) as { tags: string[] };
          const normalized = (data.tags ?? [])
            .map((tag) => tag.replace(/^(genre|maker):/i, "").trim())
            .filter(Boolean);
          setTagOptions(normalized);
        }
        if (actressRes.ok) {
          const data = (await actressRes.json()) as { actresses: string[] };
          setActressOptions(data.actresses ?? []);
        }
      } catch {
        // ignore
      }
    };
    fetchOptions();
  }, [sessionToken]);

  useEffect(() => {
    if (!items.length) return;
    setDrafts((prev) => {
      const next = { ...prev };
      items.forEach((item) => {
        if (!next[item.id]) {
          const normalizedTags = (item.curated_tags ?? (Array.isArray(item.tags) ? item.tags : []))
            .map((tag) => String(tag).replace(/^(genre|maker):/i, "").trim())
            .filter(Boolean);
          next[item.id] = {
            tags: normalizedTags,
            actresses: item.curated_actresses ?? [],
            tagInput: "",
            actressInput: "",
          };
        }
      });
      return next;
    });
  }, [items]);

  if (!supabaseUrl || !supabaseAnonKey || !/^https?:\/\//i.test(supabaseUrl)) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-semibold">管理画面</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY が未設定、またはURLが不正です。
        </p>
      </div>
    );
  }

  if (!sessionToken) {
    return (
      <div className="mx-auto max-w-md p-6">
        <h1 className="text-2xl font-semibold">管理者ログイン</h1>
        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium">メールアドレス</label>
            <input
              type="email"
              className="mt-1 w-full rounded border border-border bg-background px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium">パスワード</label>
            <input
              type="password"
              className="mt-1 w-full rounded border border-border bg-background px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button type="submit" className="w-full rounded bg-primary px-4 py-2 text-primary-foreground">
            ログイン
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-6">
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <div className="rounded border border-border bg-background px-6 py-3 text-sm">
            処理中...
          </div>
        </div>
      )}
      {toast && (
        <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2">
          <div
            className={`rounded px-4 py-2 text-sm text-white shadow ${
              toast.status === "approved"
                ? "bg-emerald-600"
                : toast.status === "rejected"
                  ? "bg-rose-600"
                  : "bg-black/80"
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">TokyoMotion 管理</h1>
          <p className="text-sm text-muted-foreground">
            未選択の動画を確認し、承認 / 非公開 / 公開を設定します。
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="rounded border border-border bg-background px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as ApprovalStatus | "published" | "all");
              setPage(1);
            }}
          >
            <option value="pending">未選択</option>
            <option value="approved">承認</option>
            <option value="published">公開</option>
            <option value="rejected">非公開</option>
            <option value="all">すべて</option>
          </select>
          <select
            className="rounded border border-border bg-background px-3 py-2 text-sm"
            value={sortKey}
            onChange={(e) => {
              setSortKey(e.target.value as SortKey);
              setPage(1);
            }}
          >
            <option value="published_at">公開日</option>
            <option value="fetched_at">取得日</option>
            <option value="title">タイトル</option>
          </select>
          <select
            className="rounded border border-border bg-background px-3 py-2 text-sm"
            value={sortDir}
            onChange={(e) => {
              setSortDir(e.target.value as SortDir);
              setPage(1);
            }}
          >
            <option value="desc">降順</option>
            <option value="asc">昇順</option>
          </select>
          <select
            className="rounded border border-border bg-background px-3 py-2 text-sm"
            value={perPage}
            onChange={(e) => {
              setPerPage(Number(e.target.value));
              setPage(1);
            }}
          >
            <option value={25}>25件</option>
            <option value={50}>50件</option>
            <option value={100}>100件</option>
          </select>
          <button
            onClick={() => fetchItems()}
            className="rounded border border-border px-3 py-2 text-sm transition hover:bg-muted"
            disabled={loading}
          >
            再読み込み
          </button>
          <button
            onClick={handleLogout}
            className="rounded bg-muted px-3 py-2 text-sm transition hover:bg-muted/80"
            disabled={loading}
          >
            ログアウト
          </button>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
      <datalist id="tag-options">
        {tagOptions.map((tag) => (
          <option key={tag} value={tag} />
        ))}
      </datalist>
      <datalist id="actress-options">
        {actressOptions.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      <div className="mt-6 overflow-x-auto rounded border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="p-3">サムネ</th>
              <th className="p-3">タイトル</th>
              <th className="p-3">タグ</th>
              <th className="p-3">女優</th>
              <th className="p-3">公開日</th>
              <th className="p-3">状態</th>
              <th className="p-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  読み込み中...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  該当データがありません。
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-t border-border">
                  <td className="p-3">
                    {item.thumb_url ? (
                      <img
                        src={item.thumb_url}
                        alt={item.title}
                        className="h-16 w-24 rounded object-cover"
                      />
                    ) : (
                      <div className="h-16 w-24 rounded bg-muted" />
                    )}
                  </td>
                  <td className="p-3">
                    <div className="font-medium">{item.title}</div>
                    <a href={item.url} target="_blank" rel="noreferrer" className="text-xs text-blue-600">
                      TokyoMotionで開く
                    </a>
                    {item.fanza_code && (
                      <div className="mt-1 text-xs text-muted-foreground">FANZAコード: {item.fanza_code}</div>
                    )}
                    <div className="mt-2 text-xs text-muted-foreground">
                      表示タイトル: {buildPreviewTitle(item)}
                    </div>
                  </td>
                  <td className="p-3 align-top">
                    <div className="flex flex-wrap gap-1">
                      {(drafts[item.id]?.tags ?? []).map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => removeTag(item.id, tag)}
                          className="rounded bg-muted px-2 py-0.5 text-xs hover:bg-muted/80"
                          title="クリックで削除"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        list="tag-options"
                        className="w-40 rounded border border-border bg-background px-2 py-1 text-xs"
                        placeholder="タグを追加"
                        value={drafts[item.id]?.tagInput ?? ""}
                        onChange={(e) => updateDraft(item.id, { tagInput: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addTag(item.id);
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => addTag(item.id)}
                        className="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
                      >
                        追加
                      </button>
                    </div>
                    {tagOptions.length > 0 && (
                      <div className="mt-2 max-h-28 overflow-y-auto rounded border border-border p-2 text-xs">
                        <div className="flex flex-wrap gap-2">
                          {tagOptions.slice(0, 80).map((tag) => {
                            const checked = drafts[item.id]?.tags?.includes(tag);
                            return (
                              <label key={tag} className="flex items-center gap-1">
                                <input
                                  type="checkbox"
                                  checked={!!checked}
                                  onChange={() => toggleTag(item.id, tag)}
                                />
                                <span>{tag}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="p-3 align-top">
                    <div className="flex flex-wrap gap-1">
                      {(drafts[item.id]?.actresses ?? []).map((name) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => removeActress(item.id, name)}
                          className="rounded bg-muted px-2 py-0.5 text-xs hover:bg-muted/80"
                          title="クリックで削除"
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        list="actress-options"
                        className="w-72 rounded border border-border bg-background px-2 py-1 text-xs"
                        placeholder="女優名を追加"
                        value={drafts[item.id]?.actressInput ?? ""}
                        onChange={(e) => updateDraft(item.id, { actressInput: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addActress(item.id);
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => addActress(item.id)}
                        className="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
                      >
                        追加
                      </button>
                    </div>
                  </td>
                  <td className="p-3">
                    {item.published_at ? new Date(item.published_at).toLocaleString("ja-JP") : "-"}
                  </td>
                  <td className="p-3">
                    {item.curation_ready && item.approval_status === "approved"
                      ? "公開"
                      : STATUS_LABEL[(item.approval_status as ApprovalStatus) || "pending"]}
                    {!item.curation_ready && (
                      <div className="mt-1 text-xs text-amber-600">公開が未設定</div>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => saveCuration(item.id)}
                        className="rounded border border-border px-3 py-1 text-xs transition hover:bg-muted active:scale-[0.98] disabled:opacity-60"
                        disabled={loading}
                      >
                        タグ/女優を保存
                      </button>
                      <button
                        onClick={() => resolveFanza(item.id)}
                        className="rounded border border-border px-3 py-1 text-xs transition hover:bg-muted active:scale-[0.98] disabled:opacity-60"
                        disabled={loading}
                      >
                        FANZA補完
                      </button>
                      <button
                        onClick={() => setCurationReady(item.id, !item.curation_ready)}
                        className="rounded border border-border px-3 py-1 text-xs transition hover:bg-muted active:scale-[0.98] disabled:opacity-60"
                        disabled={loading || item.approval_status !== "approved"}
                      >
                        {item.curation_ready ? "公開を解除" : "公開"}
                      </button>
                      <button
                        onClick={() => updateStatus(item.id, "approved")}
                        className="rounded bg-emerald-600 px-3 py-1 text-white transition hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-60"
                        disabled={loading}
                      >
                        承認
                      </button>
                      <button
                        onClick={() => updateStatus(item.id, "rejected")}
                        className="rounded bg-rose-600 px-3 py-1 text-white transition hover:bg-rose-500 active:scale-[0.98] disabled:opacity-60"
                        disabled={loading}
                      >
                        非公開
                      </button>
                      <button
                        onClick={() => updateStatus(item.id, "pending")}
                        className="rounded border border-border px-3 py-1 transition hover:bg-muted active:scale-[0.98] disabled:opacity-60"
                        disabled={loading}
                      >
                        未選択
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="text-muted-foreground">
          {total !== null ? `全${total}件` : "件数取得中"}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded border border-border px-3 py-1 disabled:opacity-50"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={loading || page <= 1}
          >
            前へ
          </button>
          <span>ページ {page}</span>
          <button
            className="rounded border border-border px-3 py-1 disabled:opacity-50"
            onClick={() => setPage((p) => p + 1)}
            disabled={loading || (total !== null && page * perPage >= total)}
          >
            次へ
          </button>
        </div>
      </div>
    </div>
  );
}
