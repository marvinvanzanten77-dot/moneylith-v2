import React, { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: { sitekey: string; theme?: string; callback?: (token: string) => void }) => void;
    };
  }
}

type Props = {
  siteKey: string;
  onVerify: (token: string) => void;
  theme?: "light" | "dark" | "auto";
};

export const TurnstileWidget: React.FC<Props> = ({ siteKey, onVerify, theme = "dark" }) => {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!siteKey) return;
    const id = "cf-turnstile-script";
    if (!document.getElementById(id)) {
      const s = document.createElement("script");
      s.id = id;
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      s.async = true;
      document.body.appendChild(s);
    }

    const render = () => {
      if (window.turnstile && ref.current) {
        window.turnstile.render(ref.current, {
          sitekey: siteKey,
          theme,
          callback: onVerify,
        });
      }
    };

    // small delay to allow script load
    const t = setTimeout(render, 300);
    return () => clearTimeout(t);
  }, [siteKey, onVerify, theme]);

  return <div ref={ref} className="mt-2" />;
};
