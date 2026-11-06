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
unchanged. Renaming a stage or item resets its progress to `todo`; nodes missing from the
file are removed.

## Prompt for Claude Code

Paste this, filling in the topic:

> Create a learning roadmap for **<topic>** as a single JSON file that follows
> `docs/roadmap-json-contract.md` exactly. Order `stages` from foundations to advanced
> topics (4–8 stages). Give each stage 3–8 items; use `children` only for real sub-topics.
> Mark each item `essential`, `recommended` or `optional` by how much a learner needs it.
> Add 1–3 resources per item where a well-known, stable resource exists (official docs,
> standard textbooks, well-known courses, original papers, reference code); use only URLs
> you are confident exist, and leave `resources` empty otherwise. Write titles and
> descriptions in Korean; keep resource titles in their original language. Keep sibling
> titles unique. Output only the JSON, saved as `roadmaps/<slug>.json`, then run
> `npm run roadmap:import roadmaps/<slug>.json`.

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
