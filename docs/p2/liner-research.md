# Liner (liner.com / getliner.com) — official API & export research

Checked: 2026-11-02. Only official liner.com pages are used as evidence.
Third-party pages are listed separately as reference and are NOT evidence.
Limits of this check: the fetch tool got HTTP 403 on `support.liner.com` (help center) and HTTP 410 on
`getliner.com`, so help-center article bodies could not be read. Pages were summarized by a fetch tool,
so quotes should be re-checked in a browser before relying on exact wording.

## Summary for implementers (impl-11)

| Question | Conclusion |
|---|---|
| (a) Public API | **Yes, but developer/pay-per-use, not a "export my data" API.** Key-based REST API + MCP servers. No documented endpoint to read a user's highlights/answers/history. |
| (b) Export of highlights / answers / Scholar results | **Not confirmed.** No export feature found in official pages that could be read. Scholar MCP has no export tool. |
| (c) Title-search URL | **Not confirmed.** No documented query-parameter URL for Liner or Scholar. |

Design consequence: assume NO programmatic import. Build the manual path: paste answer/summary/highlight
into a "Liner memo" section with source + date, and an "open in Liner" link that does not depend on a
query parameter (see fallback below).

## (a) Public API

- Developer portal exists and is public: https://liner.com/developers/docs (checked 2026-11-02).
  Lists 8 APIs: LLM (Router) API (OpenAI Chat Completions-compatible), Search API (web + academic paper search),
  Visualization API, Quick Answer / Search / Deep Research / Visual Answer Agent APIs, Actions API
  (runs actions in end users' connected third-party apps). Also Search MCP and Actions MCP.
- Quick start: https://liner.com/ko/developers/docs/quick-start — keys created in platform dashboard
  (platform.liner.com/keys), base URL `https://platform.liner.com/api/v1/`, header `X-API-KEY`.
  Whether individuals are eligible / approval needed: **확인되지 않음** (page says create a key; no eligibility text seen).
- Pricing is per 1K requests (e.g. Web Search $1, Search Agent $20 per 1K) per the docs page; separate
  "API pricing" page, not read. Individual vs enterprise tiering of the API: **확인되지 않음**.
- API terms exist: https://liner.com/zh/docs/api-terms-of-service (keys must be confidential, not in client-side code).
  Full text not read.
- Scholar MCP: https://liner.com/mcp/scholar — OAuth 2.1 with a Liner account. 9 tools:
  `search_papers`, `search_paper_sections`, `fetch_paper`, `get_paper_citations`,
  `scholar_library_tree`, `scholar_library_ls`, `scholar_library_search`, `scholar_library_read`,
  `scholar_library_upload` (only write tool: adds a paper). Plan requirement: **확인되지 않음**.
  - Library read tools list saved papers (title, authors, year) and read full text of saved papers,
    but the page does NOT describe them returning the user's highlights, notes or Q&A answers.
- General MCP (search_web, search_scholar, agents): https://liner.com/developers/docs/mcp — none of the tools
  is described as accessing highlights/library/history. Paper search output: title, authors, year, citation data, source link.
- Third-party claim (reference only, contradicted by official docs): linkgo.dev FAQ says API docs are non-public.

Implication for this app: the Liner API could be used to *search papers*, but it requires the user's own
API key and costs money; out of Phase 2 scope ("paste" flow is the specified fallback). Do not store keys.

## (b) Export of highlights / answers / Scholar results

- https://liner.com/scholar (checked 2026-11-02): no document or citation export mentioned. Features listed:
  find/write/cite, citation recommender. "Download" footer = app installs (iOS, Android, Mac, Windows, Chrome, Edge).
- https://liner.com/pricing: export not mentioned.
- https://liner.com/terms: no clause about exporting user content; §7.1 says the user owns the content they create.
  §4.1(B) forbids accessing Content "through any technology or means other than the Service itself" —
  **do not scrape or automate Liner**; only user-pasted text.
- Help center (https://support.liner.com/...) search results show: highlights live in "My Space / My Highlights"
  with folders; a highlight can be shared via a link ("Make & Edit Highlights",
  https://support.liner.com/hc/en-us/articles/4408827436825-Make-Edit-Highlights). Export to a file:
  **확인되지 않음** (articles unreadable: 403 from the fetch tool; search snippets mention none).
- Third-party only (reference, NOT evidence): app-store reviews mention one-click export to Evernote;
  directory sites (aipure.ai, navtools.ai) claim PDF export. Unverified against official docs.

Conclusion: no officially confirmed export (Markdown/CSV/Notion) of highlights, answers or Scholar results.
Copy-paste by the user is the only confirmed route.

## (c) Title-search URL

- Product paths seen on liner.com: `/search`, `/scholar`, `/write`, `/pricing`, `/developers`.
  No query-string examples in any official page read; fetching `/search?query=...` returned the marketing homepage
  (no evidence the parameter is honored). Parameter name/format: **확인되지 않음**.
- Fallback for "라이너에서 열기" (needs product decision, not asserted as working):
  1. Open `https://liner.com/scholar` (documented path, no query) and put the paper title on the clipboard
     for the user to paste, or
  2. Try `https://liner.com/search?query=<title>` only as best effort and tell the user to paste if the box is empty.
  Impl should isolate URL building in one function so it can be fixed once a format is confirmed.
- Suggested manual check before shipping (needs a logged-in browser): open liner.com, search a title, read the address bar.

## Open items for the lead
1. Confirm in a logged-in browser: export menu in My Highlights / answer pages; URL after a search.
2. Whether to support the Liner API (user's own key) later — out of the scope as specified.
