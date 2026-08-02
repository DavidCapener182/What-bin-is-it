import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowRight, KeyRound, RadioTower, ShieldCheck } from "lucide-react";

import { requestCouncilSignIn, signInCouncilWithPassword } from "@/app/actions";
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
          <span><KeyRound aria-hidden="true" size={18} /> Password or secure-link access</span>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <span className="eyebrow">Authorised staff only</span>
          <h2>Sign in to your council workspace</h2>
          <p>
            {developmentLogin
              ? "Enter your assigned platform-superadmin email to open this local development console."
              : "Use your authorised email and password, or request a one-time secure link."}
          </p>
          {params.sent && !developmentLogin ? (
            <div className="login-confirmation" role="status">
              <strong>Check your inbox.</strong>
              <span>If that address is authorised, a sign-in link is on its way.</span>
            </div>
          ) : null}
          {params.signedOut ? <div className="login-note">You have been signed out safely.</div> : null}
          {params.auth ? (
            <div className="login-error" role="alert">
              {params.auth === "unavailable"
                ? "The secure sign-in service did not respond. Please try your password or request a fresh link."
                : "Could not sign in. Check your details or request a fresh secure link."}
            </div>
          ) : null}
          {developmentLogin ? null : (
            <form action={signInCouncilWithPassword} className="stack-form">
              <label htmlFor="password-email">Authorised email address</label>
              <input
                autoComplete="username"
                id="password-email"
                inputMode="email"
                maxLength={254}
                name="email"
                placeholder="name@council.gov.uk"
                required
                type="email"
              />
              <label htmlFor="password">Password</label>
              <input
                autoComplete="current-password"
                id="password"
                maxLength={256}
                minLength={8}
                name="password"
                placeholder="Your password"
                required
                type="password"
              />
              <button className="primary-button" type="submit">
                Sign in
                <ArrowRight aria-hidden="true" size={18} />
              </button>
            </form>
          )}
          {developmentLogin ? null : <div className="login-divider"><span>or use a secure link</span></div>}
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
              {developmentLogin ? "Open superadmin console" : "Email secure link"}
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
