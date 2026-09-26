import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import DeviceAuthorizationPage from "./DeviceAuthorizationPage";
const decide = vi.hoisted(() => vi.fn());
vi.mock("convex/react", () => ({ useMutation: () => decide }));
beforeEach(() => {
  decide.mockReset();
  window.history.replaceState({}, "", "/device");
});

it("never approves a link automatically; requires a valid code and explicit decision", async () => {
  window.history.replaceState({}, "", "/device?user_code=ABCD-EFGH");
  decide.mockResolvedValue("approved");
  render(<DeviceAuthorizationPage email="user@example.test" />);
  expect(screen.getByLabelText("One-time code")).toHaveValue("ABCD-EFGH");
  expect(decide).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Allow access" }));
  expect(decide).toHaveBeenCalledWith({
    userCode: "ABCD-EFGH",
    approved: true,
  });
  await screen.findByRole("heading", { name: "CLI connected" });
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

it("supports manual codes, disables controls during submission, and displays denial", async () => {
  let finish!: (result: string) => void;
  decide.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  render(<DeviceAuthorizationPage email="user@example.test" />);
  expect(screen.getByRole("button", { name: "Allow access" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("One-time code"), {
    target: { value: "abcd-efgh" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Deny" }));
  expect(decide).toHaveBeenCalledWith({
    userCode: "ABCD-EFGH",
    approved: false,
  });
  expect(screen.getByLabelText("One-time code")).toBeDisabled();
  expect(screen.getByRole("button", { name: "Deny" })).toBeDisabled();
  await act(async () => finish("denied"));
  await screen.findByRole("heading", { name: "Access denied" });
});

it.each(["invalid_code", "slow_down", "network"])(
  "keeps %s failures recoverable",
  async (result) => {
    if (result === "network") {
      decide.mockRejectedValue(new Error("private backend error"));
    } else {
      decide.mockResolvedValue(result);
    }
    render(<DeviceAuthorizationPage />);
    fireEvent.change(screen.getByLabelText("One-time code"), {
      target: { value: "ABCD-EFGH" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Allow access" }));
    await screen.findByRole("alert");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Allow access" })).toBeEnabled()
    );
    expect(screen.queryByText("private backend error")).not.toBeInTheDocument();
  }
);
