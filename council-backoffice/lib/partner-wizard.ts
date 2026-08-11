export const partnerWizardSteps = [
  { title: "Service details", detail: "Describe the organisation and the resident service." },
  { title: "Areas and items", detail: "Choose when and where this listing is relevant." },
  { title: "Compliance evidence", detail: "Record the evidence and resident complaint route." },
  { title: "Price and payment", detail: "Set the commercial model and booking route." },
  { title: "Resident preview", detail: "Check the exact service order and disclosure." },
  { title: "Approval and activation", detail: "Set campaign dates, then create a draft or send for review." },
] as const;

export type PartnerDraft = {
  name: string;
  category: string;
  description: string;
  serviceUrl: string;
  itemKeys: string;
  supportedAreaLabels: string;
  disclosureLabel: string;
  referralModel: string;
  commissionPence: string;
  bookingMode: string;
  bookingPricePence: string;
  platformFeePence: string;
  stripeAccountId: string;
  providerAcceptanceSlaHours: string;
  termsUrl: string;
  priority: string;
  licenceReference: string;
  evidenceUrl: string;
  complaintContact: string;
  budgetPence: string;
  renewalReviewAt: string;
  startsAt: string;
  endsAt: string;
};

export const initialPartnerDraft: PartnerDraft = {
  name: "",
  category: "bulky-waste",
  description: "",
  serviceUrl: "",
  itemKeys: "",
  supportedAreaLabels: "",
  disclosureLabel: "Sponsored partner",
  referralModel: "none",
  commissionPence: "",
  bookingMode: "external-referral",
  bookingPricePence: "",
  platformFeePence: "",
  stripeAccountId: "",
  providerAcceptanceSlaHours: "24",
  termsUrl: "",
  priority: "100",
  licenceReference: "",
  evidenceUrl: "",
  complaintContact: "",
  budgetPence: "",
  renewalReviewAt: "",
  startsAt: "",
  endsAt: "",
};

function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function validatePartnerWizardStep(step: number, draft: PartnerDraft) {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (step === 0) {
    if (!draft.name.trim()) errors.push("Add the partner name.");
    if (!draft.description.trim()) errors.push("Add the resident-facing description.");
    if (!isHttpsUrl(draft.serviceUrl)) errors.push("Add a secure https booking or service URL.");
  }
  if (step === 1 && !draft.itemKeys.split("\n").some((value) => value.trim())) {
    errors.push("Add at least one resident guide item key.");
  }
  if (step === 2) {
    if (!draft.licenceReference.trim() && !draft.evidenceUrl.trim()) warnings.push("No waste-carrier or compliance evidence is recorded yet.");
    if (draft.evidenceUrl && !isHttpsUrl(draft.evidenceUrl)) errors.push("The evidence link must use https.");
    if (!draft.complaintContact.trim()) warnings.push("Add a complaint route before approval.");
  }
  if (step === 3) {
    const sla = Number(draft.providerAcceptanceSlaHours);
    const commission = draft.commissionPence ? Number(draft.commissionPence) : undefined;
    const bookingPrice = draft.bookingPricePence ? Number(draft.bookingPricePence) : undefined;
    const platformFee = draft.platformFeePence ? Number(draft.platformFeePence) : undefined;
    const budget = draft.budgetPence ? Number(draft.budgetPence) : undefined;
    const validBookingPrice = bookingPrice !== undefined
      && Number.isInteger(bookingPrice)
      && bookingPrice >= 100
      && bookingPrice <= 1000000;
    const validPlatformFee = platformFee !== undefined
      && Number.isInteger(platformFee)
      && platformFee >= 0
      && platformFee <= 100000;
    if (!Number.isInteger(sla) || sla < 1 || sla > 168) errors.push("Provider response time must be between 1 and 168 hours.");
    if (!draft.disclosureLabel.trim()) errors.push("Add the resident sponsorship disclosure.");
    if (draft.termsUrl && !isHttpsUrl(draft.termsUrl)) errors.push("The booking terms link must use https.");
    if (commission !== undefined && (!Number.isInteger(commission) || commission < 0 || commission > 100000)) errors.push("Commission must be a whole number between 0 and 100,000 pence.");
    if (bookingPrice !== undefined && !validBookingPrice) errors.push("Fixed item price must be a whole number between 100 and 1,000,000 pence.");
    if (platformFee !== undefined && !validPlatformFee) errors.push("What Bin fee must be a whole number between 0 and 100,000 pence.");
    if (validBookingPrice && validPlatformFee && platformFee > bookingPrice) errors.push("What Bin fee cannot be more than the fixed item price.");
    if (budget !== undefined && (!Number.isInteger(budget) || budget < 0 || budget > 100000000)) errors.push("Campaign budget must be a whole number between 0 and 100,000,000 pence.");
    if (draft.stripeAccountId && !draft.stripeAccountId.match(/^acct_[A-Za-z0-9]{8,}$/)) errors.push("The Stripe connected-account ID is not valid.");
    if (draft.bookingMode === "stripe-connect") {
      if (bookingPrice === undefined) errors.push("Add a fixed item price for in-app checkout.");
      if (platformFee === undefined) errors.push("Add a What Bin fee for in-app checkout.");
      if (!draft.stripeAccountId) errors.push("Add the Stripe connected-account ID for in-app checkout.");
      if (!draft.termsUrl) warnings.push("Booking terms are required before in-app checkout can be activated.");
    }
  }
  if (step === 5) {
    const priority = Number(draft.priority);
    if (!Number.isInteger(priority) || priority < 1 || priority > 1000) errors.push("Display order must be between 1 and 1,000.");
    if (draft.startsAt && draft.endsAt && new Date(draft.endsAt) <= new Date(draft.startsAt)) errors.push("The campaign end must be after its start.");
    if (!draft.renewalReviewAt) warnings.push("No renewal-review date is set.");
  }

  return { errors, warnings };
}

export function firstInvalidPartnerWizardStep(draft: PartnerDraft) {
  return partnerWizardSteps.findIndex((_, step) => validatePartnerWizardStep(step, draft).errors.length > 0);
}

export function partnerDraftStorageKey(organisationId: string) {
  return `what-bin-partner-wizard:${organisationId}`;
}

export function serialisePartnerDraft(draft: PartnerDraft) {
  return JSON.stringify(draft);
}

export function restorePartnerDraft(raw: string): PartnerDraft | undefined {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;

    const restored = { ...initialPartnerDraft };
    for (const key of Object.keys(initialPartnerDraft) as Array<keyof PartnerDraft>) {
      const value = (parsed as Record<string, unknown>)[key];
      if (typeof value === "string") restored[key] = value;
    }
    return restored;
  } catch {
    return undefined;
  }
}

export function shouldWarnPartnerWizardBeforeLeave(dirty: boolean, submitting: boolean) {
  return dirty && !submitting;
}
