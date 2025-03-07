# Contributing to 0.email

Thank you for your interest in contributing to 0.email! We're excited to have you join our mission to create an open-source email solution that prioritizes privacy, transparency, and user empowerment.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
- [Pull Request Process](#pull-request-process)
- [Coding Guidelines](#coding-guidelines)
- [Testing](#testing)
- [Documentation](#documentation)
- [Community](#community)

## Getting Started

1. **Fork the Repository**

   - Click the 'Fork' button at the top right of this repository
   - Clone your fork locally: `git clone https://github.com/YOUR-USERNAME/Mail-0.git`

2. **Set Up Development Environment**
   - Install Node.js (v16 or higher)
   - Install required dependencies: `npm install`
   - Copy `.env.example` to `.env` and configure your environment variables
   - Set up your Google OAuth credentials (see README.md)

## Development Workflow

1. **Create a New Branch**

   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

2. **Make Your Changes**

   - Write clean, maintainable code
   - Follow our coding standards
   - Add/update tests as needed
   - Update documentation if required

3. **Commit Your Changes**

   - Use clear, descriptive commit messages
   - Reference issues and pull requests

   ```bash
   git commit -m "feat: add new email threading feature

   Implements #123"
   ```

4. **Push to Your Fork**

   ```bash
   git push origin your-branch-name
   ```

5. **Submit a Pull Request**
   - Fill out the PR template completely
   - Link any relevant issues
   - Add screenshots for UI changes

## Coding Guidelines

### General Principles

- Write clean, readable, and maintainable code
- Follow existing code style and patterns
- Keep functions small and focused
- Use meaningful variable and function names
- Comment complex logic, but write self-documenting code where possible

### JavaScript/TypeScript Guidelines

- Use TypeScript for new code
- Follow ESLint and Prettier configurations
- Use async/await for asynchronous operations
- Properly handle errors and edge cases
- Use proper TypeScript types and interfaces

### React Guidelines

- Use functional components and hooks
- Keep components small and focused
- Use proper prop types/TypeScript interfaces
- Follow React best practices for performance
- Implement responsive design principles

## Testing

- Write unit tests for new features
- Update existing tests when modifying features
- Ensure all tests pass before submitting PR
- Include integration tests for complex features
- Test edge cases and error scenarios

## Documentation

- Update README.md if needed
- Document new features and APIs
- Include JSDoc comments for functions
- Update API documentation
- Add comments for complex logic

## Areas of Contribution

- 📨 Email Integration Features
- 🎨 UI/UX Improvements
- 🔒 Security Enhancements
- ⚡ Performance Optimizations
- 📝 Documentation
- 🐛 Bug Fixes
- ✨ New Features
- 🧪 Testing

## Community

- Join our discussions in GitHub Issues
- Help others in the community
- Share your ideas and feedback
- Be respectful and inclusive
- Follow our Code of Conduct

## Questions or Need Help?

If you have questions or need help, you can:

1. Check our documentation
2. Open a GitHub issue
3. Join our community discussions

---

Thank you for contributing to 0.email! Your efforts help make email more open, private, and user-centric. 🚀
