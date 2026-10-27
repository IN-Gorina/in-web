"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { AddMemberModal } from "@/components/members/add-member-modal";
import { BlockMemberDialog, UnblockMemberDialog } from "@/components/members/block-dialog";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton, LinkButton } from "@/components/ui/button";
import { Card, Eyebrow } from "@/components/ui/card";
import { Segmented } from "@/components/ui/choice";
import { SearchInput } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Menu } from "@/components/ui/menu";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableFooter, TableHeader, TableHeaderCell, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { downloadCsv } from "@/lib/csv";
import { updateMemberCategory } from "@/lib/data/members/actions";
import { categoryName, memberStatus, sideLabels } from "@/lib/data/members/presentation";
import { categories, type Booking, type Category, type Member, type PlayingSide } from "@/lib/data/types";
import { ago, dayMonth, monthYear, shortDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/format";

export type MemberBookingSummary = {
  id: string;
  start: string;
  court: string;
  future: boolean;
  price: number;
  deposit: number;
  depositStatus: Booking["depositStatus"];
  balancePaid: boolean;
};

type Tab = "todos" | "activos" | "preinscriptos" | "sin-categoria";
const PAGE_SIZE = 10;

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export function AddMemberButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button icon="plus" onClick={() => setOpen(true)}>
        Agregar socio
      </Button>
      {open && <AddMemberModal onClose={() => setOpen(false)} />}
    </>
  );
}

