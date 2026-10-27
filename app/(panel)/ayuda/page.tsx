import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Ayuda del panel" };

const topics = [
  {
    title: "Cargar una reserva por teléfono",
    body: "En Agenda, tocá un horario libre o «Nueva reserva». Elegí el socio (o «Invitado sin app») y si paga todo en el club o deja la seña acá.",
    href: "/agenda",
  },
  {
    title: "Cobrar el saldo en el mostrador",
    body: "En Reservas, tocá ··· › «Registrar cobro» en la fila del socio. Elegí efectivo, transferencia o QR. El cobro queda a tu nombre.",
    href: "/reservas",
  },
  {
    title: "Una seña que no llega",
    body: "Si el socio no paga la seña a tiempo, el turno se libera solo. Podés reenviarle el link desde el detalle de la reserva.",
    href: "/reservas?estado=sena-pendiente",
  },
  {
    title: "Pedidos de turno fijo",
    body: "Aparecen en Turnos y partidos con el aviso de disponibilidad. Aprobalo o rechazalo ofreciendo otro horario.",
    href: "/turnos-y-partidos",
  },
  {
    title: "Publicaciones denunciadas",
    body: "En Moderación ves qué se denunció y por qué. Ocultar le avisa al autor el motivo; con 5 denuncias se oculta sola.",
    href: "/moderacion",
  },
  {
    title: "Bloquear un horario",
    body: "Para mantenimiento, clases o eventos: «Bloquear horario» en Agenda. Si choca con reservas, se cancelan y se devuelven las señas.",
    href: "/agenda",
  },
];

export default function AyudaPage() {
  return (
    <>
      <PageHeader title="Ayuda del panel" subtitle="Lo que más se hace en recepción, paso a paso" />
      <div className="grid grid-cols-2 gap-4">
        {topics.map((topic) => (
          <Card key={topic.title} className="flex flex-col gap-2 p-5">
            <CardTitle title={topic.title} />
            <p className="text-label font-medium text-ink-muted">{topic.body}</p>
            <Link href={topic.href} className="self-start text-body-sm font-bold text-link hover:underline">
              Ir a la sección
            </Link>
          </Card>
        ))}
      </div>
    </>
  );
}
