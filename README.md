<p align="center">
  <picture>
    <source srcset="apps/mail/public/white-icon.svg" media="(prefers-color-scheme: dark)">
    <img src="apps/mail/public/black-icon.svg" alt="Zero Logo" width="64" style="background-color: #000; padding: 10px; border-radius: 10px;"/>
  </picture>
</p>

# Zero

An Open-Source Gmail Alternative for the Future of Email.

## What is Zero?

Zero is an open-source AI email solution that gives users the power to **self-host** their own email app while also integrating external services like Gmail and other email providers. Our goal is to modernize and improve emails through AI agents to truly modernize emails.

## Why Zero?

Most email services today are either **closed-source**, **data-hungry**, or **too complex to self-host**.
0.email is different:

- ✅ **Open-Source** – No hidden agendas, fully transparent.
- 🦾 **AI Driven** - Enhance your emails with Agents & LLMs.
- 🔒 **Data Privacy First** – Your emails, your data. Zero does not track, collect, or sell your data in any way. Please note: while we integrate with external services, the data passed through them is not under our control and falls under their respective privacy policies and terms of service.
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

## Getting Started

Welcome, contributor! Follow this guide to set up the project locally.

### Prerequisites

Before you begin, ensure you have the following tools installed:
* [Node.js](https://nodejs.org/en/) (v18 or later recommended)
* [pnpm](https://pnpm.io/installation)
* [Docker](https://www.docker.com/products/docker-desktop/) & Docker Compose

If you're using macOS or Linux, you can set it up directly. For Windows users, it's recommended to use WSL (Windows Subsystem for Linux) for a smoother setup experience.

### 1. Fork & Clone
First, create your own copy (a "fork") of the repository and clone it.

```bash
# Replace [YOUR_USERNAME] with your GitHub username.
git clone https://github.com/[YOUR_USERNAME]/Zero.git
cd Zero
```

### 2. Install Dependencies
Install all project dependencies using `pnpm`.

```bash
pnpm install
```

### 3. Start Database
With Docker running, start the local PostgreSQL instance.

```bash
pnpm docker:db:up
```
This creates a database with: Name: `zerodotemail`, User: `postgres`, Pass: `postgres`, Port: `5432`.

### 4. Configure Environment

**A. Generate `.env` file**
```bash
pnpm nizzy env
```
This copies `.env.example` to a new `.env` file in the project root.

**B. Fill Environment Variables**
Open the newly created `.env` file. Below is a complete list of variables that are mandatory to run the project locally.

| Variable Name | Value |
| :--- | :--- |
| `GOOGLE_CLIENT_ID` | `"your_google_client_id"` | 
| `GOOGLE_CLIENT_SECRET`| `"your_google_client_secret"` |
| `VITE_PUBLIC_APP_URL` | `"http://localhost:3000"` |
| `VITE_PUBLIC_BACKEND_URL`| `"http://localhost:8787"` |
| `DATABASE_URL` | `"postgresql://postgres:postgres@localhost:5432/zerodotemail"` |
| `BETTER_AUTH_SECRET` | `"generated_secret_key"` |
| `BETTER_AUTH_URL` | `"http://localhost:3000"` |
| `COOKIE_DOMAIN` | `"localhost"` | 
| `REDIS_URL` | `"http://localhost:8079"` |
| `REDIS_TOKEN` | `"upstash-local-token"` |
| `RESEND_API_KEY` | `"your_resend_api_key"` | 
| `NODE_ENV` | `"development"` | 
| `AUTUMN_SECRET_KEY` | `"your_autumn_secret_key"` |
| `TWILIO_ACCOUNT_SID` | `"your_twilio_sid"` |
| `TWILIO_AUTH_TOKEN` | `"your_twilio_auth_token"` |
| `TWILIO_PHONE_NUMBER`| `"your_twilio_phone_number"`|

**C. Detailed Setup for Key Services**
For services requiring external setup, follow these guides.

- **Better Auth:**
  Generate a secret with `openssl rand -hex 32` and add it to your `.env` file for the `BETTER_AUTH_SECRET` variable.

- **Google OAuth (for Gmail integration):**
  1. Go to the [Google Cloud Console](https://console.cloud.google.com) and create a project.
  2. Enable the **People API** and **Gmail API**.
  3. Go to `APIs & Services` > `OAuth consent screen`, configure it, and add your email as a test user.
  4. Go to `Credentials`, create `OAuth 2.0 Client IDs` for a `Web application`.
  5. Add the authorized redirect URI: `http://localhost:8787/api/auth/callback/google`
     > [!WARNING]
     > This URI must match **exactly**.
  6. Copy your Client ID and Secret into the `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` variables in the `.env` file.

- **Autumn (for encryption):**
  1. Go to [Autumn's onboarding page](https://app.useautumn.com/sandbox/onboarding) to get a key for local use.
  2. Add the key to the `AUTUMN_SECRET_KEY` variable in your `.env` file.

- **Twilio (for SMS/phone services):**
  1. Go to [Twilio Console](https://console.twilio.com/) and create an account or log in.
  2. From your Dashboard, copy your **Account SID** and add it to the `TWILIO_ACCOUNT_SID` variable.
  3. Copy your **Auth Token** (click "Show" to reveal it) and add it to the `TWILIO_AUTH_TOKEN` variable.
  4. Go to `Phone Numbers` > `Manage` > `Active numbers` to get a phone number, or purchase one from `Buy a number`.
  5. Copy your Twilio phone number and add it to the `TWILIO_PHONE_NUMBER` variable in your `.env` file.

**D. Sync Environment**
After saving your `.env` file, run the sync command.
```bash
pnpm nizzy sync
```

### 5. Initialize Database
Push the database schema to your local PostgreSQL instance.
```bash
pnpm db:push
```

### 6. Start the App
You're all set! Run the development server.
```bash
pnpm dev
```
The app will be available at **[http://localhost:3000](http://localhost:3000)**. The database studio will also be running.

## Database Commands

- **Create migration files** (after schema changes):
  ```bash
  pnpm db:generate
  ```
- **Apply migrations**:
  ```bash
  pnpm db:migrate
  ```
- **View database content**:
  ```bash
  pnpm db:studio
  ```

## Contribute

Please refer to the [contributing guide](.github/CONTRIBUTING.md) and the [translation guide](.github/TRANSLATION.md).

If you'd like to help with translating Zero to other languages, check out our [translation guide](.github/TRANSLATION.md).

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Mail-0/Zero&type=Timeline)](https://www.star-history.com/#Mail-0/Zero&Timeline)

## This project wouldn't be possible without these awesome companies

<div style="display: flex; justify-content: center; gap: 16px; align-items: center;">
  <a href="https://vercel.com" style="text-decoration: none;">
    <img src="public/vercel.png" alt="Vercel" width="96"/>
  </a>
  <a href="https://better-auth.com" style="text-decoration: none;">
    <img src="public/better-auth.png" alt="Better Auth" width="96"/>
  </a>
  <a href="https://orm.drizzle.team" style="text-decoration: none;">
    <img src="public/drizzle-orm.png" alt="Drizzle ORM" width="96"/>
  </a>
  <a href="https://coderabbit.com" style="text-decoration: none;">
    <img src="public/coderabbit.png" alt="Coderabbit AI" width="96"/>
  </a>
</div>

## 🤍 The Team

Curious who makes Zero? Here are our [contributors and maintainers](https://0.email/contributors).
