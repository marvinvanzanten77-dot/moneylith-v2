import * as Sentry from "@sentry/node";

const dsn = process.env.SENTRY_DSN;
const environment = process.env.SENTRY_ENVIRONMENT || process.env.VERCEL_ENV || "development";
const release = process.env.SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA || "";

let initialized = false;
export function initSentry() {
  if (initialized || !dsn) return;
  Sentry.init({
    dsn,
    environment,
    release,
    tracesSampleRate: 0,
    beforeSend(event) {
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
  initialized = true;
}

export { Sentry };
