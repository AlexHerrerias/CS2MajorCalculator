import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

vi.mock("../../services/tournamentService", () => ({
  getFantasyLeaderboard: vi.fn(
    () =>
      new Promise(() => {
        // Never resolves — keeps the component in its loading state for the smoke test.
      }),
  ),
}));

import FantasyLeaderboard from "./FantasyLeaderboard";

describe("FantasyLeaderboard", () => {
  it("renders the loading state while data is fetched", () => {
    render(
      <MemoryRouter>
        <FantasyLeaderboard />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Cargando leaderboard/i)).toBeInTheDocument();
  });
});
