import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from "./Table";

describe("Table", () => {
  it("renders headers and labeled cells", () => {
    render(
      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>Team</TableHeader>
            <TableHeader>Wins</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          <TableRow>
            <TableCell label="Team">Spirit</TableCell>
            <TableCell label="Wins">3</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(screen.getByText("Team")).toBeInTheDocument();
    expect(screen.getByText("Spirit")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    // mobile label is also rendered (hidden via Tailwind class)
    expect(screen.getAllByText(/Team:/i).length).toBeGreaterThan(0);
  });
});
