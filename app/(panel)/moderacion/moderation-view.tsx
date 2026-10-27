"use client";

import { useMemo, useState, useTransition } from "react";

import { BlockMemberDialog } from "@/components/members/block-dialog";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, Eyebrow } from "@/components/ui/card";
import { ChipGroup, Segmented, SwitchRow } from "@/components/ui/choice";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, SearchInput } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { dismissReport, hidePost, restorePost } from "@/lib/data/moderation/actions";
import type { Report } from "@/lib/data/types";
import { hoursAgo } from "@/lib/dates";

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export type ReportAuthor = { blocked: boolean; upcoming: number };

export function ModerationView({
  reports,
  authors,
  canBlock,
}: {
  reports: Report[];
  authors: Record<string, ReportAuthor>;
  canBlock: boolean;
}) {
  const [tab, setTab] = useState<"denuncias" | "ocultas">("denuncias");
  const [query, setQuery] = useState("");
  const open = reports.filter((r) => r.status === "abierta");
  const hidden = reports.filter((r) => r.status === "oculta");
  const list = useMemo(() => {
    const q = normalize(query.trim());
    return (tab === "denuncias" ? open : hidden).filter((r) => !q || normalize(`${r.author.name} ${r.body}`).includes(q));
  }, [tab, open, hidden, query]);
  const [selectedId, setSelectedId] = useState<string | null>(list[0]?.id ?? null);
  const selected = list.find((r) => r.id === selectedId) ?? list[0] ?? null;

  return (
    <>
      <div className="flex shrink-0 items-center gap-2.5">
        <Segmented
          label="Vista"
          value={tab}
          onChange={setTab}
          options={[
            { value: "denuncias", label: "Denuncias", count: open.length },
            { value: "ocultas", label: "Ocultas", count: hidden.length },
          ]}
        />
        <SearchInput placeholder="Buscar publicación" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Buscar publicación" className="w-[280px]" />
      </div>

      <div className="flex min-h-0 flex-1 gap-5">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <Table label="Publicaciones denunciadas">
            <TableHeader>
              <TableHeaderCell grow>Publicación denunciada</TableHeaderCell>
              <TableHeaderCell width={140}>Motivo</TableHeaderCell>
              <TableHeaderCell width={92} align="right">
                Denuncias
              </TableHeaderCell>
            </TableHeader>
            {list.length === 0 ? (
              <EmptyState
                icon="check"
                title={tab === "denuncias" ? "No hay denuncias para revisar" : "No hay publicaciones ocultas"}
                description={tab === "denuncias" ? "Cuando un socio denuncie una publicación, aparece acá." : undefined}
              />
            ) : (
              <TableBody>
                {list.map((report) => (
                  <TableRow key={report.id} height={72} selected={report.id === selected?.id} onClick={() => setSelectedId(report.id)}>
                    <TableCell grow>
                      <span className="flex min-w-0 items-center gap-3">
                        <Avatar name={report.author.name} tone={report.id === selected?.id ? "deep" : "tint"} size="lg" />
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="truncate text-label font-bold text-ink">
                            {report.author.name} · {report.context}
                          </span>
                          <span className="line-clamp-2 text-body-sm font-medium text-ink-muted">{report.excerpt}</span>
                        </span>
                      </span>
                    </TableCell>
                    <TableCell width={140} weight="semibold">
                      {report.reason}
                    </TableCell>
                    <TableCell width={92} align="right">
                      <span
                        className={cn(
                          "inline-flex h-[22px] min-w-[26px] items-center justify-center rounded-full px-2 text-caption font-bold",
                          report.count >= 2 ? "bg-danger-soft text-danger" : "bg-surface-muted text-ink",
                        )}
                      >
                        {report.count}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            )}
          </Table>
          <Callout tone="neutral">Con 5 denuncias una publicación se oculta sola hasta que el staff la revise.</Callout>
        </div>

        {selected && <ReviewPanel key={selected.id} report={selected} author={authors[selected.author.memberId]} canBlock={canBlock} />}
      </div>
    </>
  );
}

const reasonOptions = ["Posible estafa", "Agresión", "Spam", "Otro"] as const;

function ReviewPanel({ report, author, canBlock }: { report: Report; author?: ReportAuthor; canBlock: boolean }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [hiding, setHiding] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const isOpen = report.status === "abierta";

  const run = (action: () => Promise<{ ok: boolean; error?: string }>, success: string) =>
    startTransition(async () => {
      const result = await action();
      toast(result.ok ? success : (result.error ?? "Algo salió mal"), result.ok ? "success" : "error");
    });

  return (
    <Card className="flex w-[440px] shrink-0 flex-col gap-4 p-5">
      <Eyebrow className="tracking-label">{isOpen ? "Revisar denuncia" : "Publicación oculta"}</Eyebrow>
      <div className="flex flex-col gap-3 rounded-md bg-surface-muted p-4">
        <div className="flex items-center gap-2.5">
          <Avatar name={report.author.name} tone="deep" size="md" />
          <div className="flex flex-col">
            <span className="text-label font-bold text-ink">{report.author.name}</span>
            <span className="text-caption font-medium text-ink-muted">
              {report.context} · {hoursAgo(report.createdAt)}
            </span>
          </div>
        </div>
        <p className="text-body font-medium text-ink">{report.body}</p>
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-body-sm font-bold text-ink">
          Motivos ({report.count} {report.count === 1 ? "denuncia" : "denuncias"})
        </p>
        <p className="text-body-sm font-medium text-ink-muted">{report.reasons.map((r) => `${r.label} · ${r.count}`).join("  ·  ")}</p>
      </div>

      <div className="mt-auto flex flex-col gap-2">
        {isOpen ? (
          <>
            {/* Paper: 44px buttons with the 10px control radius, 1.5px borders. */}
            <Button variant="danger" fullWidth onClick={() => setHiding(true)} disabled={pending} className="h-11! font-bold!">
              Ocultar publicación
            </Button>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="h-11! flex-1 border-[1.5px]!"
                disabled={pending}
                onClick={() => run(() => dismissReport(report.id), "Denuncia descartada")}
              >
                Descartar denuncia
              </Button>
              {canBlock && author && !author.blocked && (
                <Button variant="danger-outline" className="h-11! flex-1 border-danger!" disabled={pending} onClick={() => setBlocking(true)}>
                  Bloquear socio
                </Button>
              )}
            </div>
            <p className="text-center text-caption leading-[17px] font-medium text-ink-muted">
              Le avisamos al autor por qué se ocultó. El que denunció no ve quién resolvió.
            </p>
          </>
        ) : (
          <Button variant="secondary" size="lg" fullWidth disabled={pending} onClick={() => run(() => restorePost(report.id), "Publicación visible de nuevo")}>
            Volver a mostrar
          </Button>
        )}
      </div>

      {hiding && <HideDialog report={report} canBlock={canBlock && !author?.blocked} onClose={() => setHiding(false)} />}
      {blocking && (
        <BlockMemberDialog
          member={{ id: report.author.memberId, name: report.author.name }}
          upcoming={author?.upcoming ?? 0}
          onClose={() => setBlocking(false)}
        />
      )}
    </Card>
  );
}

/** Paper "Panel / 14 – Ocultar publicación". */
function HideDialog({ report, canBlock, onClose }: { report: Report; canBlock: boolean; onClose: () => void }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const initial = reasonOptions.find((r) => r === report.reason) ?? "Otro";
  const [reason, setReason] = useState<(typeof reasonOptions)[number]>(initial);
  const [block, setBlock] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <ConfirmDialog
      open
      onClose={onClose}
      pending={pending}
      icon="eye-off"
      title={`¿Ocultar la publicación de ${report.author.name.split(" ")[0]}?`}
      description={`Deja de verse en Social. ${report.count === 1 ? "La denuncia se cierra" : `Las ${report.count} denuncias se cierran`} y le avisamos al autor el motivo.`}
      confirmLabel="Ocultar publicación"
      onConfirm={() =>
        startTransition(async () => {
          const result = await hidePost({ id: report.id, reason, blockAuthor: block });
          if (!result.ok) return setError(result.error);
          toast(block ? "Publicación oculta y socio bloqueado" : "Publicación oculta");
          onClose();
        })
      }
    >
      <Field label="Motivo">
        <ChipGroup label="Motivo" value={reason} onChange={setReason} options={reasonOptions.map((r) => ({ value: r, label: r }))} />
      </Field>
      {canBlock && (
        <SwitchRow
          title="Bloquear también al socio"
          description="No va a poder publicar, reservar ni sumarse a partidos"
          checked={block}
          onChange={setBlock}
        />
      )}
      {error && <Callout tone="danger">{error}</Callout>}
    </ConfirmDialog>
  );
}
