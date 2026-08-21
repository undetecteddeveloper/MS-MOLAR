// @vitest-environment jsdom

// C-14 `TransferDetails` — plan Task 4.3.
// UI Spec:  docs/ui-spec/subscription-ui-spec.md § Component: `TransferDetails` — C-14
// Design:   docs/design/subscription-frontend-design.md § C-14, FE-AC-14/15/16
//
// THIS COMPONENT IS THE PAYMENT PATH, NOT A CAPTION FOR THE QR. A QR is an
// image; if it is the only route, the flow is unusable for a screen-reader
// user and for anyone whose camera will not scan. So every claim below is
// about text a user can read, select and retype.
//
// THE FOUR FIXTURE VALUES ARE FOUR DIFFERENT STRINGS, AND THAT IS LOAD-BEARING.
// Account number, account holder, amount and memo are all rendered as text;
// seeding two of them with the same value would make a swap between the two
// invisible, which is exactly how a defect got through earlier in this feature.
//
// THE AMOUNT IS COMPARED AGAINST THE QR PAYLOAD, not against a re-run of the
// formatter. The expected string is written out literally ("39,000 VND"), and
// the payload's EMVCo tag 54 is parsed independently, so neither side of the
// comparison is produced by the code under test.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

import { renderServerTree } from "@/app/(billing)/me/orders/__tests__/renderServerTree";
import { en } from "@/lib/i18n/dictionaries/en";
import { TransferDetails } from "../_components/TransferDetails";

// The same four values the S-06 fixtures use elsewhere: four distinguishable
// strings, one number.
type Fields = {
  accountNumber: string;
  accountName: string;
  amountVnd: number;
  memo: string;
};

const FIELDS: Fields = {
  accountNumber: "19001234567890",
  accountName: "CONG TY MS MOLAR",
  amountVnd: 39000,
  memo: "MSMOLAR3100000000002",
};

// A VietQR/EMVCo payload carrying the SAME amount in tag 54 ("54" + length
// "05" + "39000"). The test parses it back out rather than trusting a comment.
const QR_PAYLOAD =
  "00020101021238580010A000000727012800069704220114190012345678900208QRIBFTTA53037045405390005802VN6304ABCD";

/** EMVCo TLV reader — tag 54 is the transaction amount. Written here, not
 *  imported, so the QR side of the comparison shares no code with the screen. */
function emvcoAmount(payload: string): number {
  let i = 0;
  while (i + 4 <= payload.length) {
    const tag = payload.slice(i, i + 2);
    const len = Number(payload.slice(i + 2, i + 4));
    const value = payload.slice(i + 4, i + 4 + len);
    if (tag === "54") return Number(value);
    i += 4 + len;
  }
  throw new Error("the payload fixture carries no tag 54");
}

async function render(overrides: Partial<Fields> = {}) {
  const { container } = await renderServerTree(await TransferDetails({ ...FIELDS, ...overrides }));
  const dl = container.querySelector("dl");
  if (dl === null) throw new Error("TransferDetails rendered no <dl>");
  const terms = [...dl.querySelectorAll("dt")].map((n) => (n.textContent ?? "").trim());
  const values = [...dl.querySelectorAll("dd")].map((n) => (n.textContent ?? "").trim());
  return { container, dl, terms, values };
}

