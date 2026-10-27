import type { Metadata } from "next";
import { Suspense } from "react";

import { CheckEmail } from "../auth-form";

export const metadata: Metadata = { title: "Revisá tu correo" };

export default function RevisaTuCorreoPage({ searchParams }: PageProps<"/revisa-tu-correo">) {
  return (
    <Suspense fallback={<CheckEmail email="" />}>
      <Check searchParams={searchParams} />
    </Suspense>
  );
}

async function Check({ searchParams }: Pick<PageProps<"/revisa-tu-correo">, "searchParams">) {
  const { email } = await searchParams;
  return <CheckEmail email={typeof email === "string" ? email : ""} />;
}
