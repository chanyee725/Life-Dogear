import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { itemIdForMetadata, resolveItemRoute } from "@/lib/item-route";
import { ArchivedNotice } from "@/components/fields/ArchiveButton";
import { DetailMoreMenu } from "@/components/fields/DetailMoreMenu";
import { ItemForm } from "@/components/fields/ItemForm";
import { ConnectedWithGraph } from "@/components/graph/ConnectedWithGraph";
import { Page } from "@/components/shell/PageHeader";
import { tags, thoughts } from "@/lib/repo";
import { deleteThought, updateThought } from "../actions";
import { ThoughtFields } from "../ThoughtFields";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = await itemIdForMetadata("thoughts", (await params).id);
  const thought = id ? await thoughts.get(id) : null;
  return { title: thought?.title ?? "생각" };
}

export default async function ThoughtDetailPage({ params }: Props) {
  const id = await resolveItemRoute("thoughts", (await params).id);
  const [thought, allTags] = await Promise.all([thoughts.get(id), tags.listAll()]);
  if (!thought) notFound();

  return (
    <Page className="flex flex-col gap-12">
      <div className="flex flex-col gap-4">
        {thought.archivedAt ? <ArchivedNotice item={{ type: "thought", id: thought.id }} /> : null}
        <ItemForm
          mode="edit"
          action={updateThought.bind(null, thought.id)}
          basePath="/thoughts"
          backLabel="생각"
          actions={
            <>
              <DetailMoreMenu
                item={{ type: "thought", id: thought.id }}
                archived={Boolean(thought.archivedAt)}
                redirectTo={"/thoughts"}
                deleteAction={deleteThought.bind(null, thought.id)}
                itemLabel="이 생각"
              />
            </>
          }
        >
          <ThoughtFields
            editorKey={thought.id}
            tagSuggestions={allTags.map((t) => t.name)}
            values={{
              title: thought.title,
              kind: thought.kind,
              maturity: thought.maturity,
              body: thought.body,
              tags: thought.tags,
            }}
          />
        </ItemForm>
      </div>
      <ConnectedWithGraph item={{ type: "thought", id: thought.id }} />
    </Page>
  );
}
