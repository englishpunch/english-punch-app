import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { AppVersion } from "./AppVersion";

it("shows the canonical English Punch version", () => {
  render(<AppVersion />);

  expect(
    screen.getByLabelText("English Punch version 0.3.5")
  ).toHaveTextContent("v0.3.5");
});
