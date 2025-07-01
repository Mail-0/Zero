# Zero Documentation

The official documentation site for **Zero** - an open-source AI email solution that gives users the power to self-host their own email app while integrating external services like Gmail and other email providers.

## About Zero

Zero is revolutionizing email through:

- **Privacy First** - Your emails, your data. No tracking or data collection
- **AI-Powered** - Enhanced with agents and LLMs for intelligent email management
- **Self-Hosting** - Run your own email infrastructure with complete control
- **Unified Inbox** - Connect multiple email providers in one place
- **Customizable** - Tailor your email experience exactly how you want it
- **Developer-Friendly** - Built for extensibility and integrations

## Documentation Features

This documentation site provides:

- **Complete Guides** - From setup to advanced configuration
- **Architecture Overview** - Understanding Zero's design and components
- **API Reference** - Detailed API documentation for developers
- **Plugin Development** - Build custom extensions and integrations
- **Contributing Guide** - How to contribute to the Zero project
- **Blog Posts** - Latest news, updates, and technical deep-dives

## Development

### Prerequisites

- Node.js 18+
- pnpm (recommended package manager)

### Running Locally

From the root of the Zero project:

```bash
# Run all services including docs
pnpm dev

# Or run only the documentation site
pnpm dev:docs
```

From the docs directory (`apps/docs`):

```bash
# Install dependencies (if running standalone)
pnpm install

# Start development server
pnpm dev
```

The documentation will be available at [http://localhost:3000](http://localhost:3000).

### Building for Production

```bash
# From root directory
pnpm build:docs

# Or from docs directory
pnpm build
```

## Project Structure

```text
apps/docs/
├── app/                    # Next.js app directory
│   ├── (home)/            # Landing page and home routes
│   ├── docs/              # Documentation layout and pages
│   ├── api/search/        # Search API endpoint
│   └── layout.config.tsx  # Shared layout configuration
├── content/               # MDX content files
│   ├── docs/             # Documentation pages
│   └── blog/             # Blog posts
├── components/           # React components
├── lib/                 # Utility functions and configurations
│   └── source.ts        # Content source adapter
└── source.config.ts     # Fumadocs MDX configuration
```

## Key Files & Directories

| Path                      | Description                                            |
| ------------------------- | ------------------------------------------------------ |
| `content/docs/`           | Main documentation content in MDX format              |
| `content/blog/`           | Blog posts and announcements                          |
| `lib/source.ts`           | Content source adapter for Fumadocs                   |
| `app/layout.config.tsx`   | Shared layout options and navigation configuration    |
| `app/api/search/route.ts` | Search functionality for the documentation            |
| `source.config.ts`        | MDX processing and frontmatter schema configuration   |

## Technology Stack

This documentation site is built with:

- **[Next.js 15](https://nextjs.org/)** - React framework for production
- **[Fumadocs](https://fumadocs.vercel.app/)** - Documentation framework
- **[MDX](https://mdxjs.com/)** - Markdown with JSX for rich content
- **[TypeScript](https://www.typescriptlang.org/)** - Type-safe JavaScript
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first styling
- **[Mermaid](https://mermaid.js.org/)** - Diagram and flowchart generation

## Contributing to Documentation

We welcome contributions to improve the documentation! Here's how you can help:

### Content Contributions

1. **Fix typos or errors** - Submit PRs for any mistakes you find
2. **Add examples** - Help improve guides with practical examples
3. **Write tutorials** - Create new guides for common use cases
4. **Update outdated content** - Keep documentation current with latest features

### Technical Contributions

1. **Improve search** - Enhance the documentation search functionality
2. **Add components** - Create reusable MDX components
3. **Optimize performance** - Help make the docs site faster
4. **Enhance accessibility** - Improve the documentation for all users

### Getting Started with Contributions

1. Fork the Zero repository
2. Create a new branch for your changes
3. Make your changes in the `apps/docs/` directory
4. Test your changes locally with `pnpm dev:docs`
5. Submit a pull request with a clear description

## Learn More

- **[Zero Main Repository](https://github.com/your-org/zero)** - The main Zero project
- **[Zero Documentation](/)** - Start reading the docs
- **[Contributing Guide](/docs/contributing)** - How to contribute to Zero
- **[Community Discussions](https://github.com/your-org/zero/discussions)** - Join the conversation
- **[Fumadocs Documentation](https://fumadocs.vercel.app)** - Learn about our docs framework
- **[Next.js Documentation](https://nextjs.org/docs)** - Learn about Next.js

## Support

- **Bug Reports** - [Create an issue](https://github.com/your-org/zero/issues)
- **Feature Requests** - [Start a discussion](https://github.com/your-org/zero/discussions)
- **Documentation Issues** - [Report documentation problems](https://github.com/your-org/zero/issues)
- **General Questions** - [Ask in discussions](https://github.com/your-org/zero/discussions)

---

Built with ❤️ by the Zero community. Licensed under [MIT License](../../LICENSE).
