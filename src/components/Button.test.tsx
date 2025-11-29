import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("renders the primary variant with CTA styles by default", () => {
    render(<Button>Submit</Button>);

    const button = screen.getByRole("button", { name: /submit/i });
    expect(button.className).toMatch(/bg-primary-600/);
    expect(button.className).toMatch(/focus-visible:outline-primary-400/);
    expect(button.className).toContain("gap-2");
    expect(button).not.toBeDisabled();
  });

  it("keeps padding and icon/text gap consistent across variants", () => {
    const variants = ["primary", "secondary", "ghost", "danger", "plain"] as const;

    render(
      <div>
        {variants.map((variant) => (
          <Button key={variant} variant={variant}>
            {variant}
          </Button>
        ))}
      </div>
    );

    const buttons = variants.map((variant) =>
      screen.getByRole("button", { name: new RegExp(variant, "i") })
    );

    const classNames = buttons.map((button) => button.className);

    classNames.forEach((className) => {
      expect(className).toContain("px-4");
      expect(className).toContain("py-3");
      expect(className).toContain("gap-2");
    });

    const pxTokens = new Set(
      classNames
        .map((className) => className.match(/px-\d+/)?.[0])
        .filter(Boolean)
    );
    const pyTokens = new Set(
      classNames
        .map((className) => className.match(/py-\d+/)?.[0])
        .filter(Boolean)
    );

    expect(pxTokens.size).toBe(1);
    expect(pyTokens.size).toBe(1);
  });

  it("includes default hover and active scale transforms", () => {
    render(<Button>Scale</Button>);

    const button = screen.getByRole("button", { name: /scale/i });
    expect(button.className).toContain("transition");
    expect(button.className).toContain("transform");
    expect(button.className).not.toContain("hover:scale-102");
    expect(button.className).toContain("active:scale-98");
  });

  it("supports a secondary variant and disabled state styling", () => {
    render(
      <Button variant="secondary" disabled>
        Cancel
      </Button>
    );

    const button = screen.getByRole("button", { name: /cancel/i });
    expect(button).toBeDisabled();
    expect(button.className).toMatch(/border-gray-200/);
    expect(button.className).toMatch(/cursor-not-allowed/);
    expect(button.className).not.toMatch(/bg-primary-600/);
  });
});
