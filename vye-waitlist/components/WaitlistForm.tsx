"use client";

// Vye — Waitlist form (Route A: Supabase-backed).
// Single email field, low friction. Handles duplicates, double-submits,
// basic spam (honeypot), and shows a clean confirmation state.
//
// Requires: supabase/waitlist.sql run in your Supabase project, and
// NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY set (locally in
// .env.local, and in Render → Environment for the live test).

import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Status = "idle" | "submitting" | "success" | "already" | "error";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function WaitlistForm({ source = "landing" }: { source?: string }) {
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState(""); // honeypot — real users never fill this
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "submitting") return; // block double-submit

    const clean = email.trim().toLowerCase();
    if (!EMAIL_RE.test(clean)) {
      setStatus("error");
      setMessage("Please enter a valid email address.");
      return;
    }

    // Honeypot: if filled, it's a bot. Pretend success, insert nothing.
    if (company.trim() !== "") {
      setStatus("success");
      setMessage("You're on the list.");
      return;
    }

    setStatus("submitting");
    setMessage("");

    const { error } = await supabase
      .from("waitlist")
      .insert({ email: clean, source });

    if (!error) {
      setStatus("success");
      setMessage("You're on the list — we'll be in touch.");
      setEmail("");
      return;
    }

    // 23505 = unique_violation → already signed up
    if ((error as { code?: string }).code === "23505") {
      setStatus("already");
      setMessage("You're already on the list.");
      return;
    }

    setStatus("error");
    setMessage("Something went wrong. Please try again.");
  }

  const done = status === "success" || status === "already";

  return (
    <form onSubmit={onSubmit} className="w-full max-w-md">
      {done ? (
        <p className="rounded-xl border border-[#97BC62]/40 bg-[#97BC62]/10 px-4 py-3 text-center text-[#ECE4D6]">
          {message}
        </p>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row">
          {/* Honeypot: visually hidden, off-screen, not tabbable */}
          <input
            type="text"
            name="company"
            tabIndex={-1}
            autoComplete="off"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className="absolute left-[-9999px] h-0 w-0 opacity-0"
            aria-hidden="true"
          />

          <input
            type="email"
            inputMode="email"
            required
            placeholder="you@school.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 rounded-xl border border-white/15 bg-white/5 px-4 py-3
                       text-[#ECE4D6] placeholder-white/40 outline-none
                       focus:border-[#97BC62] focus:ring-2 focus:ring-[#97BC62]/40"
          />
          <button
            type="submit"
            disabled={status === "submitting"}
            className="rounded-xl bg-[#97BC62] px-6 py-3 font-semibold text-[#16130F]
                       transition hover:bg-[#a9cc76] disabled:opacity-60"
          >
            {status === "submitting" ? "Joining…" : "Join the waitlist"}
          </button>
        </div>
      )}

      {status === "error" && (
        <p className="mt-2 text-sm text-red-300">{message}</p>
      )}
    </form>
  );
}
