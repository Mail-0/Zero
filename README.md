# Zero

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fnizzyabi%2FMail0&env=DATABASE_URL,BETTER_AUTH_SECRET,BETTER_AUTH_URL,BETTER_AUTH_TRUSTED_ORIGINS,GOOGLE_CLIENT_ID,GOOGLE_CLIENT_SECRET,GOOGLE_REDIRECT_URI,GITHUB_CLIENT_ID,GITHUB_CLIENT_SECRET,GITHUB_REDIRECT_URI&envDescription=For%20more%20info%20on%20setting%20up%20your%20API%20keys%2C%20checkout%20the%20Readme%20below&envLink=https%3A%2F%2Fgithub.com%2Fnizzyabi%2FMail0%2Fblob%2Fmain%2FREADME.md&project-name=0&repository-name=0&redirect-url=0.email&demo-title=0&demo-description=An%20open%20source%20email%20app&demo-url=0.email)

An Open-Source Gmail Alternative for the Future of Email

## Table of Contents <!-- omit from toc -->

- [Zero](#zero)
  - [What is Zero?](#what-is-zero)
  - [Why Zero?](#why-zero)
  - [Our Mission](#our-mission)
  - [Documentation](#documentation)
  - [Roadmap 🛤️](#roadmap-️)
    - [1. Core Email Connectivity](#1-core-email-connectivity)
    - [2. Email Usage Improvements](#2-email-usage-improvements)
    - [3. Infrastructure](#3-infrastructure)
  - [Development Priorities](#development-priorities)
  - [Join the Movement 🚀](#join-the-movement-)
    - [Stay Tuned](#stay-tuned)
  - [Tech Stack](#tech-stack)
  - [Getting Started](#getting-started)
    - [Prerequisites](#prerequisites)
    - [Environment Variables](#environment-variables)
    - [Update the PostgreSQL database accordingly](#update-the-postgresql-database-accordingly)
    - [Running Locally](#running-locally)
  - [Contribute](#contribute)
  - [Issues](#issues)
    - [Create a new issue](#create-a-new-issue)
    - [Solve an issue](#solve-an-issue)
  - [Pull Request](#pull-request)
  - [License](#license)

## What is Zero?

Zero is an open-source email solution that gives users the power to **self-host** their own email app while also integrating external services like Gmail and other email providers. Our goal is to put **control, privacy, and customization** back into the hands of users—whether they choose to host their email independently or manage multiple inboxes from a single, customizable platform.

## Why Zero?

Most email services today are either **closed-source**, **data-hungry**, or **too complex to self-host**. Mail0.io is different:

✅ **Open-Source** – No hidden agendas, fully transparent.
🔒 **Data Privacy First** – Your emails, your data. No tracking, no selling, no middlemen.
⚙️ **Self-Hosting Freedom** – Run your own email app with ease.
📬 **Unified Inbox** – Connect multiple email providers like Gmail, Outlook, and more.
🎨 **Customizable UI & Features** – Tailor your email experience the way you want it.
🚀 **Developer-Friendly** – Built with extensibility and integrations in mind.

## Our Mission

We believe email should be:

1. **Yours** – You control where your data is stored.
2. **Flexible** – Use it however you want—self-hosted or connected to third-party providers.
3. **Open** – Transparent development, open collaboration, and community-driven innovation.
4. **User-Friendly** – No need for technical expertise to get started.

## Documentation

- [License](LICENSE) - Project license and terms
- [Roadmap](ROADMAP.md) - Development plans and future features

## Roadmap 🛤️

This document outlines the development roadmap for Zero. Our vision is to create a powerful, user-friendly, and privacy-focused email experience.

### 1. Core Email Connectivity

- Connect main email providers
- Support for multiple email accounts
- Unified inbox experience

### 2. Email Usage Improvements

- AI-powered email assistance
- Advanced drag-and-drop tools
- Customizable keyboard shortcuts
- Performance optimization
- Enhanced search capabilities
- Deep customization options

### 3. Infrastructure

- Domain management
- Optimized email client
- Self-hosting support

## Development Priorities

1. Building a robust foundation for email management
2. Implementing user-requested features
3. Ensuring seamless integration with existing email providers
4. Maintaining high performance and reliability

We welcome community input and contributions to help shape these features and priorities. If you have suggestions or would like to contribute, please:

1. Open an issue to discuss new feature ideas
2. Submit pull requests for improvements
3. Join discussions in existing issues

This roadmap is a living document and will be updated as development progresses and priorities evolve based on community feedback and technological advances.

## Join the Movement 🚀

Zero is not just another email app—it's a **vision** for a better, more open, and user-controlled email ecosystem. If you believe in **privacy**, **open-source software**, and **giving users control**, we'd love for you to join us!

📢 **Follow our progress** – Stay updated on GitHub as we build Zero.
💡 **Contribute** – Share your ideas, suggest features, and help shape the project.
🤝 **Community-driven** – Our goal is to create an email solution **for the people, by the people**.

### Stay Tuned

We're just getting started. If you're excited about a future where **email belongs to users, not corporations**, let's make it happen together.

---

🤍 **Zero – Email, Reimagined.**

## Tech Stack

Zero is built with modern and reliable technologies:

- **Frontend**: Next.js, React, TypeScript, TailwindCSS, Shadcn UI
- **Backend**: Node.js, Drizzle ORM
- **Database**: PostgreSQL
- **Authentication**: Better Auth, Google OAuth
<!-- - **Testing**: Jest, React Testing Library -->

## Getting Started

### Prerequisites

**Required Versions:**

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- Docker >= 20.10.0

Before running the application, you'll need to set up several services and environment variables:

1. **Setup Local Services with Dev Container and Docker**

   - Make sure you have [Docker](https://docs.docker.com/get-docker/), [NodeJS](https://nodejs.org/en/download/), and [pnpm](https://pnpm.io/installation) installed.
   - Open codebase as a container in [VSCode](https://code.visualstudio.com/) or your favorite VSCode fork.
   - Run the following commands in order to populate your dependencies and setup docker

     ```
     pnpm install
     pnpm docker:up
     ```

   - Run the following commands to clean up after yourself

     ```
     pnpm docker:down
     rm -rf node_modules
     rm pnpm-lock.yaml
     ```

   - Run the following commands if you are unable to start any of the services

     ```
     rm -rf node_modules
     rm pnpm-lock.yaml
     ```

2. **Better Auth Setup**

   - Open the `.env` file and change the BETTER_AUTH_SECRET to a random string. (Use `openssl rand -hex 32` to generate a 32 character string)

     ```env
     BETTER_AUTH_SECRET=your_secret_key
     ```

3. **Google OAuth Setup**

   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create a new project
   - Add the following APIs in your Google Cloud Project: [People API](https://console.cloud.google.com/apis/library/people.googleapis.com), [Gmail API](https://console.cloud.google.com/apis/library/gmail.googleapis.com)
     - Use the links above and click 'Enable' or
     - Go to 'APIs and Services' > 'Enable APIs and Services' > Search for 'Google People API' and click 'Enable'
     - Go to 'APIs and Services' > 'Enable APIs and Services' > Search for 'Gmail API' and click 'Enable'
   - Enable the Google OAuth2 API
   - Create OAuth 2.0 credentials (Web application type)
   - Add authorized redirect URIs:
     - Development:
       - `http://localhost:3000/api/auth/callback/google`
       - `http://localhost:3000/api/v1/mail/auth/google/callback`
     - Production:
       - `https://your-production-url/api/auth/callback/google`
       - `https://your-production-url/api/v1/mail/auth/google/callback`
   - Add to `.env`:

     ```env
     GOOGLE_CLIENT_ID=your_client_id
     GOOGLE_CLIENT_SECRET=your_client_secret
     GOOGLE_REDIRECT_URI=http://localhost:3000/api/v1/mail/auth/google/callback
     ```

   - Add yourself as a test user:

     - Go to [`Audience`](https://console.cloud.google.com/auth/audience)
     - Under 'Test users' click 'Add Users'
     - Add your email and click 'Save'

> [!WARNING]
> The `GOOGLE_REDIRECT_URI` must match **exactly** what you configure in the Google Cloud Console, including the protocol (http/https), domain, and path - these are provided above.

4. **GitHub OAuth Setup**

   - Go to [GitHub Developer Setting](https://github.com/settings/developers)
   - Create a new OAuth App
   - Add authorized redirect URIs:

     - Development:
       - `http://localhost:3000/api/auth/callback/github`
     - Production:
       - `https://your-production-url/api/auth/callback/github`

   - Add to `.env`:

     ```env
     GITHUB_CLIENT_ID=your_client_id
     GITHUB_CLIENT_SECRET=your_client_secret
     ```

### Environment Variables

Copy `.env.example` to `.env` and configure the following variables:

```env
# Auth
BETTER_AUTH_SECRET=     # Required: Secret key for authentication

# Google OAuth (Optional)
GOOGLE_CLIENT_ID=       # Required for Gmail integration
GOOGLE_CLIENT_SECRET=   # Required for Gmail integration
GOOGLE_REDIRECT_URI=    # Required for Gmail integration

# Database
DATABASE_URL=          # Required: PostgreSQL connection string
```

### Update the PostgreSQL database accordingly

Drizzle will apply the schema migrations set in `.env`

```bash
pnpm db:push
```

- Use `pnpm db:studio` to view and manage your data

### Running Locally

Run the development server:

```bash
cd apps/mail
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Contribute

1. You can fork the repository and make changes to your forked repository. Once you have made your changes, you can create a pull request to the main branch.
2. To add code to the main branch, make a [pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request). **Your code will always be reviewed by a maintainer, not yourself!**

## Issues

### Create a new issue

If you spot a problem with the docs, [search if an issue already exists](https://docs.github.com/en/github/searching-for-information-on-github/searching-on-github/searching-issues-and-pull-requests#search-by-the-title-body-or-comments). If a related issue doesn't exist, you can open a new issue using a relevant [issue form](https://github.com/nizzyabi/Mail0/issues/new?template=Blank+issue).

### Solve an issue

Scan through our [existing issues](https://github.com/nizzyabi/Mail0/issues) to find one that interests you. You can narrow down the search using `labels` as filters. For more information, see "[Label reference](https://docs.github.com/en/contributing/collaborating-on-github-docs/label-reference)". As a general rule, we don't assign issues to anyone. If you find an issue to work on, you are welcome to open a PR with a fix.

## Pull Request

When you're finished with the changes, create a pull request, also known as a PR.

- Fill the "Ready for review" template so that we can review your PR. This template helps reviewers understand your changes as well as the purpose of your pull request.
- Don't forget to [link PR to issue](https://docs.github.com/en/issues/tracking-your-work-with-issues/linking-a-pull-request-to-an-issue) if you are solving one.
- Enable the checkbox to [allow maintainer edits](https://docs.github.com/en/github/collaborating-with-issues-and-pull-requests/allowing-changes-to-a-pull-request-branch-created-from-a-fork) so the branch can be updated for a merge.
  Once you submit your PR, a reviewer will review your proposal. We may ask questions or request additional information.
- We may ask for changes to be made before a PR can be merged, either using [suggested changes](https://docs.github.com/en/github/collaborating-with-issues-and-pull-requests/incorporating-feedback-in-your-pull-request) or pull request comments. You can apply suggested changes directly through the UI. You can make any other changes in your fork and then commit them to your branch.
- As you update your PR and apply changes, mark each conversation as [resolved](https://docs.github.com/en/github/collaborating-with-issues-and-pull-requests/commenting-on-a-pull-request#resolving-conversations).
- If you run into any merge issues, check out this [git tutorial](https://github.com/skills/resolve-merge-conflicts) to help you resolve merge conflicts and other issues.

## License

Mail0.io is licensed under the MIT License. This means you can:

✅ Use the software commercially
✅ Modify the source code
✅ Distribute your modifications
✅ Use and modify the software privately

The only requirement is that you include the original copyright and license notice in any copy of the software/source.

See the [LICENSE](LICENSE) file for the full license text.
