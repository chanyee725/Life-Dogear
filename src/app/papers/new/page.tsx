import type { Metadata } from "next";
import Link from "next/link";
import { Page, PageHeader } from "@/components/shell";
import { tags } from "@/lib/repo";
import { NewPaperForm } from "../_components/NewPaperForm";

export const metadata: Metadata = { title: "새 논문" };
export const dynamic = "force-dynamic";

export default async function NewPaperPage() {
  const allTags = await tags.listAll();
  return (
    <Page>
      <PageHeader
        eyebrow={
          <Link href="/papers" className="hover:text-fg">
            ← 논문
          </Link>
        }
        title="새 논문"
      />
      <NewPaperForm tagSuggestions={allTags.map((t) => t.name)} />
    </Page>
  );
}
