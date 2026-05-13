import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge } from "./Badge";

describe("Badge", () => {
  it("renders content and applies the variant class", () => {
    render(<Badge variant="success">LIVE</Badge>);
    const el = screen.getByText("LIVE");
    expect(el).toBeInTheDocument();
    expect(el.className).toContain("success");
  });
});
