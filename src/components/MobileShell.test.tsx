import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, Mock, vi } from "vitest";

vi.mock("@convex-dev/auth/react");

vi.mock("./BagManager", () => ({
  __esModule: true,
  default: () => <div>BagManager</div>,
}));

vi.mock("./ActivityPage", () => ({
  __esModule: true,
  default: () => <div>ActivityPage</div>,
}));

vi.mock("../SignOutButton", () => ({
  SignOutButton: () => <button>Sign out</button>,
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: true }),
}));

import MobileShell from "./MobileShell";
import { useAuthActions } from "@convex-dev/auth/react";
import { Id } from "../../convex/_generated/dataModel";

describe("MobileShell profile drawer", () => {
  beforeEach(() => {
    (useAuthActions as Mock).mockReset();
    (useAuthActions as Mock).mockReturnValue({
      signIn: vi.fn().mockResolvedValue(undefined),
      signOut: vi.fn(),
    });
  });

  it("opens full-screen drawer with profile info when profile button is clicked", async () => {
    const user = userEvent.setup();

    render(
      <MobileShell user={{ _id: "user_1" as any, email: "test@example.com" }} />
    );

    expect(screen.queryByText(/내 프로필/)).not.toBeInTheDocument();

    await user.click(screen.getByLabelText(/open profile/i));

    expect(screen.getByText(/내 프로필/)).toBeInTheDocument();
    expect(screen.getByText(/test@example.com/)).toBeInTheDocument();
  });

  it("allows login from drawer", async () => {
    const user = userEvent.setup();
    const signIn = vi.fn().mockResolvedValue(undefined);
    (useAuthActions as Mock).mockReturnValue({ signIn });

    render(<MobileShell user={{ _id: "user_anon" as Id<"users"> }} />);

    await user.click(screen.getByLabelText(/open profile/i));
    await user.type(screen.getByPlaceholderText(/email/i), "me@test.com");
    await user.type(screen.getByPlaceholderText(/password/i), "pass1234");
    await user.click(screen.getByRole("button", { name: /로그인/i }));

    expect(signIn).toHaveBeenCalledWith("password", expect.any(FormData));
  });

  it("closes the profile drawer after a successful sign-in", async () => {
    const user = userEvent.setup();
    const signIn = vi.fn().mockResolvedValue(undefined);
    (useAuthActions as Mock).mockReturnValue({ signIn, signOut: vi.fn() });

    render(<MobileShell user={{ _id: "user_anon" as any }} />);

    await user.click(screen.getByLabelText(/open profile/i));
    expect(screen.getByText(/내 프로필/)).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(/email/i), "me@test.com");
    await user.type(screen.getByPlaceholderText(/password/i), "pass1234");
    await user.click(screen.getByRole("button", { name: /로그인/i }));

    await waitFor(() => expect(signIn).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.queryByText(/내 프로필/)).not.toBeInTheDocument()
    );
  });
});
