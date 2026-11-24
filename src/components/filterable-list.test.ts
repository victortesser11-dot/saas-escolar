import { describe, expect, it } from "vitest";
import { normalizeSearch } from "./filterable-list";

describe("normalizeSearch", () => {
  it("ignora acentos, maiúsculas e espaços extras", () => {
    expect(normalizeSearch("  Avaliação  de FRAÇÕES ")).toBe("avaliacao de fracoes");
    expect(normalizeSearch("7º ano B")).toBe("7º ano b");
  });
});
