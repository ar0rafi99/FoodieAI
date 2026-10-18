"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { RESTAURANT_SLUG } from "../config/restaurant";
import AuthModal from "./AuthModal";

type Restaurant = { id: string; name: string; currency: string };
type OrderItem = { id: string; name: string; price: number; qty: number };
type Order = {
  id: string;
  customer_name: string;
  phone: string;
  address: string;
  notes: string | null;
  subtotal: number;
  delivery_fee: number;
  total: number;
  status: string;
  payment_method: string;
  created_at: string;
  order_items: OrderItem[];
};
type Category = { id: string; name: string };
type Item = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  emoji: string | null;
  image_url: string | null;
  category_id: string | null;
  is_available: boolean;
};
type Draft = {
  id?: string;
  name: string;
  description: string;
  price: string;
  emoji: string;
  image_url: string | null;
  category_id: string;
  is_available: boolean;
};

const EMPTY_DRAFT: Draft = {
  name: "",
  description: "",
  price: "",
  emoji: "🍽️",
  image_url: null,
  category_id: "",
  is_available: true,
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  preparing: "Preparing",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};
const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-400/15 text-amber-300 border-amber-400/30",
  preparing: "bg-sky-400/15 text-sky-300 border-sky-400/30",
  out_for_delivery: "bg-violet-400/15 text-violet-300 border-violet-400/30",
  delivered: "bg-emerald-400/15 text-emerald-300 border-emerald-400/30",
  cancelled: "bg-red-400/15 text-red-300 border-red-400/30",
};
const NEXT_STATUS: Record<string, string> = {
  pending: "preparing",
  preparing: "out_for_delivery",
  out_for_delivery: "delivered",
};
const NEXT_LABEL: Record<string, string> = {
  pending: "Accept & start preparing",
  preparing: "Send for delivery",
  out_for_delivery: "Mark delivered",
};

const inputClass =
  "w-full rounded-xl border border-white/10 bg-neutral-950 px-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none transition focus:border-amber-400/60";

function beep() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.value = 0.1;
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // sound is optional
  }
}

