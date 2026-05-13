import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import BuchholzRounds from "./BuchholzRounds";
import type { Team, Round } from "../types/hltvTypes";

const teams: Team[] = [
  { id: 1, name: "Alpha", logo: "", seed: 1, region: "EU", wins: 0, losses: 0, buchholzScore: 0 },
  { id: 2, name: "Bravo", logo: "", seed: 2, region: "EU", wins: 0, losses: 0, buchholzScore: 0 },
];

const rounds: Round[] = [
  {
    roundNumber: 1,
    status: "pending",
    matches: [
      {
        team1Id: 1,
        team2Id: 2,
        winner: null,
        team1Score: 0,
        team2Score: 0,
        format: "BO3",
        status: "PENDING",
      },
    ],
  },
];

describe("BuchholzRounds", () => {
  it("renders the round header without crashing", () => {
    render(
      <BuchholzRounds
        stage="phase1"
        rounds={rounds}
        teams={teams}
        onMatchResult={() => {}}
        onStageChange={() => {}}
        currentStage="phase1"
      />,
    );
    expect(screen.getByText(/Ronda\s+1/)).toBeInTheDocument();
  });
});
