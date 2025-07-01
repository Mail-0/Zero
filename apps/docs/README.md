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
- **Professional Blog** - Latest news, updates, and technical deep-dives with enterprise-grade design
- **Interactive Search** - Powerful search functionality across all content
- **Responsive Design** - Optimized for all devices and screen sizes

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
│   │   ├── blog/          # Blog index and post pages
│   │   │   ├── page.tsx   # Blog index with Fumadocs design
│   │   │   └── [slug]/    # Individual blog posts
│   │   └── page.tsx       # Documentation homepage
│   ├── docs/              # Documentation layout and pages
│   ├── api/search/        # Search API endpoint
│   └── layout.config.tsx  # Shared layout configuration
├── content/               # MDX content files
│   ├── docs/             # Documentation pages
│   │   ├── getting-started/ # Getting started guides
│   │   └── ...           # Other documentation sections
│   └── blog/             # Blog posts and announcements
│       └── sample.mdx    # Professional sample blog post
├── components/           # React components
├── lib/                 # Utility functions and configurations
│   └── source.ts        # Content source adapter with blog support
└── source.config.ts     # Fumadocs MDX configuration with blog schema
```

## Key Files & Directories

| Path                      | Description                                            |
| ------------------------- | ------------------------------------------------------ |
| `content/docs/`           | Main documentation content in MDX format              |
| `content/blog/`           | Professional blog posts with enterprise-grade design  |
| `app/(home)/blog/`        | Blog pages using official Fumadocs blog implementation|
| `lib/source.ts`           | Content source adapter with docs and blog support     |
| `app/layout.config.tsx`   | Shared layout options and navigation configuration    |
| `app/api/search/route.ts` | Search functionality for docs and blog content        |
| `source.config.ts`        | MDX processing with blog and docs schema definitions  |

## Technology Stack

This documentation site is built with:

- **[Next.js 15](https://nextjs.org/)** - React framework for production
- **[Fumadocs](https://fumadocs.vercel.app/)** - Documentation framework with official blog support
- **[MDX](https://mdxjs.com/)** - Markdown with JSX for rich content
- **[TypeScript](https://www.typescriptlang.org/)** - Type-safe JavaScript
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first styling
- **[Mermaid](https://mermaid.js.org/)** - Diagram and flowchart generation

## Blog Implementation

The blog section uses the official Fumadocs blog implementation, featuring:

- **Professional Design** - Matches the official Fumadocs blog aesthetic
- **Gradient Backgrounds** - Beautiful visual effects with noise textures
- **Responsive Layout** - Optimized for all screen sizes
- **InlineTOC** - Table of contents for easy navigation
- **MDX Support** - Rich content with React components
- **Automatic Sorting** - Posts sorted by date (newest first)
- **SEO Optimized** - Proper metadata and structured data

The blog can be accessed at `/blog` and individual posts at `/blog/[slug]`.

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

- **[Zero Main Repository](https://github.com/Mail-0/zero)** - The main Zero project
- **[Zero Documentation](/)** - Start reading the docs
- **[Contributing Guide](/docs/contributing)** - How to contribute to Zero
- **[Community Discussions](https://github.com/Mail-0/zero/discussions)** - Join the conversation
- **[Fumadocs Documentation](https://fumadocs.vercel.app)** - Learn about our docs framework
  
## Support
- **Bug Reports** - [Create an issue](https://github.com/Mail-0/zero/issues)
- **Feature Requests** - [Start a discussion](https://github.com/Mail-0/zero/discussions)
- **Documentation Issues** - [Report documentation problems](https://github.com/Mail-0/zero/issues)
- **General Questions** - [Ask in discussions](https://github.com/Mail-0/zero/discussions)

---

Built with ❤️ by the Zero community. Licensed under [MIT License](../../LICENSE).
