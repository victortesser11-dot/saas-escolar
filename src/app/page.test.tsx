import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("Página inicial provisória", () => {
  it("exibe o nome da plataforma", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 1, name: "Avaliações Escolares" })).toBeVisible();
  });
});
