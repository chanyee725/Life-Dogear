import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteArea } from "@/app/_actions/areas";
import { ArchiveButton, ArchivedNotice } from "@/components/fields/ArchiveButton";
import { DeleteItemButton } from "@/components/fields/DeleteItemButton";
import { ItemForm } from "@/components/fields/ItemForm";
import { ConnectedItems } from "@/components/links";
import { Page } from "@/components/shell/PageHeader";
import { buttonClass } from "@/components/ui/Button";
import { Section } from "@/components/ui/Card";
import { isValidItemId } from "@/lib/ids";
import { areas, projects, tags } from "@/lib/repo";
import { ProgressBadge } from "../../projects/ProgressBadge";
import { updateAreaPatch } from "../actions";
import { AreaFields } from "../AreaFields";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const area = isValidItemId(id) ? await areas.get(id) : null;
  return { title: area?.title ?? "영역" };
}

export default async function AreaDetailPage({ params }: Props) {
  const { id } = await params;
  if (!isValidItemId(id)) notFound();
  const [area, allTags, areaProjects] = await Promise.all([
    areas.get(id),
    tags.listAll({ visibleOnly: true }),
    projects.list({ areaId: id }),
  ]);
  if (!area) notFound();
  const ref = { type: "area" as const, id: area.id };

  return (
    <Page className="flex flex-col gap-12">
      <div className="flex flex-col gap-4">
        {area.archivedAt ? <ArchivedNotice item={ref} /> : null}
        <ItemForm
          mode="edit"
          action={updateAreaPatch.bind(null, area.id)}
          basePath="/areas"
          backLabel="영역"
          actions={
            <>
              {area.archivedAt ? null : (
                <ArchiveButton item={ref} archived={false} redirectTo="/areas" />
              )}
              <DeleteItemButton
                action={deleteArea.bind(null, area.id)}
                redirectTo="/areas"
                itemLabel="이 영역"
              />
            </>
          }
        >
          <AreaFields
            editorKey={area.id}
            tagSuggestions={allTags.map((t) => t.name)}
            values={{
              title: area.title,
              standard: area.standard,
              body: area.body,
              tags: area.tags,
            }}
          />
        </ItemForm>
      </div>
      <Section
        title={`프로젝트${areaProjects.length ? ` ${areaProjects.length}` : ""}`}
        action={
          <Link href={`/projects/new?area=${area.id}`} className={buttonClass("ghost", "sm")}>
            새 프로젝트
          </Link>
        }
      >
        {areaProjects.length === 0 ? (
          <p className="text-sm text-muted">이 영역에 속한 프로젝트가 없습니다.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {areaProjects.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-surface"
                >
                  <span className="min-w-0 flex-1 truncate font-medium">{p.title}</span>
                  {p.nextAction ? (
                    <span className="hidden max-w-64 truncate text-muted sm:inline">
                      다음: {p.nextAction}
                    </span>
                  ) : null}
                  <ProgressBadge project={p} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <ConnectedItems item={ref} />
    </Page>
  );
}