export default function AdminApp() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);

  const [tab, setTab] = useState<"dashboard" | "orders" | "menu">("dashboard");
  const [orders, setOrders] = useState<Order[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [orderFilter, setOrderFilter] = useState<"active" | "completed" | "all">("active");
  const [toast, setToast] = useState("");

  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [menuError, setMenuError] = useState("");
  const [newCategory, setNewCategory] = useState("");

  // ---------- Auth ----------
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setUser(session?.user ?? null)
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  // ---------- Access check ----------
  useEffect(() => {
    if (!user) {
      setAllowed(null);
      return;
    }
    (async () => {
      const { data: r } = await supabase
        .from("restaurants")
        .select("id, name, currency")
        .eq("slug", RESTAURANT_SLUG)
        .single();
      if (!r) return setAllowed(false);

      const { data: staff } = await supabase
        .from("restaurant_staff")
        .select("role")
        .eq("restaurant_id", r.id)
        .eq("user_id", user.id)
        .maybeSingle();

      setRestaurant(r);
      setAllowed(!!staff);
    })();
  }, [user]);

  // ---------- Data loaders ----------
  const loadOrders = useCallback(async (rid: string) => {
    const { data } = await supabase
      .from("orders")
      .select(
        "id, customer_name, phone, address, notes, subtotal, delivery_fee, total, status, payment_method, created_at, order_items(id, name, price, qty)"
      )
      .eq("restaurant_id", rid)
      .order("created_at", { ascending: false })
      .limit(100);
    setOrders(
      (data ?? []).map((o) => ({
        ...o,
        subtotal: Number(o.subtotal),
        delivery_fee: Number(o.delivery_fee),
        total: Number(o.total),
        order_items: (o.order_items ?? []).map((i: OrderItem) => ({
          ...i,
          price: Number(i.price),
        })),
      })) as Order[]
    );
  }, []);

  const loadMenu = useCallback(async (rid: string) => {
    const [cats, menu] = await Promise.all([
      supabase.from("categories").select("id, name").eq("restaurant_id", rid).order("sort_order"),
      supabase
        .from("menu_items")
        .select("id, name, description, price, emoji, image_url, category_id, is_available")
        .eq("restaurant_id", rid)
        .order("created_at"),
    ]);
    setCategories(cats.data ?? []);
    setItems((menu.data ?? []).map((i) => ({ ...i, price: Number(i.price) })));
  }, []);

  useEffect(() => {
    if (restaurant && allowed) {
      loadOrders(restaurant.id);
      loadMenu(restaurant.id);
    }
  }, [restaurant, allowed, loadOrders, loadMenu]);

  // ---------- Realtime new orders ----------
  useEffect(() => {
    if (!restaurant || !allowed) return;
    const rid = restaurant.id;
    const channel = supabase
      .channel("orders-" + rid)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${rid}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            beep();
            setToast("🔔 New order received!");
            setTimeout(() => setToast(""), 5000);
          }
          loadOrders(rid);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurant, allowed, loadOrders]);

  const money = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: restaurant?.currency ?? "USD",
    }).format(n);

  // ---------- Orders ----------
  async function setStatus(orderId: string, status: string) {
    await supabase.from("orders").update({ status }).eq("id", orderId);
    if (restaurant) loadOrders(restaurant.id);
  }

  // ---------- Menu ----------
  async function uploadImage(file: File) {
    if (!restaurant) return;
    if (file.size > 3 * 1024 * 1024) {
      setMenuError("Image must be under 3 MB.");
      return;
    }
    setUploading(true);
    setMenuError("");
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${restaurant.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("menu-images").upload(path, file);
    if (error) setMenuError(error.message);
    else {
      const { data } = supabase.storage.from("menu-images").getPublicUrl(path);
      setDraft((d) => (d ? { ...d, image_url: data.publicUrl } : d));
    }
    setUploading(false);
  }

  async function saveItem(e: React.FormEvent) {
    e.preventDefault();
    if (!draft || !restaurant) return;
    setSaving(true);
    setMenuError("");

    const payload = {
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      price: Number(draft.price),
      emoji: draft.emoji.trim() || null,
      image_url: draft.image_url,
      category_id: draft.category_id || null,
      is_available: draft.is_available,
    };

    const res = draft.id
      ? await supabase.from("menu_items").update(payload).eq("id", draft.id)
      : await supabase.from("menu_items").insert({ ...payload, restaurant_id: restaurant.id });

    setSaving(false);
    if (res.error) setMenuError(res.error.message);
    else {
      setDraft(null);
      loadMenu(restaurant.id);
    }
  }

  async function toggleAvailable(item: Item) {
    await supabase.from("menu_items").update({ is_available: !item.is_available }).eq("id", item.id);
    if (restaurant) loadMenu(restaurant.id);
  }

  async function deleteItem(item: Item) {
    if (!confirm(`Delete "${item.name}"?`)) return;
    await supabase.from("menu_items").delete().eq("id", item.id);
    if (restaurant) loadMenu(restaurant.id);
  }

  async function addCategory() {
    const name = newCategory.trim();
    if (!name || !restaurant) return;
    await supabase
      .from("categories")
      .insert({ restaurant_id: restaurant.id, name, sort_order: categories.length + 1 });
    setNewCategory("");
    loadMenu(restaurant.id);
  }

  // ---------- Gates ----------
  if (!authReady) return <p className="p-16 text-center text-neutral-500">Loading...</p>;

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-sm rounded-2xl border border-white/10 bg-neutral-900 p-8 text-center">
          <h1 className="font-[family-name:var(--font-display)] text-2xl text-amber-300">Admin Panel</h1>
          <p className="mb-6 mt-2 text-sm text-neutral-400">Sign in with your restaurant owner account.</p>
          <button
            onClick={() => setShowAuth(true)}
            className="w-full rounded-xl bg-amber-400 py-3 font-semibold text-black hover:bg-amber-300"
          >
            Sign in
          </button>
        </div>
        {showAuth && <AuthModal onClose={() => setShowAuth(false)} onSuccess={() => setShowAuth(false)} />}
      </div>
    );
  }

  if (allowed === null) return <p className="p-16 text-center text-neutral-500">Checking access...</p>;

  if (!allowed || !restaurant) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-sm rounded-2xl border border-red-400/30 bg-neutral-900 p-8 text-center">
          <div className="mb-2 text-4xl">🚫</div>
          <h1 className="text-xl text-red-300">No access</h1>
          <p className="my-3 text-sm text-neutral-400">
            {user.email} is not registered as staff for this restaurant.
          </p>
          <button
            onClick={() => supabase.auth.signOut()}
            className="rounded-full border border-white/15 px-5 py-2 text-sm hover:border-amber-400/50"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  // ---------- Dashboard numbers ----------
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todays = orders.filter((o) => new Date(o.created_at) >= startOfToday);
  const validToday = todays.filter((o) => o.status !== "cancelled");
  const todayRevenue = validToday.reduce((s, o) => s + o.total, 0);
  const pendingCount = orders.filter((o) => o.status === "pending").length;
  const avgOrder = validToday.length ? todayRevenue / validToday.length : 0;

  const sold: Record<string, number> = {};
  orders
    .filter((o) => o.status !== "cancelled")
    .forEach((o) => o.order_items.forEach((i) => (sold[i.name] = (sold[i.name] || 0) + i.qty)));
  const topItems = Object.entries(sold)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const visibleOrders = orders.filter((o) =>
    orderFilter === "all"
      ? true
      : orderFilter === "active"
      ? ["pending", "preparing", "out_for_delivery"].includes(o.status)
      : ["delivered", "cancelled"].includes(o.status)
  );

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-neutral-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <h1 className="font-[family-name:var(--font-display)] text-xl text-amber-300">
            ◆ {restaurant.name} <span className="text-sm text-neutral-500">· Admin</span>
          </h1>
          <nav className="flex gap-1 rounded-full border border-white/10 p-1">
            {(["dashboard", "orders", "menu"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`relative rounded-full px-4 py-1.5 text-sm capitalize transition ${
                  tab === t ? "bg-amber-400 font-semibold text-black" : "text-neutral-300 hover:text-white"
                }`}
              >
                {t}
                {t === "orders" && pendingCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-red-500 px-1.5 text-xs text-white">{pendingCount}</span>
                )}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <a href="/admin/tickets" className="text-sm text-neutral-300 hover:text-amber-300">Tickets</a>
            <a href="/" className="text-sm text-neutral-400 hover:text-white">View site ↗</a>
            <button
              onClick={() => supabase.auth.signOut()}
              className="rounded-full border border-white/15 px-4 py-1.5 text-sm text-neutral-300 hover:border-amber-400/50"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {toast && (
        <div className="fixed right-5 top-20 z-50 rounded-xl border border-amber-400/40 bg-neutral-900 px-5 py-3 text-sm text-amber-300 shadow-2xl">
          {toast}
        </div>
      )}

      <main className="mx-auto max-w-6xl px-5 py-8">
        {/* ---------- DASHBOARD ---------- */}
        {tab === "dashboard" && (
          <div className="space-y-8">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Orders today", value: String(todays.length) },
                { label: "Revenue today", value: money(todayRevenue) },
                { label: "Pending now", value: String(pendingCount) },
                { label: "Avg. order value", value: money(avgOrder) },
              ].map((s) => (
                <div key={s.label} className="rounded-2xl border border-white/10 bg-neutral-900/60 p-5">
                  <p className="text-xs uppercase tracking-widest text-neutral-500">{s.label}</p>
                  <p className="mt-2 font-[family-name:var(--font-display)] text-3xl text-amber-300">{s.value}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-6">
              <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl">Top sellers</h2>
              {topItems.length === 0 ? (
                <p className="text-sm text-neutral-500">No sales yet. Place a test order from the website.</p>
              ) : (
                <ul className="space-y-3">
                  {topItems.map(([name, qty], idx) => (
                    <li key={name}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span>{idx + 1}. {name}</span>
                        <span className="text-neutral-400">{qty} sold</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/5">
                        <div
                          className="h-1.5 rounded-full bg-amber-400"
                          style={{ width: `${(qty / topItems[0][1]) * 100}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-4 text-xs text-neutral-600">Based on the latest 100 orders.</p>
            </div>
          </div>
        )}

        {/* ---------- ORDERS ---------- */}
        {tab === "orders" && (
          <div>
            <div className="mb-6 flex gap-2">
              {(["active", "completed", "all"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setOrderFilter(f)}
                  className={`rounded-full border px-5 py-1.5 text-sm capitalize ${
                    orderFilter === f
                      ? "border-amber-400 bg-amber-400 font-semibold text-black"
                      : "border-white/10 text-neutral-300 hover:border-amber-400/50"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {visibleOrders.length === 0 && <p className="text-neutral-500">No orders here yet.</p>}

            <div className="grid gap-4 lg:grid-cols-2">
              {visibleOrders.map((o) => (
                <div key={o.id} className="rounded-2xl border border-white/10 bg-neutral-900/60 p-5">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm text-neutral-400">#{o.id.slice(0, 8)}</p>
                      <p className="text-xs text-neutral-600">{new Date(o.created_at).toLocaleString()}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs ${STATUS_COLOR[o.status] ?? ""}`}>
                      {STATUS_LABEL[o.status] ?? o.status}
                    </span>
                  </div>

                  <p className="font-medium">{o.customer_name}</p>
                  <p className="text-sm text-neutral-400">📞 {o.phone}</p>
                  <p className="mb-3 text-sm text-neutral-400">📍 {o.address}</p>
                  {o.notes && (
                    <p className="mb-3 rounded-lg bg-amber-400/10 px-3 py-2 text-sm text-amber-200">📝 {o.notes}</p>
                  )}

                  <ul className="mb-3 space-y-1 border-y border-white/10 py-3 text-sm">
                    {o.order_items.map((i) => (
                      <li key={i.id} className="flex justify-between text-neutral-300">
                        <span>{i.qty} × {i.name}</span>
                        <span>{money(i.price * i.qty)}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mb-4 flex justify-between font-semibold text-amber-300">
                    <span>Total (Cash on delivery)</span>
                    <span>{money(o.total)}</span>
                  </div>

                  {NEXT_STATUS[o.status] && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setStatus(o.id, NEXT_STATUS[o.status])}
                        className="flex-1 rounded-xl bg-amber-400 py-2.5 text-sm font-semibold text-black hover:bg-amber-300"
                      >
                        {NEXT_LABEL[o.status]}
                      </button>
                      <button
                        onClick={() => confirm("Cancel this order?") && setStatus(o.id, "cancelled")}
                        className="rounded-xl border border-red-400/40 px-4 text-sm text-red-300 hover:bg-red-400/10"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---------- MENU ---------- */}
        {tab === "menu" && (
          <div>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-[family-name:var(--font-display)] text-2xl">Menu items ({items.length})</h2>
              <button
                onClick={() => {
                  setMenuError("");
                  setDraft({ ...EMPTY_DRAFT, category_id: categories[0]?.id ?? "" });
                }}
                className="rounded-full bg-amber-400 px-5 py-2 text-sm font-semibold text-black hover:bg-amber-300"
              >
                + Add item
              </button>
            </div>

            <div className="mb-6 flex gap-2">
              <input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="New category name (e.g. Salads)"
                className={inputClass + " max-w-xs"}
              />
              <button
                onClick={addCategory}
                className="rounded-xl border border-white/15 px-4 text-sm hover:border-amber-400/50"
              >
                Add category
              </button>
            </div>

            <div className="grid gap-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-neutral-900/60 p-4"
                >
                  <div
                    className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-neutral-800 bg-cover bg-center text-3xl"
                    style={item.image_url ? { backgroundImage: `url(${item.image_url})` } : undefined}
                  >
                    {!item.image_url && item.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{item.name}</p>
                    <p className="truncate text-sm text-neutral-500">
                      {categories.find((c) => c.id === item.category_id)?.name ?? "No category"} · {money(item.price)}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleAvailable(item)}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      item.is_available
                        ? "border-emerald-400/40 text-emerald-300"
                        : "border-red-400/40 text-red-300"
                    }`}
                  >
                    {item.is_available ? "In stock" : "Sold out"}
                  </button>
                  <button
                    onClick={() => {
                      setMenuError("");
                      setDraft({
                        id: item.id,
                        name: item.name,
                        description: item.description ?? "",
                        price: String(item.price),
                        emoji: item.emoji ?? "",
                        image_url: item.image_url,
                        category_id: item.category_id ?? "",
                        is_available: item.is_available,
                      });
                    }}
                    className="text-sm text-amber-300 hover:underline"
                  >
                    Edit
                  </button>
                  <button onClick={() => deleteItem(item)} className="text-sm text-red-400 hover:underline">
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Item editor modal */}
      {draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <form
            onSubmit={saveItem}
            className="max-h-[92vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-2xl border border-white/10 bg-neutral-900 p-7 shadow-2xl"
          >
            <div className="flex items-start justify-between">
              <h2 className="font-[family-name:var(--font-display)] text-2xl text-amber-300">
                {draft.id ? "Edit item" : "New item"}
              </h2>
              <button type="button" onClick={() => setDraft(null)} className="text-2xl leading-none text-neutral-500 hover:text-white">
                ×
              </button>
            </div>

            <input required placeholder="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inputClass} />
            <textarea rows={2} placeholder="Description" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className={inputClass} />

            <div className="grid grid-cols-2 gap-3">
              <input required type="number" step="0.01" min="0" placeholder="Price" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} className={inputClass} />
              <input placeholder="Emoji (fallback)" value={draft.emoji} onChange={(e) => setDraft({ ...draft, emoji: e.target.value })} className={inputClass} />
            </div>

            <select value={draft.category_id} onChange={(e) => setDraft({ ...draft, category_id: e.target.value })} className={inputClass}>
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <div className="rounded-xl border border-dashed border-white/15 p-4">
              <p className="mb-2 text-sm text-neutral-400">Photo (max 3 MB)</p>
              {draft.image_url && (
                <div
                  className="mb-3 h-32 w-full rounded-lg bg-cover bg-center"
                  style={{ backgroundImage: `url(${draft.image_url})` }}
                />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])}
                className="text-sm text-neutral-400 file:mr-3 file:rounded-full file:border-0 file:bg-amber-400 file:px-4 file:py-1.5 file:text-sm file:font-semibold file:text-black"
              />
              {uploading && <p className="mt-2 text-xs text-amber-300">Uploading...</p>}
            </div>

            <label className="flex items-center gap-2 text-sm text-neutral-300">
              <input
                type="checkbox"
                checked={draft.is_available}
                onChange={(e) => setDraft({ ...draft, is_available: e.target.checked })}
              />
              Available for ordering
            </label>

            {menuError && <p className="text-sm text-red-400">{menuError}</p>}

            <button
              disabled={saving || uploading}
              className="w-full rounded-xl bg-amber-400 py-3 font-semibold text-black hover:bg-amber-300 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save item"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}