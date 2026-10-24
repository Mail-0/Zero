# Drafting audit: Zero and Orchid

Reference checkout: `/Users/adam/Desktop/AJXB/mail0`. This is a behavioral
comparison, not a plan to port Orchid's runtime, storage or routing.

## Initial comparison (before the saved-draft implementation)

| Concern     | Orchid                                                                         | Zero's Keiki integration                                                                                                          |
| ----------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Sender      | Resolves mailbox, name and self-email before composing                         | Selects an owned mailbox; composition now resolves its name and email server-side                                                 |
| Email voice | User preferences, draft instructions and tone profile; separate from SMS voice | Loads mailbox writing-style metrics and the stored composition prompt; explicit instructions can be passed in the compose request |
| Composition | Supervisor writes the body using that context                                  | A separate composition model generates the body                                                                                   |
| Persistence | `draft_manage` creates/updates a draft and returns its ID                      | No save-draft tool is exposed; `compose_email` returns unsaved text                                                               |
| Preview     | Fetches the stored draft to render a card or SMS preview                       | Assistant presents generated text; send approvals preview immutable action arguments                                              |
| Revision    | Fetches the active draft, then updates the same ID                             | No assistant draft read/update tools or persisted draft reference                                                                 |
| Sending     | Separate draft send, with Orchid-specific confirmation/autonomy settings       | Separate `send_email` request, executed only after authenticated owner approval                                                   |

## Sender-name bug fixed

`apps/server/src/routes/agent/tools.ts` passed `username: 'AI Assistant'` to
`composeEmail`. The inner prompt labeled that value as the user's name, so an
assistant sign-off was grounded in incorrect application-supplied context.

The tool now resolves the selected mailbox's display name, falling back to the
owner's name. Empty names remain empty rather than becoming an assistant name
or an email-local-part guess. Sender name and email are returned with the body.
The composition contract uses the sender's email voice, respects explicit
sign-off instructions and avoids unsupported personal filler. It is applied
alongside the loaded prompt because `getPrompt` reuses mailbox-specific cached
prompts; changing a fallback alone does not update those prompts.

## Follow-up implementation

- Added assistant-only `create_draft`, `create_reply_draft`, `get_draft`, `list_drafts`, `update_draft`
  and `send_draft` tools using the existing mailbox driver and immutable pending
  actions. Save/edit approval is separate from send approval.
- Saves retain the real provider ID and freshly read the saved content. If
  read-back is unavailable, the ID is retained with `verified: false` rather
  than encouraging another create. Zero has an authenticated draft-preview page
  scoped to the explicit mailbox, not the browser's default.
- Revisions fetch the existing draft, freeze the final approved content, check
  its version again at execution and update that ID. Known stale approvals are
  refused. Attachments and reply headers are preserved. Unsupported inline
  references and large drafts require the mailbox UI rather than a lossy rewrite.
- Reply creation derives recipients and threading from the actual source
  message, honoring Reply-To. A standalone `Re:` subject is rejected as a fake
  reply. Prompt guidance requires reading inbound content and answering all
  questions; the body remains owner-reviewed, not fact-verified in code.
- Composition now loads the selected owner's persisted settings `customPrompt`,
  falling back to the legacy owner field. Current user instructions override
  persistent preferences, which override learned writing style.
- No custom HTML-signature setting was added to the current server settings
  schema. Old migrations/translations mentioning signatures are not evidence of
  a working assistant signature feature.

Do not copy Orchid's `autonomousSends` exception, SMS confirmation-as-approval,
`codemode_run` namespaces, blackboard or draft-card-only response rules. Zero
keeps one Keiki agent, server-bound principals and authenticated owner approval.

## Verification

Five regression cases exercise the real compose tool with a stubbed generator:
selected mailbox identity, owner-name fallback, unavailable names, attempted
model argument overrides and a deleted mailbox. Before the fix, all five failed.

Three live signed `compose_email` calls against the local backend also passed
using a temporary synthetic account: sender first-name sign-off, explicit
preferred sign-off and no sign-off. They exercised the actual composition model;
all returned unsaved/unsent text and created no pending actions. The temporary
account was removed; no real mailbox was read or modified.

Saved-draft integration tests cover save/edit/send ownership, immutable content,
stale versions, reply recipient derivation, preserved attachments, uncertain
save/read-back outcomes and idempotent approvals. Provider tests also exercise
Gmail nested/plain-text draft reads, Outlook non-draft rejection and failed
updates, and IMAP draft-only access. See the operational runbook for current
flow and limitations.

The first live saved-draft smoke test exposed a model filling optional reply IDs
with placeholders on a standalone email. Creation is now split into standalone
and reply tools, so standalone drafts have no thread-ID fields. A regression
rejects those fields without reading any thread.

After the split, three live Keiki turns against a temporary synthetic account
passed: save-draft intent created a pending `create_draft` and showed its exact
approval URL; text-only intent created no action; send intent created a pending
`send_email` and showed its exact approval URL. No approvals were performed and
no real mailbox was used. The synthetic account and actions were deleted.

## Reply/forward addressing follow-up

- Reply and reply-all now have deterministic envelopes, with explicit reviewed
  To/Cc/Bcc overrides. Defaults exclude known self-addresses and never inherit
  Bcc. Verified From aliases are selected by sender/To/Cc evidence; ambiguous
  identities require clarification. Source and overridden sender mailbox
  ownership are independently rechecked before execution.
- `search_contacts` exposes a bounded, mailbox-local known-correspondent index,
  not a new provider address book. It indexes email headers only and backfills
  existing body-free snapshots in bounded batches. It returns candidates and
  coverage flags rather than guessing an address or choosing among names.
- `create_forward_draft` fetches the real source server-side, builds its quoted
  HTML and subject, and carries original files and inline image content. The
  model provides source IDs, explicit destination addresses and an optional
  covering note—not a reconstructed original. Source versions protect approval
  against changed body/attachment data; missing content fails closed.
- Approval previews show the actual From address and all recipients. Forward
  saves still require a separate owner-approved send; standalone email tools
  reject reply/forward shortcuts. Gmail pending aliases are not offered as
  sending identities. Cross-mailbox Outlook replies are refused where the
  provider API cannot preserve threading.

## Reference code

- Orchid: `apps/orchid-agent/src/prompts/modules/draft.ts`;
  `apps/orchid-agent/src/prompts/formatting/user-context.ts`;
  `packages/tools/src/draft.ts`;
  `apps/orchid-agent/src/draft-preview-tools.ts`.
- Zero: `apps/server/src/routes/agent/tools.ts`;
  `apps/server/src/trpc/routes/ai/compose.ts`;
  `apps/server/src/lib/brain.ts`;
  `apps/server/src/trpc/routes/drafts.ts`;
  `apps/server/src/routes/assistant.ts`.
