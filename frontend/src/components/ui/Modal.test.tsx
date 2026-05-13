import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Modal } from "./Modal";

describe("Modal", () => {
  it("renders title and content when open", () => {
    render(
      <Modal open onClose={() => {}} title="Confirm">
        <p>Are you sure?</p>
      </Modal>,
    );
    expect(screen.getByText("Confirm")).toBeInTheDocument();
    expect(screen.getByText("Are you sure?")).toBeInTheDocument();
  });

  it("hides content when closed", () => {
    render(
      <Modal open={false} onClose={() => {}} title="Confirm">
        <p>Are you sure?</p>
      </Modal>,
    );
    expect(screen.queryByText("Are you sure?")).not.toBeInTheDocument();
  });
});
