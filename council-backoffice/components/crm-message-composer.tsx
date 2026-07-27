"use client";

import { useMemo, useState } from "react";

import { saveCrmMessageAction } from "@/app/actions";
import type { CrmAccountType, CrmMessage } from "@/lib/types";

type ComposeAccount = {
  id: string;
  name: string;
  accountType: CrmAccountType;
};

type ComposeContact = {
  id: string;
  accountId: string;
  accountName: string;
  fullName: string;
  doNotContact: boolean;
};

function inputDateTime() {
  const value = new Date();
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

const deliveryStatuses: Record<CrmMessage["direction"], CrmMessage["deliveryStatus"][]> = {
  sent: ["sent", "delivered", "draft", "failed"],
  received: ["received", "read"],
  internal: ["read"],
};

export function CrmMessageComposer({
  accounts,
  contacts,
  initialAccountId,
}: {
  accounts: ComposeAccount[];
  contacts: ComposeContact[];
  initialAccountId?: string;
}) {
  const initialAccount = accounts.some((account) => account.id === initialAccountId)
    ? initialAccountId!
    : accounts[0]?.id ?? "";
  const [accountId, setAccountId] = useState(initialAccount);
  const [direction, setDirection] = useState<CrmMessage["direction"]>("sent");
  const availableContacts = useMemo(
    () => contacts.filter((contact) => contact.accountId === accountId),
    [accountId, contacts],
  );

  return (
    <form action={saveCrmMessageAction} className="stack-form">
      <div className="field-grid">
        <div className="field">
          <label htmlFor="messageAccountId">Organisation</label>
          <select
            id="messageAccountId"
            name="accountId"
            onChange={(event) => setAccountId(event.target.value)}
            required
            value={accountId}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>{account.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="messageContactId">Contact</label>
          <select id="messageContactId" key={accountId} name="contactId">
            <option value="">Organisation-level</option>
            {availableContacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.fullName}{contact.doNotContact ? " — DO NOT CONTACT" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="messageDirection">Direction</label>
          <select
            id="messageDirection"
            name="direction"
            onChange={(event) => setDirection(event.target.value as CrmMessage["direction"])}
            value={direction}
          >
            <option value="sent">Sent</option>
            <option value="received">Received</option>
            <option value="internal">Internal note</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="messageChannel">Channel</label>
          <select defaultValue="email" id="messageChannel" name="channel">
            <option value="email">Email</option>
            <option value="phone">Phone</option>
            <option value="sms">SMS</option>
            <option value="linkedin">LinkedIn</option>
            <option value="meeting">Meeting</option>
            <option value="note">Internal note</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="messageOccurredAt">Date and time</label>
          <input defaultValue={inputDateTime()} id="messageOccurredAt" name="occurredAt" required type="datetime-local" />
        </div>
        <div className="field">
          <label htmlFor="messageDeliveryStatus">Status</label>
          <select id="messageDeliveryStatus" key={direction} name="deliveryStatus">
            {deliveryStatuses[direction].map((status) => (
              <option key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="senderAddress">From</label>
          <input id="senderAddress" maxLength={320} name="senderAddress" placeholder="Email, phone number or name" />
        </div>
        <div className="field">
          <label htmlFor="recipientAddresses">To</label>
          <input
            id="recipientAddresses"
            maxLength={1_500}
            name="recipientAddresses"
            placeholder={direction === "sent" ? "Recipient email or name" : "Optional recipients"}
            required={direction === "sent"}
          />
          <span className="help-text">Separate multiple recipients with commas.</span>
        </div>
        <div className="field field-span">
          <label htmlFor="messageSubject">Subject</label>
          <input id="messageSubject" maxLength={300} name="subject" required />
        </div>
        <div className="field field-span">
          <label htmlFor="messageBody">Message or conversation record</label>
          <textarea id="messageBody" maxLength={20_000} name="body" required rows={8} />
          <span className="help-text">Business correspondence only. Do not paste resident service records or sensitive personal information.</span>
        </div>
        <div className="field">
          <label htmlFor="attachmentNames">Attachments</label>
          <input id="attachmentNames" maxLength={1_500} name="attachmentNames" placeholder="proposal.pdf, pricing.xlsx" />
          <span className="help-text">Names only; files are not uploaded here.</span>
        </div>
        <div className="field">
          <label htmlFor="externalMessageId">External message ID</label>
          <input id="externalMessageId" maxLength={500} name="externalMessageId" />
          <span className="help-text">Optional ID from an email or messaging provider.</span>
        </div>
      </div>
      <button className="primary-button" type="submit">Save correspondence</button>
    </form>
  );
}
