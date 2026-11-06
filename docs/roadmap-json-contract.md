# Learning roadmap JSON contract

Learning roadmaps (학습 로드맵) are not created in the app. Claude Code writes a JSON file
that follows this contract, and it is imported with:

```bash
npm run roadmap:import path/to/roadmap.json
```

The validator is `src/lib/roadmap/contract.ts` (`parseRoadmap`, `parseRoadmapJson`). This
document must match it; change both together.

## Shape

```jsonc
{
  "slug": "visual-slam",            // lowercase kebab-case, ≤ 80 chars, unique key
  "title": "Visual SLAM 로드맵",      // ≤ 120
  "topic": "Visual SLAM",           // ≤ 120
  "summary": "한두 줄 설명",           // optional, ≤ 500
  "stages": [                       // 1..30, in learning order
    {
      "title": "기초 수학",            // ≤ 120, unique among stages
      "description": "...",         // optional, ≤ 2000
      "items": [                    // 0..50
        {
          "title": "선형대수",         // ≤ 120, unique among siblings
          "priority": "essential",  // essential | recommended | optional
          "description": "...",     // optional, ≤ 2000
          "resources": [            // optional, ≤ 20
            { "title": "...", "url": "https://...", "kind": "book" }
          ],
          "children": []            // optional, same item shape
        }
      ]
    }
  ]
}
```

## Rules

- `priority`: exactly one of `essential` (필수), `recommended` (추천), `optional` (선택).
- `resources[].kind`: `book`, `course`, `paper`, `video`, `code` or `doc`.
- `resources[].url`: absolute `http://` or `https://` URL only, ≤ 2000 chars.
- Items nest at most 3 levels below a stage (item → child → grandchild). Deeper is rejected.
- Sibling titles must be unique (stage titles among stages, item titles among the items of
  one parent). Titles are the identity used on re-import.
- At most 1000 nodes in total (stages + items).
- Text fields are trimmed; required text must not be empty.
- Unknown fields are ignored.

## Re-import

Importing a file whose `slug` already exists updates that roadmap: titles, descriptions,
priorities, resources and order are replaced by the file. Progress (`status`:
todo/doing/done) is kept for every node whose title path (stage title → item title → …) is
unchanged. Renaming a stage or item resets its progress to `todo` (including every item beneath it); nodes missing from the
file are removed.

## Prompt for Claude Code

Paste this, filling in the topic. Roadmaps are split into steps (one roadmap per step,
slug `step-<n>-<name>`, title `<n>단계: <name>`), ordered by what the learner needs first;
the roadmap list is sorted by slug, so steps show in order.

> Create a learning roadmap for **<topic>** as step **<n>** (slug `step-<n>-<name>`,
> title `<n>단계: <name>`), one JSON file that follows `docs/roadmap-json-contract.md`
> exactly. The learner already does the hands-on work; focus on the theory a university
> course would teach, in fine detail: one item is one study unit (one or two weeks of a
> lecture or less), and use `children` and grandchildren to break topics down.
> Do not write `summary` or stage `description`. Each item `description` names what is
> learned in concrete terms (theorems, equations, algorithms, API or tag names) and ends
> with where it is in a standard textbook or official doc (e.g. "— Lynch & Park 5장");
> give only the book name when the chapter is uncertain.
> Mark each item `essential`, `recommended` or `optional` for this learner. Add resources
> only where a stable one exists (official docs, author-hosted textbooks, original arXiv
> papers, official GitHub); use only URLs you are confident exist, check them with
> `curl -sIL` in parallel and drop any that fail; leave paid standards (ISO, IEC) as names
> in the description. Write titles and descriptions in Korean; keep resource titles in
> their original language. Keep sibling titles unique and the whole file under 1000 nodes.
> Save as `roadmaps/<slug>.json`, then run `npm run roadmap:import roadmaps/<slug>.json`.

## Example

A small valid file (also the e2e fixture, `tests/e2e/fixtures/roadmap.json`, in a larger
form):

```json
{
  "slug": "visual-slam",
  "title": "Visual SLAM 로드맵",
  "topic": "Visual SLAM",
  "summary": "카메라로 위치를 추정하고 지도를 만드는 Visual SLAM을 단계별로 익힌다.",
  "stages": [
    {
      "title": "기초 수학",
      "description": "SLAM 전반에 쓰이는 선형대수·확률·최적화.",
      "items": [
        {
          "title": "선형대수",
          "priority": "essential",
          "description": "행렬 분해와 고유값, 최소제곱.",
          "resources": [
            { "title": "Linear Algebra Course", "url": "https://example.com/linear-algebra", "kind": "course" }
          ],
          "children": [
            { "title": "SVD", "priority": "essential" },
            { "title": "QR 분해", "priority": "recommended" }
          ]
        }
      ]
    },
    {
      "title": "SLAM 시스템",
      "items": [
        { "title": "번들 조정", "priority": "essential" },
        { "title": "루프 클로저", "priority": "optional" }
      ]
    }
  ]
}
```
