/**
 * Styles for the in page overlay.
 *
 * Shipped as a string rather than a stylesheet import because it is injected
 * into a shadow root. Values are copied from the Sumi Press tokens rather than
 * referenced, since custom properties defined on the host page's root do not
 * cross into a shadow tree, and the host page is not ours to modify.
 */
export const OVERLAY_CSS = `
:host {
  all: initial;
}

.layer {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}

.frame {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: top left;
  pointer-events: none;
}

/* The seal, which is the only thing visible until the reader asks for a page. */
.seal {
  position: absolute;
  top: 10px;
  inset-inline-end: 10px;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  padding: 0;
  pointer-events: auto;

  font-family: "Yu Mincho", "Hiragino Mincho ProN", "MS Mincho", serif;
  font-size: 19px;
  line-height: 1;
  color: #f4efe6;
  background-color: #d8412f;
  border: 3px solid #14110f;
  border-radius: 999px;
  box-shadow: 4px 4px 0 #14110f;
  cursor: pointer;
  opacity: 0.35;
  transition: opacity 140ms linear, transform 90ms cubic-bezier(0.2, 0.9, 0.25, 1.2), box-shadow 90ms linear;
}

.frame:hover .seal {
  opacity: 1;
}

.seal:hover {
  transform: translate(1px, 1px) rotate(-4deg);
  box-shadow: 3px 3px 0 #14110f;
}

.seal:active {
  transform: translate(4px, 4px) rotate(-7deg);
  box-shadow: 0 0 0 #14110f;
}

.seal:focus-visible {
  outline: 3px solid #14110f;
  outline-offset: 3px;
  opacity: 1;
}

.frame[data-state="working"] .seal {
  opacity: 1;
  animation: pulse 900ms ease-in-out infinite;
}

.frame[data-state="failed"] .seal {
  opacity: 1;
  background-color: #14110f;
}

@keyframes pulse {
  50% { transform: scale(0.92); }
}

/* Status line, set as a hard edged slug rather than a rounded toast. */
.banner {
  position: absolute;
  top: 10px;
  inset-inline-start: 10px;
  max-width: 62%;
  padding: 6px 10px;
  pointer-events: auto;

  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  font-size: 11px;
  letter-spacing: 0.04em;
  line-height: 1.4;
  color: #f4efe6;
  background-color: #14110f;
  border: 2px solid #d8412f;
}

/* A translated speech bubble sitting over the artwork. */
.bubble {
  position: absolute;
  display: grid;
  place-items: center;
  padding: 3px;
  pointer-events: auto;

  color: #14110f;
  background-color: #f7f3ec;
  border: 2px solid #14110f;
  border-radius: 8px;
  cursor: pointer;
}

.bubble[data-raw="true"] {
  color: #f4efe6;
  background-color: #14110f;
  border-color: #d8412f;
}

.bubble__text {
  font-family: "Zen Kaku Gothic New", system-ui, -apple-system, "Segoe UI", sans-serif;
  font-weight: 500;
  line-height: 1.15;
  text-align: center;
  overflow-wrap: anywhere;
  hyphens: auto;
}

@media (prefers-reduced-motion: reduce) {
  .seal,
  .seal:hover,
  .seal:active {
    transform: none;
    animation: none;
    transition: none;
  }
}
`;
