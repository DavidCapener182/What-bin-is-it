"use client";

import { X } from "lucide-react";
import { useId, useRef, type ReactNode } from "react";

export function OperationalDrawer({
  children,
  description,
  title,
  triggerLabel,
  triggerStyle = "secondary",
  wide = false,
}: {
  children: ReactNode;
  description?: string;
  title: string;
  triggerLabel: string;
  triggerStyle?: "primary" | "secondary" | "text";
  wide?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  function open() {
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  return (
    <>
      <button
        className={triggerStyle === "text" ? "queue-text-action" : `${triggerStyle}-button button-small`}
        onClick={open}
        ref={triggerRef}
        type="button"
      >
        {triggerLabel}
      </button>
      <dialog
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        className={`operational-drawer${wide ? " operational-drawer-wide" : ""}`}
        onClose={() => triggerRef.current?.focus()}
        onClick={(event) => {
          if (event.target === dialogRef.current) close();
        }}
        ref={dialogRef}
      >
        <div className="operational-drawer-panel">
          <header className="operational-drawer-header">
            <div>
              <h2 id={titleId}>{title}</h2>
              {description ? <p id={descriptionId}>{description}</p> : null}
            </div>
            <button aria-label={`Close ${title}`} className="icon-button" onClick={close} type="button">
              <X aria-hidden="true" size={20} />
            </button>
          </header>
          <div className="operational-drawer-body">{children}</div>
        </div>
      </dialog>
    </>
  );
}
