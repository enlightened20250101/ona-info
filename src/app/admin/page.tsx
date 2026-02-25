"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type TokyoMotionAdminItem = {
  id: string;
  title: string;
  url: string;
  thumb_url: string | null;
  duration: string | null;
  tags: string[];
  summary: string | null;
  published_at: string | null;
  fetched_at: string;
  approval_status: string | null;
};

type ApprovalStatus = "pending" | "approved" | "rejected";

const STATUS_LABEL: Record<ApprovalStatus, string> = {
  pending: "未選択",
  approved: "公開OK",
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
  const [statusFilter, setStatusFilter] = useState<ApprovalStatus | "all">("pending");

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
      const query = statusFilter === "all" ? "" : `?status=${statusFilter}`;
      const res = await fetch(`/api/admin/tokyomotion${query}`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data = (await res.json()) as { items: TokyoMotionAdminItem[] };
      setItems(data.items);
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
      const res = await fetch("/api/admin/tokyomotion", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, approval_status: status }),
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
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
  }, [sessionToken, statusFilter]);

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
    <div className="mx-auto max-w-6xl p-6">
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <div className="rounded border border-border bg-background px-6 py-3 text-sm">
            処理中...
          </div>
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">TokyoMotion 管理</h1>
          <p className="text-sm text-muted-foreground">
            未選択の動画を確認し、公開OK / 非公開を設定します。
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="rounded border border-border bg-background px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ApprovalStatus | "all")}
          >
            <option value="pending">未選択</option>
            <option value="approved">公開OK</option>
            <option value="rejected">非公開</option>
            <option value="all">すべて</option>
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

      <div className="mt-6 overflow-x-auto rounded border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="p-3">サムネ</th>
              <th className="p-3">タイトル</th>
              <th className="p-3">タグ</th>
              <th className="p-3">公開日</th>
              <th className="p-3">状態</th>
              <th className="p-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  読み込み中...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
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
                  </td>
                  <td className="p-3">{Array.isArray(item.tags) ? item.tags.join(" / ") : ""}</td>
                  <td className="p-3">
                    {item.published_at ? new Date(item.published_at).toLocaleString("ja-JP") : "-"}
                  </td>
                  <td className="p-3">
                    {STATUS_LABEL[(item.approval_status as ApprovalStatus) || "pending"]}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => updateStatus(item.id, "approved")}
                        className="rounded bg-emerald-600 px-3 py-1 text-white transition hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-60"
                        disabled={loading}
                      >
                        公開OK
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
    </div>
  );
}
