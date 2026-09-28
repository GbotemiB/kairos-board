import { Badge } from "@/components/ui/badge";
import { describeDeadline, type DeadlineTone } from "@/lib/programs/deadline";
import {
  programStatusLabel,
  programTypeLabel,
  type Program,
  type ProgramStatus,
} from "@/lib/programs/types";
import { isHttpUrl } from "@/lib/url/is-http-url";

const statusClassName: Record<ProgramStatus, string> = {
  OPEN: "bg-emerald-100 text-emerald-900",
  UPCOMING: "bg-sky-100 text-sky-900",
  CLOSED: "bg-muted text-muted-foreground",
};

const toneClassName: Record<DeadlineTone, string> = {
  urgent: "font-medium text-red-700",
  normal: "",
  muted: "text-muted-foreground",
};

type ProgramListProps = { programs: Program[]; now: Date };

/** Compact table view of the board. */
export function ProgramList({ programs, now }: ProgramListProps) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Programs</caption>
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">
              Program
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Type
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Status
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Deadline
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Location
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {programs.map((program) => {
            const deadline = describeDeadline(program, now);
            const href = isHttpUrl(program.url) ? program.url : null;
            return (
              <tr key={program.id} className="align-top">
                <th scope="row" className="px-3 py-2 font-normal">
                  {href === null ? (
                    <span className="font-medium">{program.title}</span>
                  ) : (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer nofollow ugc"
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {program.title}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  )}
                  {program.organization !== null && (
                    <div className="text-muted-foreground">{program.organization}</div>
                  )}
                </th>
                <td className="px-3 py-2 whitespace-nowrap">{programTypeLabel[program.type]}</td>
                <td className="px-3 py-2">
                  <Badge className={statusClassName[program.status]}>
                    {programStatusLabel[program.status]}
                  </Badge>
                </td>
                <td className={`px-3 py-2 whitespace-nowrap ${toneClassName[deadline.tone]}`}>
                  {deadline.dateTime === null ? (
                    deadline.label
                  ) : (
                    <time dateTime={deadline.dateTime}>{deadline.label}</time>
                  )}
                </td>
                <td className="text-muted-foreground px-3 py-2">{program.location ?? "-"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
