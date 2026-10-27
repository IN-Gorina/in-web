"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Segmented, SwitchRow, TileGroup } from "@/components/ui/choice";
import { Modal } from "@/components/ui/dialog";
import { Field, FieldLabel, TextField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { addMember } from "@/lib/data/members/actions";
import { categories, type Category, type PlayingSide } from "@/lib/data/types";

/** Paper "Panel / 07a – Agregar socio". */
export function AddMemberModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [dni, setDni] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const [side, setSide] = useState<PlayingSide>("drive");
  const [sendAppLink, setSendAppLink] = useState(true);

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await addMember({ name, dni, phone, email, category: category ?? undefined, side, sendAppLink });
      if (!result.ok) return setError(result.error);
      toast(sendAppLink ? "Socio agregado · le mandamos el link de la app" : "Socio agregado");
      onClose();
      router.push(`/socios/${result.data.id}`);
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Agregar socio"
      subtitle="Para quien todavía no tiene la app o se anotó en recepción"
      footer={
        <>
          <span className="flex-1 text-caption font-semibold text-ink-muted">Queda como socio activo</span>
          <Button variant="ghost" size="lg" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="lg" onClick={submit} disabled={pending}>
            Agregar socio
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        <TextField label="Nombre y apellido" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" className="flex-1" />
        <TextField label="DNI" inputMode="numeric" value={dni} onChange={(e) => setDni(e.target.value)} className="w-[170px] shrink-0" />
      </div>
      <div className="flex gap-3">
        <TextField label="Teléfono" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+54 221 …" className="flex-1" />
        <TextField label="Correo" aside="Opcional" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@gmail.com" className="flex-1" />
      </div>
      <Field label="Categoría" aside="Opcional · la puede elegir en la app">
        <TileGroup
          display
          label="Categoría"
          value={category ? [category] : []}
          onChange={(value) => setCategory(value === category ? null : value)}
          options={categories.map((c) => ({ value: c, label: c }))}
        />
      </Field>
      <div className="flex items-center justify-between">
        <FieldLabel label="Lado de juego" />
        <Segmented
          variant="field"
          size="sm"
          label="Lado de juego"
          value={side}
          onChange={setSide}
          className="h-9"
          options={[
            { value: "drive", label: "Drive" },
            { value: "reves", label: "Revés" },
            { value: "indistinto", label: "Indistinto" },
          ]}
        />
      </div>
      <SwitchRow
        title="Mandarle el link de la app"
        description="Por WhatsApp. Al registrarse con este teléfono, su historial queda unido."
        checked={sendAppLink}
        onChange={setSendAppLink}
      />
      {error && <Callout tone="danger">{error}</Callout>}
    </Modal>
  );
}
