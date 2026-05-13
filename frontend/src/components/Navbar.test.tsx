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

  it("renders the Fantasy link, the login affordance and the hamburger button", () => {
    renderNavbar();
    expect(screen.getByRole("link", { name: "Fantasy" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Abrir menú principal/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Login con Twitch/i).length).toBeGreaterThan(0);
  });

  it("opens the mobile slide-in panel when the hamburger is clicked", async () => {
    renderNavbar();
    await userEvent.setup().click(screen.getByLabelText(/Abrir menú principal/i));
    expect(screen.getByText("Menú")).toBeInTheDocument();
    expect(screen.getByLabelText(/Cerrar menú/i)).toBeInTheDocument();
  });
});
