"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Translate" },
  { href: "/dictionary", label: "Dictionary" },
  { href: "/read", label: "Read" },
  { href: "/languages", label: "Languages" },
] as const;

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="masthead__nav" aria-label="Main">
      {LINKS.map((link) => {
        const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className="navlink"
            {...(active ? { "aria-current": "page" as const } : {})}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