describe("C-14 TransferDetails — the four pairs, in the fixed order", () => {
  // ==========================================================================
  // REFERENCE CONTRACT (UI Spec C-14, structure-order): Bank account number →
  // Account holder → Amount → Transfer memo.
  //
  // Rejects: any reordering; a pair rendered outside the <dl>; a label
  // hard-coded in English rather than resolved through t(); and — because the
  // four fixture values differ — any swap of two values between pairs.
  // ==========================================================================
  it("renders exactly four pairs in the specified order with their own values", async () => {
    const { terms, values } = await render();

    expect(terms).toEqual([
      en["billing.checkout.account"],
      en["billing.checkout.accountName"],
      en["billing.checkout.amountLabel"],
      en["billing.checkout.memo"],
    ]);
    expect(values).toEqual([
      "19001234567890",
      "CONG TY MS MOLAR",
      "39,000 VND",
      "MSMOLAR3100000000002",
    ]);
  });

  // ==========================================================================
  // FE-AC-16 / UI-D13. Rejects: `t("billing.amount", { amount: amountVnd })`,
  // which substitutes with a raw String() and prints "39000 VND" beside a QR a
  // banking app shows as 39.000 — a user reading two different sums stops
  // paying. Also rejects a hard-coded unit that bypasses the dictionary.
  //
  // The expected string is a LITERAL, and the QR side is parsed by a reader
  // written in this file, so neither side is produced by the component.
  // ==========================================================================
  it("renders the amount formatted, and equal to the amount the QR encodes", async () => {
    const { values } = await render();
    const rendered = values[2];

    expect(rendered).toBe("39,000 VND");
    expect(rendered).not.toBe("39000 VND");
    expect(rendered).toContain(en["billing.amount"].replace("{amount}", "").trim());

    // Strip grouping and the unit, then compare NUMBERS with the payload.
    const renderedNumber = Number(rendered.replace(/[^\d]/g, ""));
    expect(emvcoAmount(QR_PAYLOAD)).toBe(39000);
    expect(renderedNumber).toBe(emvcoAmount(QR_PAYLOAD));
  });

  // ==========================================================================
  // Rejects: a grouped account number ("1 900 1234 567 890") — a user pastes it
  // into a bank app that rejects spaces; a value element without `select-all`,
  // which is this repository's whole substitute for a clipboard button; a memo
  // without `break-all`, which overflows the 360px column.
  // ==========================================================================
  it("makes the copied fields monospaced, selectable and unbreakable in the wrong places", async () => {
    const { dl } = await render();
    const [account, holder, amount, memo] = [...dl.querySelectorAll("dd")].map(
      (n) => (n.getAttribute("class") ?? "").split(/\s+/)
    );

    for (const cls of ["font-mono", "select-all"]) {
      expect(account).toContain(cls);
      expect(memo).toContain(cls);
    }
    expect(memo).toContain("break-all");
    expect(amount).toContain("select-all");
    // The account holder is plain text — no monospace, and nothing to copy.
    expect(holder).not.toContain("font-mono");

    // The account number is the raw digit run, ungrouped.
    const values = [...dl.querySelectorAll("dd")].map((n) => (n.textContent ?? "").trim());
    expect(values[0]).toMatch(/^\d+$/);
  });

  // ==========================================================================
  // THE MEMO WARNING IS ASSERTED BY ITS TEXT, NOT ITS PRESENCE. The memo is the
  // field that loses a user their money: a transfer without it arrives and
  // matches no order. A test that only counted elements would pass against a
  // warning that says nothing.
  // ==========================================================================
  it("states, in words, what happens to a transfer sent without the memo", async () => {
    const { container } = await render();
    const text = container.textContent ?? "";

    expect(text).toContain(en["billing.checkout.memoWarning"]);
    // The sentence names the consequence, not just the instruction.
    expect(en["billing.checkout.memoWarning"].toLowerCase()).toContain("cannot be matched");
  });

  // ==========================================================================
  // "Selectable, not copy-to-clipboard" (UI Spec C-14). Rejects: a clipboard
  // utility smuggled in with this component — it is a new interaction pattern
  // with its own permission, feedback and announcement obligations.
  // ==========================================================================
  it("introduces no clipboard affordance", () => {
    const src = readFileSync(
      join(import.meta.dirname, "..", "_components", "TransferDetails.tsx"),
      "utf8"
    );
    expect(src).toContain("export async function TransferDetails");
    expect(src).not.toContain("navigator.clipboard");
    expect(src).not.toContain("execCommand");
    expect(src).not.toMatch(/<button\b/);
  });
});

describe("C-14 TransferDetails — Partial: a missing field is stated, never blank", () => {
  // Each row removes ONE field. The other three must survive intact, so a
  // "render nothing when anything is missing" implementation is red.
  const MISSING: Array<{ label: string; override: Partial<Fields>; survives: string[] }> = [
    {
      label: "account number",
      override: { accountNumber: "" },
      survives: ["CONG TY MS MOLAR", "39,000 VND", "MSMOLAR3100000000002"],
    },
    {
      label: "account holder",
      override: { accountName: "" },
      survives: ["19001234567890", "39,000 VND", "MSMOLAR3100000000002"],
    },
    {
      label: "memo",
      override: { memo: "   " },
      survives: ["19001234567890", "CONG TY MS MOLAR", "39,000 VND"],
    },
    {
      label: "amount (a non-finite number is a broken row, not a zero)",
      override: { amountVnd: Number.NaN },
      survives: ["19001234567890", "CONG TY MS MOLAR", "MSMOLAR3100000000002"],
    },
  ];

  for (const row of MISSING) {
    // ========================================================================
    // Rejects: an empty <dd> that reads as a field the user failed to notice;
    // an em dash, which reads as "the value is nothing"; the whole block
    // disappearing; and a silent render that never tells the user to stop.
    // ========================================================================
    it(`omits the pair and says so when the ${row.label} is missing`, async () => {
      const { container, values } = await render(row.override);

      expect(values).toHaveLength(3);
      expect(values).toEqual(row.survives);
      for (const value of values) expect(value.length).toBeGreaterThan(0);

      const text = container.textContent ?? "";
      expect(text).toContain(en["billing.checkout.fieldMissing"]);
      expect(text).not.toContain("—");
    });
  }

  // ==========================================================================
  // The complement: a complete order must NOT carry the warning, or the
  // sentence becomes noise every user learns to skip.
  // ==========================================================================
  it("says nothing about missing details when all four are present", async () => {
    const { container } = await render();

    expect(container.textContent ?? "").not.toContain(en["billing.checkout.fieldMissing"]);
  });
});
