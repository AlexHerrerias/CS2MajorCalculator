import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

vi.mock("../services/tournamentService", () => ({
  getAllTournaments: vi.fn().mockResolvedValue([]),
  getCurrentUserProfile: vi.fn().mockResolvedValue(null),
  twitchLogin: vi.fn(),
  logoutUser: vi.fn(),
}));

import Navbar from "./Navbar";

describe("Navbar", () => {
  const renderNavbar = () =>
    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    );

  // The hamburger button uses a visually-hidden `<span class="sr-only">` for its
  // label, which the accessibility tree exposes via the button's accessible name —
  // so we query by `role: button` + name regex rather than by label.
  const openMenuButton = () =>
    screen.getByRole("button", { name: /Abrir menú principal/i });

  it("renders the Fantasy link, the login affordance and the hamburger button", () => {
    renderNavbar();
    expect(screen.getByRole("link", { name: "Fantasy" })).toBeInTheDocument();
    expect(openMenuButton()).toBeInTheDocument();
    expect(screen.getAllByText(/Login con Twitch/i).length).toBeGreaterThan(0);
  });

  it("opens the mobile slide-in panel when the hamburger is clicked", async () => {
    renderNavbar();
    await userEvent.setup().click(openMenuButton());
    expect(screen.getByText("Menú")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cerrar menú/i })).toBeInTheDocument();
  });
});
