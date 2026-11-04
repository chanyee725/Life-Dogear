import bash from "highlight.js/lib/languages/bash";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import python from "highlight.js/lib/languages/python";
import shell from "highlight.js/lib/languages/shell";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";
import { createLowlight } from "lowlight";

/**
 * Syntax highlighting for code blocks: only the languages we write in, each imported on its
 * own (never lowlight's `common`/`all` bundles). Grammars bring their usual aliases
 * (`sh`, `yml`, `py`, `ts`, `js`, `h`, `hpp`, `html`…); ROS `.launch` files are XML.
 */
const GRAMMARS = { bash, shell, yaml, xml, c, cpp, python, json, typescript, javascript };
const EXTRA_ALIASES = { xml: ["launch"] };

type Root = ReturnType<ReturnType<typeof createLowlight>["highlight"]>;

export function createCodeLowlight() {
  const lowlight = createLowlight(GRAMMARS);
  lowlight.registerAlias(EXTRA_ALIASES);
  return {
    ...lowlight,
    /**
     * The Tiptap plugin falls back to auto-detection for a missing or unknown language.
     * We never guess: such blocks stay plain text.
     */
    highlightAuto: (value: string): Root => ({
      type: "root",
      children: [{ type: "text", value }],
      data: { language: undefined, relevance: 0 },
    }),
  };
}

export type CodeLowlight = ReturnType<typeof createCodeLowlight>;
