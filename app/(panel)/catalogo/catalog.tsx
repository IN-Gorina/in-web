"use client";

import { useState, type ReactNode } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Badge, CountBadge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardTitle, Eyebrow } from "@/components/ui/card";
import { ChipGroup, ChoiceCard, Segmented, SwitchRow, TileGroup } from "@/components/ui/choice";
import { ConfirmDialog, Drawer, DrawerClose, Modal } from "@/components/ui/dialog";
import { Field, SearchInput, TextArea, TextField } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { KpiCard, KpiRow } from "@/components/ui/kpi-card";
import { Menu } from "@/components/ui/menu";
import { Select } from "@/components/ui/select";
import { EmptyState, TableSkeleton } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableFooter, TableHeader, TableHeaderCell, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { formatMoney } from "@/lib/format";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="flex flex-col gap-5 p-6">
      <CardTitle title={title} />
      {children}
    </Card>
  );
}

const courts = ["C1", "C2", "C3", "C4", "C5", "C6"] as const;

export function Catalog() {
  const toast = useToast();
  const [range, setRange] = useState<"hoy" | "semana" | "mes">("hoy");
  const [duration, setDuration] = useState<"60" | "90">("90");
  const [reason, setReason] = useState<"mantenimiento" | "clase" | "evento" | "otro">("mantenimiento");
  const [picked, setPicked] = useState<string[]>(["C3"]);
  const [payment, setPayment] = useState<"club" | "sena">("club");
  const [repeat, setRepeat] = useState(false);
  const [state, setState] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [confirm, setConfirm] = useState(false);

  return (
    <div className="flex flex-col gap-5 pb-10">
      <Section title="Botones">
        <div className="flex flex-wrap items-center gap-3">
          <Button icon="plus">Nueva reserva</Button>
          <Button variant="secondary" icon="lock">
            Bloquear horario
          </Button>
          <Button variant="secondary" icon="download">
            Exportar
          </Button>
          <Button variant="ghost">Cancelar</Button>
          <Button variant="danger" size="lg">
            Bloquear socio
          </Button>
          <Button variant="danger-outline" size="lg">
            Cancelar reserva
          </Button>
          <Button size="lg">Crear reserva</Button>
          <Button disabled>Deshabilitado</Button>
          <IconButton icon="x" label="Cerrar" />
          <IconButton icon="dots" label="Más acciones" tone="plain" />
        </div>
        <div className="w-[400px]">
          <Button size="xl" fullWidth>
            Ingresar
          </Button>
        </div>
      </Section>

      <Section title="Estados y avatares">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="success">Confirmada · seña</Badge>
          <Badge tone="warning">Seña pendiente</Badge>
          <Badge tone="info">Partido abierto · falta 1</Badge>
          <Badge tone="danger">Cancelada · seña devuelta</Badge>
          <Badge tone="neutral">Paga en el club</Badge>
          <Badge tone="dark">Administrador</Badge>
          <CountBadge count={3} />
          <CountBadge count={2} tone="warning" />
        </div>
        <div className="flex items-center gap-3">
          <Avatar name="Marcela Bruno" tone="deep" />
          <Avatar name="Alex Fernández" tone="tint" size="lg" />
          <Avatar name="Tomás Ledesma" tone="blue" size="sm" />
          <Avatar name="Diego Acosta" tone="muted" size="lg" />
          <Avatar name="Alex Fernández" tone="blue" size="xl" />
        </div>
      </Section>

      <Section title="Números">
        <KpiRow>
          <KpiCard highlight label="Ingresos de octubre" value={formatMoney(4820000)} footnote="+12% vs septiembre" />
          <KpiCard label="Ocupación promedio" value="71%" footnote="+6 pts vs septiembre" trend="positive" />
          <KpiCard label="Señas pendientes" value={formatMoney(15000)} footnote="3 reservas · se liberan a los 10 min" trend="warning" />
          <KpiCard label="Reservas canceladas" value="23" footnote="4% del mes" />
        </KpiRow>
      </Section>

      <Section title="Filtros">
        <div className="flex flex-wrap items-center gap-2.5">
          <SearchInput placeholder="Buscar por socio o cancha" />
          <Segmented
            label="Período"
            value={range}
            onChange={setRange}
            options={[
              { value: "hoy", label: "Hoy" },
              { value: "semana", label: "Semana" },
              { value: "mes", label: "Mes" },
            ]}
          />
          <Select
            label="Estado"
            value={state}
            onChange={setState}
            options={[
              { value: "confirmada", label: "Confirmada" },
              { value: "pendiente", label: "Seña pendiente" },
              { value: "cancelada", label: "Cancelada" },
            ]}
          />
          <Segmented
            label="Eventos"
            value="proximos"
            onChange={() => {}}
            options={[
              { value: "proximos", label: "Próximos", count: 4 },
              { value: "borradores", label: "Borradores", count: 1 },
              { value: "pasados", label: "Pasados" },
            ]}
          />
        </div>
      </Section>

      <Section title="Formularios">
        <div className="grid max-w-[560px] grid-cols-1 gap-[18px]">
          <Field label="Cancha" message="C3 · Techada · C5 en mantenimiento">
            <TileGroup
              label="Cancha"
              value={picked}
              onChange={(court) =>
                setPicked((current) => (current.includes(court) ? current.filter((c) => c !== court) : [...current, court]))
              }
              options={courts.map((court) => ({ value: court, label: court, disabled: court === "C5" }))}
            />
          </Field>
          <div className="flex gap-3">
            <TextField label="Día" defaultValue="Jue 9 oct" className="flex-1" />
            <TextField label="Hora" defaultValue="20:30" className="flex-1" />
            <Field label="Duración" className="w-[150px]">
              <Segmented
                variant="field"
                label="Duración"
                value={duration}
                onChange={setDuration}
                options={[
                  { value: "60", label: "60′" },
                  { value: "90", label: "90′" },
                ]}
              />
            </Field>
          </div>
          <Field label="Motivo">
            <ChipGroup
              label="Motivo"
              value={reason}
              onChange={setReason}
              options={[
                { value: "mantenimiento", label: "Mantenimiento" },
                { value: "clase", label: "Clase" },
                { value: "evento", label: "Evento" },
                { value: "otro", label: "Otro" },
              ]}
            />
          </Field>
          <Field label="Cobro">
            <div className="flex gap-2">
              <ChoiceCard
                className="flex-1"
                title="Paga todo en el club"
                description="Sin seña · queda confirmada"
                selected={payment === "club"}
                onSelect={() => setPayment("club")}
              />
              <ChoiceCard
                className="flex-1"
                title="Seña cobrada acá"
                description="Efectivo o transferencia"
                selected={payment === "sena"}
                onSelect={() => setPayment("sena")}
              />
            </div>
          </Field>
          <SwitchRow
            title="Repetir cada semana"
            description="Lo convierte en turno fijo · jueves 20:30"
            checked={repeat}
            onChange={setRepeat}
          />
          <TextField label="Correo" aside="Opcional" placeholder="nombre@gmail.com" />
          <TextField label="DNI" defaultValue="38.4" error="Revisá el DNI: tiene que tener 7 u 8 números." />
          <Field label="Descripción" aside="0 / 600">
            <TextArea placeholder="Contá de qué se trata, quién puede anotarse y qué incluye." />
          </Field>
        </div>
      </Section>

      <Section title="Avisos">
        <Callout>
          Cuando el socio paga en el club, tocá ··· › &quot;Registrar cobro del saldo&quot;.
        </Callout>
        <Callout tone="warning" title="1 reserva choca con este horario">
          Sofía Benítez · C3 · 16:30. Le avisamos por push y le devolvemos la seña.
        </Callout>
        <Callout tone="success">Cancha 2 libre los miércoles 20:00 las próximas 8 semanas</Callout>
      </Section>

      <Section title="Tabla">
        <Table label="Reservas">
          <TableHeader>
            <TableHeaderCell width={170}>Fecha y hora</TableHeaderCell>
            <TableHeaderCell width={100}>Cancha</TableHeaderCell>
            <TableHeaderCell grow>Organizador</TableHeaderCell>
            <TableHeaderCell width={190}>Estado</TableHeaderCell>
            <TableHeaderCell width={100}>Saldo</TableHeaderCell>
            <TableHeaderCell width={36} />
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell width={170} weight="semibold">
                Jue 8 · 16:30
              </TableCell>
              <TableCell width={100}>Cancha 1</TableCell>
              <TableCell grow weight="semibold">
                Tomás Gómez
              </TableCell>
              <TableCell width={190}>
                <Badge tone="success">Confirmada · seña</Badge>
              </TableCell>
              <TableCell width={100} weight="bold">
                {formatMoney(23000)}
              </TableCell>
              <TableCell width={36}>
                <RowMenu />
              </TableCell>
            </TableRow>
            <TableRow selected>
              <TableCell width={170} weight="semibold">
                Jue 8 · 19:00
              </TableCell>
              <TableCell width={100}>Cancha 1</TableCell>
              <TableCell grow weight="semibold">
                Alex Fernández
              </TableCell>
              <TableCell width={190}>
                <Badge tone="warning">Seña pendiente</Badge>
              </TableCell>
              <TableCell width={100} weight="bold">
                —
              </TableCell>
              <TableCell width={36}>
                <RowMenu />
              </TableCell>
            </TableRow>
          </TableBody>
          <TableFooter>
            <span>Mostrando 2 de 31</span>
            <button type="button" className="font-bold text-link">
              Ver más
            </button>
          </TableFooter>
        </Table>
        <Table label="Cargando">
          <TableSkeleton rows={3} />
        </Table>
        <Card>
          <EmptyState icon="calendar" title="No hay reservas para hoy" description="Cuando alguien reserve desde la app, aparece acá." />
        </Card>
      </Section>

      <Section title="Superposiciones">
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setModal(true)}>
            Abrir modal
          </Button>
          <Button variant="secondary" onClick={() => setDrawer(true)}>
            Abrir panel lateral
          </Button>
          <Button variant="secondary" onClick={() => setConfirm(true)}>
            Abrir confirmación
          </Button>
          <Button variant="secondary" onClick={() => toast("Cobro registrado")}>
            Mostrar aviso
          </Button>
        </div>
      </Section>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Nueva reserva"
        subtitle="Para reservas por teléfono o en el mostrador"
        footer={
          <>
            <div className="flex flex-1 flex-col gap-0.5">
              <span className="text-caption font-semibold text-ink-muted">Pico · 90 min</span>
              <span className="font-display text-title-2 text-ink">{formatMoney(42000)}</span>
            </div>
            <Button variant="ghost" size="lg" onClick={() => setModal(false)}>
              Cancelar
            </Button>
            <Button size="lg" onClick={() => setModal(false)}>
              Crear reserva
            </Button>
          </>
        }
      >
        <TextField label="A nombre de" defaultValue="Tomás Ledesma" />
        <SwitchRow title="Repetir cada semana" checked={repeat} onChange={setRepeat} />
      </Modal>

      <Drawer open={drawer} onClose={() => setDrawer(false)} label="Detalle de reserva">
        <div className="flex items-start justify-between border-b border-line px-7 pb-5 pt-7">
          <div className="flex flex-col gap-2.5">
            <Badge tone="warning" className="self-start">
              Seña pendiente · vence 19:10
            </Badge>
            <h2 className="font-display text-headline text-ink">Cancha 1 · Jue 8 oct</h2>
          </div>
          <DrawerClose onClose={() => setDrawer(false)} />
        </div>
        <div className="flex flex-1 flex-col gap-3 p-7">
          <Eyebrow>Organiza</Eyebrow>
          <p className="text-body font-bold">Alex Fernández</p>
        </div>
      </Drawer>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          toast("Socio bloqueado");
        }}
        icon="ban"
        title="¿Bloquear a Franco Aguirre?"
        description="No va a poder reservar, publicar ni sumarse a partidos."
        confirmLabel="Bloquear socio"
      />
    </div>
  );
}

function RowMenu() {
  return (
    <Menu
      items={[
        { label: "Ver detalle", icon: "eye", onSelect: () => {} },
        { label: "Registrar cobro", icon: "cash", onSelect: () => {} },
        { label: "Ver socio", icon: "user", onSelect: () => {} },
        { type: "separator" },
        { label: "Cancelar reserva", icon: "circle-x", tone: "danger", onSelect: () => {} },
      ]}
      trigger={(props) => (
        <button
          type="button"
          aria-label="Más acciones"
          {...props}
          className="flex size-7 items-center justify-center rounded-sm text-ink-muted hover:bg-blue-tint aria-expanded:bg-blue-tint"
        >
          <Icon name="dots" size={18} strokeWidth={3} />
        </button>
      )}
    />
  );
}
