"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Check, ChevronLeft, ChevronRight, CloudUpload, Save, ShieldCheck } from "lucide-react";

import { savePartnerAction } from "@/app/actions";
import {
  firstInvalidPartnerWizardStep,
  initialPartnerDraft,
  partnerDraftStorageKey,
  partnerWizardSteps,
  restorePartnerDraft,
  serialisePartnerDraft,
  shouldWarnPartnerWizardBeforeLeave,
  validatePartnerWizardStep,
  type PartnerDraft,
} from "@/lib/partner-wizard";

const categories = ["bulky-waste", "reuse", "electricals", "batteries", "paint", "garden", "bin-cleaning", "replacement-bins", "other"];
const referralModels = ["none", "flat-fee", "commission", "sponsored-placement"];

function humanise(value: string) {
  return value.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function poundValue(pence: string) {
  const value = Number(pence);
  if (!Number.isFinite(value) || value < 0) return "Price confirmed during booking";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value / 100);
}

export function PartnerSetupWizard({
  clearLocalDraft,
  organisationId,
  organisationName,
}: {
  clearLocalDraft: boolean;
  organisationId: string;
  organisationName: string;
}) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<PartnerDraft>(initialPartnerDraft);
  const [dirty, setDirty] = useState(false);
  const [draftMessage, setDraftMessage] = useState<string>();
  const [validationVisible, setValidationVisible] = useState(false);
  const submitting = useRef(false);
  const storageKey = partnerDraftStorageKey(organisationId);
  const validation = useMemo(() => validatePartnerWizardStep(step, draft), [draft, step]);

  useEffect(() => {
    try {
      if (clearLocalDraft) {
        window.localStorage.removeItem(storageKey);
        return;
      }
      const saved = window.localStorage.getItem(storageKey);
      if (!saved) return;
      const restored = restorePartnerDraft(saved);
      if (!restored) {
        window.localStorage.removeItem(storageKey);
        return;
      }
      const timer = window.setTimeout(() => {
        setDraft(restored);
        setDraftMessage("Browser draft restored on this device.");
      }, 0);
      return () => window.clearTimeout(timer);
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, [clearLocalDraft, storageKey]);

  useEffect(() => {
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      if (!shouldWarnPartnerWizardBeforeLeave(dirty, submitting.current)) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [dirty]);

  function update<Key extends keyof PartnerDraft>(key: Key, value: PartnerDraft[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setDraftMessage(undefined);
  }

  function continueToNextStep() {
    setValidationVisible(true);
    if (validation.errors.length) return;
    setStep((current) => Math.min(current + 1, partnerWizardSteps.length - 1));
    setValidationVisible(false);
  }

  function persistBrowserDraft(message: string) {
    try {
      window.localStorage.setItem(storageKey, serialisePartnerDraft(draft));
      setDirty(false);
      setDraftMessage(message);
      return true;
    } catch {
      setDraftMessage("This browser blocked local draft storage. Keep this page open or create the council draft now.");
      return false;
    }
  }

  function saveBrowserDraft() {
    persistBrowserDraft("Saved only in this browser. No council record has been created.");
  }

  function validateSubmission(event: FormEvent<HTMLFormElement>) {
    const firstInvalidStep = firstInvalidPartnerWizardStep(draft);
    if (firstInvalidStep < 0) {
      persistBrowserDraft("Submitting this record to the council workspace.");
      submitting.current = true;
      return;
    }
    event.preventDefault();
    setStep(firstInvalidStep);
    setValidationVisible(true);
  }

  const previewPrice = draft.bookingMode === "stripe-connect" ? poundValue(draft.bookingPricePence) : "Price confirmed with provider";

  return (
    <section className="panel partner-wizard">
      <div className="partner-wizard-heading">
        <div>
          <span className="section-kicker">Guided partner setup</span>
          <h2>Submit a partner for review</h2>
          <p className="form-intro">Activation always requires a separate authorised approval. Work through each section, preview the resident order, then create a council record.</p>
        </div>
        <span className={dirty ? "wizard-save-state wizard-save-state-unsaved" : "wizard-save-state"}>{dirty ? "Unsaved changes" : draftMessage ? "Browser draft available" : "No unsaved changes"}</span>
      </div>

      <ol className="partner-wizard-progress" aria-label="Partner setup progress">
        {partnerWizardSteps.map((item, index) => (
          <li className={index === step ? "current" : index < step ? "complete" : ""} key={item.title}>
            <button onClick={() => setStep(index)} type="button">
              <span>{index < step ? <Check aria-hidden="true" size={15} /> : index + 1}</span>
              <strong>{item.title}</strong>
            </button>
          </li>
        ))}
      </ol>

      <div className="partner-wizard-step-heading">
        <span>Step {step + 1} of {partnerWizardSteps.length}</span>
        <h3>{partnerWizardSteps[step].title}</h3>
        <p>{partnerWizardSteps[step].detail}</p>
      </div>

      {(validationVisible || validation.warnings.length > 0) && (validation.errors.length > 0 || validation.warnings.length > 0) ? (
        <div className={validation.errors.length ? "wizard-validation wizard-validation-error" : "wizard-validation"} role={validation.errors.length ? "alert" : "status"}>
          <strong>{validation.errors.length ? `${validation.errors.length} item${validation.errors.length === 1 ? "" : "s"} to fix` : "Review before approval"}</strong>
          <ul>{[...validation.errors, ...validation.warnings].map((message) => <li key={message}>{message}</li>)}</ul>
        </div>
      ) : null}

      <form action={savePartnerAction} className="stack-form partner-wizard-form" noValidate onSubmit={validateSubmission}>
        <section className="partner-wizard-fields" hidden={step !== 0}>
          <div className="field"><label htmlFor="name">Partner name</label><input id="name" maxLength={160} name="name" onChange={(event) => update("name", event.target.value)} value={draft.name} /></div>
          <div className="field"><label htmlFor="category">Category</label><select id="category" name="category" onChange={(event) => update("category", event.target.value)} value={draft.category}>{categories.map((value) => <option key={value} value={value}>{humanise(value)}</option>)}</select></div>
          <div className="field"><label htmlFor="description">Resident-facing description</label><textarea id="description" maxLength={400} name="description" onChange={(event) => update("description", event.target.value)} value={draft.description} /></div>
          <div className="field"><label htmlFor="serviceUrl">Booking or service URL</label><input id="serviceUrl" inputMode="url" name="serviceUrl" onChange={(event) => update("serviceUrl", event.target.value)} placeholder="https://provider.example/service" type="url" value={draft.serviceUrl} /></div>
        </section>

        <section className="partner-wizard-fields" hidden={step !== 1}>
          <div className="field"><label htmlFor="itemKeys">Relevant item keys, one per line</label><textarea id="itemKeys" name="itemKeys" onChange={(event) => update("itemKeys", event.target.value)} placeholder={"mattress\nbed-frame"} value={draft.itemKeys} /><small>Use the same item keys as the resident Guide so the service appears only for relevant searches.</small></div>
          <div className="field"><label htmlFor="supportedAreaLabels">Supported wards, rounds or area labels</label><textarea id="supportedAreaLabels" name="supportedAreaLabels" onChange={(event) => update("supportedAreaLabels", event.target.value)} placeholder={"Huyton North\nRound A12"} value={draft.supportedAreaLabels} /><small>Leave blank only when the service covers all of {organisationName}.</small></div>
        </section>

        <section className="partner-wizard-fields" hidden={step !== 2}>
          <div className="field-grid">
            <div className="field field-span"><label htmlFor="licenceReference">Waste-carrier or licence reference</label><input id="licenceReference" maxLength={120} name="licenceReference" onChange={(event) => update("licenceReference", event.target.value)} value={draft.licenceReference} /></div>
            <div className="field"><label htmlFor="evidenceUrl">Licence or evidence link</label><input id="evidenceUrl" inputMode="url" name="evidenceUrl" onChange={(event) => update("evidenceUrl", event.target.value)} type="url" value={draft.evidenceUrl} /></div>
            <div className="field"><label htmlFor="complaintContact">Resident complaint contact</label><input id="complaintContact" maxLength={160} name="complaintContact" onChange={(event) => update("complaintContact", event.target.value)} placeholder="support@provider.example" value={draft.complaintContact} /></div>
            <div className="field"><label htmlFor="renewalReviewAt">Compliance renewal review</label><input id="renewalReviewAt" name="renewalReviewAt" onChange={(event) => update("renewalReviewAt", event.target.value)} type="date" value={draft.renewalReviewAt} /></div>
          </div>
          <div className="wizard-compliance-note"><ShieldCheck aria-hidden="true" size={19} /><p>Evidence is recorded for council review. A saved listing still cannot become visible until an authorised approver activates it.</p></div>
        </section>

        <section className="partner-wizard-fields" hidden={step !== 3}>
          <div className="field-grid">
            <div className="field"><label htmlFor="disclosureLabel">Resident disclosure</label><input id="disclosureLabel" maxLength={80} name="disclosureLabel" onChange={(event) => update("disclosureLabel", event.target.value)} value={draft.disclosureLabel} /></div>
            <div className="field"><label htmlFor="referralModel">Commercial model</label><select id="referralModel" name="referralModel" onChange={(event) => update("referralModel", event.target.value)} value={draft.referralModel}>{referralModels.map((value) => <option key={value} value={value}>{humanise(value)}</option>)}</select></div>
            <div className="field"><label htmlFor="commissionPence">Commission (pence)</label><input id="commissionPence" min={0} name="commissionPence" onChange={(event) => update("commissionPence", event.target.value)} type="number" value={draft.commissionPence} /></div>
            <div className="field"><label htmlFor="bookingMode">Booking route</label><select id="bookingMode" name="bookingMode" onChange={(event) => update("bookingMode", event.target.value)} value={draft.bookingMode}><option value="none">Listing only</option><option value="external-referral">Tracked provider referral</option><option value="stripe-connect">In-app Stripe checkout</option></select></div>
            <div className="field"><label htmlFor="bookingPricePence">Fixed item price (pence)</label><input id="bookingPricePence" max={1000000} min={100} name="bookingPricePence" onChange={(event) => update("bookingPricePence", event.target.value)} type="number" value={draft.bookingPricePence} /><small>Required for in-app checkout and multiplied by quantity.</small></div>
            <div className="field"><label htmlFor="platformFeePence">What Bin fee per item (pence)</label><input id="platformFeePence" max={100000} min={0} name="platformFeePence" onChange={(event) => update("platformFeePence", event.target.value)} type="number" value={draft.platformFeePence} /><small>Recognised only after signed payment confirmation.</small></div>
            <div className="field"><label htmlFor="stripeAccountId">Stripe connected account</label><input id="stripeAccountId" maxLength={255} name="stripeAccountId" onChange={(event) => update("stripeAccountId", event.target.value)} placeholder="acct_..." value={draft.stripeAccountId} /></div>
            <div className="field"><label htmlFor="providerAcceptanceSlaHours">Provider response window (hours)</label><input id="providerAcceptanceSlaHours" max={168} min={1} name="providerAcceptanceSlaHours" onChange={(event) => update("providerAcceptanceSlaHours", event.target.value)} type="number" value={draft.providerAcceptanceSlaHours} /></div>
            <div className="field field-span"><label htmlFor="termsUrl">Booking terms</label><input id="termsUrl" inputMode="url" name="termsUrl" onChange={(event) => update("termsUrl", event.target.value)} type="url" value={draft.termsUrl} /></div>
            <div className="field field-span"><label htmlFor="budgetPence">Campaign budget (pence)</label><input id="budgetPence" min={0} name="budgetPence" onChange={(event) => update("budgetPence", event.target.value)} type="number" value={draft.budgetPence} /></div>
          </div>
        </section>

        <section className="partner-wizard-fields" hidden={step !== 4}>
          <div className="resident-service-preview" aria-label="Resident service order preview">
            <div className="resident-preview-title"><span>Resident Guide preview</span><strong>{draft.itemKeys.split("\n").find((value) => value.trim()) || "Selected item"}</strong><small>Free and public-service routes are never displaced by payment.</small></div>
            <article><span className="resident-preview-rank">1</span><div><strong>Official {organisationName} service</strong><small>Free council option shown first when available</small></div><span className="resident-preview-badge">Official</span></article>
            <article><span className="resident-preview-rank">2</span><div><strong>Charity or reuse service</strong><small>Free reuse option shown before a paid provider</small></div><span className="resident-preview-badge">Reuse</span></article>
            <article className="resident-preview-sponsored"><span className="resident-preview-rank">3</span><div><strong>{draft.name || "Partner service"}</strong><small>{draft.description || "The resident-facing description will appear here."}</small><b>{previewPrice}</b></div><span className="resident-preview-badge">{draft.disclosureLabel || "Sponsored"}</span></article>
          </div>
        </section>

        <section className="partner-wizard-fields" hidden={step !== 5}>
          <div className="field-grid">
            <div className="field"><label htmlFor="priority">Order after council options</label><input id="priority" max={1000} min={1} name="priority" onChange={(event) => update("priority", event.target.value)} type="number" value={draft.priority} /></div>
            <div className="field"><label htmlFor="startsAt">Campaign starts</label><input id="startsAt" name="startsAt" onChange={(event) => update("startsAt", event.target.value)} type="datetime-local" value={draft.startsAt} /></div>
            <div className="field"><label htmlFor="endsAt">Campaign ends</label><input id="endsAt" name="endsAt" onChange={(event) => update("endsAt", event.target.value)} type="datetime-local" value={draft.endsAt} /></div>
          </div>
          <div className="wizard-review-summary">
            <CloudUpload aria-hidden="true" size={22} />
            <div><strong>Ready to create a {organisationName} record</strong><p>Create draft keeps the listing out of the resident app. Send for review enters the independent approval queue; neither action activates it.</p></div>
          </div>
        </section>

        <div className="partner-wizard-actions">
          <button className="secondary-button" disabled={step === 0} onClick={() => { setStep((current) => Math.max(0, current - 1)); setValidationVisible(false); }} type="button"><ChevronLeft aria-hidden="true" size={17} /> Previous</button>
          <button className="secondary-button" onClick={saveBrowserDraft} type="button"><Save aria-hidden="true" size={17} /> Save browser draft</button>
          {step < partnerWizardSteps.length - 1 ? <button className="primary-button" onClick={continueToNextStep} type="button">Continue <ChevronRight aria-hidden="true" size={17} /></button> : <><button className="secondary-button" name="status" type="submit" value="draft">Create council draft</button><button className="primary-button" name="status" type="submit" value="review">Send for review <ChevronRight aria-hidden="true" size={17} /></button></>}
        </div>
        {draftMessage ? <p className="wizard-draft-message" role="status">{draftMessage}</p> : null}
        <p className="wizard-local-note">Browser drafts stay only on this device and are not suitable for shared computers. They do not create a council record, reserve a campaign or enter the approval queue.</p>
      </form>
    </section>
  );
}
