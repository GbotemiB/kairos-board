import { siteConfig } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="text-muted-foreground mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-6 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p>
          {siteConfig.name} is open source under the MIT License. Deadlines and details are
          community-submitted; always confirm on the official page.
        </p>
        <a
          href={siteConfig.repoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground shrink-0 underline-offset-4 hover:underline"
        >
          Contribute on GitHub
        </a>
      </div>
    </footer>
  );
}
