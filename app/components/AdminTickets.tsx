"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { RESTAURANT_SLUG } from "../config/restaurant";
import AuthModal from "./AuthModal";

type Ticket = {
  id: string;
  name: string;
  phone: string;
  message: string;
  status: string;
  created_at: string;
};

export default function AdminTickets() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [rid, setRid] = useState<string | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filter, setFilter] = useState<"open" | "resolved">("open");

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
      .select("id")
      .eq("slug", RESTAURANT_SLUG)
      .single()
      .then(({ data }) => data && setRid(data.id));
  }, []);

  const load = useCallback(async (restaurantId: string) => {
    const { data } = await supabase
      .from("support_tickets")
      .select("id, name, phone, message, status, created_at")
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false })
      .limit(100);
    setTickets((data ?? []) as Ticket[]);
  }, []);

  useEffect(() => {
    if (!user || !rid) return;
    load(rid);
    const t = setInterval(() => load(rid), 15000);
    return () => clearInterval(t);
  }, [user, rid, load]);

  async function resolve(id: string, status: string) {
    await supabase.from("support_tickets").update({ status }).eq("id", id);
    if (rid) load(rid);
  }

  if (!ready) return <p className="p-16 text-center text-neutral-500">Loading...</p>;

  const shown = tickets.filter((t) => t.status === filter);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-neutral-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <h1 className="font-[family-name:var(--font-display)] text-xl text-amber-300">◆ Support tickets</h1>
          <a href="/admin" className="rounded-full border border-white/15 px-4 py-1.5 text-sm text-neutral-300 hover:border-amber-400/50">
            ← Admin
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-8">
        {!user ? (
          <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-10 text-center">
            <button
              onClick={() => setShowAuth(true)}
              className="rounded-xl bg-amber-400 px-8 py-3 font-semibold text-black hover:bg-amber-300"
            >
              Sign in as staff
            </button>
          </div>
        ) : (
          <>
            <div className="mb-6 flex gap-2">
              {(["open", "resolved"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-full border px-5 py-1.5 text-sm capitalize ${
                    filter === f
                      ? "border-amber-400 bg-amber-400 font-semibold text-black"
                      : "border-white/10 text-neutral-300 hover:border-amber-400/50"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {shown.length === 0 && (
              <p className="text-neutral-500">No {filter} tickets (or you are not staff for this restaurant).</p>
            )}

            <div className="space-y-4">
              {shown.map((t) => (
                <div key={t.id} className="rounded-2xl border border-white/10 bg-neutral-900/60 p-5">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{t.name}</p>
                      <a href={`tel:${t.phone}`} className="text-sm text-amber-300 hover:underline">📞 {t.phone}</a>
                    </div>
                    <p className="text-xs text-neutral-600">{new Date(t.created_at).toLocaleString()}</p>
                  </div>
                  <p className="mb-4 whitespace-pre-wrap rounded-lg bg-neutral-950 px-3 py-2 text-sm text-neutral-300">
                    {t.message}
                  </p>
                  <button
                    onClick={() => resolve(t.id, t.status === "open" ? "resolved" : "open")}
                    className="rounded-xl border border-white/15 px-4 py-2 text-sm hover:border-amber-400/50"
                  >
                    {t.status === "open" ? "Mark resolved ✓" : "Reopen"}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} onSuccess={() => setShowAuth(false)} />}
    </div>
  );
}