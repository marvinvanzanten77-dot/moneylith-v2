import * as Sentry from "@sentry/react";

const dsn = import.meta.env.VITE_SENTRY_DSN;
const environment = import.meta.env.VITE_SENTRY_ENVIRONMENT ?? import.meta.env.MODE;
const release = import.meta.env.VITE_SENTRY_RELEASE ?? "";

if (dsn) {
  Sentry.init({
    dsn,
    environment,
    release,
    integrations: [], // TODO: voeg selectieve integrations toe zonder ruis
    tracesSampleRate: 0, // geen tracing zonder expliciete keuze
    beforeSend(event) {
      // scrub mogelijke PII in messages
      if (event.request) {
        delete (event.request as any).data;
      }
      if (event.user) {
        delete (event.user as any).email;
        delete (event.user as any).id;
      }
      return event;
    },
  });
}

export { Sentry };
