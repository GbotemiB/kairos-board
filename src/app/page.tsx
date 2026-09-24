import { siteConfig } from "@/lib/site";

// Placeholder until the board lands (Phase 2, step 4).
export default function Home() {
  return (
    <section className="flex flex-col gap-3 py-12">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{siteConfig.tagline}</h1>
      <p className="text-muted-foreground max-w-2xl text-lg">{siteConfig.description}</p>
    </section>
  );
}
