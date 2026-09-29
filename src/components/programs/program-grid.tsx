import { ProgramCard } from "@/components/programs/program-card";
import type { Program } from "@/lib/programs/types";

type ProgramGridProps = {
  programs: Program[];
  now: Date;
};

export function ProgramGrid({ programs, now }: ProgramGridProps) {
  return (
    <ul aria-label="Programs" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {programs.map((program) => (
        <li key={program.id}>
          <ProgramCard program={program} now={now} />
        </li>
      ))}
    </ul>
  );
}
