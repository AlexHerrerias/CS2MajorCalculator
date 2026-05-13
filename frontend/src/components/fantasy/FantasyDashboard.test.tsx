import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

vi.mock("../../services/tournamentService", () => ({
  getCurrentUserProfile: vi.fn().mockResolvedValue(null),
  getLocalMajorData: vi.fn().mockReturnValue(null),
  getMajorData: vi.fn().mockResolvedValue(null),
}));

import FantasyDashboard from "./FantasyDashboard";

describe("FantasyDashboard", () => {
  it("renders the loading state initially", () => {
    render(
      <MemoryRouter>
        <FantasyDashboard />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Cargando Dashboard/i)).toBeInTheDocument();
  });
});
