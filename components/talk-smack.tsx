"use client";

import { useEffect, useRef, useState } from "react";

interface SmackMessage {
  id: string;
  body: string;
  createdAt: string;
  displayName: string;
  userId: string;
}

export function TalkSmack({ currentUserId }: { currentUserId: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<SmackMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    });
  }

  // Load on open; light poll every 10s while open so new smack appears.
  useEffect(() => {
    if (!open) return;
    let active = true;
    async function load() {
      const res = await fetch("/api/messages");
      if (res.ok && active) {
        const { messages } = await res.json();
        setMessages(messages);
        setLoaded(true);
        scrollToBottom();
      }
    }
    load();
    const t = setInterval(load, 10000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [open]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    setSending(false);
    if (res.ok) {
      const { messages } = await res.json();
      setMessages(messages);
      setDraft("");
      scrollToBottom();
    }
  }

  return (
    <>
      {/* Floating button, bottom-right */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open Talk Smack message board"
          className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-field px-4 py-3 font-semibold text-white shadow-lg active:scale-95"
        >
          <SmackIcon />
          <span>Talk Smack</span>
        </button>
      )}

      {/* Slide-up panel */}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end sm:items-end sm:p-4">
          {/* backdrop */}
          <button
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="relative flex h-[75vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:h-[70vh] sm:max-w-md sm:rounded-2xl">
            {/* header */}
            <div className="flex items-center justify-between border-b border-gray-200 bg-field px-4 py-3 text-white">
              <div className="flex items-center gap-2 font-semibold">
                <SmackIcon /> Talk Smack
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-2xl leading-none text-white/80 hover:text-white"
              >
                &times;
              </button>
            </div>

            {/* messages */}
            <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
              {!loaded ? (
                <p className="text-center text-sm text-gray-400">Loading…</p>
              ) : messages.length === 0 ? (
                <p className="text-center text-sm text-gray-400">
                  No smack yet. Be the first to talk it. 🗣️
                </p>
              ) : (
                messages.map((m) => {
                  const mine = m.userId === currentUserId;
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${mine ? "items-end" : "items-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                          mine
                            ? "bg-field text-white"
                            : "bg-gray-100 text-gray-900"
                        }`}
                      >
                        {m.body}
                      </div>
                      <div className="mt-0.5 px-1 text-[11px] text-gray-400">
                        {m.displayName} · {formatTime(m.createdAt)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* composer */}
            <form
              onSubmit={send}
              className="flex items-center gap-2 border-t border-gray-200 p-2"
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Talk your smack…"
                maxLength={1000}
                className="flex-1 rounded-full border border-gray-300 px-4 py-2.5 text-base focus:border-field focus:outline-none"
              />
              <button
                type="submit"
                disabled={!draft.trim() || sending}
                className="shrink-0 rounded-full bg-field px-4 py-2.5 font-semibold text-white disabled:opacity-50"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function SmackIcon() {
  // Speech bubble with lines coming out ("talking smack").
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 5h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-4 3v-3H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
        fill="currentColor"
      />
      <path
        d="M20 9h2M20 12h2.5M20 15h2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return d.toLocaleString("en-US", {
    month: sameDay ? undefined : "short",
    day: sameDay ? undefined : "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
