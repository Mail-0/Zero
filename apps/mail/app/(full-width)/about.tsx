import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Github, Mail, ArrowLeft } from 'lucide-react';
import { Navigation } from '@/components/navigation';
import { Button } from '@/components/ui/button';
import Footer from '@/components/home/footer';
import React from 'react';

export default function AboutPage() {
  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-auto bg-white dark:bg-[#111111]">
      <Navigation />
      <div className="relative z-10 flex flex-grow flex-col">
        <div className="absolute right-4 top-6 md:left-8 md:right-auto md:top-8">
          <a href="/">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-gray-600 hover:text-gray-900 dark:text-white dark:hover:text-white/80"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </a>
        </div>

        <div className="container mx-auto max-w-4xl px-4 py-16">
          <Card className="overflow-hidden rounded-xl border-none bg-gray-50/80 dark:bg-transparent">
            <CardHeader className="space-y-4 px-8 py-8">
              <div className="space-y-2 text-center">
                <CardTitle className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl dark:text-white">
                  About Us
                </CardTitle>
              </div>
            </CardHeader>

            <div className="space-y-8 p-8">
              {sections.map((section) => (
                <div key={section.title} className="p-6">
                  <h2 className="mb-4 text-xl font-semibold tracking-tight text-gray-900 dark:text-white">
                    {section.title}
                  </h2>
                  <div className="prose prose-sm prose-a:text-blue-600 hover:prose-a:text-blue-800 dark:prose-a:text-blue-400 dark:hover:prose-a:text-blue-300 max-w-none text-gray-600 dark:text-white/80">
                    {section.content}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Footer />
      </div>
    </div>
  );
}

const sections = [
  {
    title: 'Our Mission',
    content: (
      <p>
        Zero is an AI-powered email client that manages your inbox, so you don't have to. We help
        busy professionals unclutter their inboxes, prioritize important messages, summarize
        conversations, complete tasks, and even chat with their inbox — letting them spend less time
        managing email and more time getting things done.
      </p>
    ),
  },
  {
    title: 'Why We Started',
    content: (
      <p>
        We started Zero because we were frustrated that email — the most-used communication tool in
        the world — hasn't meaningfully evolved in decades. Despite countless new apps, none
        actually solve the real problem: helping you finish what you intend to do. We realized the
        real solution isn't just a new interface — it's AI acting like a true assistant inside your
        inbox.
      </p>
    ),
  },
  {
    title: 'Open Source',
    content: (
      <div className="space-y-4">
        <p>
          Zero is built on the principles of transparency and community collaboration. Our entire
          codebase is open source, allowing anyone to:
        </p>
        <ul className="ml-4 list-disc space-y-2">
          <li>Review our code for security and privacy</li>
          <li>Contribute improvements and new features</li>
          <li>Self-host their own instance of Zero</li>
          <li>Learn from and build upon our work</li>
        </ul>
        <p>
          We believe that email is too important to be controlled by a single entity. By being open
          source, we ensure that Zero remains transparent, trustworthy, and accessible to everyone.
        </p>
      </div>
    ),
  },
  {
    title: 'Our Journey',
    content: (
      <div className="space-y-4">
        <p>
          We launched our early access program and have already seen strong demand, with over 15,000
          signups in just under 3 months. What we found is that users want an assistant that
          streamlines their inbox, providing features to summarize emails, compose responses, and
          take necessary actions.
        </p>
        <p>
          The opportunity is massive: over 4 billion people use email daily, and most still manage
          it manually. Zero is poised to fundamentally change the way the world deals with
          communication and tasks — and we're just getting started.
        </p>
      </div>
    ),
  },
  {
    title: 'Our Founders',
    content: (
      <div className="space-y-4">
        <p>
          Adam and Nizar, the cofounders of Zero, met through family friends. Coming from
          backgrounds in product design and software engineering, we both felt the pain of drowning
          in email firsthand while trying to build and grow companies.
        </p>
        <p>
          We're driven by a shared belief that email should help you move faster, not slow you down.
        </p>
      </div>
    ),
  },
  {
    title: 'Contact',
    content: (
      <div className="space-y-3">
        <p>Want to learn more about Zero? Get in touch:</p>
        <div className="flex flex-col space-y-2">
          <a
            href="mailto:founders@0.email"
            className="inline-flex items-center text-blue-400 hover:text-blue-300"
          >
            <Mail className="mr-2 h-4 w-4" />
            founders@0.email
          </a>
          <a
            href="https://github.com/Mail-0/Zero"
            className="inline-flex items-center text-blue-400 hover:text-blue-300"
          >
            <Github className="mr-2 h-4 w-4" />
            Open an issue on GitHub
          </a>
        </div>
      </div>
    ),
  },
];
