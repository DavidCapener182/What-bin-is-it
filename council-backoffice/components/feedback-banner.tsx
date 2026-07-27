export function FeedbackBanner({
  error,
  saved,
}: {
  error?: string;
  saved?: string;
}) {
  if (!error && !saved) return null;
  return (
    <div
      aria-live="polite"
      className={`feedback-banner ${error ? "feedback-error" : "feedback-success"}`}
      role={error ? "alert" : "status"}
    >
      {error ?? saved}
    </div>
  );
}
