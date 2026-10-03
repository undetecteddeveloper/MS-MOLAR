// authErrors — unit tests. Hàm thuần, không mock.

import { describe, expect, it } from "vitest";
import { mapAuthError } from "./authErrors";

describe("mapAuthError", () => {
  it("maps the SMTP failure seen on the sign-up form to sendFailed", () => {
    expect(
      mapAuthError({ code: "unexpected_failure", status: 500, message: "Error sending confirmation email" })
    ).toBe("auth.error.sendFailed");
  });

  it("maps wrong email/password by code and by legacy message", () => {
    expect(mapAuthError({ code: "invalid_credentials", status: 400 })).toBe(
      "auth.error.invalidCredentials"
    );
    expect(mapAuthError({ message: "Invalid login credentials" })).toBe(
      "auth.error.invalidCredentials"
    );
  });

  it("maps an unverified email", () => {
    expect(mapAuthError({ code: "email_not_confirmed", status: 400 })).toBe(
      "auth.error.emailNotConfirmed"
    );
  });

  it("maps provider rate limits, including a bare 429", () => {
    expect(mapAuthError({ code: "over_email_send_rate_limit", status: 429 })).toBe(
      "auth.error.rateLimited"
    );
    expect(mapAuthError({ status: 429 })).toBe("auth.error.rateLimited");
  });

  it("maps a weak password rejected by the provider", () => {
    expect(mapAuthError({ code: "weak_password", status: 422 })).toBe("auth.error.weakPassword");
  });

  it("falls back to generic and never returns the provider sentence", () => {
    const key = mapAuthError({ message: "User not allowed to do the thing", status: 418 });
    expect(key).toBe("auth.error.generic");
  });
});
