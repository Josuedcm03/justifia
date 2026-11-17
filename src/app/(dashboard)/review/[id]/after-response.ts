import { after } from "next/server";

// Runs a mail dispatch after the response of a Server Action (`after()`), the
// post-commit send of the teacher remissions and of the coordination notices.
// The write the action just committed never depends on it: a failure of the
// work, or of the scheduling itself, is logged by error name only (an error
// message could carry an address) and the retry job and "Reenviar" recover the
// rows. `event` names the log lines: `<event>_failed`, `<event>_not_scheduled`.

function errorCode(error: unknown): string {
  return error instanceof Error ? error.name : "unknown";
}

export function afterResponse(event: string, work: () => Promise<unknown>) {
  try {
    after(async () => {
      try {
        await work();
      } catch (error) {
        console.error(`${event}_failed`, { code: errorCode(error) });
      }
    });
  } catch (error) {
    console.error(`${event}_not_scheduled`, { code: errorCode(error) });
  }
}
