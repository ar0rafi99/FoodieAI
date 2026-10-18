"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { RESTAURANT_SLUG } from "../config/restaurant";
import AuthModal from "./AuthModal";

type OrderItem = { id: string; name: string; price: number; qty: number };
type Order = {
  id: string;
  total: number;
  status: string;
  address: string;
  created_at: string;
  order_items: OrderItem[];
};

const STEPS = ["pending", "preparing", "out_for_delivery", "delivered"];
const STEP_LABELS = ["Received", "Preparing", "On the way", "Delivered"];

export default function MyOrders() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [currency, setCurrency] = useState("USD");
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    supabase
      .from("restaurants")
      .select("currency")
      .eq("slug", RESTAURANT_SLUG)
      .single()
      .then(({ data }) => data && setCurrency(data.currency));
  }, []);

  const load = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from("orders")
      .select("id, total, status, address, created_at, order_items(id, name, price, qty)")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(30);
    setOrders(
      (data ?? []).map((o) => ({
        ...o,
        total: Number(o.total),
        order_items: (o.order_items ?? []).map((i: OrderItem) => ({ ...i, price: Number(i.price) })),
      })) as Order[]
    );
  }, []);

  useEffect(() => {
    if (!user) return;
    load(user.id);
    const channel = supabase
      .channel("my-orders-" + user.id)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `user_id=eq.${user.id}` },
        () => load(user.id)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, load]);

  const money = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);

  if (!ready) return <p className="p-16 text-center text-neutral-500">Loading...</p>;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-neutral-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <h1 className="font-[family-name:var(--font-display)] text-xl text-amber-300">◆ My Orders</h1>
          <a href="/" className="rounded-full border border-white/15 px-4 py-1.5 text-sm text-neutral-300 hover:border-amber-400/50">
            ← Back to menu
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-8">
        {!user ? (
          <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-10 text-center">
            <p className="mb-4 text-neutral-400">Sign in to see your orders.</p>
            <button
              onClick={() => setShowAuth(true)}
              className="rounded-xl bg-amber-400 px-8 py-3 font-semibold text-black hover:bg-amber-300"
            >
              Sign in
            </button>
          </div>
        ) : orders.length === 0 ? (
          <p className="text-center text-neutral-500">No orders yet. Go order something delicious!</p>
        ) : (
          <div className="space-y-5">
            {orders.map((o) => {
              const cancelled = o.status === "cancelled";
              const current = STEPS.indexOf(o.status);
              return (
                <div key={o.id} className="rounded-2xl border border-white/10 bg-neutral-900/60 p-5">
                  <div className="mb-4 flex items-start justify-between">
                    <div>
                      <p className="font-mono text-sm text-neutral-400">#{o.id.slice(0, 8)}</p>
                      <p className="text-xs text-neutral-600">{new Date(o.created_at).toLocaleString()}</p>
                    </div>
                    <p className="font-semibold text-amber-300">{money(o.total)}</p>
                  </div>

                  {cancelled ? (
                    <p className="mb-4 rounded-lg bg-red-400/10 px-3 py-2 text-sm text-red-300">
                      This order was cancelled.
                    </p>
                  ) : (
                    <div className="mb-5 grid grid-cols-4 gap-1">
                      {STEP_LABELS.map((label, idx) => (
                        <div key={label} className="text-center">
                          <div className={`mb-1.5 h-1.5 rounded-full ${idx <= current ? "bg-amber-400" : "bg-white/10"}`} />
                          <p className={`text-[11px] ${idx <= current ? "text-amber-300" : "text-neutral-600"}`}>
                            {label}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <ul className="space-y-1 border-t border-white/10 pt-3 text-sm text-neutral-300">
                    {o.order_items.map((i) => (
                      <li key={i.id} className="flex justify-between">
                        <span>{i.qty} × {i.name}</span>
                        <span>{money(i.price * i.qty)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs text-neutral-500">📍 {o.address}</p>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} onSuccess={() => setShowAuth(false)} />}
    </div>
  );
}