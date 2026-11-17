import { describe, expect, it } from "vitest";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  toFieldErrors,
} from "./validation";

describe("signUpSchema", () => {
  const valid = {
    fullName: "  Maria Silva ",
    email: " Maria@Escola.COM ",
    password: "senha-forte-1",
  };

  it("normaliza nome e e-mail", () => {
    const result = signUpSchema.parse(valid);
    expect(result.fullName).toBe("Maria Silva");
    expect(result.email).toBe("maria@escola.com");
  });

  it("exige senha com pelo menos 8 caracteres", () => {
    const result = signUpSchema.safeParse({ ...valid, password: "1234567" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(toFieldErrors(result.error).password).toMatch(/8 caracteres/);
    }
  });

  it("rejeita e-mail inválido com mensagem em português", () => {
    const result = signUpSchema.safeParse({ ...valid, email: "maria@" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(toFieldErrors(result.error).email).toBe("Informe um e-mail válido.");
    }
  });

  it("exige nome", () => {
    const result = signUpSchema.safeParse({ ...valid, fullName: " " });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(toFieldErrors(result.error).fullName).toBeDefined();
    }
  });
});

describe("signInSchema", () => {
  it("aceita qualquer senha não vazia (a validação real é do servidor de autenticação)", () => {
    expect(signInSchema.safeParse({ email: "a@b.com", password: "x" }).success).toBe(true);
  });

  it("acusa campos ausentes", () => {
    const result = signInSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = toFieldErrors(result.error);
      expect(errors.email).toBe("Informe seu e-mail.");
      expect(errors.password).toBe("Informe sua senha.");
    }
  });
});

describe("forgotPasswordSchema", () => {
  it("valida o e-mail", () => {
    expect(forgotPasswordSchema.safeParse({ email: "a@b.com" }).success).toBe(true);
    expect(forgotPasswordSchema.safeParse({ email: "abc" }).success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("exige confirmação igual", () => {
    const result = resetPasswordSchema.safeParse({
      password: "nova-senha-123",
      confirmPassword: "outra-senha-123",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(toFieldErrors(result.error).confirmPassword).toBe("As senhas não conferem.");
    }
  });

  it("aceita senhas iguais e válidas", () => {
    expect(
      resetPasswordSchema.safeParse({
        password: "nova-senha-123",
        confirmPassword: "nova-senha-123",
      }).success,
    ).toBe(true);
  });
});
