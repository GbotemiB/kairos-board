import { BookOpen, CalendarClock, MapPin, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from "@/components/ui/card";
import { describeDeadline, type DeadlineTone } from "@/lib/programs/deadline";
import {
  programStatusLabel,
  programTypeLabel,
  type Program,
  type ProgramStatus,
} from "@/lib/programs/types";
import { isHttpUrl } from "@/lib/url/is-http-url";

/** Eligibility bullets shown before collapsing into "+N more". */
export const MAX_ELIGIBILITY = 3;

const statusClassName: Record<ProgramStatus, string> = {
  OPEN: "bg-emerald-100 text-emerald-900",
  UPCOMING: "bg-sky-100 text-sky-900",
  CLOSED: "bg-muted text-muted-foreground",
};

const toneClassName: Record<DeadlineTone, string> = {
  urgent: "font-medium text-red-700",
  normal: "text-foreground",
  muted: "text-muted-foreground",
};

type ProgramCardProps = {
  program: Program;
  /** Injected for deterministic rendering and tests. */
  now?: Date;
};

export function ProgramCard({ program, now = new Date() }: ProgramCardProps) {
  const deadline = describeDeadline(program, now);
  const href = isHttpUrl(program.url) ? program.url : null;
  const titleId = `program-${program.id}-title`;

  const shownEligibility = program.eligibility.slice(0, MAX_ELIGIBILITY);
  const hiddenEligibility = program.eligibility.length - shownEligibility.length;

  const details = [
    { key: "location", icon: MapPin, label: "Location", value: program.location },
    { key: "field", icon: BookOpen, label: "Field", value: program.field },
    { key: "funding", icon: Wallet, label: "Funding", value: program.funding },
  ].filter((detail) => detail.value !== null && detail.value.trim() !== "");

  return (
    <article aria-labelledby={titleId} className="h-full">
      <Card className="h-full">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={statusClassName[program.status]}>
              {programStatusLabel[program.status]}
            </Badge>
            <Badge variant="outline">{programTypeLabel[program.type]}</Badge>
          </div>
          <h2 id={titleId} className="text-base leading-snug font-semibold">
            {href === null ? (
              program.title
            ) : (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer nofollow ugc"
                className="underline-offset-4 hover:underline"
              >
                {program.title}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            )}
          </h2>
          {program.organization !== null && (
            <CardDescription>{program.organization}</CardDescription>
          )}
        </CardHeader>

        <CardContent className="flex flex-col gap-3 text-sm">
          <p className={`flex items-center gap-1.5 ${toneClassName[deadline.tone]}`}>
            <CalendarClock aria-hidden="true" className="size-4 shrink-0" />
            {deadline.dateTime === null ? (
              deadline.label
            ) : (
              <time dateTime={deadline.dateTime}>{deadline.label}</time>
            )}
          </p>

          {details.length > 0 && (
            <dl className="text-muted-foreground flex flex-col gap-1">
              {details.map(({ key, icon: Icon, label, value }) => (
                <div key={key} className="flex items-center gap-1.5">
                  <dt>
                    <Icon aria-hidden="true" className="size-4 shrink-0" />
                    <span className="sr-only">{label}</span>
                  </dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </CardContent>

        {shownEligibility.length > 0 && (
          <CardFooter className="flex-col items-start gap-1 text-sm">
            <p className="font-medium">Eligibility</p>
            <ul className="text-muted-foreground list-disc pl-5">
              {shownEligibility.map((item, index) => (
                <li key={`${index}-${item}`}>{item}</li>
              ))}
            </ul>
            {hiddenEligibility > 0 && (
              <p className="text-muted-foreground">+{hiddenEligibility} more</p>
            )}
          </CardFooter>
        )}
      </Card>
    </article>
  );
}
