import { loadSettings, type ReadPageResponse, type Settings, type TranslatedRegion } from "../lib/messages";
import { OVERLAY_CSS } from "../lib/overlay-css";

/**
 * The content script.
 *
 * Everything it draws lives inside a shadow root. Raw reader sites are hostile
 * styling environments, full of global selectors and high z-index chrome, and
 * a shadow root is the only reliable way to keep their CSS out of ours and
 * ours out of theirs.
 *
 * It never touches the page's own DOM beyond reading image positions.
 */

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",

  async main() {
    const settings = await loadSettings();
    const reader = new PageReader(settings);
    reader.start();
  },
});

interface Tracked {
  image: HTMLImageElement;
  frame: HTMLDivElement;
  state: "idle" | "working" | "done" | "failed";
}

class PageReader {
  private readonly settings: Settings;
  private readonly host: HTMLDivElement;
  private readonly root: ShadowRoot;
  private readonly layer: HTMLDivElement;
  private readonly tracked = new Map<HTMLImageElement, Tracked>();
  private frameRequest = 0;

  constructor(settings: Settings) {
    this.settings = settings;

    this.host = document.createElement("div");
    this.host.id = "wakaru-root";
    this.host.style.cssText = "all: initial; position: absolute; top: 0; left: 0; width: 0; height: 0; z-index: 2147483000;";

    this.root = this.host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = OVERLAY_CSS;
    this.root.append(style);

    this.layer = document.createElement("div");
    this.layer.className = "layer";
    this.root.append(this.layer);
  }

  start(): void {
    document.documentElement.append(this.host);
    this.scan();

    // Reader sites load pages lazily as you scroll, so new images appear
    // constantly and a one time scan would miss almost all of them.
    const observer = new MutationObserver(() => this.schedule());
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener("scroll", () => this.schedule(), { passive: true });
    window.addEventListener("resize", () => this.schedule(), { passive: true });
  }

  private schedule(): void {
    if (this.frameRequest) return;
    this.frameRequest = requestAnimationFrame(() => {
      this.frameRequest = 0;
      this.scan();
      this.reposition();
    });
  }

  /** Any image big enough to be a page rather than an icon or an advert. */
  private candidates(): HTMLImageElement[] {
    const min = this.settings.minImageSize;
    return [...document.images].filter((image) => {
      const rect = image.getBoundingClientRect();
      return rect.width >= min && rect.height >= min;
    });
  }

  private scan(): void {
    for (const image of this.candidates()) {
      if (this.tracked.has(image)) continue;
      this.attach(image);
    }

    // Drop anything the site has since removed from the document.
    for (const [image, entry] of this.tracked) {
      if (!image.isConnected) {
        entry.frame.remove();
        this.tracked.delete(image);
      }
    }
  }

  private attach(image: HTMLImageElement): void {
    const frame = document.createElement("div");
    frame.className = "frame";

    const button = document.createElement("button");
    button.className = "seal";
    button.type = "button";
    button.title = "Read this page with Wakaru";
    button.textContent = "分";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void this.read(image);
    });

    frame.append(button);
    this.layer.append(frame);
    this.tracked.set(image, { image, frame, state: "idle" });
    this.place(image, frame);
  }

  /** Position in document coordinates so the overlay scrolls with the page. */
  private place(image: HTMLImageElement, frame: HTMLDivElement): void {
    const rect = image.getBoundingClientRect();
    frame.style.transform = `translate(${rect.left + window.scrollX}px, ${rect.top + window.scrollY}px)`;
    frame.style.width = `${rect.width}px`;
    frame.style.height = `${rect.height}px`;
  }

  private reposition(): void {
    for (const [image, entry] of this.tracked) {
      this.place(image, entry.frame);
    }
  }

  private setState(entry: Tracked, state: Tracked["state"], note?: string): void {
    entry.state = state;
    entry.frame.dataset.state = state;

    const seal = entry.frame.querySelector(".seal");
    if (seal) seal.textContent = state === "working" ? "..." : state === "failed" ? "!" : "分";

    let banner = entry.frame.querySelector<HTMLDivElement>(".banner");
    if (note) {
      if (!banner) {
        banner = document.createElement("div");
        banner.className = "banner";
        entry.frame.append(banner);
      }
      banner.textContent = note;
    } else {
      banner?.remove();
    }
  }

  private async read(image: HTMLImageElement): Promise<void> {
    const entry = this.tracked.get(image);
    if (!entry || entry.state === "working") return;

    // The extension asks for site access only when a person actually uses it,
    // rather than holding permission for every site from install onward.
    const origin = `${new URL(image.currentSrc || image.src, location.href).origin}/*`;
    const granted = await chrome.permissions.request({ origins: [origin, `${location.origin}/*`] }).catch(() => false);
    if (!granted) {
      this.setState(entry, "failed", "Wakaru needs access to this site to read the image.");
      return;
    }

    this.setState(entry, "working", "Reading. The first page downloads a language model.");

    const response = (await chrome.runtime.sendMessage({
      type: "read-page",
      imageUrl: image.currentSrc || image.src,
      script: this.settings.script,
      target: this.settings.target,
    })) as ReadPageResponse | undefined;

    if (!response || response.error) {
      this.setState(entry, "failed", response?.error ?? "could not read this image");
      return;
    }

    this.setState(entry, "done");
    this.paint(entry, response.regions, response.width, response.height);
  }

  /**
   * Draw the translations over the artwork.
   *
   * Positions are percentages of the natural image size, so the overlay stays
   * aligned when the site scales the image responsively or the reader zooms.
   */
  private paint(entry: Tracked, regions: TranslatedRegion[], width: number, height: number): void {
    entry.frame.querySelectorAll(".bubble").forEach((node) => node.remove());

    for (const region of regions) {
      if (!region.translation) continue;

      const bubble = document.createElement("div");
      bubble.className = "bubble";
      bubble.style.left = `${(region.box.x / width) * 100}%`;
      bubble.style.top = `${(region.box.y / height) * 100}%`;
      bubble.style.width = `${(region.box.width / width) * 100}%`;
      bubble.style.height = `${(region.box.height / height) * 100}%`;
      bubble.title = region.text;

      const text = document.createElement("span");
      text.className = "bubble__text";
      text.textContent = region.translation;
      bubble.append(text);

      // Clicking a bubble flips back to the original, which matters when the
      // recognition is wrong and the reader wants to see what it actually said.
      bubble.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const showingRaw = bubble.dataset.raw === "true";
        bubble.dataset.raw = showingRaw ? "false" : "true";
        text.textContent = showingRaw ? region.translation : region.text;
      });

      entry.frame.append(bubble);
    }

    this.fitText(entry.frame);
  }

  /** Shrink any translation that does not fit the bubble it belongs to. */
  private fitText(frame: HTMLDivElement): void {
    for (const bubble of frame.querySelectorAll<HTMLDivElement>(".bubble")) {
      const text = bubble.querySelector<HTMLSpanElement>(".bubble__text");
      if (!text) continue;

      let size = Math.max(9, Math.min(18, bubble.clientHeight / 5));
      text.style.fontSize = `${size}px`;

      while (size > 7 && (text.scrollHeight > bubble.clientHeight || text.scrollWidth > bubble.clientWidth)) {
        size -= 1;
        text.style.fontSize = `${size}px`;
      }
    }
  }
}
