"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/learn", label: "Learn" },
  { href: "/history", label: "History" },
  { href: "/settings", label: "Settings" },
];

export function TopBar() {
  const pathname = usePathname();
  return (
    <header className="topbar">
      <a className="skip" href="#main">Skip to content</a>
      <div className="topbar__row container">
        <Link href="/" className="wordmark">Hotseat</Link>
        <nav className="topbar__links" aria-label="Main">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="navlink" aria-current={pathname.startsWith(link.href) ? "page" : undefined}>
              {link.label}
            </Link>
          ))}
          <Link href="/setup" className="btn btn--primary"><span className="wide-only">New interview</span><span className="narrow-only">Interview</span></Link>
        </nav>
      </div>
    </header>
  );
}
