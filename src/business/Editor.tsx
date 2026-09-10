import {
  Input,
  Select,
  Textarea,
  Button,
  SurfaceCard,
} from "../components/WorkspaceUI";
import { useId, useRef, useState, type ReactNode } from "react";
import { euros } from "./model";

export type Field = {
  key: string;
  label: string;
  visibleWhen?: { key: string; values: string[] };
  labelFor?: (draft: Record<string, string | boolean>) => string;
  type?:
    "text" | "money" | "number" | "date" | "select" | "boolean" | "textarea";
  options?: [string, string][];
  optional?: boolean;
  nullable?: boolean;
};

export function ConfirmAction({
  button,
  message,
  onConfirm,
}: {
  button: string;
  message: string;
  onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const [error, setError] = useState("");
  return (
    <>
      <Button
        type="button"
        onClick={() => {
          setError("");
          dialog.current?.showModal();
        }}
      >
        {button}
      </Button>
      <dialog
        className="biz-dialog card-shell"
        ref={dialog}
        aria-labelledby={heading}
      >
        <div className="biz-confirm">
          <h2 id={heading}>{button}</h2>
          <p>{message}</p>
          {error && (
            <p role="alert" className="biz-error">
              {error}
            </p>
          )}
          <div className="biz-actions">
            <Button
              type="button"

              autoFocus
              onClick={() => dialog.current?.close()}
            >
              Annuleren
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                try {
                  onConfirm();
                  dialog.current?.close();
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? e.message
                      : "De wijziging is niet uitgevoerd.",
                  );
                }
              }}
            >
              Bevestigen
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
export function EditDialog({
  title,
  button,
  value,
  fields,
  onSave,
  inline = false,
}: {
  inline?: boolean;
  title: string;
  button: string;
  value: Record<string, unknown>;
  fields: Field[];
  onSave: (patch: Record<string, unknown>) => void;
}) {
  const headingId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const initialDraft = () =>
    Object.fromEntries(
      fields.map((field) => {
        const current = value[field.key];
        return [
          field.key,
          field.type === "boolean"
            ? current === true
            : current == null
              ? ""
              : field.type === "money"
                ? String(Number(current) / 100)
                : String(current),
        ];
      }),
    );
  const [draft, setDraft] =
    useState<Record<string, string | boolean>>(initialDraft);
  const [error, setError] = useState("");
  const visibleFields = fields.filter(
    (field) =>
      !field.visibleWhen ||
      field.visibleWhen.values.includes(String(draft[field.visibleWhen.key])),
  );
  const open = () => {
    setError("");
    setDraft(
      Object.fromEntries(
        fields.map((field) => {
          const current = value[field.key];
          return [
            field.key,
            field.type === "boolean"
              ? current === true
              : current === null || current === undefined
                ? ""
                : field.type === "money"
                  ? String(Number(current) / 100)
                  : String(current),
          ];
        }),
      ),
    );
    dialog.current?.showModal();
  };
  const form = (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        try {
          const patch = Object.fromEntries(
            visibleFields.map((field) => {
              const raw = draft[field.key];
              if (field.type === "boolean") return [field.key, raw === true];
              const text = String(raw ?? "").trim();
              if (!text) {
                if (field.nullable) return [field.key, null];
                if (field.optional) return [field.key, ""];
                throw new Error(`Vul ${field.label.toLowerCase()} in.`);
              }
              return [
                field.key,
                field.type === "money"
                  ? euros(text)
                  : field.type === "number"
                    ? Number(text.replace(",", "."))
                    : text,
              ];
            }),
          );
          onSave(patch);
          setError("");
          dialog.current?.close();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Opslaan is niet gelukt.");
        }
      }}
    >
      <h2 id={headingId}>{title}</h2>
      <div className="biz-form-grid">
        {visibleFields.map((field) => (
          <label key={field.key}>
            <span>
              {field.labelFor?.(draft) ?? field.label}
              {field.nullable ? " (leeg = onbekend)" : ""}
            </span>
            {field.type === "select" ? (
              <Select
                value={String(draft[field.key] ?? "")}
                required={!field.optional && !field.nullable}
                onChange={(e) =>
                  setDraft({ ...draft, [field.key]: e.target.value })
                }
              >
                <option value="">Kies…</option>
                {field.options?.map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Select>
            ) : field.type === "boolean" ? (
              <Input
                type="checkbox"
                checked={draft[field.key] === true}
                onChange={(e) =>
                  setDraft({ ...draft, [field.key]: e.target.checked })
                }
              />
            ) : field.type === "textarea" ? (
              <Textarea
                value={String(draft[field.key] ?? "")}
                onChange={(e) =>
                  setDraft({ ...draft, [field.key]: e.target.value })
                }
              />
            ) : (
              <Input
                type={field.type === "date" ? "date" : "text"}
                inputMode={
                  field.type === "money" || field.type === "number"
                    ? "decimal"
                    : undefined
                }
                required={!field.optional && !field.nullable}
                value={String(draft[field.key] ?? "")}
                onChange={(e) =>
                  setDraft({ ...draft, [field.key]: e.target.value })
                }
              />
            )}
          </label>
        ))}
      </div>
      {error && (
        <p className="biz-error" role="alert">
          {error}
        </p>
      )}
      <div className="biz-actions">
        <Button variant="primary" type="submit">
          Opslaan
        </Button>
        <Button
          type="button"
          onClick={() => {
            if (inline) {
              setDraft(initialDraft());
              setError("");
            } else dialog.current?.close();
          }}
        >
          {inline ? "Wijzigingen terugzetten" : "Annuleren"}
        </Button>
      </div>
    </form>
  );
  if (inline)
    return (
      <div className="w-full" aria-label={title}>
        {form}
      </div>
    );
  return (
    <>
      <Button type="button" onClick={open}>
        {button}
      </Button>
      <dialog
        className="biz-dialog card-shell"
        ref={dialog}
        aria-labelledby={headingId}
      >
        {form}
      </dialog>
    </>
  );
}

