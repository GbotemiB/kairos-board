"use client";

import { useActionState, useState } from "react";

import type { DeleteProgramState } from "@/app/my/actions";
import { Button } from "@/components/ui/button";

type DeleteProgramButtonProps = {
  title: string;
  action: () => Promise<DeleteProgramState>;
};

export function DeleteProgramButton({ title, action }: DeleteProgramButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(action, {});

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={`Delete ${title}`}
        onClick={() => setConfirming(true)}
      >
        Delete
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <span className="text-sm">Delete this program?</span>
      <Button type="submit" variant="destructive" size="sm" disabled={pending}>
        {pending ? "Deleting…" : "Yes, delete"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setConfirming(false)}
        disabled={pending}
      >
        Cancel
      </Button>
      {state.error !== undefined && (
        <p role="alert" className="text-destructive w-full text-sm">
          {state.error}
        </p>
      )}
    </form>
  );
}
