import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import BuchholzRounds from "./BuchholzRounds";
import type { Team, Round } from "../types/hltvTypes";

const baseTeams: Team[] = [
  { id: 1, name: "Alpha", logo: "", seed: 1, region: "EU", wins: 0, losses: 0, buchholzScore: 0 },
  { id: 2, name: "Bravo", logo: "", seed: 2, region: "EU", wins: 0, losses: 0, buchholzScore: 0 },
];

const pendingRounds: Round[] = [
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
        rounds={pendingRounds}
        teams={baseTeams}
        onMatchResult={() => {}}
        onStageChange={() => {}}
        currentStage="phase1"
      />,
    );
    expect(screen.getByText(/Ronda\s+1/)).toBeInTheDocument();
  });

  it("renders the qualified-teams panel once every round is completed and someone has 3 wins", () => {
    // Simulate a finished Swiss stage where Alpha has reached 3-0 and Bravo is
    // out 0-3. The component should surface its "qualified to the next stage"
    // section.
    const qualifiedTeams: Team[] = [
      { ...baseTeams[0], wins: 3, losses: 0 },
      { ...baseTeams[1], wins: 0, losses: 3 },
    ];
    const completedRounds: Round[] = [
      {
        roundNumber: 1,
        status: "completed",
        matches: [
          {
            team1Id: 1,
            team2Id: 2,
            winner: 1,
            team1Score: 2,
            team2Score: 0,
            format: "BO3",
            status: "FINISHED",
          },
        ],
      },
    ];

    render(
      <BuchholzRounds
        stage="phase1"
        rounds={completedRounds}
        teams={qualifiedTeams}
        onMatchResult={() => {}}
        onStageChange={() => {}}
        currentStage="phase1"
      />,
    );

    expect(
      screen.getByText(/Equipos Clasificados a la Siguiente Fase/i),
    ).toBeInTheDocument();
    // The qualified-teams grid must show the team with 3 wins.
    expect(screen.getByText("Alpha")).toBeInTheDocument();
  });
});
