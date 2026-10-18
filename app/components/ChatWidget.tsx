"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "What's popular here?",
  "Any vegetarian options?",
  "Recommend dinner for two",
  "বাংলায় মেনু বলো",
];

const inputClass =
  "w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-amber-400/60";

export default function ChatWidget({ restaurantId }: { restaurantId: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [ticketMode, setTicketMode] = useState(false);
  const [tName, setTName] = useState("");
  const [tPhone, setTPhone] = useState("");
  const [tMsg, setTMsg] = useState("");
  const [tState, setTState] = useState<"idle" | "sending" | "done" | "error">("idle");

  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, open, ticketMode]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;

    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      setMessages([...next, { role: "assistant", content: data.reply ?? "Something went wrong." }]);
    } catch {
      setMessages([...next, { role: "assistant", content: "Network error. Please try again." }]);
    }
    setLoading(false);
  }

  async function submitTicket(e: React.FormEvent) {
    e.preventDefault();
    setTState("sending");
    const { data: sess } = await supabase.auth.getSession();
    const { error } = await supabase.from("support_tickets").insert({
      restaurant_id: restaurantId,
      user_id: sess.session?.user.id ?? null,
      name: tName.trim(),
      phone: tPhone.trim(),
      message: tMsg.trim(),
    });
    if (error) setTState("error");
    else {
      setTState("done");
      setTName("");
      setTPhone("");
      setTMsg("");
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Open chat"
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-amber-400 text-2xl text-black shadow-[0_10px_40px_-5px_rgba(251,191,36,0.5)] transition hover:scale-105"
      >
        {open ? "×" : "💬"}
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 z-40 flex h-[32rem] max-h-[70vh] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-neutral-900 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 bg-neutral-950 px-4 py-3">
            <div>
              <p className="font-[family-name:var(--font-display)] text-lg text-amber-300">Ask our assistant</p>
              <p className="text-xs text-neutral-500">AI · may make mistakes</p>
            </div>
            <button
              onClick={() => {
                setTicketMode(!ticketMode);
                setTState("idle");
              }}
              className="rounded-full border border-white/15 px-3 py-1 text-xs text-neutral-300 hover:border-amber-400/50"
            >
              {ticketMode ? "Back to chat" : "Talk to staff"}
            </button>
          </div>

          {/* Ticket form */}
          {ticketMode ? (
            <div className="flex-1 overflow-y-auto p-4">
              {tState === "done" ? (
                <div className="mt-10 text-center">
                  <div className="mb-2 text-4xl">✅</div>
                  <p className="text-amber-300">Message sent!</p>
                  <p className="mt-1 text-sm text-neutral-400">Our team will contact you soon.</p>
                </div>
              ) : (
                <form onSubmit={submitTicket} className="space-y-3">
                  <p className="text-sm text-neutral-400">
                    Order problem, allergy question or complaint? Leave your details and our staff will call you.
                  </p>
                  <input required placeholder="Your name" value={tName} onChange={(e) => setTName(e.target.value)} className={inputClass} />
                  <input required type="tel" minLength={5} placeholder="Phone number" value={tPhone} onChange={(e) => setTPhone(e.target.value)} className={inputClass} />
                  <textarea required rows={4} maxLength={1000} placeholder="How can we help?" value={tMsg} onChange={(e) => setTMsg(e.target.value)} className={inputClass} />
                  {tState === "error" && <p className="text-sm text-red-400">Could not send. Please try again.</p>}
                  <button
                    disabled={tState === "sending"}
                    className="w-full rounded-xl bg-amber-400 py-2.5 text-sm font-semibold text-black hover:bg-amber-300 disabled:opacity-60"
                  >
                    {tState === "sending" ? "Sending..." : "Send to staff"}
                  </button>
                </form>
              )}
              <div ref={endRef} />
            </div>
          ) : (
            <>
              {/* Messages */}
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-neutral-800 px-3.5 py-2.5 text-sm text-neutral-200">
                  Hi! 👋 I can help you explore the menu, recommend dishes and answer questions. Ask me in English or বাংলা!
                </div>

                {messages.length === 0 && (
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="rounded-full border border-amber-400/40 px-3 py-1 text-xs text-amber-300 transition hover:bg-amber-400 hover:text-black"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}

                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm ${
                        m.role === "user"
                          ? "rounded-br-sm bg-amber-400 text-black"
                          : "rounded-bl-sm bg-neutral-800 text-neutral-200"
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="w-fit rounded-2xl rounded-bl-sm bg-neutral-800 px-4 py-3 text-sm text-neutral-400">
                    <span className="animate-pulse">Typing...</span>
                  </div>
                )}
                <div ref={endRef} />
              </div>

              {/* Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send(input);
                }}
                className="flex gap-2 border-t border-white/10 bg-neutral-950 p-3"
              >
                <input
                  value={input}
                  maxLength={500}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your question..."
                  className={inputClass}
                />
                <button
                  disabled={loading || !input.trim()}
                  className="rounded-xl bg-amber-400 px-4 text-sm font-semibold text-black hover:bg-amber-300 disabled:opacity-50"
                >
                  Send
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}