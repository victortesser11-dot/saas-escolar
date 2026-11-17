import { describe, expect, it } from "vitest";
import { getAuthRedirect, safeNextPath } from "./routes";

describe("getAuthRedirect", () => {
  it("manda visitante do painel para o login", () => {
    expect(getAuthRedirect("/painel", false)).toBe("/entrar");
  });

  it("preserva a página interna desejada no parâmetro next", () => {
    expect(getAuthRedirect("/painel/turmas", false)).toBe("/entrar?next=%2Fpainel%2Fturmas");
  });

  it("exige login para redefinir senha", () => {
    expect(getAuthRedirect("/redefinir-senha", false)).toBe("/entrar?next=%2Fredefinir-senha");
  });

  it("manda usuário autenticado das páginas de login para o painel", () => {
    expect(getAuthRedirect("/entrar", true)).toBe("/painel");
    expect(getAuthRedirect("/cadastro", true)).toBe("/painel");
    expect(getAuthRedirect("/recuperar-senha", true)).toBe("/painel");
  });

  it("não interfere em rotas públicas", () => {
    expect(getAuthRedirect("/", false)).toBeNull();
    expect(getAuthRedirect("/", true)).toBeNull();
    expect(getAuthRedirect("/auth/callback", false)).toBeNull();
  });

  it("não confunde prefixos parecidos", () => {
    expect(getAuthRedirect("/painelzinho", false)).toBeNull();
    expect(getAuthRedirect("/entrarx", true)).toBeNull();
  });

  it("deixa o usuário autenticado acessar o painel", () => {
    expect(getAuthRedirect("/painel", true)).toBeNull();
  });
});

describe("safeNextPath", () => {
  it("aceita caminhos internos", () => {
    expect(safeNextPath("/painel")).toBe("/painel");
    expect(safeNextPath("/painel/turmas?x=1")).toBe("/painel/turmas?x=1");
  });

  it.each([
    ["URL externa", "https://malicioso.com"],
    ["URL relativa ao protocolo", "//malicioso.com"],
    ["barra invertida", "/\\malicioso.com"],
    ["caminho relativo", "painel"],
    ["vazio", ""],
    ["caractere de controle", "/painel\n"],
  ])("rejeita %s", (_label, value) => {
    expect(safeNextPath(value)).toBe("/painel");
  });

  it("rejeita valores que não são texto", () => {
    expect(safeNextPath(null)).toBe("/painel");
    expect(safeNextPath(undefined)).toBe("/painel");
    expect(safeNextPath(42)).toBe("/painel");
  });

  it("usa o fallback informado", () => {
    expect(safeNextPath(null, "/redefinir-senha")).toBe("/redefinir-senha");
  });
});