export function MembersView({
  members,
  bookingsByMember,
  canBlock,
}: {
  members: Member[];
  bookingsByMember: Record<string, MemberBookingSummary[]>;
  canBlock: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("todos");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const [side, setSide] = useState<PlayingSide | null>(null);
  const [page, setPage] = useState(0);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [panelClosed, setPanelClosed] = useState(false);
  const [blocking, setBlocking] = useState<Member | null>(null);
  const [unblocking, setUnblocking] = useState<Member | null>(null);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return members.filter((m) => {
      if (tab === "activos" && !(m.status === "activo" || m.status === "nuevo")) return false;
      if (tab === "preinscriptos" && m.status !== "preinscripto") return false;
      if (tab === "sin-categoria" && m.category) return false;
      if (category && m.category !== category) return false;
      if (side && m.side !== side) return false;
      if (q && !normalize(`${m.name} ${m.email ?? ""} ${m.dni ?? ""} ${m.phone ?? ""}`).includes(q)) return false;
      return true;
    });
  }, [members, tab, query, category, side]);

  const pages = Math.max(Math.ceil(filtered.length / PAGE_SIZE), 1);
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
  // The panel shows the member picked in the current list, or the list's first member (as in Paper),
  // until it's closed; picking a row opens it again.
  const selected = panelClosed ? null : (visible.find((m) => m.id === pickedId) ?? visible[0] ?? null);
  const selectedId = selected?.id ?? null;
  const select = (id: string | null) => {
    setPickedId(id);
    setPanelClosed(id === null);
  };

  const exportCsv = () =>
    downloadCsv(
      "socios.csv",
      ["Nombre", "Correo", "Teléfono", "DNI", "Categoría", "Lado", "Partidos", "Estado"],
      filtered.map((m) => [m.name, m.email ?? "", m.phone ?? "", m.dni ?? "", m.category ?? "", m.side ? sideLabels[m.side] : "", m.matchesPlayed, memberStatus(m).label]),
    );

  const resetPage = <T,>(set: (v: T) => void) => (value: T) => {
    set(value);
    setPage(0);
  };

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center gap-2.5">
        <SearchInput placeholder="Buscar por nombre, DNI o email" value={query} onChange={(e) => resetPage(setQuery)(e.target.value)} aria-label="Buscar socios" />
        <Segmented
          label="Estado"
          value={tab}
          onChange={resetPage(setTab)}
          options={[
            { value: "todos", label: "Todos" },
            { value: "activos", label: "Activos" },
            { value: "preinscriptos", label: "Pre-inscriptos" },
            { value: "sin-categoria", label: "Sin categoría" },
          ]}
        />
        <Select
          label="Categoría"
          value={category}
          onChange={(v) => resetPage(setCategory)(v === category ? null : v)}
          options={categories.map((c) => ({ value: c, label: `${c} · ${categoryName(c)}` }))}
        />
        <Select
          label="Lado"
          value={side}
          onChange={(v) => resetPage(setSide)(v === side ? null : v)}
          options={(Object.keys(sideLabels) as PlayingSide[]).map((s) => ({ value: s, label: sideLabels[s] }))}
          width={180}
        />
        <span className="flex-1" />
        <Button variant="secondary" icon="download" onClick={exportCsv} disabled={filtered.length === 0}>
          Exportar
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 items-start gap-4">
        <Table label="Socios" className="min-w-0 flex-1">
          <TableHeader>
            <TableHeaderCell grow>Socio</TableHeaderCell>
            <TableHeaderCell width={88}>Categoría</TableHeaderCell>
            <TableHeaderCell width={70}>Lado</TableHeaderCell>
            <TableHeaderCell width={76}>Partidos</TableHeaderCell>
            <TableHeaderCell width={100}>Actividad</TableHeaderCell>
            <TableHeaderCell width={132}>Estado</TableHeaderCell>
            <TableHeaderCell width={28} />
          </TableHeader>
          {visible.length === 0 ? (
            <EmptyState icon="users" title="No hay socios con estos filtros" description="Probá con otro nombre o sacá los filtros." />
          ) : (
            <TableBody>
              {visible.map((member) => {
                const status = memberStatus(member);
                return (
                  <TableRow key={member.id} selected={member.id === selectedId} onClick={() => select(member.id)}>
                    <TableCell grow>
                      <span className="flex min-w-0 items-center gap-2.5">
                        <Avatar name={member.name} size="sm" tone={member.id === selectedId ? "blue" : "tint"} />
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-label font-semibold text-ink">{member.name}</span>
                          <span className="truncate text-caption font-medium text-ink-muted">{member.email ?? member.phone ?? "Sin datos de contacto"}</span>
                        </span>
                      </span>
                    </TableCell>
                    <TableCell width={88}>
                      {member.category ? (
                        <span className="inline-flex h-[26px] min-w-9 items-center justify-center rounded-full border border-line bg-surface-muted px-2.5 font-display text-body-sm text-ink">
                          {member.category}
                        </span>
                      ) : (
                        <span className="text-label text-ink-muted">—</span>
                      )}
                    </TableCell>
                    <TableCell width={70} tone="muted">
                      {member.side ? sideLabels[member.side] : "—"}
                    </TableCell>
                    <TableCell width={76} weight="semibold">
                      {member.matchesPlayed}
                    </TableCell>
                    <TableCell width={100} tone="muted">
                      {member.lastActivity ? ago(member.lastActivity) : "—"}
                    </TableCell>
                    <TableCell width={132}>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </TableCell>
                    <TableCell width={28}>
                      <Menu
                        items={[
                          { label: "Ver perfil completo", icon: "user", onSelect: () => router.push(`/socios/${member.id}`) },
                          ...(canBlock
                            ? [
                                { type: "separator" as const },
                                member.status === "bloqueado"
                                  ? { label: "Desbloquear", icon: "send" as const, onSelect: () => setUnblocking(member) }
                                  : { label: "Bloquear socio", icon: "ban" as const, tone: "danger" as const, onSelect: () => setBlocking(member) },
                              ]
                            : []),
                        ]}
                        trigger={(props) => (
                          <button
                            type="button"
                            aria-label={`Acciones de ${member.name}`}
                            {...props}
                            onClick={(event) => {
                              event.stopPropagation();
                              props.onClick(event);
                            }}
                            className="flex size-7 items-center justify-center rounded-[6px] text-ink-muted hover:bg-blue-tint aria-expanded:bg-blue-tint"
                          >
                            <Icon name="dots" size={18} strokeWidth={3} />
                          </button>
                        )}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          )}
          <TableFooter>
            <span>
              Mostrando {filtered.length ? current * PAGE_SIZE + 1 : 0}–{current * PAGE_SIZE + visible.length} de {filtered.length} socios
            </span>
            <Pagination page={current} pages={pages} onChange={setPage} />
          </TableFooter>
        </Table>

        {selected && (
          <MemberPanel
            key={selected.id}
            member={selected}
            bookings={bookingsByMember[selected.id] ?? []}
            canBlock={canBlock}
            onClose={() => select(null)}
            onBlock={() => setBlocking(selected)}
            onUnblock={() => setUnblocking(selected)}
          />
        )}
      </div>

      {blocking && (
        <BlockMemberDialog
          member={blocking}
          upcoming={(bookingsByMember[blocking.id] ?? []).filter((b) => b.future).length}
          onClose={() => setBlocking(null)}
        />
      )}
      {unblocking && <UnblockMemberDialog member={unblocking} onClose={() => setUnblocking(null)} />}
    </>
  );
}

function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (page: number) => void }) {
  return (
    <nav aria-label="Páginas" className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Página anterior"
        disabled={page === 0}
        onClick={() => onChange(page - 1)}
        className="flex size-8 items-center justify-center rounded-sm border border-line text-ink disabled:text-ink-disabled"
      >
        <Icon name="chevron-left" size={16} strokeWidth={2.4} />
      </button>
      {Array.from({ length: pages }, (_, i) => (
        <button
          key={i}
          type="button"
          aria-current={i === page ? "page" : undefined}
          onClick={() => onChange(i)}
          className={cn("flex size-8 items-center justify-center rounded-sm text-body-sm font-semibold", i === page ? "bg-blue-tint text-elite-blue" : "text-ink hover:bg-field")}
        >
          {i + 1}
        </button>
      ))}
      <button
        type="button"
        aria-label="Página siguiente"
        disabled={page >= pages - 1}
        onClick={() => onChange(page + 1)}
        className="flex size-8 items-center justify-center rounded-sm border border-line text-ink disabled:text-ink-disabled"
      >
        <Icon name="chevron-right" size={16} strokeWidth={2.4} />
      </button>
    </nav>
  );
}

