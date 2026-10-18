"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";

type CartLine = { id: string; name: string; price: number; qty: number };

const inputClass =
  "w-full rounded-xl border border-white/10 bg-neutral-950 px-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none transition focus:border-amber-400/60";

export default function CheckoutModal({
  restaurantId,
  items,
  subtotal,
  deliveryFee,
  total,
  money,
  onClose,
  onSuccess,
}: {
  restaurantId: string;
  items: CartLine[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  money: (n: number) => string;
  onClose: () => void;
  onSuccess: (orderId: string) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data, error } = await supabase.rpc("place_order", {
      p_restaurant_id: restaurantId,
      p_items: items.map((i) => ({ id: i.id, qty: i.qty })),
      p_name: name.trim(),
      p_phone: phone.trim(),
      p_address: address.trim(),
      p_notes: notes.trim() || null,
    });

    setLoading(false);
    if (error) setError(error.message);
    else onSuccess(data as string);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-neutral-900 p-7 shadow-2xl">
        <div className="mb-5 flex items-start justify-between">
          <h2 className="font-[family-name:var(--font-display)] text-2xl text-amber-300">Checkout</h2>
          <button onClick={onClose} className="text-2xl leading-none text-neutral-500 hover:text-white">
            ×
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input required placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          <input required type="tel" minLength={6} placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
          <textarea required rows={2} placeholder="Delivery address" value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
          <textarea rows={2} placeholder="Notes (optional) - e.g. less spicy" value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />

          <div className="rounded-xl border border-white/10 bg-neutral-950 p-4 text-sm">
            <p className="mb-2 text-xs uppercase tracking-widest text-neutral-500">Order summary</p>
            {items.map((i) => (
              <div key={i.id} className="flex justify-between py-0.5 text-neutral-300">
                <span>{i.qty} × {i.name}</span>
                <span>{money(i.price * i.qty)}</span>
              </div>
            ))}
            <div className="mt-3 space-y-1 border-t border-white/10 pt-3">
              <div className="flex justify-between text-neutral-400"><span>Subtotal</span><span>{money(subtotal)}</span></div>
              <div className="flex justify-between text-neutral-400"><span>Delivery</span><span>{money(deliveryFee)}</span></div>
              <div className="flex justify-between text-lg font-semibold text-amber-300"><span>Total</span><span>{money(total)}</span></div>
            </div>
          </div>

          <p className="text-xs text-neutral-500">💵 Payment: Cash on delivery (online payment coming soon)</p>
          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            disabled={loading}
            className="w-full rounded-xl bg-amber-400 py-3 font-semibold text-black transition hover:bg-amber-300 disabled:opacity-60"
          >
            {loading ? "Placing order..." : `Confirm Order · ${money(total)}`}
          </button>
        </form>
      </div>
    </div>
  );
}