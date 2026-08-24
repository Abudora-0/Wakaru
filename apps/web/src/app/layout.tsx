import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CommandPalette } from "@/components/CommandPalette";
import { Wordmark } from "@/components/Logo";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Wakaru",
    template: "%s | Wakaru",
  },
  description:
    "Translate between languages and their dialects, look words up in any script with pronunciation and examples, and read raw manga. Built entirely on free, keyless sources.",
  applicationName: "Wakaru",
  keywords: ["translator", "dictionary", "dialects", "manga", "OCR", "pronunciation", "IPA"],
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Wakaru",
    description: "Translate, define and read. Every source free and keyless.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4efe6" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0d0c" },
  ],
};

/**
 * Applied before first paint so a reader who chose Night Ink never sees a
 * flash of paper white on the way in.
 */
const THEME_BOOTSTRAP = `
try {
  var t = localStorage.getItem("wakaru-theme");
  if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
} catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Zen+Antique&family=Zen+Kaku+Gothic+New:wght@400;500;700&family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&family=JetBrains+Mono:wght@400;500&family=Gentium+Plus&display=swap"
        />
      </head>
      <body className="wk-scope">
        <div className="page">
          <header className="masthead">
            <div className="shell masthead__inner">
              <Link href="/" className="masthead__brand" aria-label="Wakaru home">
                <Wordmark />
              </Link>
              <Nav />
              <CommandPalette />
              <ThemeToggle />
            </div>
          </header>

          <main className="main">
            <div className="shell">{children}</div>
          </main>

          <footer className="colophon">
            <div className="shell colophon__inner">
              <p>
                Wakaru runs on free, keyless sources. Definitions from{" "}
                <a href="https://en.wiktionary.org">Wiktionary</a> and{" "}
                <a href="https://dictionaryapi.dev">dictionaryapi.dev</a> under CC BY-SA. Recordings from{" "}
                <a href="https://lingualibre.org">Lingua Libre</a>.
              </p>
              <p>
                <a href="https://github.com/wakaru/wakaru">Source</a> under MIT.
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
