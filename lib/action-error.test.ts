import { afterEach, describe, expect, it, vi } from "vitest";
import { notFound, redirect } from "next/navigation";
import { ActionError, actionErrorMessage } from "./action-error";

// What the guard or the helper threw, as the action's catch receives it.
function caught(fn: () => unknown): unknown {
  try {
    fn();
  } catch (e) {
    return e;
  }
  throw new Error("expected a throw");
}

describe("actionErrorMessage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the message of an ActionError as it is", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(actionErrorMessage(new ActionError("Accesso non autorizzato"), "Errore", "adminCloseCycle")).toBe(
      "Accesso non autorizzato",
    );
    expect(log).not.toHaveBeenCalled();
  });

  it("never returns the message of any other error, and logs it under the action", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    // Shape of a Neon driver error: the message can quote SQL.
    const driverError = Object.assign(new Error('relation "orders" does not exist'), { code: "42P01" });
    expect(actionErrorMessage(driverError, "Errore", "saveOrder")).toBe("Errore");
    expect(log).toHaveBeenCalledWith("[saveOrder]", driverError);
  });

  it("falls back for values that are not errors", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(actionErrorMessage("boom", "Errore", "adminUpsertSupplier")).toBe("Errore");
    expect(actionErrorMessage(null, "Errore", "adminUpsertSupplier")).toBe("Errore");
    expect(actionErrorMessage(undefined, "Errore", "adminUpsertSupplier")).toBe("Errore");
  });

  it("rethrows redirect() and notFound() so Next.js can still handle them", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const redirectError = caught(() => redirect("/login"));
    const notFoundError = caught(() => notFound());
    expect(() => actionErrorMessage(redirectError, "Errore", "saveOrder")).toThrow(redirectError as Error);
    expect(() => actionErrorMessage(notFoundError, "Errore", "saveOrder")).toThrow(notFoundError as Error);
    expect(log).not.toHaveBeenCalled();
  });
});

describe("ActionError", () => {
  it("is an Error, so pages and catch blocks that read e.message keep working", () => {
    const e = new ActionError("Ciclo non trovato");
    expect(e).toBeInstanceOf(Error);
    expect(e.message).toBe("Ciclo non trovato");
    expect(e.name).toBe("ActionError");
  });
});
