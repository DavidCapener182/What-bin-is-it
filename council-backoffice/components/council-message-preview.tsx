"use client";

import { AlertTriangle, Bell, CalendarDays, Smartphone } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type PreviewState = {
  title: string;
  body: string;
  sourceUrl: string;
  endsAt: string;
  audienceScope: string;
  collectionTypes: string[];
  collectionDates: string[];
  audienceLabels: string[];
};

const initial: PreviewState = {
  title: "Collection service update",
  body: "Verified council information will appear here.",
  sourceUrl: "",
  endsAt: "",
  audienceScope: "council",
  collectionTypes: [],
  collectionDates: [],
  audienceLabels: [],
};

function lines(value: FormDataEntryValue | null) {
  return String(value ?? "").split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
}

export function CouncilMessagePreview({
  formId,
  councilName,
  mode,
  existingTitles = [],
}: {
  formId: string;
  councilName: string;
  mode: "announcement" | "disruption";
  existingTitles?: string[];
}) {
  const [preview, setPreview] = useState(initial);
  const [recipientEstimate, setRecipientEstimate] = useState<number>();
  const [estimateState, setEstimateState] = useState<"idle" | "loading" | "unavailable">("idle");
  const incompleteTarget = preview.audienceScope === "targeted"
    && !preview.collectionTypes.length
    && !preview.collectionDates.length
    && !preview.audienceLabels.length;

  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    const read = () => {
      const data = new FormData(form);
      const title = String(data.get("title") ?? "").trim();
      const detail = String(data.get(mode === "announcement" ? "body" : "residentInstruction") ?? "").trim();
      setPreview({
        title: title || initial.title,
        body: detail || initial.body,
        sourceUrl: String(data.get("sourceUrl") ?? "").trim(),
        endsAt: String(data.get("endsAt") ?? "").trim(),
        audienceScope: String(data.get("audienceScope") ?? "council"),
        collectionTypes: data.getAll("audienceCollectionTypes").map(String),
        collectionDates: lines(data.get("audienceCollectionDates")),
        audienceLabels: lines(data.get("audienceLabels")),
      });
    };
    read();
    form.addEventListener("input", read);
    form.addEventListener("change", read);
    return () => {
      form.removeEventListener("input", read);
      form.removeEventListener("change", read);
    };
  }, [formId, mode]);

  useEffect(() => {
    if (incompleteTarget) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setEstimateState("loading");
      try {
        const response = await fetch("/api/audience-estimate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scope: preview.audienceScope,
            collectionTypes: preview.collectionTypes,
            collectionDates: preview.collectionDates,
            audienceLabels: preview.audienceLabels,
          }),
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("estimate unavailable");
        const result = await response.json() as { estimatedRecipientCount?: unknown };
        if (typeof result.estimatedRecipientCount !== "number") throw new Error("estimate unavailable");
        setRecipientEstimate(result.estimatedRecipientCount);
        setEstimateState("idle");
      } catch {
        if (controller.signal.aborted) return;
        setRecipientEstimate(undefined);
        setEstimateState("unavailable");
      }
    }, 350);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [incompleteTarget, preview.audienceLabels, preview.audienceScope, preview.collectionDates, preview.collectionTypes]);

  const warnings = useMemo(() => {
    const items: string[] = [];
    if (preview.title.length > 50) items.push("The push title may truncate on smaller phones.");
    if (preview.body.length > 120) items.push("The push body may truncate; the full message remains in Activity.");
    if (!preview.sourceUrl) items.push("Add an official source before publishing when one is available.");
    if (!preview.endsAt) items.push("No expiry is set; remember to archive this message manually.");
    if (preview.audienceScope === "council") items.push("Push will go to the whole opted-in council audience.");
    if (existingTitles.some((title) => title.toLowerCase() === preview.title.toLowerCase())) {
      items.push("A message with this title already exists. Check for a duplicate.");
    }
    return items;
  }, [existingTitles, preview]);

  return (
    <section aria-label="Resident message preview" className="panel message-preview-panel">
      <div className="message-preview-heading">
        <div>
          <span className="eyebrow">Publish preview</span>
          <h2>Resident experience</h2>
        </div>
        <Smartphone aria-hidden="true" size={22} />
      </div>
      <div className="message-preview-grid">
        <article className="push-preview">
          <div className="push-preview-top"><span className="preview-app-icon"><Bell aria-hidden="true" size={15} /></span><strong>What Bin?</strong><span>now</span></div>
          <strong>{preview.title}</strong>
          <p>{preview.body}</p>
        </article>
        <article className="surface-preview">
          <span>Today banner</span>
          <strong>{preview.title}</strong>
          <p>{preview.body}</p>
          <small>{councilName} · Updated now</small>
        </article>
        <article className="surface-preview activity-preview">
          <span>Activity</span>
          <div><CalendarDays aria-hidden="true" size={18} /><strong>{preview.title}</strong></div>
          <p>{preview.body}</p>
        </article>
        <article className="widget-preview">
          <span>Widget note</span>
          <strong>{preview.title}</strong>
          <small>Opens Activity for the full verified message</small>
        </article>
      </div>
      <div className="audience-estimate" aria-live="polite">
        <span>Estimated opted-in audience</span>
        <strong>{incompleteTarget ? "Choose a target" : estimateState === "loading" ? "Checking…" : recipientEstimate === undefined ? "Not available" : recipientEstimate.toLocaleString("en-GB")}</strong>
        <small>This is a live installation estimate, not a guaranteed delivery count.</small>
      </div>
      {warnings.length ? (
        <div className="preview-warning-list">
          {warnings.map((warning) => <p key={warning}><AlertTriangle aria-hidden="true" size={15} />{warning}</p>)}
        </div>
      ) : <p className="preview-ready">Message length, source, expiry and audience checks are ready.</p>}
    </section>
  );
}
