/**
 * The Wakaru mark: Ink Drop Balloon.
 *
 * A round brush balloon whose tail breaks into falling vermilion drops, with
 * 分 knocked out of the centre. The balloon silhouette is deliberately reused
 * as the tooltip shape and as the manga overlay bubble, so the logo is part of
 * the interface rather than decoration sitting on top of it.
 */

export interface LogoProps {
  size?: number;
  /** "ink" draws the balloon in ink. "seal" draws it in vermilion. */
  tone?: "ink" | "seal";
  title?: string;
  className?: string;
  /**
   * Let the ink drops fall on a loop. Used on the front page, where the mark
   * is large enough for the movement to read as ink leaving the tail rather
   * than as three dots twitching. Honoured only when the reader has not asked
   * for reduced motion.
   */
  animated?: boolean;
}

/** The balloon outline, shared by the logo and the overlay bubbles. */
export const BALLOON_PATH =
  "M34 8 C54 8 68 21 68 36 C68 51 54 62 36 62 L30 62 C29 68 25 73 18 76 C22 70 22 66 20 62 C10 58 4 48 4 36 C4 21 16 8 34 8 Z";

export function Logo({ size = 40, tone = "ink", title = "Wakaru", className, animated = false }: LogoProps) {
  const body = tone === "seal" ? "var(--wk-seal)" : "var(--wk-text)";
  const knockout = tone === "seal" ? "var(--wk-text-on-seal)" : "var(--wk-bg)";
  const drops = tone === "seal" ? "var(--wk-text)" : "var(--wk-seal)";

  return (
    <svg
      className={[animated ? "logo logo--animated" : "logo", className].filter(Boolean).join(" ")}
      viewBox="0 0 96 84"
      width={size}
      height={(size * 84) / 96}
      role="img"
      aria-label={title}
      focusable="false"
    >
      <title>{title}</title>
      <path d={BALLOON_PATH} fill={body} />
      <text
        x="36"
        y="46"
        fontSize="28"
        fill={knockout}
        textAnchor="middle"
        fontFamily="var(--wk-font-display)"
      >
        分
      </text>
      <circle className="logo__drop logo__drop--1" cx="82" cy="26" r="6" fill={drops} />
      <circle className="logo__drop logo__drop--2" cx="89" cy="43" r="3.2" fill={drops} opacity="0.62" />
      <circle className="logo__drop logo__drop--3" cx="84" cy="56" r="1.8" fill={drops} opacity="0.4" />
    </svg>
  );
}

/** The full lockup, used in the masthead and on the home page. */
export function Wordmark({ size = 34 }: { size?: number }) {
  return (
    <>
      <Logo size={size} />
      <span>
        <span className="masthead__wordmark">Wakaru</span>
        <span className="masthead__tagline">Translate / Define / Read</span>
      </span>
    </>
  );
}
