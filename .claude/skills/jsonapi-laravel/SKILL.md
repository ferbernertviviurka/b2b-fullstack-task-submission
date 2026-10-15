---
name: jsonapi-laravel
description: JSON:API response conventions for this project's Laravel API. Use this skill whenever building, changing, testing or consuming any API response — success payloads, error objects, pagination, status codes or the content type (FR-B7) — even if the task doesn't say "JSON:API" explicitly. The frontend types must mirror this contract too.
---

# JSON:API conventions (FR-B7)

Every response uses `Content-Type: application/vnd.api+json`.

## Success shape

```json
{
  "data": [
    {
      "type": "applicants",
      "id": "42",
      "attributes": {
        "name": "Jane Doe",
        "ai_score": 92,
        "status": "pending",
        "applied_at": "2026-10-01T14:30:00Z",
        "highlights": ["Strong portfolio", "Relevant internship"]
      }
    }
  ],
  "meta": {
    "summary": {
      "total_applicants": 128,
      "eligible_applicants": 87,
      "average_ai_score": 74.35,
      "top_applicants": [{ "id": "42", "name": "Jane Doe", "ai_score": 92 }]
    },
    "pagination": { "page": 1, "size": 10, "total_pages": 13, "total": 128 }
  },
  "links": { "first": "...", "last": "...", "prev": null, "next": "..." }
}
```

`meta.summary` keys are fixed: `total_applicants`, `eligible_applicants`
(score ≥ 70), `average_ai_score` (float, 2 decimals, `0.0` when empty),
`top_applicants` (≤ 5, score ≥ 90, descending).

## Error shape — always this, never a bare message or HTML

```json
{
  "errors": [
    {
      "status": "422",
      "title": "Invalid parameter",
      "detail": "min_score must be an integer between 0 and 100."
    }
  ]
}
```

## Status map

| Condition | Status |
| --- | --- |
| Missing/invalid `X-Partner-Token` header | 401 |
| Malformed `campaignId` (not a positive integer) | 422 |
| Campaign not found | 404 |
| Invalid `min_score` or `page[...]` params | 422 |
| Campaign with zero applicants | 200 with zeroed aggregates |

## Implementation notes

- Pagination params: `page[size]` (default 10, max 100), `page[number]` (default 1).
- Compute aggregates in one database pass (COUNT, AVG, conditional counts) plus one
  limited query for top applicants — never iterate models in PHP.
- Register a dedicated exception/render path so validation and not-found errors come
  out as `errors[]` with the right status — a 500 for bad input is a review finding.
