import type { Metadata } from "next";
import { SavedList } from "@/components/SavedList";
import "./saved.css";

export const metadata: Metadata = {
  title: "Saved words",
  description: "Dictionary entries you have saved, kept in this browser and exportable at any time.",
};

export default function SavedPage() {
  return (
    <>
      <div className="runhead">
        <h1 className="runhead__title">Saved words</h1>
      </div>

      <p className="saved__notice">
        Kept in this browser only, not on a server: there is no account here for it to belong to. Export a copy
        before clearing site data or switching browsers, since nothing here follows you otherwise.
      </p>

      <SavedList />
    </>
  );
}
