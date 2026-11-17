import { describe, expect, it } from "vitest";
import { normalizeRegistrationCode } from "./registration-code";
import { classSchema, studentSchema } from "./validation";

describe("normalizeRegistrationCode", () => {
  it("remove espaços e usa maiúsculas (igual ao banco)", () => {
    expect(normalizeRegistrationCode("  2024a 013 ")).toBe("2024A013");
  });
});

describe("studentSchema", () => {
  it("normaliza nome e matrícula", () => {
    expect(studentSchema.parse({ fullName: "  Ana   Souza ", registrationCode: "ab 12" })).toEqual({
      fullName: "Ana Souza",
      registrationCode: "AB12",
    });
  });

  it("aceita os símbolos usuais em matrículas", () => {
    expect(
      studentSchema.safeParse({ fullName: "Ana Souza", registrationCode: "2024.01/7-B_3" }).success,
    ).toBe(true);
  });

  it("rejeita matrícula com caracteres especiais", () => {
    const result = studentSchema.safeParse({ fullName: "Ana Souza", registrationCode: "12#4" });
    expect(result.success).toBe(false);
  });
});

describe("classSchema", () => {
  it("aceita ano letivo vazio", () => {
    expect(classSchema.parse({ name: " 7º ano  B ", schoolYear: "" })).toEqual({
      name: "7º ano B",
      schoolYear: null,
    });
  });

  it("converte o ano letivo", () => {
    expect(classSchema.parse({ name: "8A", schoolYear: "2026" }).schoolYear).toBe(2026);
  });

  it("rejeita ano letivo inválido", () => {
    const result = classSchema.safeParse({ name: "8A", schoolYear: "26" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Informe um ano letivo válido, como 2026.");
    }
  });

  it("exige nome", () => {
    expect(classSchema.safeParse({ name: "   ", schoolYear: "" }).success).toBe(false);
  });
});
