import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignInForm } from "./SignInForm";

const { signInMock, toastErrorMock } = vi.hoisted(() => ({
  signInMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn: signInMock }),
}));

vi.mock("sonner", () => ({
  toast: { error: toastErrorMock },
}));

describe("SignInForm", () => {
  beforeEach(() => {
    signInMock.mockReset();
    toastErrorMock.mockReset();
    signInMock.mockResolvedValue(undefined);
  });

  it("submits email/password with the default sign-in flow", async () => {
    const user = userEvent.setup();
    render(<SignInForm />);

    await user.type(screen.getByPlaceholderText(/email/i), "user@example.com");
    await user.type(screen.getByPlaceholderText(/password/i), "secret123");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(signInMock).toHaveBeenCalledTimes(1);
    const [provider, formData] = signInMock.mock.calls[0] as [string, FormData];
    expect(provider).toBe("password");
    expect(formData.get("email")).toBe("user@example.com");
    expect(formData.get("flow")).toBe("signIn");
  });

  it("switches to the sign-up flow and disables the submit button while sending", async () => {
    const user = userEvent.setup();
    render(<SignInForm />);

    await user.click(screen.getByRole("button", { name: /sign up instead/i }));
    const submitButton = screen.getByRole("button", { name: /sign up/i });

    await user.type(screen.getByPlaceholderText(/email/i), "new@example.com");
    await user.type(screen.getByPlaceholderText(/password/i), "newsecret");
    await user.click(submitButton);

    expect(submitButton).toBeDisabled();
    expect(signInMock).toHaveBeenCalledTimes(1);
    const [, formData] = signInMock.mock.calls[0] as [string, FormData];
    expect(formData.get("flow")).toBe("signUp");
  });
});
