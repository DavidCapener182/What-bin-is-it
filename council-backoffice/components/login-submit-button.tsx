"use client";

import { ArrowRight, LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

export function LoginSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button aria-disabled={pending} className="primary-button" disabled={pending} type="submit">
      {pending ? "Signing in…" : "Sign in"}
      {pending
        ? <LoaderCircle aria-hidden="true" className="button-spinner" size={18} />
        : <ArrowRight aria-hidden="true" size={18} />}
    </button>
  );
}
