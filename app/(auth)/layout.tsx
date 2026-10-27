/** Split layout for login screens (Paper "Panel / 00a–00e"): brand panel on the left, form on the right. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh bg-white">
      <aside className="relative hidden w-[600px] shrink-0 flex-col justify-between overflow-hidden bg-elite-blue p-14 lg:flex">
        <CourtLines />
        <p className="relative flex items-center gap-2.5 text-caption font-bold uppercase tracking-overline text-white">
          <span className="size-2.5 rounded-full bg-energy-lime" />
          Panel del club
        </p>
        <div className="relative flex flex-col gap-5">
          <p className="w-[460px] font-display text-hero tracking-tight text-white">Todo el club, en una pantalla.</p>
          <p className="w-[400px] text-body-lg font-medium text-white/80">
            Agenda, reservas, cobros y socios de IN Padel &amp; Social Club. Solo para el staff.
          </p>
        </div>
      </aside>
      <main className="flex flex-1 items-center justify-center p-6 sm:p-14">
        <div className="flex w-full max-w-[400px] flex-col gap-8">{children}</div>
      </main>
    </div>
  );
}

function CourtLines() {
  return (
    <svg
      aria-hidden
      width="760"
      height="560"
      viewBox="0 0 760 560"
      className="absolute left-[200px] top-[-60px] -rotate-12"
      fill="none"
      stroke="white"
    >
      <rect x="2" y="2" width="756" height="556" rx="6" strokeOpacity="0.16" strokeWidth="3" />
      <line x1="380" y1="2" x2="380" y2="558" strokeOpacity="0.28" strokeWidth="5" />
      <line x1="160" y1="2" x2="160" y2="558" strokeOpacity="0.16" strokeWidth="3" />
      <line x1="600" y1="2" x2="600" y2="558" strokeOpacity="0.16" strokeWidth="3" />
      <line x1="160" y1="280" x2="600" y2="280" strokeOpacity="0.16" strokeWidth="3" />
    </svg>
  );
}
