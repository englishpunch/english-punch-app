import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import OAuthConsentView from "./OAuthConsentView";

it("shows ChatGPT permissions and sends an explicit consent decision", async () => {
  const user = userEvent.setup();
  const onDecision = vi.fn();

  render(
    <OAuthConsentView
      scopes={["cards:read", "reviews:read"]}
      isSubmitting={false}
      error={null}
      onDecision={onDecision}
    />
  );

  expect(
    screen.getByRole("heading", { name: "Connect ChatGPT" })
  ).toBeInTheDocument();
  expect(screen.getByText("Read your vocabulary cards")).toBeInTheDocument();
  expect(
    screen.getByText("View review status and history")
  ).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Allow access" }));
  expect(onDecision).toHaveBeenCalledWith(true);
});
