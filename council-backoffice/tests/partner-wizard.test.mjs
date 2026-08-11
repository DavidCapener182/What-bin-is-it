import assert from "node:assert/strict";
import test from "node:test";

import {
  firstInvalidPartnerWizardStep,
  initialPartnerDraft,
  partnerDraftStorageKey,
  restorePartnerDraft,
  serialisePartnerDraft,
  shouldWarnPartnerWizardBeforeLeave,
  validatePartnerWizardStep,
} from "../lib/partner-wizard.ts";

function draftWith(overrides = {}) {
  return {
    ...initialPartnerDraft,
    name: "EcoClear Liverpool",
    description: "A licensed bulky-waste collection service.",
    serviceUrl: "https://provider.example/book",
    itemKeys: "mattress",
    licenceReference: "CBDU123456",
    complaintContact: "support@provider.example",
    renewalReviewAt: "2027-08-01",
    ...overrides,
  };
}

test("service and item steps block incomplete or insecure partner details", () => {
  assert.deepEqual(validatePartnerWizardStep(0, initialPartnerDraft).errors, [
    "Add the partner name.",
    "Add the resident-facing description.",
    "Add a secure https booking or service URL.",
  ]);

  assert.deepEqual(validatePartnerWizardStep(0, draftWith({ serviceUrl: "http://provider.example/book" })).errors, [
    "Add a secure https booking or service URL.",
  ]);
  assert.deepEqual(validatePartnerWizardStep(0, draftWith()).errors, []);
  assert.deepEqual(validatePartnerWizardStep(1, draftWith({ itemKeys: "\n  \n" })).errors, [
    "Add at least one resident guide item key.",
  ]);
});

test("Stripe Connect validation blocks database-required fields and keeps terms as an activation warning", () => {
  const incompleteCheckout = validatePartnerWizardStep(3, draftWith({
    bookingMode: "stripe-connect",
    bookingPricePence: "",
    platformFeePence: "",
    stripeAccountId: "",
    termsUrl: "",
  }));

  assert.deepEqual(incompleteCheckout.errors, [
    "Add a fixed item price for in-app checkout.",
    "Add a What Bin fee for in-app checkout.",
    "Add the Stripe connected-account ID for in-app checkout.",
  ]);
  assert.deepEqual(incompleteCheckout.warnings, [
    "Booking terms are required before in-app checkout can be activated.",
  ]);

  const invalidCheckout = validatePartnerWizardStep(3, draftWith({
    bookingMode: "stripe-connect",
    bookingPricePence: "99",
    platformFeePence: "100",
    stripeAccountId: "not-a-stripe-account",
    termsUrl: "http://provider.example/terms",
    providerAcceptanceSlaHours: "169",
  }));
  assert.deepEqual(invalidCheckout.errors, [
    "Provider response time must be between 1 and 168 hours.",
    "The booking terms link must use https.",
    "Fixed item price must be a whole number between 100 and 1,000,000 pence.",
    "The Stripe connected-account ID is not valid.",
  ]);

  const excessiveFee = validatePartnerWizardStep(3, draftWith({
    bookingMode: "stripe-connect",
    bookingPricePence: "2500",
    platformFeePence: "2501",
    stripeAccountId: "acct_12345678",
    termsUrl: "https://provider.example/terms",
  }));
  assert.deepEqual(excessiveFee.errors, ["What Bin fee cannot be more than the fixed item price."]);

  const fractionalFee = validatePartnerWizardStep(3, draftWith({
    bookingMode: "stripe-connect",
    bookingPricePence: "2500",
    platformFeePence: "125.5",
    stripeAccountId: "acct_12345678",
    termsUrl: "https://provider.example/terms",
  }));
  assert.deepEqual(fractionalFee.errors, [
    "What Bin fee must be a whole number between 0 and 100,000 pence.",
  ]);
});

test("approval validation catches invalid ordering and campaign chronology", () => {
  const result = validatePartnerWizardStep(5, draftWith({
    priority: "0",
    startsAt: "2027-08-02T12:00",
    endsAt: "2027-08-02T11:59",
    renewalReviewAt: "",
  }));

  assert.deepEqual(result.errors, [
    "Display order must be between 1 and 1,000.",
    "The campaign end must be after its start.",
  ]);
  assert.deepEqual(result.warnings, ["No renewal-review date is set."]);
  assert.equal(firstInvalidPartnerWizardStep(initialPartnerDraft), 0);
  assert.equal(firstInvalidPartnerWizardStep(draftWith()), -1);
});

test("browser drafts are council scoped, safely restored, and forward compatible", () => {
  assert.equal(partnerDraftStorageKey("knowsley"), "what-bin-partner-wizard:knowsley");
  assert.notEqual(partnerDraftStorageKey("knowsley"), partnerDraftStorageKey("sefton"));

  const saved = draftWith({ name: "Verified Partner", priority: "25" });
  assert.deepEqual(restorePartnerDraft(serialisePartnerDraft(saved)), saved);

  const partial = restorePartnerDraft(JSON.stringify({
    name: "Restored Partner",
    priority: 42,
    unknownField: "must not be restored",
  }));
  assert.equal(partial?.name, "Restored Partner");
  assert.equal(partial?.priority, initialPartnerDraft.priority);
  assert.equal(partial?.category, initialPartnerDraft.category);
  assert.equal(Object.hasOwn(partial ?? {}, "unknownField"), false);

  assert.equal(restorePartnerDraft("not-json"), undefined);
  assert.equal(restorePartnerDraft("[]"), undefined);
});

test("leave warnings apply only to unsaved work that is not being submitted", () => {
  assert.equal(shouldWarnPartnerWizardBeforeLeave(false, false), false);
  assert.equal(shouldWarnPartnerWizardBeforeLeave(false, true), false);
  assert.equal(shouldWarnPartnerWizardBeforeLeave(true, true), false);
  assert.equal(shouldWarnPartnerWizardBeforeLeave(true, false), true);
});
