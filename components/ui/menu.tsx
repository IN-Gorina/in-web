"use client";

import { useCallback, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { cn } from "@/lib/cn";

import { Icon, type IconName } from "./icon";
import { useDismiss } from "./use-dismiss";

export type MenuEntry =
  | {
      type?: "item";
      label: string;
      icon?: IconName;
      tone?: "default" | "danger";
      /** Shows a check on the right (current role, selected filter). */
      checked?: boolean;
      disabled?: boolean;
      onSelect: () => void;
    }
  | { type: "separator" }
  | { type: "header"; label: ReactNode };

type Placement = "bottom-end" | "bottom-start" | "top-start";

const placements: Record<Placement, string> = {
  "bottom-end": "right-0 top-full mt-1.5",
  "bottom-start": "left-0 top-full mt-1.5",
  "top-start": "bottom-full left-0 mb-2",
};

/**
 * Dropdown menu anchored to its trigger. `trigger` receives the props it must spread on
 * the button that opens it (aria attributes and the click handler).
 */
export function Menu({
  trigger,
  items,
  placement = "bottom-end",
  width = 252,
  className,
}: {
  trigger: (props: {
    "aria-haspopup": "menu";
    "aria-expanded": boolean;
    "aria-controls": string;
    onClick: (event: React.MouseEvent<HTMLElement>) => void;
  }) => ReactNode;
  items: MenuEntry[];
  placement?: Placement;
  width?: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  // Open upward when there isn't room below the trigger.
  const toggle = (event: React.MouseEvent<HTMLElement>) => {
    if (!open && placement.startsWith("bottom")) {
      const rect = event.currentTarget.getBoundingClientRect();
      const estimated = items.length * 40 + 24;
      setFlipped(rect.bottom + estimated > window.innerHeight && rect.top > estimated);
    }
    setOpen((value) => !value);
  };

  const focusItem = (direction: 1 | -1) => {
    const buttons = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]:not(:disabled)") ?? []);
    if (buttons.length === 0) return;
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = current === -1 ? (direction === 1 ? 0 : buttons.length - 1) : (current + direction + buttons.length) % buttons.length;
    buttons[next]!.focus();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusItem(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusItem(-1);
    }
  };

  return (
    // Clicks inside the menu never reach a clickable parent (e.g. a table row that opens a drawer).
    <div ref={ref} className={cn("relative", className)} onKeyDown={onKeyDown} onClick={(event) => event.stopPropagation()}>
      {trigger({
        "aria-haspopup": "menu",
        "aria-expanded": open,
        "aria-controls": id,
        onClick: toggle,
      })}
      {open && (
        <div
          ref={listRef}
          id={id}
          role="menu"
          style={{ width }}
          className={cn(
            "absolute z-30 flex flex-col rounded-[14px] border border-line bg-white p-1.5 shadow-menu",
            flipped ? (placement === "bottom-end" ? "bottom-full right-0 mb-1.5" : "bottom-full left-0 mb-1.5") : placements[placement],
          )}
        >
          {items.map((item, index) => {
            if (item.type === "separator") return <div key={index} role="separator" className="my-1 h-px shrink-0 bg-line" />;
            if (item.type === "header")
              return (
                <div key={index} className="px-2.5 pb-2.5 pt-2">
                  {item.label}
                </div>
              );
            return (
              <button
                key={index}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  close();
                  item.onSelect();
                }}
                className={cn(
                  "flex h-10 shrink-0 items-center gap-2.5 rounded-sm px-2.5 text-left text-label font-semibold transition-colors hover:bg-field focus:bg-field focus:outline-none disabled:opacity-40",
                  item.tone === "danger" ? "text-danger" : "text-ink",
                )}
              >
                {item.icon && (
                  <Icon name={item.icon} size={18} className={item.tone === "danger" ? "text-danger" : "text-ink-muted"} />
                )}
                <span className="flex-1">{item.label}</span>
                {item.checked && <Icon name="check" size={16} strokeWidth={3} className="text-elite-blue" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
