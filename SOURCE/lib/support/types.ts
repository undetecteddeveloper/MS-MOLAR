// SOURCE/lib/support/types.ts — không side-effect.
export type TicketIntent = "bug" | "suggestion" | "question";
export type TicketStatus = "new" | "in_progress" | "resolved";

export type SubmitTicketResult =
  | { ok: true; shortRef: string }
  | { error: "unauthenticated" | "rate_limited" | "invalid" | "screenshot_rejected" | "server" };

export type TicketActionState = { error?: string; info?: string } | null; // mirrors ModerationState shape
