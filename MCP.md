### Zero MCP

## Capabilties

Zero MCP provides the following capabilities:

### Email Management

- Get email threads by ID
- List emails in specific folders
- Create and send new emails
- Create email drafts
- Send existing drafts
- Delete emails
- Mark emails as read/unread
- Modify email labels
- Bulk delete emails
- Bulk archive emails

### Label Management

- Get all user labels
- Create new custom labels with custom colors
- Delete existing labels

### AI-Powered Features

- Compose emails with AI assistance
- Ask questions about mailbox content
- Ask questions about specific email threads
- Web search using Perplexity AI

### Search and Organization

- Search emails with custom queries
- Filter emails by labels
- Manage email organization through labels
- Archive and trash management

## How to use?

You can connecto ZeroMCP using two methods:

1. Better Auth session token
2. OAuth (Coming soon)

## Better Auth session token

Copy the session cookie from your browser cookies and place it into the Authorization header. You can copy the entire cookie field used in Zero webapp and it will work. Or you can use the format: `better-auth-{env}.session_token={value}`.
Replace `env` with `dev` for local development, `value` is your session token.
