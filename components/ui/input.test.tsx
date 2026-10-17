import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Input } from "./input";
import { Label } from "./label";
import { NativeSelect } from "./native-select";
import { Textarea } from "./textarea";

describe("Input", () => {
  it("renders a native <input> with the 3:1 input border and the control height", () => {
    const html = renderToStaticMarkup(<Input type="email" name="email" defaultValue="a@b.it" aria-invalid />);
    expect(html).toMatch(/^<input[^>]*type="email"/);
    expect(html).toContain('data-slot="input"');
    expect(html).toContain('name="email"');
    expect(html).toContain('value="a@b.it"');
    expect(html).toContain("border-input");
    expect(html).not.toContain("border-border");
    expect(html).toContain("min-h-(--control-h)");
    expect(html).toContain("aria-invalid:border-destructive");
  });

  it("lets the caller override the size and add layout classes", () => {
    const html = renderToStaticMarkup(<Input className="min-h-11 text-[13px] tabular-nums" disabled />);
    expect(html).toContain("min-h-11");
    expect(html).not.toContain("min-h-(--control-h)");
    expect(html).toContain("text-[13px]");
    expect(html).not.toContain("text-[14px]");
    expect(html).toContain("tabular-nums");
    expect(html).toContain("disabled");
  });
});

describe("Textarea, NativeSelect and Label", () => {
  it("share the field look", () => {
    const ta = renderToStaticMarkup(<Textarea rows={2} className="resize-none" />);
    expect(ta).toMatch(/^<textarea[^>]*data-slot="textarea"/);
    expect(ta).toContain("border-input");
    expect(ta).toContain("resize-none");

    const sel = renderToStaticMarkup(
      <NativeSelect name="role" defaultValue="b" wrapperClassName="mb-4">
        <option value="a">A</option>
        <option value="b">B</option>
      </NativeSelect>,
    );
    expect(sel).toContain('data-slot="native-select-wrapper"');
    expect(sel).toMatch(/class="relative w-full mb-4"/);
    expect(sel).toMatch(/<select[^>]*class="[^"]*border-input[^"]*appearance-none[^"]*"[^>]*name="role"/);
    expect(sel).toContain('<option value="b" selected="">B</option>');
    expect(sel).toContain("<svg");
  });

  it("draws the uppercase caption", () => {
    const html = renderToStaticMarkup(<Label htmlFor="x">Nome</Label>);
    expect(html).toBe(
      '<label data-slot="label" class="mb-1 block text-label font-semibold uppercase tracking-wide text-secondary-foreground" for="x">Nome</label>',
    );
  });
});
