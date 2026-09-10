import type { ReactNode } from "react";
import { Input, Select, SurfaceCard } from "./WorkspaceUI";
import type { GuidedIntent } from "../logic/businessIntent";
export function IntentQuestions<S extends string, P extends string>({
  value,
  onChange,
  strategies,
  pressures,
  business = false,
  readOnly = false,
  children,
}: {
  value: GuidedIntent<S, P>;
  onChange: (value: GuidedIntent<S, P>) => void;
  strategies: readonly { value: S; label: string; hint: string }[];
  pressures: readonly { value: P; label: string }[];
  business?: boolean;
  readOnly?: boolean;
  children?: ReactNode;
}) {
  const horizons = [
    { value: "3_maanden", label: "3 maanden" },
    { value: "1_jaar", label: "1 jaar" },
    { value: "5_jaar", label: "5 jaar" },
  ] as const;
  const styles = [
    {
      value: "spiegelend",
      label: "Spiegelend",
      example: "Ik leg terug wat je invult en stel verdiepende vragen.",
    },
    {
      value: "confronterend",
      label: "Confronterend",
      example: "Ik ben direct en benoem risico’s zonder omwegen.",
    },
    {
      value: "ondersteunend",
      label: "Ondersteunend",
      example: "Ik blijf vriendelijk en help je stap voor stap.",
    },
  ] as const;
  return (
    <SurfaceCard className="space-y-6">
      <h2 className="text-lg font-semibold">
        {business ? "Zakelijke strategie" : "Startpunt"}
      </h2>
      <p className="text-sm text-slate-500">
        Dit is het vertrekpunt van je {business ? "zakelijke" : "financiële"}{" "}
        koers. Eén keer invullen, later altijd aan te passen.
      </p>
      <div className="space-y-4">
        <label className="block text-sm font-semibold text-slate-800">
          Wat is je primaire {business ? "zakelijke" : "financiële"} strategie
          voor de komende periode?
          <Select
            value={value.primaryGoal ?? ""}
            disabled={readOnly}
            onChange={(e) =>
              onChange({
                ...value,
                primaryGoal: (e.target.value || null) as S | null,
              })
            }
          >
            <option value="">- kies -</option>
            {strategies.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          {value.primaryGoal && (
            <p className="mt-1 text-xs text-slate-500">
              {strategies.find((o) => o.value === value.primaryGoal)?.hint}
            </p>
          )}
        </label>
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-slate-800">
            Waar zit op dit moment de meeste druk
            {business ? " in je bedrijf" : ""}? (meerdere mogelijk)
          </legend>
          <div className="grid gap-2 md:grid-cols-2">
            {pressures.map((o) => (
              <label
                key={o.value}
                className="flex items-center gap-2 rounded-lg border border-white/40 bg-white/70 px-3 py-2 text-sm text-slate-800"
              >
                <Input
                  type="checkbox"
                  disabled={readOnly}
                  checked={value.mainPressure.includes(o.value)}
                  onChange={() =>
                    onChange({
                      ...value,
                      mainPressure: value.mainPressure.includes(o.value)
                        ? value.mainPressure.filter((p) => p !== o.value)
                        : [...value.mainPressure, o.value],
                    })
                  }
                />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block text-sm font-semibold text-slate-800">
          Binnen welke tijd moet dit {business ? "zakelijk" : "financieel"}{" "}
          voelbaar veranderd zijn?
          <Select
            disabled={readOnly}
            value={value.timeHorizon ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                timeHorizon: (e.target.value ||
                  null) as GuidedIntent["timeHorizon"],
              })
            }
          >
            <option value="">- kies -</option>
            {horizons.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="block text-sm font-semibold text-slate-800">
          Hoe wil je dat de AI met je praat?
          <Select
            disabled={readOnly}
            value={value.aiStyle ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                aiStyle: (e.target.value || null) as GuidedIntent["aiStyle"],
              })
            }
          >
            <option value="">- kies -</option>
            {styles.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          {value.aiStyle && (
            <p className="mt-1 text-xs text-slate-500">
              Voorbeeld:{" "}
              {styles.find((o) => o.value === value.aiStyle)?.example}
            </p>
          )}
        </label>
      </div>
      {children}
    </SurfaceCard>
  );
}
