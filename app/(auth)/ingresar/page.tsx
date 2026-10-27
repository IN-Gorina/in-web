import type { Metadata } from "next";

import { LoginForm } from "../auth-form";

export const metadata: Metadata = { title: "Ingresar" };

export default function IngresarPage() {
  return <LoginForm />;
}
