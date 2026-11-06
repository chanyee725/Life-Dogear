import { Extension } from "@tiptap/core";
import Paragraph from "@tiptap/extension-paragraph";
import type { Node as PMNode } from "@tiptap/pm/model";
import Placeholder from "@tiptap/extension-placeholder";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import { CodeBlock, CodeBlockClipboard } from "./code-block";
import { Column, Columns } from "./columns";
import { BlockDragHandle } from "./drag-handle";
import { CaptionedImage } from "./image-view";
import { WikiLink } from "./WikiLink";

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

/** The part of prosemirror-markdown's serializer state used here. */
type MarkdownSerializerState = {
  write(content: string): void;
  renderInline(parent: PMNode): void;
  closeBlock(node: PMNode): void;
};

/** Written for a blank top-level paragraph; Markdown would otherwise drop it. */
const BLANK_LINE = "&nbsp;";

/**
 * Blank lines the writer adds with Enter (empty top-level or column paragraphs) are stored as a
 * `&nbsp;` line each, and read back as empty paragraphs, so spacing between blocks
 * survives save and reload. Bodies without empty paragraphs serialize exactly as before.
 */
const BlankLineParagraph = Paragraph.extend({
  addStorage() {
    return {
      markdown: {
        serialize(state: MarkdownSerializerState, node: PMNode, parent: PMNode) {
          // The last child is skipped: StarterKit's TrailingNode appends an empty paragraph
          // after a final list, code block, table, heading or image on the first edit.
          if (
            node.childCount === 0 &&
            (parent.type.name === "doc" || parent.type.name === "column") &&
            node !== parent.lastChild
          ) {
            state.write(BLANK_LINE);
          } else {
            // Same as prosemirror-markdown's default paragraph serializer.
            state.renderInline(node);
          }
          state.closeBlock(node);
        },
        parse: {
          updateDOM(element: HTMLElement) {
            const blocks = [
              ...element.children,
              ...element.querySelectorAll(':scope > div[data-type="columns"] > div[data-type="column"] > *'),
            ];
            for (const child of blocks) {
              if (child.tagName === "P" && child.textContent === "\u00a0" && child.childNodes.length === 1) {
                child.textContent = "";
              }
            }
          },
        },
      },
    };
  },
});

/**
 * Editor extensions. Everything here must round-trip through Markdown:
 * underline is disabled because Markdown has no syntax for it; `[[title]]` wiki links
 * are stored as plain `[[title]]`.
 */
export function createExtensions(placeholder: string) {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      underline: false,
      // Replaced by the highlighted code block below (same node name and Markdown).
      codeBlock: false,
      // Replaced by BlankLineParagraph (keeps blank lines through Markdown).
      paragraph: false,
      // Pasted or typed URLs become links; a click opens them in a new tab.
      link: {
        openOnClick: true,
        autolink: true,
        linkOnPaste: true,
        defaultProtocol: "https",
        HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" },
      },
    }),
    BlankLineParagraph,
    CodeBlock,
    CodeBlockClipboard,
    TaskList,
    TaskItem.configure({ nested: true }),
    TightTaskLists,
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    // Photos are stored as files and referenced by URL (`![alt](/api/images/…)`), never
    // inlined as base64: bodies stay small and Markdown stays readable. The alt text is
    // the caption shown under the photo.
    Columns,
    Column,
    CaptionedImage.configure({ inline: false, allowBase64: false }),
    Placeholder.configure({ placeholder }),
    WikiLink,
    BlockDragHandle,
    Markdown.configure({
      html: false,
      tightLists: true,
      bulletListMarker: "-",
      linkify: true,
      breaks: false,
      transformPastedText: true,
      transformCopiedText: true,
    }),
  ];
}
