import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

// Extracted from the personal Intent form; shared by both workspaces.
export const controlClass =
  "mt-1 block w-full rounded-lg border border-white/50 bg-white/80 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-purple-400 focus:ring-2 focus:ring-purple-200 disabled:opacity-50 disabled:cursor-not-allowed";
export function Input({
  className,
  type,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      className={className ?? (type === "checkbox" ? undefined : controlClass)}
      {...props}
    />
  );
}
export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={className ?? controlClass} {...props} />;
}
export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={className ?? controlClass} {...props} />;
}
export function SurfaceCard({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`card-shell p-5 text-slate-900 ${className}`} {...props} />
  );
}
export const actionButtonClass =
  "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-amber-400 hover:shadow";
export const primaryButtonClass =
  "rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400";
export function Button({
  className,
  variant = "secondary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "secondary" | "primary";
}) {
  return (
    <button
      className={
        className ??
        (variant === "primary" ? primaryButtonClass : actionButtonClass)
      }
      {...props}
    />
  );
}
export function ReviewPanel({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-xl border border-slate-700 bg-slate-900/70 p-4 text-sm text-slate-200 ${className}`}
      {...props}
    />
  );
}
