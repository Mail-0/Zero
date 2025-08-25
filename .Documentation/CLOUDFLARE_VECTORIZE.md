# Cloudflare AI + Vectorize: Setup and Usage

This document summarizes how we use Cloudflare AI for embeddings and Cloudflare Vectorize for similarity search in this repo.

## Findings

- **Embedding model**: `@cf/baai/bge-large-en-v1.5` (1024-dim vectors)
- **Indexes used**:
  - `env.VECTORIZE` → threads index
  - `env.VECTORIZE_MESSAGE` → messages index
- **Dimensions/metric**: 1024 dimensions, cosine similarity
- **Bindings live in**: `apps/server/wrangler.jsonc`
  - Local/Staging: `threads-vector-staging`, `messages-vector-staging`
  - Production: `threads-vector`, `messages-vector`

## Where it’s used in code

- `apps/server/src/thread-workflow-utils/workflow-functions.ts`
  - Reads existing thread summary: `env.VECTORIZE.getByIds([...])`
  - Upserts thread summary vector: `env.VECTORIZE.upsert([...])`
  - Checks/Upserts message vectors: `env.VECTORIZE_MESSAGE.getByIds([...])`, `env.VECTORIZE_MESSAGE.upsert([...])`
- `apps/server/src/pipelines.effect.ts`
  - `getEmbeddingVector()` calls Cloudflare AI embeddings with `@cf/baai/bge-large-en-v1.5`
- `apps/server/src/env.ts`
  - Declares `VECTORIZE` and `VECTORIZE_MESSAGE` bindings

## Wrangler configuration

File: `apps/server/wrangler.jsonc`

- Local/Staging bindings:
  - `{"binding": "VECTORIZE", "index_name": "threads-vector-staging"}`
  - `{"binding": "VECTORIZE_MESSAGE", "index_name": "messages-vector-staging"}`
- Production bindings:
  - `{"binding": "VECTORIZE", "index_name": "threads-vector"}`
  - `{"binding": "VECTORIZE_MESSAGE", "index_name": "messages-vector"}`

Ensure your Cloudflare credentials are available when running against Cloudflare:
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- Optional switch: `USE_OPENAI !== 'true'` enables Cloudflare path in code.

## Creating indexes

Use 1024 dimensions and cosine to match the embedding model.

Staging/local:

```bash
wrangler vectorize create threads-vector-staging --dimensions 1024 --metric cosine
wrangler vectorize create messages-vector-staging --dimensions 1024 --metric cosine
```

Production:

```bash
wrangler vectorize create threads-vector --dimensions 1024 --metric cosine
wrangler vectorize create messages-vector --dimensions 1024 --metric cosine
```

Listing/inspecting:

```bash
wrangler vectorize list
wrangler vectorize get <name>
wrangler vectorize info <name>  # details about an index
```

Common ops (manual checks):

```bash
wrangler vectorize list-vectors <name>
wrangler vectorize get-vectors <name> --ids <id1,id2,...>
wrangler vectorize query <name> --vector "[v1,v2,...]" --topK 5
```

## Data shape we upsert

Threads:

```json
{
  "id": "<threadId>",
  "metadata": {
    "connection": "<connectionId>",
    "thread": "<threadId>",
    "summary": "<summary text>",
    "lastMsg": "<latest message id>"
  },
  "values": [1024 floats]
}
```

Messages:

```json
{
  "id": "<messageId>",
  "metadata": {
    "connection": "<connectionId>",
    "thread": "<threadId>",
    "summary": "<summary of message>"
  },
  "values": [1024 floats]
}
```

## Troubleshooting

- **Dimension mismatch**: Create indexes with `--dimensions 1024` (model outputs 1024 dims). Errors like 400 (dim out of range) indicate wrong index dims.
- **Index not found**: Ensure index names match `wrangler.jsonc` bindings for the active env.
- **Empty getByIds()**: Normal if vectors haven’t been upserted yet for given IDs.
- **No credentials locally**: Code guards against missing `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` by skipping CF calls; set them to exercise full path.
- **Describe command**: Use `wrangler vectorize info <name>` instead of `describe`.

## Quick checklist

- [ ] Model set to `@cf/baai/bge-large-en-v1.5` in code
- [ ] Indexes created with 1024 dims + cosine
- [ ] `wrangler.jsonc` bindings match created index names
- [ ] Cloudflare credentials set when needed
- [ ] Upserts occur for both thread and message vectors
