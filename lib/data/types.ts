/*
 * Domain types shared by the panel. Ids are strings; members and staff will use their Firebase UID.
 * Dates are ISO strings in Argentina time (UTC-3). Amounts are whole pesos.
 */

import type { StaffRole } from "@/lib/auth/permissions";

export type Id = string;

// ── Club ──────────────────────────────────────────────────────────────

export type CourtType = "techada" | "descubierta";

export type Court = {
  id: Id;
  name: string; // "Cancha 1"
  shortName: string; // "C1"
  type: CourtType;
  /** False when the court is out of service (no bookings at all). */
  enabled: boolean;
  maintenance?: { until: string; reason: string };
  slotsPerDay: number;
};

export const categories = ["8ª", "7ª", "6ª", "5ª", "4ª", "3ª", "2ª", "1ª"] as const;
export type Category = (typeof categories)[number];

export type PlayingSide = "drive" | "reves" | "indistinto";

export const weekdays = ["lun", "mar", "mie", "jue", "vie", "sab", "dom"] as const;
export type Weekday = (typeof weekdays)[number];

export type OpeningHours = Record<Weekday, { open: boolean; from: string; to: string }>;

export type ClosedDay = { id: Id; from: string; to: string; reason: string };

export type ClubSettings = {
  name: string;
  phone: string;
  address: string;
  openingDate: string;
  hours: OpeningHours;
  closedDays: ClosedDay[];
  categories: Category[];
};

export type RateBand = {
  id: Id;
  label: string; // "Mañana"
  kind: "valle" | "pico";
  from: string;
  to: string;
  weekday: number;
  saturday: number;
  sunday: number;
  badge?: string; // "−20%"
};

export type BookingRules = {
  durations: (60 | 90 | 120)[];
  defaultDuration: 60 | 90 | 120;
  maxAdvanceDays: number;
  refundHoursBefore: number;
  depositMinutes: number;
  depositAmount: number;
  depositRequired: boolean;
};

// ── People ────────────────────────────────────────────────────────────

export type MemberStatus = "activo" | "nuevo" | "preinscripto" | "sin-categoria" | "bloqueado";

/** in-api: female / male. */
export type Sex = "femenino" | "masculino";

export type Member = {
  id: Id;
  name: string;
  email?: string;
  phone?: string;
  dni?: string;
  category?: Category;
  categoryChosenBy?: "socio" | "club";
  side?: PlayingSide;
  sex?: Sex;
  status: MemberStatus;
  memberSince: string;
  lastActivity?: string;
  matchesPlayed: number;
  bookingsCount: number;
  cancellations: number;
  paidThisYear: number;
  usesApp: boolean;
  notificationsOn: boolean;
  blocked?: { at: string; reason: string };
  internalNote?: { text: string; by: string; at: string };
};

export type StaffStatus = "activo" | "invitado" | "sin-acceso";

export type StaffMember = {
  id: Id;
  name: string;
  email: string;
  role: StaffRole;
  status: StaffStatus;
  lastSeen?: string;
  invitedAt?: string;
};

// ── Bookings and payments ─────────────────────────────────────────────

export type BookingOrigin = "app" | "recepcion" | "turno-fijo";

export type DepositStatus = "no-aplica" | "pendiente" | "pagada" | "devuelta" | "retenida";

export type Booking = {
  id: Id;
  courtId: Id;
  start: string;
  durationMin: 60 | 90 | 120;
  organizer: { memberId?: Id; name: string; guest?: boolean };
  origin: BookingOrigin;
  price: number;
  /** Required deposit (seña). 0 when the booking doesn't take one. */
  deposit: number;
  depositStatus: DepositStatus;
  depositExpiresAt?: string;
  balancePaid: boolean;
  cancelled?: { at: string; by: string };
  fixedSlotId?: Id;
  /** Open match published in Social › Partidos. */
  match?: { level: string; players: string[]; needed: number; closed?: boolean };
  history: { at: string; text: string; by?: string }[];
};

export type CourtBlock = {
  id: Id;
  courtIds: Id[];
  start: string;
  end: string;
  reason: "mantenimiento" | "clase" | "evento" | "otro";
  title: string;
  note?: string;
};

export type PaymentMethod = "mercado-pago" | "efectivo" | "transferencia" | "qr";
export type PaymentStatus = "acreditado" | "pendiente" | "vence-pronto" | "reintegrado" | "rechazado";
export type PaymentConcept = "sena" | "saldo" | "evento" | "otro";

export type Payment = {
  id: Id;
  at: string;
  memberName: string;
  memberId?: Id;
  bookingId?: Id;
  concept: PaymentConcept;
  title: string; // "Cancha 1 · Jue 8 · 21:00"
  detail: string; // "Seña", "Saldo cobrado en el club"
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  operationId?: string;
  manual: boolean;
  registeredBy?: string;
  note?: string;
};

// ── Fixed slots ───────────────────────────────────────────────────────

export type FixedSlotStatus = "activo" | "pedido" | "baja";

export type FixedSlot = {
  id: Id;
  holder: { memberId?: Id; name: string; note?: string };
  weekday: Weekday;
  time: string; // "18:30"
  durationMin: 60 | 90;
  courtId: Id | null; // null = "cualquier cancha" (request)
  status: FixedSlotStatus;
  since: string;
  price: number;
  thisWeek?: "reservado" | "liberado" | "empieza";
  /** Availability check shown on requests. */
  availability?: { ok: boolean; text: string; suggestedCourtId?: Id };
  rejection?: { reason: string; offer?: string };
};

// ── Community ─────────────────────────────────────────────────────────

export type EventStatus = "publicado" | "borrador" | "pasado" | "cancelado";

export type EventAttendee = {
  memberId?: Id;
  name: string;
  detail: string; // "5ª · con Tomás Gómez"
  paid: "mercado-pago" | "en-club";
};

/** Who can sign up (and gets the notification). Everyone sees the event in the app. */
export type EventAudience = {
  categories: Category[] | null; // null = all
  sex: Sex | null; // null = everyone
};

export type EventNotification = {
  title: string;
  body: string;
  /** When it goes out; null = when the event is published. */
  at: string | null;
  sentAt: string | null;
};

export type ClubEvent = {
  id: Id;
  title: string;
  type: string; // "Americano", "Clínica"
  start?: string;
  end?: string;
  courtIds: Id[];
  audience: EventAudience;
  notification: EventNotification | null;
  pricePerPerson: number;
  capacity: number;
  attendees: EventAttendee[];
  /** Total signed up; may exceed `attendees`, which only lists a sample in the mock. */
  registered: number;
  status: EventStatus;
  image?: string;
  description?: string;
  editedAt?: string;
  blockCourts: boolean;
};

export type ReportStatus = "abierta" | "oculta" | "descartada";

export type Report = {
  id: Id;
  author: { memberId: Id; name: string };
  context: string; // "Compra/Venta", "respuesta en Partidos"
  excerpt: string;
  body: string;
  reason: string;
  reasons: { label: string; count: number }[];
  count: number;
  createdAt: string;
  status: ReportStatus;
};

export type NotificationAudience =
  | { kind: "todos" }
  | { kind: "categoria"; categories: Category[] }
  | { kind: "tema"; topic: string }
  | { kind: "turno-fijo" };

export type PushNotification = {
  id: Id;
  title: string;
  body: string;
  audienceLabel: string;
  status: "enviada" | "programada" | "automatica";
  at: string;
  recipients?: number;
  openRate?: number;
};
