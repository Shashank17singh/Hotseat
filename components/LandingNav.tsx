"use client";

import { useState } from "react";
import Link from "next/link";

export function LandingNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="land-nav">
      <div className="land-nav__pill">
        <Link href="/" className="wordmark">Hotseat</Link>
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
