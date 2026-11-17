import { describe, expect, it } from "vitest";
import { GENERIC_AUTH_ERROR, authErrorMessage } from "./errors";

describe("authErrorMessage", () => {
  it("traduz credenciais inválidas sem revelar se o e-mail existe", () => {
    expect(authErrorMessage("invalid_credentials")).toBe("E-mail ou senha incorretos.");
  });

  it("usa mensagem genérica para códigos desconhecidos ou ausentes", () => {
    expect(authErrorMessage("algo_novo")).toBe(GENERIC_AUTH_ERROR);
    expect(authErrorMessage(undefined)).toBe(GENERIC_AUTH_ERROR);
    expect(authErrorMessage(null)).toBe(GENERIC_AUTH_ERROR);
  });
});
