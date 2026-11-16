import { beforeEach, describe, expect, it, vi } from "vitest";

const sendMail = vi.fn().mockResolvedValue(undefined);
const createTransport = vi.fn(() => ({ sendMail }));
vi.mock("nodemailer", () => ({ createTransport, default: { createTransport } }));

import { ConsoleMailer, SmtpMailer, createMailer } from "./mailer.js";

describe("mailer", () => {
  beforeEach(() => {
    sendMail.mockClear();
  });

  it("uses the configured From header", async () => {
    await new SmtpMailer("smtp://u:p@smtp.example:587", "Wikognito <no-reply@wikognito.test>").send(
      {
        to: "a@example.com",
        subject: "Hi",
        text: "Body",
      },
    );
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: "Wikognito <no-reply@wikognito.test>", to: "a@example.com" }),
    );
  });

  it("falls back to console logging without an SMTP URL", () => {
    expect(createMailer("", "x")).toBeInstanceOf(ConsoleMailer);
    expect(createMailer("smtp://u:p@h:587", "x")).toBeInstanceOf(SmtpMailer);
  });
});