/** Side panel for the selected member (Paper "Panel / 07 – Socios", right column). */
function MemberPanel({
  member,
  bookings,
  canBlock,
  onClose,
  onBlock,
  onUnblock,
}: {
  member: Member;
  bookings: MemberBookingSummary[];
  canBlock: boolean;
  onClose: () => void;
  onBlock: () => void;
  onUnblock: () => void;
}) {
  const toast = useToast();
  const [, startTransition] = useTransition();
  const shown = bookings.slice(0, 2);
  const due = bookings
    .filter((b) => b.future && !b.balancePaid && b.depositStatus !== "pendiente")
    .reduce((sum, b) => sum + b.price - (b.depositStatus === "pagada" ? b.deposit : 0), 0);

  const since = `Socio desde ${monthYear(member.memberSince)}`;
  const blockedNote = member.blocked ? ` · bloqueado el ${dayMonth(`${member.blocked.at}T12:00:00-03:00`)}` : "";

  return (
    <Card className="flex w-[300px] shrink-0 flex-col">
      <div className="flex flex-col gap-3.5 border-b border-line p-5">
        <div className="flex items-start justify-between">
          <Avatar name={member.name} tone="blue" size="panel" />
          <IconButton icon="x" label="Cerrar" tone="plain" onClick={onClose} />
        </div>
        <div className="flex flex-col gap-0.5">
          <p className="font-display text-title-2 text-ink">{member.name}</p>
          <p className="text-body-sm font-medium text-ink-muted">
            {since}
            {blockedNote}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-b border-line px-5 py-4">
        <Eyebrow className="tracking-label">Categoría</Eyebrow>
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-control bg-blue-tint font-display text-title-2 text-elite-blue">
            {member.category ?? "—"}
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="text-label font-semibold text-ink">
              {member.category ? categoryName(member.category) : "Sin categoría"}
              {member.side ? ` · ${sideLabels[member.side]}` : ""}
            </p>
            <p className="text-caption font-medium text-ink-muted">
              {member.categoryChosenBy === "club" ? "Corregida por el club" : member.category ? "Elegida por el socio" : "Todavía no eligió"}
            </p>
          </div>
        </div>
        <Select
          label="Corregir categoría"
          value={null}
          placeholder="Corregir categoría"
          width={252}
          className="[&>button]:w-full [&>button]:justify-between"
          options={categories.map((c) => ({ value: c, label: `${c} · ${categoryName(c)}` }))}
          onChange={(value) =>
            startTransition(async () => {
              const result = await updateMemberCategory({ id: member.id, category: value });
              toast(result.ok ? `Categoría actualizada a ${value}` : result.error, result.ok ? "success" : "error");
            })
          }
        />
      </div>

      <div className="flex border-b border-line px-5 py-4">
        {[
          [member.matchesPlayed, "Partidos"],
          [member.bookingsCount, "Reservas"],
          [member.cancellations, "Canceladas"],
        ].map(([value, label], index) => (
          <div key={label} className={cn("flex flex-1 flex-col gap-0.5", index > 0 && "border-l border-line pl-4")}>
            <span className="font-display text-[24px] leading-[30px] text-ink">{value}</span>
            <span className="text-caption font-medium text-ink-muted">{label}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 px-5 py-4">
        <div className="flex items-center justify-between">
          <Eyebrow className="tracking-label">Reservas</Eyebrow>
          {due > 0 && <Badge tone="warning">Saldo {formatMoney(due)}</Badge>}
        </div>
        {shown.length === 0 ? (
          <p className="text-body-sm font-medium text-ink-muted">Sin reservas este mes.</p>
        ) : (
          shown.map((b, index) => (
            <div key={b.id} className={cn("flex items-center gap-3 rounded-control p-3", index === 0 ? "bg-surface-muted" : "py-0")}>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-body-sm font-semibold text-ink">
                  {shortDateTime(b.start)} · {b.court}
                </span>
                <span className="text-caption font-medium text-ink-muted">
                  {b.balancePaid ? "Pagada" : b.future ? (b.depositStatus === "pendiente" ? "Seña pendiente" : "Saldo a cobrar en el club") : "Jugada"}
                </span>
              </div>
              <span className={cn("text-label font-bold", b.future ? "text-ink" : "text-ink-muted")}>
                {formatMoney(b.balancePaid ? b.price : b.price - (b.depositStatus === "pagada" ? b.deposit : 0))}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="mt-auto flex flex-col gap-2 px-5 pb-5">
        {canBlock &&
          (member.status === "bloqueado" ? (
            <Button icon="send" fullWidth onClick={onUnblock}>
              Desbloquear socio
            </Button>
          ) : (
            <Button variant="danger-outline" icon="ban" fullWidth onClick={onBlock} className="h-10 rounded-control">
              Bloquear socio
            </Button>
          ))}
        <LinkButton href={`/socios/${member.id}`} variant="secondary" fullWidth>
          Ver perfil completo
        </LinkButton>
        {!canBlock && member.status === "bloqueado" && (
          <p className="text-caption font-medium text-ink-muted">
            Bloqueado: {member.blocked?.reason}. Solo un administrador puede desbloquearlo.
          </p>
        )}
      </div>
    </Card>
  );
}
