import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Tabs } from "./Tabs";

describe("Tabs", () => {
  it("renders all tab labels and the first panel content", () => {
    render(
      <Tabs
        tabs={[
          { label: "Standings", content: <span>Standings content</span> },
          { label: "Picks", content: <span>Picks content</span> },
        ]}
      />,
    );
    expect(screen.getByRole("tab", { name: "Standings" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Picks" })).toBeInTheDocument();
    expect(screen.getByText("Standings content")).toBeInTheDocument();
  });
});
