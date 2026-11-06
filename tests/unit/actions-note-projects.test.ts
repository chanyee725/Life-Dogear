import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { loadNoteProjects, setNoteProject } from "@/app/notes/actions";
import { archive, links, notes, projects } from "@/lib/repo";
import { useFreshDb } from "./repo-helpers";

let noteId: string;
let alpha: string;
let beta: string;

beforeEach(async () => {
  await useFreshDb();
  noteId = (await notes.create({ title: "Fake note" })).id;
  alpha = (await projects.create({ title: "Alpha project" })).id;
  beta = (await projects.create({ title: "Beta project" })).id;
});

const titles = (list: { title: string }[]) => list.map((n) => n.title);

describe("note ↔ project links", () => {
  it("linking shows the note in the project's notes; unlinking drops it", async () => {
    expect(await setNoteProject(noteId, alpha, true)).toEqual({ ok: true, data: null });
    expect(titles(await notes.listForItem({ type: "project", id: alpha }))).toEqual(["Fake note"]);
    expect(await notes.listForItem({ type: "project", id: beta })).toEqual([]);
    const loaded = await loadNoteProjects(noteId);
    expect(loaded.ok && titles(loaded.data.linked)).toEqual(["Alpha project"]);

    expect(await setNoteProject(noteId, alpha, false)).toEqual({ ok: true, data: null });
    expect(await notes.listForItem({ type: "project", id: alpha })).toEqual([]);
    expect((await notes.projectChoices(noteId)).linked).toEqual([]);
  });

  it("sees links made from the project side and keeps them idempotent", async () => {
    await links.link({ type: "project", id: beta }, { type: "note", id: noteId });
    expect(titles((await notes.projectChoices(noteId)).linked)).toEqual(["Beta project"]);
    await setNoteProject(noteId, beta, true);
    expect(await links.listConnected({ type: "note", id: noteId })).toHaveLength(1);
    await setNoteProject(noteId, beta, false);
    expect(await links.listConnected({ type: "note", id: noteId })).toEqual([]);
  });

  it("hides archived projects from the choices but keeps linked ones", async () => {
    await setNoteProject(noteId, beta, true);
    await archive.archive({ type: "project", id: beta });
    const { linked, options } = await notes.projectChoices(noteId);
    expect(titles(options)).toEqual(["Alpha project"]);
    expect(linked).toEqual([{ id: beta, title: "Beta project", archived: true }]);
  });

  it("rejects bad input with Korean errors", async () => {
    expect((await setNoteProject(noteId, "missing-project", true)).ok).toBe(false);
    expect(await setNoteProject(noteId, alpha, "yes")).toEqual({
      ok: false,
      error: "연결 값이 올바르지 않습니다.",
    });
  });
});
