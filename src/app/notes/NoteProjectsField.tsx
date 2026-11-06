"use client";

import { useEffect, useState, useTransition } from "react";
import { Property } from "@/components/fields/Properties";
import { Select } from "@/components/ui/Select";
import { itemHref } from "@/lib/item-href";
import type { NoteProject } from "@/lib/repo/notes";
import { loadNoteProjects, setNoteProject } from "./actions";

/**
 * 프로젝트 field of a saved note (`/notes/[id]`): chips for the linked projects and a
 * picker of non-archived ones. Each change links/unlinks right away through `links`,
 * so the project's 노트 section shows the note (or drops it). Not part of the form
 * patch: neither control has a `name`. Hidden on `/notes/new` (no id yet). Takes the
 * note id as a prop: the route param is a `<slug>-<shortid>` segment, not the id.
 */
export function NoteProjectsField({ noteId }: { noteId: string | null }) {
  const [linked, setLinked] = useState<NoteProject[] | null>(null);
  const [options, setOptions] = useState<NoteProject[]>([]);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!noteId) return;
    let live = true;
    void loadNoteProjects(noteId).then((res) => {
      if (!live) return;
      if (res.ok) {
        setLinked(res.data.linked);
        setOptions(res.data.options);
      } else setError(res.error);
    });
    return () => {
      live = false;
    };
  }, [noteId]);

  if (!noteId) return null;
  if (linked === null) {
    // Still loading: show nothing. Load failed: keep the field so the error is visible.
    if (!error) return null;
    return (
      <Property label="프로젝트" htmlFor="note-projects">
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      </Property>
    );
  }

  const linkedIds = new Set(linked.map((p) => p.id));
  const choices = options.filter((p) => !linkedIds.has(p.id));

  function toggle(project: NoteProject, on: boolean) {
    if (!noteId || !linked) return;
    const before = linked;
    setLinked(on ? [...linked, project] : linked.filter((p) => p.id !== project.id));
    setError("");
    startTransition(async () => {
      const res = await setNoteProject(noteId, project.id, on);
      if (!res.ok) {
        setLinked(before);
        setError(res.error);
      }
    });
  }

  return (
    <Property label="프로젝트" htmlFor="note-projects">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {linked.length ? (
            <ul aria-label="연결된 프로젝트" className="contents">
              {linked.map((p) => (
                <li
                  key={p.id}
                  className="inline-flex h-6 items-center gap-1 rounded-md bg-subtle pr-1 pl-2 text-[13px] text-fg"
                >
                  <a href={itemHref("project", p.id, p.title)} className="hover:underline">
                    {p.title}
                  </a>
                  {p.archived ? <span className="text-xs text-muted">(보관됨)</span> : null}
                  <button
                    type="button"
                    aria-label={`${p.title} 연결 해제`}
                    disabled={pending}
                    onClick={() => toggle(p, false)}
                    className="flex h-4 w-4 items-center justify-center rounded text-muted hover:bg-hover hover:text-fg"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {choices.length ? (
            <Select
              id="note-projects"
              aria-label="프로젝트 추가"
              size="sm"
              value=""
              disabled={pending}
              className="w-auto"
              onChange={(e) => {
                const project = choices.find((p) => p.id === e.target.value);
                if (project) toggle(project, true);
              }}
            >
              <option value="">프로젝트 추가</option>
              {choices.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </Select>
          ) : linked.length ? null : (
            <span className="text-sm text-muted">프로젝트 없음</span>
          )}
        </div>
        {error ? (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </Property>
  );
}
