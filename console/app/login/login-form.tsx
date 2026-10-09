"use client";

import { useActionState } from "react";
import { Button, Field, Input, Notice } from "@/components/ui";
import { login, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, { error: null });
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required autoFocus />
      </Field>
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Accesso…" : "Accedi"}
      </Button>
    </form>
  );
}
