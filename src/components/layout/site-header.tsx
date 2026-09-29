import Link from "next/link";

import { signOut } from "@/app/auth/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import type { CurrentUser } from "@/lib/auth/session";
import { siteConfig } from "@/lib/site";

type SiteHeaderProps = {
  user: CurrentUser | null;
};

export function SiteHeader({ user }: SiteHeaderProps) {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          {siteConfig.name}
        </Link>
        <nav aria-label="Main" className="flex items-center gap-4 text-sm">
          <Link href="/" className="text-muted-foreground hover:text-foreground">
            Board
          </Link>
          <a
            href={siteConfig.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground"
          >
            GitHub
          </a>
          <Link href="/submit" className={buttonVariants({ size: "sm" })}>
            Add program
          </Link>
          {user === null ? (
            <Link href="/login" className="text-muted-foreground hover:text-foreground">
              Sign in
            </Link>
          ) : (
            <Link href="/my" className="text-muted-foreground hover:text-foreground">
              My submissions
            </Link>
          )}
          {user !== null && (
            <form action={signOut} className="flex items-center gap-3">
              <span className="text-muted-foreground hidden sm:inline">{user.email}</span>
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          )}
        </nav>
      </div>
    </header>
  );
}
