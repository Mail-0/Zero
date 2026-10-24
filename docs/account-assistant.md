# Zero conversation assistant

One Keiki agent and one Photon line serve Zero. Each web/iMessage conversation
is authorized to one Zero user. Keiki already owns conversation isolation and
persistence; Zero owns OAuth, account bindings and mailbox permissions. There is
no per-user agent, custom gateway router or feature flag.

## Configuration

- `KEIKI_API_KEY`: server-only organization key with `deployments:write` for
  setup and `agents:chat` for completions.
- `KEIKI_AGENT_ID`: the one configured shared agent. The setup external reference
  is `zero-shared-gateway`; use the existing agent rather than creating one per user.
- `KEIKI_WEBHOOK_SECRET`: random shared signing secret, at least 32 characters.
- `KEIKI_PHOTON_LINE`: the existing shared number in E.164 format; assign it to
  the shared agent in Keiki. Setup does not buy or provision numbers.
- `KEIKI_PLATFORM_URL`: optional; defaults to `https://onkeiki.com`.
- `KEIKI_MODEL`: optional underlying model configured during explicit setup.
- `KEIKI_CALLBACK_URL`: optional public callback origin, such as a dev tunnel.
  Defaults to the backend URL and does not change browser OAuth origins.

Keiki's conversation-principal/signed-tool support is merged in
[PR #1477](https://github.com/Mail-0/sms-kit/pull/1477). The merged callback and
tool contracts match this integration; there is no extra gateway adapter to
maintain. No additional Keiki shared-gateway tables, migration or registration
endpoint are needed.

Zero pins the published `@onkeiki/agents@0.1.3`, which exports
`@onkeiki/agents/cloud`. There is no vendored SDK or local-checkout dependency.
Server deployment is separate from the package release: the Keiki deployment
must also include the merged conversation identity/tool changes.

Apply Zero's unreleased `0039_account_assistants` migration through the standard
migration workflow. It contains only web conversation authorization bindings,
verified external identities, linking challenges and pending approvals—not
per-user cloud agents. No production migration is applied by these changes.

For local development, use the database in Wrangler's local `HYPERDRIVE`
binding. It may differ from a remote `DATABASE_URL` in `.env`. With the default
Docker configuration, the explicit local migration command is:

```sh
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/zerodotemail pnpm --filter @zero/server exec drizzle-kit migrate
```

Do not reset an existing database or replay historical migrations against tables
already present. If the migration ledger is behind a schema created previously,
verify the full existing schema before recording that baseline.

With the backend running and env loaded, run:

```sh
pnpm exec dotenv -- pnpm --filter @zero/server run assistant:setup
```

The command sends an explicit HMAC-signed setup operation to Zero. Zero uses the
SDK to synchronize the one shared agent's prompt, scoped tools and identity
webhook, then reports its ID. Set that ID as `KEIKI_AGENT_ID` and restart the
backend. The private setup operation cannot be invoked with a replayed identity
or tool callback body.

Use the published `@onkeiki/cli@0.1.2` for a local callback tunnel. Install
`cloudflared` first (or select `--provider ngrok` with ngrok installed), start the
backend, then run:

```sh
pnpm dlx @onkeiki/cli@0.1.2 dev --port 8787
```

The CLI does not change agent settings or env files. Set its printed origin in
`KEIKI_CALLBACK_URL`, with the same signing secret in `.env` and the Worker's
`.dev.vars`. Restart Workers to reload env files. A backend tunnel does not make
the frontend reachable from a remote phone; desktop localhost OAuth can remain
local, while remote phone login needs a public frontend too.

## Authorization

The signed identity hook maps a verified Photon sender to a Zero account. An
unknown sender gets a single-use 10-minute login link, then must send the shown
`CONNECT …` command from the originating identity after OAuth. Login alone is
not proof of phone/Apple-ID control. Onboarding/denial replies do not read prior
history or run a model. Provider retries are idempotent and link creation is
rate-limited per sender. Group requests are refused.

For web chat, Zero binds its server-selected conversation UUID to the logged-in
user before requesting a completion. The identity hook looks up this binding;
it never trusts a user ID from a prompt or browser-supplied Keiki metadata.

Generic tool URLs contain no user IDs. Every call must have a valid HMAC, the
configured shared agent ID, a trusted channel/conversation identity and matching
principal. Zero re-reads the binding and current mailbox ownership on every
call. Identity responses have `ttlSeconds: 0`; disconnect and AI-off take effect
immediately, including for stale/queued tool calls.

All mutations store immutable arguments and return an expiring approval link.
Only that account's authenticated session may approve the exact stored action.
An atomic claim prevents duplicate execution; ambiguous failed sends are never
automatically retried. `get_action_status` checks a previous approval without
requesting a second mutation.

### Keiki-managed approval cards

Zero requires only its Keiki credentials, never a Photon project ID or secret.
For a pending action in a verified private messaging conversation, Zero returns:

```json
{
  "presentation": {
    "type": "app",
    "id": "<stable-action-id>",
    "url": "https://<zero-host>/assistant/action/<stable-action-id>",
    "caption": "Review Zero action",
    "subcaption": "Sign in to review and approve"
  }
}
```

Keiki owns provider credentials, routing, retries and the Spectrum launcher.
`assistant:setup` explicitly enables the agent's `imessageApps` add-on. Cards
are supported only on the agent's dedicated line purchased through
Keiki, never imported or shared/pool lines. The recipient and sender come from
Keiki's verified conversation, not the request body. Keiki returns
`presentationDelivery.state: accepted` with its real message ID only after
provider acceptance; `unavailable`, `failed` or `unknown` means use the URL.
Unavailable reasons include `addon_disabled`, `invalid_presentation`,
`unsupported_channel` and `line_not_eligible`.
A presentation request alone never establishes delivery. An older Keiki server
can ignore it and continue with the browser link. The assistant must not invoke
`imessage_send_app` again or retry a mail mutation to recover delivery.

The stable action ID deduplicates presentation attempts in Keiki. Previews are
generic and do not contain email recipients/content or trigger metadata scraping.
Handled/expired actions return no presentation. Delivery does not execute mail
tools or grant approval: the authenticated owner must still review the exact
stored action. Opening a forwarded URL does not authorize another account.

The existing review page opens inside Messages through the Spectrum launcher,
which recipients install once. This is not an install-free Apple App Clip;
Safari cookies are not assumed to exist in its embedded browser. Deploy the
Keiki presentation support and rerun `assistant:setup` to synchronize the
updated instructions. Until then, browser approval links continue to work.
Zero omits `live`: it has a hosted review page, not its own native iMessage
extension. A normal app card still opens that page inside the launcher.

For phone testing, `VITE_PUBLIC_APP_URL` must be a publicly reachable HTTPS
frontend serving this Zero instance. A backend-only tunnel is insufficient:
HTTP/localhost review URLs intentionally produce no presentation. The frontend
must use the matching backend and working owner login; pointing at an unrelated
production frontend will not expose local pending actions.

Before enabling for users, test on a real iPhone: first-use launcher install,
OAuth and return to the review screen, session persistence, approve/decline,
expired and forwarded cards, SMS fallback, and a callback retry. A forwarded
card must not expose the action to another Zero account or allow approval.
Browser login may still be necessary if the embedded OAuth flow is restricted;
do not weaken owner-session or Origin checks to work around that restriction.

References: [Keiki iMessage Apps](https://onkeiki.com/docs/imessage-apps),
[Spectrum app cards](https://photon.codes/docs/spectrum-ts/content/app).

Mailbox selectors are exact `connectionId` values from `list_mailboxes`, not
email addresses or account IDs. Match a requested sender against that list and
ask if ambiguous; never fall back to a different sender. Invalid, unavailable or
unowned selectors return HTTP 400 with `mailbox_selection_required` and discovery
instructions, without revealing whether another account owns that selector.
Malformed tool arguments return HTTP 400 with `invalid_tool_input` and field
issues; unexpected backend failures remain HTTP 500.

`compose_email` generates **unsaved text only**, not a persisted mailbox draft.
Its response includes `status: generated`, `saved: false` and `sent: false`.
For explicitly text-only intent, present that text as unsaved. A request to make
or save a draft must continue to `create_draft` and show its save-approval URL.
For explicit send intent, the assistant must call `send_email` for a new email
or `get_draft` then `send_draft` for an existing draft, and show the exact returned
approval URL in the same turn. Composition alone is not a completed request. No mail is sent
until the authenticated owner approves the immutable pending action. Callback
retries for the same trace and arguments reuse the action, do not extend its
expiry, and report its current status rather than claiming a completed action
still needs approval. After changing the prompt or tool definitions, rerun
`assistant:setup` to synchronize the existing shared agent.

### Saved drafts

- `create_draft` requests approval to save a standalone draft. Replies use the
  separate `create_reply_draft` tool with actual source IDs from `get_thread`.
  Nothing is saved yet. After approval, `get_action_status` returns the provider's
  real `draftId` and a Zero preview URL. The save is read back from the mailbox;
  previews show stored recipients, subject, body and attachment metadata.
- `get_draft` reads a specific draft; `list_drafts` recovers IDs through bounded
  pagination. These never return attachment bytes or provider credentials.
- `update_draft` requires the ID and version returned by `get_draft`. It freezes
  the final content in a pending action, preserves untouched fields, threading
  and attachments, and updates the existing draft only after approval.
- `send_draft` is a separate mutation/approval. It freezes the stored draft's
  exact content; a save approval or a chat confirmation cannot send it.
- Updates and sends freshly re-read and compare the draft version at request
  and execution time. Changes invalidate the approval with HTTP 409. Provider
  APIs do not give this flow an atomic cross-client compare-and-swap; the check
  prevents known stale snapshots, while sends still submit the frozen content.
- Mutations require a stable Keiki `traceId` for idempotent callback retries.
  A save with a provider ID but unavailable read-back retains that ID and reports
  `verified: false`; inspect it rather than creating another draft. Missing IDs
  or uncertain provider errors fail without automatic retries.
- Reply creation resolves recipients and threading from the actual source
  message. Oversized drafts or inline references that cannot be preserved
  require the mailbox UI rather than a lossy rewrite. Uploading new files is
  not exposed; forwarding copies original attachments server-side.
- `/assistant/draft/:connectionId/:draftId` is an authenticated, ownership-checked
  read-only preview, independent of the browser's active/default mailbox. It
  renders untrusted content as text, not executable HTML.

### Reply addressing, sender overrides and forwards

`create_reply_draft` has explicit `reply` (default) and `reply_all` modes. Reply
uses Reply-To, otherwise From; replying to one's own sent message uses its
original recipients. Reply-all adds other original To/Cc participants. Defaults
exclude known self-addresses (owned mailbox addresses plus discovered source and
sender aliases), deduplicate case-insensitively across To/Cc/Bcc, and never
inherit original Bcc. `overrides.to/cc/bcc` are explicit user-requested changes:
omission preserves the default; `[]` clears a field. A final To recipient is
still required. Deliberate overrides may include a copy to self.

The outer tool `connectionId` is the source mailbox. From defaults to the
verified sending identity on that mailbox, preferring a uniquely matched To
alias, then a Cc alias. Multiple matches at the same priority require a choice. An explicit
`overrides.senderConnectionId` may select another owned mailbox; an explicit
`overrides.fromEmail` must be returned by `list_sending_addresses` for that sender.
Gmail pending/unverified aliases are excluded. Sender and source ownership and
alias validity are rechecked at approval time. The immutable preview shows the
final From address and recipients. `update_draft.fromEmail` can change a saved
draft to another verified address on the same mailbox, without creating a new
draft; it is not a cross-mailbox draft move. Outlook cannot preserve cross-mailbox reply
threading through this API and refuses that override rather than creating a fake
reply; select the original mailbox or use its UI.

`search_contacts` searches **known mailbox correspondents**, not a full external
address book. It reads an email-header-only SQLite index in the selected mailbox
DO; it does not read another user's contacts or require new provider permissions.
Normal sync indexes sender/To/Cc (never Bcc); existing body-free snapshots are
backfilled in batches of 200 per search. Results include candidates, `hasMore`
and `backfillComplete`. Those flags do not establish full mailbox/address-book
coverage. Ambiguous, incomplete or unresolved names must be refined or clarified
with the user, never converted to guessed addresses.

`create_forward_draft` requires actual source thread/message IDs and explicit
destination emails, supplied by the user or resolved with `search_contacts`.
There is no model-supplied original body, subject or attachment list. The server
builds a forward from original HTML, quoted headers (excluding Bcc), optional
plain-text covering note and the complete original attachments. It uses the
provider's native forward creation where supported, otherwise the mailbox's
draft MIME path. Ordinary files and referenced inline images are preserved;
missing content, unsupported attachment types and unsupported inline references
fail closed instead of creating a text-only substitute. Source body plus note
is bounded to 64,000 characters and encoded file data to 14 MB; larger forwards
require the mailbox UI.

The forward source and attachment bytes are versioned, freshly re-read, and
checked again when the owner approves. An altered or no-longer-owned source
invalidates the pending action. Saving a forward still does not send it:
`send_draft` requires a separate authenticated owner approval. `send_email` and
standalone `create_draft` reject reply/forward subject shortcuts so they cannot
silently replace these source-preserving tools.

Composition resolves the selected mailbox's stored display name server-side,
falling back to its Zero owner's name when blank. Names are not model arguments;
never pass the assistant's persona as the sender. The composer uses the user's
email writing style rather than the assistant's chat voice, honors explicit
sign-off instructions, and omits an unknown name instead of inventing one. This
sender contract is applied alongside the loaded mailbox prompt so an older
cached prompt does not bypass it. The tool returns the resolved sender name and
email alongside the generated body. Composition now loads persisted writing
preferences from the selected owner's settings, falling back to the legacy
owner `customPrompt` when settings have none. Explicit instructions for the
current email override stored preferences; preferences override the style
profile. Saving remains the separate approved `create_draft` operation.

Deleting a user revokes their web bindings and nulls their messaging identity;
it must never delete the shared Keiki agent or interrupt another user's
conversation. Identity tombstones prevent recycled numbers from inheriting old
history. Upstream transcript retention/deletion is a separate lifecycle policy.

## Compatibility

The Cloudflare chat object remains only the socket, existing web history and
mailbox-presence adapter; there is no legacy model-loop fallback. Web and
iMessage histories remain separate, authorized to the same account. Existing
history is preserved and historical tool invocations are not re-executed.
Cross-channel history/memory merging is not enabled. Web attachments currently
return an explicit unsupported error; Photon media uses Keiki's media pipeline.

Slack/email can use the same principal-based tool boundary when their verified
identities are linked; they do not need another sender-to-agent routing system.
