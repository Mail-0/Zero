# Zero

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fnizzyabi%2FMail0&env=DATABASE_URL,BETTER_AUTH_SECRET,BETTER_AUTH_URL,BETTER_AUTH_TRUSTED_ORIGINS,GOOGLE_CLIENT_ID,GOOGLE_CLIENT_SECRET,GOOGLE_REDIRECT_URI,GITHUB_CLIENT_ID,GITHUB_CLIENT_SECRET,GITHUB_REDIRECT_URI&envDescription=For%20more%20info%20on%20setting%20up%20your%20API%20keys%2C%20checkout%20the%20Readme%20below&envLink=https%3A%2F%2Fgithub.com%2Fnizzyabi%2FMail0%2Fblob%2Fmain%2FREADME.md&project-name=0&repository-name=0&redirect-url=0.email&demo-title=0&demo-description=An%20open%20source%20email%20app&demo-url=0.email)

An Open-Source Gmail Alternative for the Future of Email

## What is Zero?

Zero is an open-source AI email solution that gives users the power to **self-host** their own email app while also integrating external services like Gmail and other email providers. Our goal is to modernize and improve emails through AI agents to truly modernize emails.

## Why Zero?
Most email services today are either **closed-source**, **data-hungry**, or **too complex to self-host**.
0.email is different:
  - ✅ **Open-Source** – No hidden agendas, fully transparent.
  - 🦾 **AI Driven** - Enhance your emails with Agents & LLMs.
  - 🔒 **Data Privacy First** – Your emails, your data. No tracking, no selling, no middlemen.
  - ⚙️ **Self-Hosting Freedom** – Run your own email app with ease.
  - 📬 **Unified Inbox** – Connect multiple email providers like Gmail, Outlook, and more.
  - 🎨 **Customizable UI & Features** – Tailor your email experience the way you want it.
  - 🚀 **Developer-Friendly** – Built with extensibility and integrations in mind.

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

For more in-depth information on environment variables, please refer to the [Environment Variables](#environment-variables) section.


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

Copy `.env.example` located in the `apps/mail` folder to `.env` in the same folder and configure the following variables:

```env
# Auth
BETTER_AUTH_SECRET=     # Required: Secret key for authentication

# Google OAuth (Optional)
GOOGLE_CLIENT_ID=       # Required for Gmail integration
GOOGLE_CLIENT_SECRET=   # Required for Gmail integration
GOOGLE_REDIRECT_URI=    # Required for Gmail integration

# Database
DATABASE_URL=           # Required: PostgreSQL connection string for backend connection
```

To be able to run `pnpm db:push` and push the schemas to the database you also have to add a `.env` file to the `packages/db` folder (so `packages/db/.env`) with the following content:

```env
DATABASE_URL=          # Required: PostgreSQL connection string for migrations
```
For local development a connection string example is provided in the `.env.example` file located in the same folder as the database.

**Note:** The `DATABASE_URL` connection string in the `apps/mail/.env` has to be the same as the one in `packages/db/.env`

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

Please refer to the [contributing guide](.github/CONTRIBUTING.md).

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Mail-0/Mail-0&type=Timeline)](https://star-history.com/#Mail-0/Mail-0&Timeline)
