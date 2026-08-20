"use client";

import { Bookmark, BookmarkCheck, RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function SavedViewControls({
  currentQuery,
  pathname,
  viewKey,
}: {
  currentQuery: string;
  pathname: string;
  viewKey: string;
}) {
  const router = useRouter();
  const storageKey = `what-bin-console:view:${viewKey}`;
  const [savedQuery, setSavedQuery] = useState<string>();
  const [message, setMessage] = useState("");

  useEffect(() => {
    const hydration = window.setTimeout(() => {
      try {
        setSavedQuery(window.localStorage.getItem(storageKey) ?? "");
      } catch {
        setSavedQuery("");
      }
    }, 0);
    return () => window.clearTimeout(hydration);
  }, [storageKey]);

  function saveView() {
    try {
      window.localStorage.setItem(storageKey, currentQuery);
      setSavedQuery(currentQuery);
      setMessage("View saved on this device.");
    } catch {
      setMessage("This browser blocked saved view storage.");
    }
  }

  function restoreView() {
    if (savedQuery === undefined) return;
    let latestSavedQuery = savedQuery;
    try {
      latestSavedQuery = window.localStorage.getItem(storageKey) ?? "";
      setSavedQuery(latestSavedQuery);
    } catch {
      // Fall back to the hydrated in-memory value when storage becomes unavailable.
    }
    router.replace(latestSavedQuery ? `${pathname}?${latestSavedQuery}` : pathname);
    setMessage("Saved view restored.");
  }

  function clearView() {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // The in-memory control is still cleared when browser storage is unavailable.
    }
    setSavedQuery("");
    setMessage("Saved view cleared.");
  }

  return (
    <div className="saved-view-controls">
      <button className="secondary-button button-small" onClick={saveView} type="button">
        {savedQuery === currentQuery ? <BookmarkCheck aria-hidden="true" size={15} /> : <Bookmark aria-hidden="true" size={15} />}
        Save View
      </button>
      <button className="secondary-button button-small" disabled={savedQuery === undefined} onClick={restoreView} type="button">
        <RotateCcw aria-hidden="true" size={15} /> Restore
      </button>
      {savedQuery ? (
        <button aria-label="Clear saved view" className="icon-button" onClick={clearView} type="button">
          <Trash2 aria-hidden="true" size={16} />
        </button>
      ) : null}
      <span aria-live="polite" className="sr-only">{message}</span>
    </div>
  );
}
