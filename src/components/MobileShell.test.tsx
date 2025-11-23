import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import MobileShell from "./MobileShell";

vi.mock("./DeckManager", () => ({
  __esModule: true,
  default: () => <div>DeckManager</div>,
}));

vi.mock("./ActivityPage", () => ({
  __esModule: true,
  default: () => <div>ActivityPage</div>,
}));

vi.mock("../SignOutButton", () => ({
  SignOutButton: () => <button>Sign out</button>,
}));

describe("MobileShell profile drawer", () => {
  it("opens full-screen drawer with profile info when profile button is clicked", async () => {
    const user = userEvent.setup();

    render(<MobileShell user={{ _id: "user_1" as any, email: "test@example.com" }} />);

    expect(screen.queryByText(/내 프로필/)).not.toBeInTheDocument();

    await user.click(screen.getByLabelText(/open profile/i));

    expect(screen.getByText(/내 프로필/)).toBeInTheDocument();
    expect(screen.getByText(/test@example.com/)).toBeInTheDocument();
  });
});
