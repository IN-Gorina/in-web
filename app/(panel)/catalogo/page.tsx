import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui/page-header";

import { Catalog } from "./catalog";

export const metadata: Metadata = { title: "Catálogo" };

/** Every UI primitive in its states. Development only (or a build with SHOW_CATALOG=1). */
export default function CatalogPage() {
  if (process.env.NODE_ENV === "production" && process.env.SHOW_CATALOG !== "1") notFound();
  return (
    <>
      <PageHeader title="Catálogo de componentes" subtitle="Primitivas del panel con los valores de Paper. Solo en desarrollo." />
      <Catalog />
    </>
  );
}
