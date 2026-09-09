import { useId, useRef, useState, type ReactNode } from "react";
import { euros } from "./model";

export type Field = {
  key: string;
  label: string;
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
      <button
        className="biz-button"
        type="button"
        onClick={() => {
          setError("");
          dialog.current?.showModal();
        }}
      >
        {button}
      </button>
      <dialog className="biz-dialog" ref={dialog} aria-labelledby={heading}>
        <div className="biz-confirm">
          <h2 id={heading}>{button}</h2>
          <p>{message}</p>
          {error && (
            <p role="alert" className="biz-error">
              {error}
            </p>
          )}
          <div className="biz-actions">
            <button
              type="button"
              className="biz-button"
              autoFocus
              onClick={() => dialog.current?.close()}
            >
              Annuleren
            </button>
            <button
              type="button"
              className="biz-button primary"
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
            </button>
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
}: {
  title: string;
  button: string;
  value: Record<string, unknown>;
  fields: Field[];
  onSave: (patch: Record<string, unknown>) => void;
}) {
  const headingId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<Record<string, string | boolean>>({});
  const [error, setError] = useState("");
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
  return (
    <>
      <button className="biz-button" type="button" onClick={open}>
        {button}
      </button>
      <dialog className="biz-dialog" ref={dialog} aria-labelledby={headingId}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            try {
              const patch = Object.fromEntries(
                fields.map((field) => {
                  const raw = draft[field.key];
                  if (field.type === "boolean")
                    return [field.key, raw === true];
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
              dialog.current?.close();
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Opslaan is niet gelukt.",
              );
            }
          }}
        >
          <h2 id={headingId}>{title}</h2>
          <div className="biz-form-grid">
            {fields.map((field) => (
              <label key={field.key}>
                <span>
                  {field.label}
                  {field.nullable ? " (leeg = onbekend)" : ""}
                </span>
                {field.type === "select" ? (
                  <select
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
                  </select>
                ) : field.type === "boolean" ? (
                  <input
                    type="checkbox"
                    checked={draft[field.key] === true}
                    onChange={(e) =>
                      setDraft({ ...draft, [field.key]: e.target.checked })
                    }
                  />
                ) : field.type === "textarea" ? (
                  <textarea
                    value={String(draft[field.key] ?? "")}
                    onChange={(e) =>
                      setDraft({ ...draft, [field.key]: e.target.value })
                    }
                  />
                ) : (
                  <input
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
            <button className="biz-button primary" type="submit">
              Opslaan
            </button>
            <button
              className="biz-button"
              type="button"
              onClick={() => dialog.current?.close()}
            >
              Annuleren
            </button>
          </div>
        </form>
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
}: {
  title: string;
  items: T[];
  fields: Field[];
  defaults: Record<string, unknown>;
  onSave: (item: T) => void;
  onDelete: (id: string) => void;
  summary: (item: T) => ReactNode;
  empty?: string;
}) {
  const [error, setError] = useState("");
  return (
    <section className="biz-card">
      <div className="biz-section-heading">
        <h2>{title}</h2>
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
              <ConfirmAction
                button={`Verwijder ${item.label}`}
                message={`Verwijder '${item.label}' uit deze administratie? Gekoppelde betalingen moeten eerst worden verwijderd.`}
                onConfirm={() => {
                  onDelete(item.id);
                  setError("");
                }}
              />
            </div>
          </article>
        ))}
      </div>
      {error && (
        <p className="biz-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
