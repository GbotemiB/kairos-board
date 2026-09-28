"use client";

import { useActionState } from "react";

import type { SaveProgramState } from "@/app/submit/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FIELD_LIMITS } from "@/lib/ai/schema";
import type { ProgramFieldErrors, ProgramFormField, ProgramFormValues } from "@/lib/programs/form";
import { programTypeLabel } from "@/lib/programs/types";

type ProgramFormProps = {
  initialValues: ProgramFormValues;
  action: (state: SaveProgramState, formData: FormData) => Promise<SaveProgramState>;
  submitLabel?: string;
};

const SELECT_CLASS =
  "border-input bg-background h-8 rounded-lg border px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive";

function FieldError({ name, errors }: { name: ProgramFormField; errors: ProgramFieldErrors }) {
  const message = errors[name];
  return message === undefined ? null : (
    <p id={`${name}-error`} className="text-destructive text-sm">
      {message}
    </p>
  );
}

function describedBy(name: ProgramFormField, errors: ProgramFieldErrors, hint?: string) {
  const ids = [errors[name] === undefined ? null : `${name}-error`, hint ?? null].filter(Boolean);
  return ids.length === 0 ? undefined : ids.join(" ");
}

export function ProgramForm({
  initialValues,
  action,
  submitLabel = "Add to board",
}: ProgramFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const values = state.values ?? initialValues;
  const errors = state.fieldErrors ?? {};

  const field = (name: ProgramFormField) => ({
    id: name,
    name,
    "aria-invalid": errors[name] !== undefined,
    "aria-describedby": describedBy(name, errors),
  });

  return (
    // Re-mount after each failed attempt so fields show the echoed values.
    <form key={state.attempt ?? 0} action={formAction} className="flex flex-col gap-5" noValidate>
      {state.error !== undefined && (
        <p role="alert" className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="url">Link</Label>
        <Input {...field("url")} type="url" defaultValue={values.url} required />
        <FieldError name="url" errors={errors} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="title">Program name</Label>
        <Input
          {...field("title")}
          defaultValue={values.title}
          maxLength={FIELD_LIMITS.title}
          required
        />
        <FieldError name="title" errors={errors} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="organization">Organization</Label>
          <Input
            {...field("organization")}
            defaultValue={values.organization}
            maxLength={FIELD_LIMITS.organization}
          />
          <FieldError name="organization" errors={errors} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="type">Type</Label>
          <select {...field("type")} defaultValue={values.type} className={SELECT_CLASS}>
            {Object.entries(programTypeLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset className="grid gap-5 sm:grid-cols-3">
        <legend className="mb-2 text-sm font-medium">Dates</legend>
        <div className="flex flex-col gap-2">
          <Label htmlFor="deadlineType">Deadline</Label>
          <select
            {...field("deadlineType")}
            defaultValue={values.deadlineType}
            className={SELECT_CLASS}
          >
            <option value="FIXED">Fixed date</option>
            <option value="ROLLING">Rolling</option>
            <option value="UNKNOWN">Not listed</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="deadline">Applications close</Label>
          <Input {...field("deadline")} type="date" defaultValue={values.deadline} />
          <FieldError name="deadline" errors={errors} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="opensAt">Applications open</Label>
          <Input {...field("opensAt")} type="date" defaultValue={values.opensAt} />
          <FieldError name="opensAt" errors={errors} />
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor="eligibility">Eligibility</Label>
        <Textarea
          {...field("eligibility")}
          aria-describedby={describedBy("eligibility", errors, "eligibility-hint")}
          defaultValue={values.eligibility}
          rows={4}
        />
        <p id="eligibility-hint" className="text-muted-foreground text-sm">
          One criterion per line.
        </p>
        <FieldError name="eligibility" errors={errors} />
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="location">Location</Label>
          <Input
            {...field("location")}
            defaultValue={values.location}
            maxLength={FIELD_LIMITS.location}
          />
          <FieldError name="location" errors={errors} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="field">Field</Label>
          <Input {...field("field")} defaultValue={values.field} maxLength={FIELD_LIMITS.field} />
          <FieldError name="field" errors={errors} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="funding">Funding</Label>
          <Input
            {...field("funding")}
            defaultValue={values.funding}
            maxLength={FIELD_LIMITS.funding}
          />
          <FieldError name="funding" errors={errors} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="applicationsClosed"
          name="applicationsClosed"
          type="checkbox"
          defaultChecked={values.applicationsClosed}
          className="size-4"
        />
        <Label htmlFor="applicationsClosed">Applications are closed</Label>
      </div>

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
