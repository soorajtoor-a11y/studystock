"use client";

// Vye — "About" section that users scroll to, with the waitlist form at the end.
// Copy is the polished About text; swap classes for your own design tokens as needed.
// Drop <AboutWaitlistSection /> into your landing page below the hero.

import WaitlistForm from "./WaitlistForm";

const FEATURES: { title: string; body: string }[] = [
  {
    title: "Objective Test Study Tools",
    body:
      "Comprehensive breakdowns of every objective event across all three competitions. Users can choose from flashcards, quizzes, or chatbots to study for their event, and move between granular, goal-by-goal analysis and full reviews of an entire event.",
  },
  {
    title: "Presentation Events",
    body:
      "Complete access to an AI presentation workbot that analyzes and scores your presentation audio, script, video, or file, all against the official event guidelines that judges use at the real competitions. Users can track their progression over time and improve their score in a methodical, accurate way. After presenting, they can also choose to be scored on a Q&A built specifically for their event and product.",
  },
  {
    title: "Role-Play Events",
    body:
      "Competitors can generate sample prompts for their role-play, plan and prepare, present through audio, script, or video, and receive a clear, focused breakdown of their progression across scenarios.",
  },
  {
    title: "Editable Notes",
    body:
      "Students can generate guideline-backed notes in seconds, then copy, edit, and revisit them whenever they like.",
  },
];

export default function AboutWaitlistSection() {
  return (
    <section
      id="about"
      className="mx-auto w-full max-w-5xl px-6 py-24 text-[#ECE4D6]"
    >
      <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
        What Vye does
      </h2>

      <div className="mt-12 grid gap-10 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <div key={f.title}>
            <h3 className="text-xl font-semibold text-[#97BC62]">{f.title}</h3>
            <p className="mt-3 leading-relaxed text-[#ECE4D6]/80">{f.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-16 flex flex-col items-center gap-4 text-center">
        <h3 className="text-2xl font-bold">Be first in line.</h3>
        <p className="max-w-md text-[#ECE4D6]/70">
          Join the waitlist and we'll let you know the moment Vye opens.
        </p>
        <WaitlistForm source="about-section" />
      </div>
    </section>
  );
}
