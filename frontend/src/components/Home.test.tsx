import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

vi.mock("../services/tournamentService", () => ({
  getMajorData: vi.fn().mockResolvedValue(null),
  updateMatchResult: vi.fn(),
  changeStage: vi.fn(),
}));

import Home from "./Home";

describe("Home", () => {
  it("shows the loading state while data is null", () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Cargando torneo/i)).toBeInTheDocument();
  });
});
