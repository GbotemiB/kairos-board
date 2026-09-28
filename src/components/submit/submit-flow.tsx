"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { createProgram } from "@/app/submit/actions";
import { ProgramForm } from "@/components/submit/program-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requestExtraction } from "@/lib/extract/client";
import type { ExtractApiResponse } from "@/lib/extract/http";
import { EMPTY_FORM_VALUES, toFormValues, type ProgramFormValues } from "@/lib/programs/form";

type Stage =
  | { kind: "link"; error?: string }
  | { kind: "loading"; pasted: boolean }
  | { kind: "paste"; message?: string }
  | { kind: "duplicate"; title: string; message: string }
  | { kind: "review"; values: ProgramFormValues; warnings: string[]; notice?: string };

const PASTE_CODES = new Set(["THIN_CONTENT", "FETCH_FAILED", "UNSUPPORTED_CONTENT"]);
const MANUAL_CODES = new Set(["AI_FAILED", "AI_BUSY", "RATE_LIMITED", "UNAVAILABLE"]);

export function SubmitFlow() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [stage, setStage] = useState<Stage>({ kind: "link" });

  function handleResponse(response: ExtractApiResponse, pasted: boolean) {
    if (response.ok) {
      setStage({
        kind: "review",
        values: toFormValues(response.url, response.data),
        warnings: response.warnings,
      });
      return;
    }
    if (response.code === "UNAUTHENTICATED") {
      router.push("/login?next=%2Fsubmit");
      return;
    }
    if (response.code === "DUPLICATE") {
      setStage({
        kind: "duplicate",
        title: response.existing?.title ?? "This program",
        message: response.message,
      });
      return;
    }
    if (PASTE_CODES.has(response.code)) {
      setStage({ kind: "paste", message: response.message });
      return;
    }
    if (MANUAL_CODES.has(response.code)) {
      const values =
        response.partial === undefined
          ? { ...EMPTY_FORM_VALUES, url }
          : toFormValues(url, response.partial);
      setStage({ kind: "review", values, warnings: [], notice: response.message });
      return;
    }
    // INVALID_URL, BLOCKED_HOST, INVALID_REQUEST and anything unexpected.
    setStage(
      pasted
        ? { kind: "paste", message: response.message }
        : { kind: "link", error: response.message },
    );
  }

  async function extract(event: FormEvent<HTMLFormElement>, pasted: boolean) {
    event.preventDefault();
    setStage({ kind: "loading", pasted });
    const response = await requestExtraction(pasted ? { url, text: pastedText } : { url });
    handleResponse(response, pasted);
  }

  function fillManually() {
    setStage({ kind: "review", values: { ...EMPTY_FORM_VALUES, url }, warnings: [] });
  }

  function startOver() {
    setPastedText("");
    setStage({ kind: "link" });
  }

  if (stage.kind === "loading") {
    return (
      <p role="status" className="text-muted-foreground py-8">
        {stage.pasted ? "Reading the text…" : "Reading the page…"} This can take a few seconds.
      </p>
    );
  }

  if (stage.kind === "review") {
    return (
      <div className="flex flex-col gap-6">
        {stage.notice !== undefined && (
          <p role="status" className="bg-muted rounded-md p-3 text-sm">
            {stage.notice}
          </p>
        )}
        {stage.warnings.length > 0 && (
          <div
            role="status"
            className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"
          >
            <p className="font-medium">Please check</p>
            <ul className="list-disc pl-5">
              {stage.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-muted-foreground text-sm">
          Review the details and fix anything that looks wrong before adding it.
        </p>
        <ProgramForm initialValues={stage.values} action={createProgram} />
        <Button type="button" variant="ghost" onClick={startOver} className="self-start">
          Start over
        </Button>
      </div>
    );
  }

  if (stage.kind === "duplicate") {
    return (
      <div role="status" className="flex flex-col items-start gap-3 rounded-md border p-4">
        <p>
          <strong>{stage.title}</strong> is already on the board.
        </p>
        <div className="flex gap-3">
          <Link href="/" className="text-sm underline underline-offset-4">
            View the board
          </Link>
          <button
            type="button"
            onClick={startOver}
            className="text-sm underline underline-offset-4"
          >
            Add a different link
          </button>
        </div>
      </div>
    );
  }

  if (stage.kind === "paste") {
    return (
      <form onSubmit={(event) => extract(event, true)} className="flex flex-col gap-4">
        {stage.message !== undefined && (
          <p role="alert" className="bg-muted rounded-md p-3 text-sm">
            {stage.message}
          </p>
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor="paste-url">Link</Label>
          <Input
            id="paste-url"
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="page-text">Page text</Label>
          <Textarea
            id="page-text"
            value={pastedText}
            onChange={(event) => setPastedText(event.target.value)}
            rows={10}
            aria-describedby="page-text-hint"
            required
          />
          <p id="page-text-hint" className="text-muted-foreground text-sm">
            Open the page, select all (Ctrl/Cmd + A), copy, and paste it here.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="submit">Get details from text</Button>
          <Button type="button" variant="outline" onClick={fillManually}>
            Fill in manually
          </Button>
          <Button type="button" variant="ghost" onClick={startOver}>
            Start over
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={(event) => extract(event, false)} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="link">Link to the program</Label>
        <Input
          id="link"
          type="url"
          inputMode="url"
          placeholder="https://example.org/fellowship"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          aria-invalid={stage.error !== undefined}
          aria-describedby={stage.error !== undefined ? "link-error" : undefined}
          required
        />
        {stage.error !== undefined && (
          <p id="link-error" className="text-destructive text-sm">
            {stage.error}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="submit">Get details</Button>
        <Button type="button" variant="outline" onClick={() => setStage({ kind: "paste" })}>
          Paste page text instead
        </Button>
        <Button type="button" variant="ghost" onClick={fillManually}>
          Fill in manually
        </Button>
      </div>
    </form>
  );
}
