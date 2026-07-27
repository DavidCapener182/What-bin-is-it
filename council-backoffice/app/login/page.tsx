import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowRight, KeyRound, RadioTower, ShieldCheck } from "lucide-react";

import { requestCouncilSignIn } from "@/app/actions";
import { developmentSuperadminLoginAvailable, getCouncilSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Council staff sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; signedOut?: string; auth?: string }>;
}) {
  if (await getCouncilSession()) redirect("/");
  const params = await searchParams;
  const developmentLogin = await developmentSuperadminLoginAvailable();
  return (
    <main className="login-page">
      <section className="login-intro">
        <div className="login-brand">
          <span className="brand-mark brand-mark-large"><RadioTower aria-hidden="true" size={25} /></span>
          <span>
            <strong>What Bin</strong>
            <small>Council Console</small>
          </span>
        </div>
        <div className="login-statement">
          <span className="eyebrow eyebrow-light">Resident engagement infrastructure</span>
          <h1>Turn service changes into clear resident action.</h1>
          <p>
            Publish verified collection notices, local recycling guidance and missed-bin
            instructions from one private council workspace.
          </p>
        </div>
        <div className="login-trust">
          <span><ShieldCheck aria-hidden="true" size={18} /> Council-scoped permissions</span>
          <span><KeyRound aria-hidden="true" size={18} /> Password-free staff access</span>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <span className="eyebrow">Authorised staff only</span>
          <h2>Sign in to your council workspace</h2>
          <p>
            {developmentLogin
              ? "Enter your assigned platform-superadmin email to open this local development console."
              : "Use the email address already assigned by your What Bin administrator. We will send a one-time secure link."}
          </p>
          {params.sent && !developmentLogin ? (
            <div className="login-confirmation" role="status">
              <strong>Check your inbox.</strong>
              <span>If that address is authorised, a sign-in link is on its way.</span>
            </div>
          ) : null}
          {params.signedOut ? <div className="login-note">You have been signed out safely.</div> : null}
          {params.auth ? <div className="login-error" role="alert">That sign-in link is invalid or expired. Request another below.</div> : null}
          <form action={requestCouncilSignIn} className="stack-form">
            <label htmlFor="email">{developmentLogin ? "Superadmin email address" : "Council email address"}</label>
            <input
              autoComplete="email"
              id="email"
              inputMode="email"
              maxLength={254}
              name="email"
              placeholder={developmentLogin ? "Your superadmin email" : "name@council.gov.uk"}
              required
              type="email"
            />
            <button className="primary-button" type="submit">
              {developmentLogin ? "Open superadmin console" : "Email my secure link"}
              <ArrowRight aria-hidden="true" size={18} />
            </button>
          </form>
          <small className="privacy-note">
            {developmentLogin
              ? "Local access is restricted to localhost, your configured email and a signed development session. Hosted access remains verified."
              : "Responses are deliberately generic. Access is granted only after server-side staff and council membership checks."}
          </small>
        </div>
      </section>
    </main>
  );
}
