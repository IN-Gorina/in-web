"use client";

import { useId, useMemo, useRef, useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { useDismiss } from "@/components/ui/use-dismiss";
import { cn } from "@/lib/cn";

/** The few member fields pickers and forms need on the client. */
export type MemberOption = {
  id: string;
  name: string;
  category?: string;
  phone?: string;
  email?: string;
  blocked: boolean;
};

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/**
 * Pick a member by name, phone or email. Once picked, shows the blue card with "Cambiar"
 * (Paper "Nueva reserva · A nombre de").
 */
export function MemberPicker({
  members,
  value,
  onChange,
  label = "Buscar socio",
  invalid,
}: {
  members: MemberOption[];
  value: string | null;
  onChange: (id: string | null) => void;
  label?: string;
  invalid?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const listId = useId();
  useDismiss(ref, open, () => setOpen(false));

  const selected = members.find((member) => member.id === value);
  const results = useMemo(() => {
    const q = normalize(query.trim());
    const list = q
      ? members.filter((m) => normalize(`${m.name} ${m.phone ?? ""} ${m.email ?? ""}`).includes(q))
      : members;
    return list.slice(0, 6);
  }, [members, query]);

  if (selected) {
    return (
      <div className="flex h-14 items-center gap-3 rounded-md border-2 border-elite-blue bg-blue-tint px-3.5">
        <Avatar name={selected.name} tone="blue" size="sm" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="truncate text-label font-bold leading-[18px] text-ink">{selected.name}</p>
          <p className="truncate text-caption font-medium text-ink-muted">
            {[selected.category, selected.phone ?? selected.email].filter(Boolean).join(" · ")}
          </p>
        </div>
        <button type="button" onClick={() => onChange(null)} className="text-body-sm font-bold text-link hover:underline">
          Cambiar
        </button>
      </div>
    );
  }

  const pick = (member: MemberOption) => {
    if (member.blocked) return;
    onChange(member.id);
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <div
        className={cn(
          "flex h-11 items-center gap-2.5 rounded-control bg-field px-3.5 focus-within:ring-2 focus-within:ring-elite-blue",
          invalid && "ring-2 ring-danger",
        )}
      >
        <Icon name="search" size={16} className="text-ink-muted" />
        <input
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && results[active] ? `${listId}-${results[active]!.id}` : undefined}
          value={query}
          placeholder="Nombre, teléfono o email"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((i) => Math.min(i + 1, results.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (event.key === "Enter" && results[active]) {
              event.preventDefault();
              pick(results[active]!);
            }
          }}
          className="w-full bg-transparent text-label font-semibold text-ink placeholder:font-medium placeholder:text-ink-disabled focus:outline-none"
        />
      </div>
      {open && (
        <div
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-30 mt-1.5 flex max-h-72 flex-col overflow-y-auto rounded-[14px] border border-line bg-white p-1.5 shadow-menu"
        >
          {results.length === 0 ? (
            <p className="px-2.5 py-3 text-body-sm font-medium text-ink-muted">No hay socios con ese nombre.</p>
          ) : (
            results.map((member, index) => (
              <button
                key={member.id}
                id={`${listId}-${member.id}`}
                type="button"
                role="option"
                aria-selected={index === active}
                aria-disabled={member.blocked}
                onMouseEnter={() => setActive(index)}
                onClick={() => pick(member)}
                className={cn(
                  "flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-left",
                  index === active && "bg-field",
                  member.blocked && "cursor-not-allowed opacity-50",
                )}
              >
                <Avatar name={member.name} tone="tint" size="sm" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-label font-semibold text-ink">{member.name}</span>
                  <span className="truncate text-caption font-medium text-ink-muted">
                    {member.blocked ? "Bloqueado" : [member.category, member.phone ?? member.email].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
