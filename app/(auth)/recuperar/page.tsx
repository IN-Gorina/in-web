import type { Metadata } from "next";
import { Suspense } from "react";

import { RecoverForm } from "../auth-form";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function RecuperarPage({ searchParams }: PageProps<"/recuperar">) {
  return (
    <Suspense fallback={<RecoverForm initialEmail="" />}>
      <Recover searchParams={searchParams} />
    </Suspense>
  );
}

async function Recover({ searchParams }: Pick<PageProps<"/recuperar">, "searchParams">) {
  const { email } = await searchParams;
  return <RecoverForm initialEmail={typeof email === "string" ? email : ""} />;
}
