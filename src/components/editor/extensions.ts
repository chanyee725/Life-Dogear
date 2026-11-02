import { Extension } from "@tiptap/core";
import Placeholder from "@tiptap/extension-placeholder";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";

/**
 * tiptap-markdown only marks bullet/ordered lists as "tight"; without this, checklists
 * serialize with a blank line between every item.
 */
const TightTaskLists = Extension.create({
  name: "tightTaskLists",
  addGlobalAttributes() {
    return [
      {
        types: ["taskList"],
        attributes: {
          tight: {
            default: true,
            parseHTML: (element: HTMLElement) =>
              element.getAttribute("data-tight") === "true" || !element.querySelector("p"),
            renderHTML: (attributes: Record<string, unknown>) => ({
              "data-tight": attributes.tight ? "true" : null,
            }),
          },
        },
      },
    ];
  },
});

/**
 * Editor extensions. Everything here must round-trip through Markdown:
 * underline is disabled because Markdown has no syntax for it.
 */
export function createExtensions(placeholder: string) {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      underline: false,
      link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    TightTaskLists,
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    Placeholder.configure({ placeholder }),
    Markdown.configure({
      html: true,
      tightLists: true,
      bulletListMarker: "-",
      linkify: true,
      breaks: false,
      transformPastedText: true,
      transformCopiedText: true,
    }),
  ];
}
