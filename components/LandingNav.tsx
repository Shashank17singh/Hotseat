"use client";

import { useState } from "react";
import Link from "next/link";

export function LandingNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="land-nav">
      <div className="land-nav__pill">
        <Link href="/" className="wordmark inline-flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[#0b0f1a] shadow-sm ring-1 ring-orange-500/25" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6.5 23L12.5 18.5L18 20.5L25.5 9" stroke="#f97316" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="25.5" cy="9" r="2.5" fill="#f97316"/>
            </svg>
          </span>
          <span>Hotseat</span>
        </Link>
        <nav className="land-nav__links" aria-label="Main">
          <a className="navlink" href="#how">How it works</a>
          <Link className="navlink" href="/learn">Learn</Link>
          <Link className="navlink" href="/history">History</Link>
          <Link className="btn" href="/setup">Start practising</Link>
          <button
            type="button"
            className="land-nav__toggle"
            aria-label="Toggle navigation menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Close" : "Menu"}
          </button>
        </nav>
      </div>
      {open && (
        <div className="land-nav__mobile-menu">
          <a className="navlink" href="#how" onClick={() => setOpen(false)}>How it works</a>
          <Link className="navlink" href="/learn" onClick={() => setOpen(false)}>Learn</Link>
          <Link className="navlink" href="/history" onClick={() => setOpen(false)}>History</Link>
          <Link className="navlink" href="/settings" onClick={() => setOpen(false)}>Settings</Link>
          <Link className="btn btn--primary" href="/setup" onClick={() => setOpen(false)}>Start practising</Link>
        </div>
      )}
    </header>
  );
}
