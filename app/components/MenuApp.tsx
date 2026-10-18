"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { RESTAURANT_SLUG } from "../config/restaurant";
import AuthModal from "./AuthModal";
import CheckoutModal from "./CheckoutModal";
import ChatWidget from "./ChatWidget";
import Recommendations from "./Recommendations";

type Restaurant = { id: string; name: string; currency: string; delivery_fee: number };
type Category = { id: string; name: string };
type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  emoji: string | null;
  image_url: string | null;
  category_id: string | null;
};

export default function MenuApp() {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});

  const [user, setUser] = useState<User | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);

  // Load menu
  useEffect(() => {
    async function load() {
      const { data: r, error: rErr } = await supabase
        .from("restaurants")
        .select("id, name, currency, delivery_fee")
        .eq("slug", RESTAURANT_SLUG)
        .single();

      if (rErr || !r) {
        setError("Restaurant not found. Check your Supabase setup.");
        setLoading(false);
        return;
      }

      const [cats, menu] = await Promise.all([
        supabase.from("categories").select("id, name").eq("restaurant_id", r.id).order("sort_order"),
        supabase
          .from("menu_items")
          .select("id, name, description, price, emoji, image_url, category_id")
          .eq("restaurant_id", r.id)
          .order("created_at"),
      ]);

      setRestaurant({ ...r, delivery_fee: Number(r.delivery_fee) });
      setCategories(cats.data ?? []);
      setItems((menu.data ?? []).map((i) => ({ ...i, price: Number(i.price) })));
      setLoading(false);
    }
    load();
  }, []);

  // Track login state
    const [isStaff, setIsStaff] = useState(false);
  useEffect(() => {
    if (!user || !restaurant) {
      setIsStaff(false);
      return;
    }
    supabase
      .from("restaurant_staff")
      .select("role")
      .eq("restaurant_id", restaurant.id)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setIsStaff(!!data));
  }, [user, restaurant]);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setUser(session?.user ?? null)
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  const money = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: restaurant?.currency ?? "USD",
    }).format(n);

  const filtered = items.filter((item) => {
    const matchCategory = category === "all" || item.category_id === category;
    const matchSearch = item.name.toLowerCase().includes(search.trim().toLowerCase());
    return matchCategory && matchSearch;
  });

  const addToCart = (id: string) => setCart((p) => ({ ...p, [id]: (p[id] || 0) + 1 }));
  const removeFromCart = (id: string) =>
    setCart((p) => {
      const next = { ...p };
      if (next[id] > 1) next[id] -= 1;
      else delete next[id];
      return next;
    });

  const cartItems = items.filter((i) => cart[i.id]).map((i) => ({ ...i, qty: cart[i.id] }));
  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const deliveryFee = restaurant?.delivery_fee ?? 0;
  const subtotal = cartItems.reduce((s, i) => s + i.price * i.qty, 0);
  const total = cartItems.length > 0 ? subtotal + deliveryFee : 0;

  function placeOrder() {
    if (!user) setShowAuth(true);
    else setShowCheckout(true);
  }

  if (loading) return <p className="p-16 text-center text-neutral-500">Loading menu...</p>;
  if (error || !restaurant) return <p className="p-16 text-center text-red-400">{error}</p>;

  return (
    <div className="min-h-screen">
      {/* Navbar */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-neutral-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <h1 className="font-[family-name:var(--font-display)] text-xl tracking-wide text-amber-300">
            ◆ {restaurant.name}
          </h1>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <a href="/orders" className="text-sm text-neutral-300 hover:text-amber-300">My orders</a>
                {isStaff && (
                  <a href="/admin" className="text-sm text-amber-300 hover:underline">Admin</a>
                )}
                <span className="hidden text-sm text-neutral-400 md:block">{user.email}</span>
                <button
                  onClick={() => supabase.auth.signOut()}
                  className="rounded-full border border-white/15 px-4 py-1.5 text-sm text-neutral-300 transition hover:border-amber-400/50 hover:text-white"
                >
                  Sign out
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowAuth(true)}
                className="rounded-full border border-white/15 px-4 py-1.5 text-sm text-neutral-300 transition hover:border-amber-400/50 hover:text-white"
              >
                Sign in
              </button>
            )}
            <a
              href="#cart"
              className="rounded-full bg-amber-400 px-4 py-1.5 text-sm font-semibold text-black transition hover:bg-amber-300"
            >
              🛒 {cartCount}
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="pointer-events-none absolute -top-32 left-1/2 h-80 w-[40rem] -translate-x-1/2 rounded-full bg-amber-500/15 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-5 py-16 text-center sm:py-24">
          <p className="mb-4 text-xs uppercase tracking-[0.35em] text-amber-300/80">Fine dining, at your door</p>
          <h2 className="font-[family-name:var(--font-display)] text-4xl leading-tight sm:text-6xl">
            Taste the <span className="italic text-amber-300">extraordinary</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-neutral-400">
            Handcrafted dishes made with fresh ingredients, delivered hot and fast.
          </p>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 lg:grid-cols-3">
        {/* Menu */}
        <main className="lg:col-span-2">
            <Recommendations
            restaurantId={restaurant.id}
            cartIds={Object.keys(cart)}
            items={items}
            money={money}
            onAdd={addToCart}
          />
          <input
            type="text"
            placeholder="Search the menu..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-5 w-full rounded-2xl border border-white/10 bg-neutral-900/60 px-5 py-3.5 text-sm text-white placeholder:text-neutral-500 outline-none transition focus:border-amber-400/60"
          />

          <div className="mb-7 flex flex-wrap gap-2">
            {[{ id: "all", name: "All" }, ...categories].map((c) => (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                className={`rounded-full border px-5 py-1.5 text-sm transition ${
                  category === c.id
                    ? "border-amber-400 bg-amber-400 font-semibold text-black"
                    : "border-white/10 text-neutral-300 hover:border-amber-400/50"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {filtered.map((item) => (
              <div
                key={item.id}
                className="group rounded-2xl border border-white/10 bg-neutral-900/60 p-5 transition duration-300 hover:-translate-y-1 hover:border-amber-400/40 hover:shadow-[0_10px_40px_-10px_rgba(251,191,36,0.25)]"
              >
                                {item.image_url ? (
                  <div
                    className="mb-4 h-40 w-full rounded-xl bg-cover bg-center ring-1 ring-white/10"
                    style={{ backgroundImage: `url(${item.image_url})` }}
                  />
                ) : (
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-400/20 to-transparent text-4xl ring-1 ring-white/10">
                    {item.emoji}
                  </div>
                )}
                <h3 className="font-[family-name:var(--font-display)] text-xl">{item.name}</h3>
                <p className="mb-5 mt-1 min-h-[2.5rem] text-sm text-neutral-400">{item.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold text-amber-300">{money(item.price)}</span>
                  <button
                    onClick={() => addToCart(item.id)}
                    className="rounded-full border border-amber-400/60 px-4 py-1.5 text-sm text-amber-300 transition hover:bg-amber-400 hover:text-black"
                  >
                    + Add
                  </button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <p className="text-neutral-500">No items found.</p>}
          </div>
        </main>

        {/* Cart */}
        <aside
          id="cart"
          className="h-fit scroll-mt-24 rounded-2xl border border-white/10 bg-neutral-900/70 p-6 backdrop-blur lg:sticky lg:top-24"
        >
          <h2 className="mb-4 font-[family-name:var(--font-display)] text-2xl text-amber-300">Your Order</h2>

          {cartItems.length === 0 ? (
            <p className="text-sm text-neutral-500">Your cart is empty. Add something delicious.</p>
          ) : (
            <>
              <ul className="mb-5 space-y-4">
                {cartItems.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.name}</p>
                      <p className="text-xs text-neutral-500">
                        {money(item.price)} × {item.qty}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="h-7 w-7 rounded-full border border-white/15 text-neutral-300 hover:border-amber-400/60"
                      >
                        −
                      </button>
                      <span className="w-4 text-center text-sm">{item.qty}</span>
                      <button
                        onClick={() => addToCart(item.id)}
                        className="h-7 w-7 rounded-full bg-amber-400 font-bold text-black hover:bg-amber-300"
                      >
                        +
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="space-y-2 border-t border-white/10 pt-4 text-sm">
                <div className="flex justify-between text-neutral-400"><span>Subtotal</span><span>{money(subtotal)}</span></div>
                <div className="flex justify-between text-neutral-400"><span>Delivery</span><span>{money(deliveryFee)}</span></div>
                <div className="flex justify-between pt-1 text-lg font-semibold text-amber-300"><span>Total</span><span>{money(total)}</span></div>
              </div>

              <button
                onClick={placeOrder}
                className="mt-5 w-full rounded-xl bg-amber-400 py-3 font-semibold text-black transition hover:bg-amber-300"
              >
                {user ? "Checkout" : "Sign in to Order"}
              </button>
            </>
          )}
        </aside>
      </div>

      <footer className="border-t border-white/5 py-8 text-center text-xs text-neutral-600">
        © {new Date().getFullYear()} {restaurant.name} · Powered by FoodieAI
      </footer>

      {/* Modals */}
      {showAuth && (
        <AuthModal
          onClose={() => setShowAuth(false)}
          onSuccess={() => {
            setShowAuth(false);
            if (cartItems.length > 0) setShowCheckout(true);
          }}
        />
      )}

      {showCheckout && (
        <CheckoutModal
          restaurantId={restaurant.id}
          items={cartItems.map((i) => ({ id: i.id, name: i.name, price: i.price, qty: i.qty }))}
          subtotal={subtotal}
          deliveryFee={deliveryFee}
          total={total}
          money={money}
          onClose={() => setShowCheckout(false)}
          onSuccess={(id) => {
            setShowCheckout(false);
            setCart({});
            setOrderId(id);
          }}
        />
      )}

    <ChatWidget restaurantId={restaurant.id} />

      {orderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-amber-400/30 bg-neutral-900 p-8 text-center shadow-2xl">
            <div className="mb-3 text-5xl">✅</div>
            <h2 className="font-[family-name:var(--font-display)] text-2xl text-amber-300">Order placed!</h2>
            <p className="mt-2 text-sm text-neutral-400">
              Thank you. Your order <span className="font-mono text-neutral-200">#{orderId.slice(0, 8)}</span> is being prepared.
            </p>
            <button
              onClick={() => setOrderId(null)}
              className="mt-6 w-full rounded-xl bg-amber-400 py-3 font-semibold text-black hover:bg-amber-300"
            >
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}