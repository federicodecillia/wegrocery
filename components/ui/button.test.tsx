import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button, buttonVariants } from "./button";

describe("Button", () => {
  it("renders a type=button <button> with the default dark look", () => {
    const html = renderToStaticMarkup(<Button>Ok</Button>);
    expect(html).toMatch(/^<button[^>]*type="button"/);
    expect(html).toContain('data-slot="button"');
    expect(html).toContain("bg-inverse text-inverse-foreground");
    expect(html).toContain("min-h-12");
  });

  it("keeps a submit type and a disabled state", () => {
    const html = renderToStaticMarkup(
      <Button type="submit" disabled variant="destructive" size="sm" block>
        Elimina
      </Button>,
    );
    expect(html).toContain('type="submit"');
    expect(html).toContain("disabled");
    expect(html).toContain("bg-danger text-danger-foreground");
    expect(html).toContain("min-h-(--control-h)");
    expect(html).toContain("w-full");
  });

  it("gives a Link the same look through buttonVariants", () => {
    expect(buttonVariants({ variant: "outline" })).toContain("border border-border");
  });
});