export function Collection<T extends { id: string; label: string }>({
  title,
  items,
  fields,
  defaults,
  onSave,
  onDelete,
  summary,
  empty = "Nog niet ingevuld.",
  inline = false,
}: {
  title: string;
  items: T[];
  fields: Field[];
  defaults: Record<string, unknown>;
  onSave: (item: T) => void;
  onDelete: (id: string) => void;
  summary: (item: T) => ReactNode;
  empty?: string;
  inline?: boolean;
}) {
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formVersion, setFormVersion] = useState(0);
  const formRef = useRef<HTMLDivElement>(null);
  const editing = items.find((item) => item.id === editingId);
  return (
    <SurfaceCard className="space-y-4">
      <div className="biz-section-heading">
        <h2>{title}</h2>
        {!inline && (
          <EditDialog
            title={title + " — toevoegen"}
            button="Toevoegen"
            value={defaults}
            fields={fields}
            onSave={(patch) => {
              onSave({ ...defaults, ...patch, id: crypto.randomUUID() } as T);
              setError("");
            }}
          />
        )}
      </div>
      {items.length === 0 && <p className="biz-muted">{empty}</p>}
      <div className="biz-records">
        {items.map((item) => (
          <article key={item.id} className="biz-record">
            <div>
              <h3>{item.label}</h3>
              <div className="biz-record-detail">{summary(item)}</div>
            </div>
            <div className="biz-actions">
              {inline ? (
                <Button
                  onClick={() => {
                    setEditingId(item.id);
                    requestAnimationFrame(() => {
                      formRef.current?.scrollIntoView({
                        block: "center",
                        behavior: "smooth",
                      });
                    });
                  }}
                >
                  Bewerk {item.label}
                </Button>
              ) : (
                <EditDialog
                  title={title + " — bewerken"}
                  button={`Bewerk ${item.label}`}
                  value={item as unknown as Record<string, unknown>}
                  fields={fields}
                  onSave={(patch) => {
                    onSave({ ...item, ...patch });
                    setError("");
                  }}
                />
              )}
              <ConfirmAction
                button={`Verwijder ${item.label}`}
                message={`Verwijder '${item.label}' uit deze administratie? Gekoppelde betalingen moeten eerst worden verwijderd.`}
                onConfirm={() => {
                  onDelete(item.id);
                  if (editingId === item.id) setEditingId(null);
                  setError("");
                }}
              />
            </div>
          </article>
        ))}
      </div>
      {inline && (
        <div ref={formRef} className="space-y-3">
          <EditDialog
            key={`${editingId ?? "new"}-${formVersion}`}
            inline
            title={title + (editing ? " — bewerken" : " — toevoegen")}
            button="Opslaan"
            value={
              editing
                ? (editing as unknown as Record<string, unknown>)
                : defaults
            }
            fields={fields}
            onSave={(patch) => {
              onSave({
                ...defaults,
                ...editing,
                ...patch,
                id: editing?.id ?? crypto.randomUUID(),
              } as T);
              setEditingId(null);
              setFormVersion((v) => v + 1);
              setError("");
            }}
          />
          {editing && (
            <Button onClick={() => setEditingId(null)}>
              Stoppen met bewerken
            </Button>
          )}
        </div>
      )}
      {error && (
        <p className="biz-error" role="alert">
          {error}
        </p>
      )}
    </SurfaceCard>
  );
}
