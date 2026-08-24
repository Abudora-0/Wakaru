import type { Metadata } from "next";
import { MangaReader } from "@/components/MangaReader";
import "./read.css";

export const metadata: Metadata = {
  title: "Read",
  description:
    "Turn a raw Japanese, Korean or Chinese page into readable text. Speech bubbles are found and read in your browser, with nothing uploaded.",
};

export default function ReadPage() {
  return (
    <>
      <div className="runhead">
        <h1 className="runhead__title">Read</h1>
        <span className="runhead__note">OCR runs in your browser</span>
      </div>

      <MangaReader />

      <p className="notice notice--quiet" style={{ marginTop: "var(--wk-s-6)" }}>
        The first page you read downloads a language model, which is a few megabytes and is then cached by your
        browser. Nothing is sent to a server: recognition happens locally, and only the extracted text is sent to the
        translator. To read pages without leaving the site you are on, install the browser extension.
      </p>
    </>
  );
}
