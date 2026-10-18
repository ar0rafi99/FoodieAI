"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Item = {
  id: string;
  name: string;
  price: number;
  emoji: string | null;
  image_url: string | null;
};

export default function Recommendations({
  restaurantId,
  cartIds,
  items,
  money,
  onAdd,
}: {
  restaurantId: string;
  cartIds: string[];
  items: Item[];
  money: (n: number) => string;
  onAdd: (id: string) => void;
}) {
  const [ids, setIds] = useState<string[]>([]);
  const key = [...cartIds].sort().join(",");

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("recommend_items", {
        p_restaurant_id: restaurantId,
        p_cart_ids: key ? key.split(",") : [],
        p_limit: 4,
      });
      if (!cancelled && data) {
        setIds((data as { rec_item_id: string }[]).map((r) => r.rec_item_id));
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [restaurantId, key]);

  const recs = ids
    .map((id) => items.find((i) => i.id === id))
    .filter((i): i is Item => !!i);

  if (recs.length === 0) return null;

  return (
    <section className="mb-8">
      <h3 className="mb-3 text-xs uppercase tracking-[0.25em] text-amber-300/80">
        {cartIds.length > 0 ? "Goes well with your order" : "Recommended for you"}
      </h3>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {recs.map((item) => (
          <div
            key={item.id}
            className="flex w-52 shrink-0 items-center gap-3 rounded-2xl border border-white/10 bg-neutral-900/60 p-3"
          >
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-neutral-800 bg-cover bg-center text-2xl"
              style={item.image_url ? { backgroundImage: `url(${item.image_url})` } : undefined}
            >
              {!item.image_url && item.emoji}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{item.name}</p>
              <p className="text-xs text-amber-300">{money(item.price)}</p>
            </div>
            <button
              onClick={() => onAdd(item.id)}
              className="h-7 w-7 shrink-0 rounded-full bg-amber-400 font-bold text-black hover:bg-amber-300"
            >
              +
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}