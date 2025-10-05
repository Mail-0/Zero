import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { CRMTablePreview } from '@/components/crm/crm-table-preview';
import { renderTemplateContent } from '@/lib/template-utils';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import templateColors from '@/config/template-colors.json';
import { useEditor, EditorContent } from '@tiptap/react';
import Placeholder from '@tiptap/extension-placeholder';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Button } from '@/components/ui/button';
import StarterKit from '@tiptap/starter-kit';
import { useState, useEffect } from 'react';
import { Extension } from '@tiptap/core';
import confetti from 'canvas-confetti';

// Mock data for testing - will be replaced with real analysis later
const mockUserData = {
  name: 'Jesse',
  role: 'Founder & CEO',
  location: 'San Francisco',
  linkedin: 'https://www.linkedin.com/in/jesse-li-6b6465168/',
  company: {
    name: 'Cedar',
    fullName: 'Cedar Technologies',
    product: 'CedarMail - AI-powered email management platform',
    description:
      'Building the future of intelligent email management with AI-powered workflows that automatically categorize, respond to, and manage your inbox.',
    sector: 'Enterprise SaaS / AI Productivity Tools',
    size: '15-20 employees',
    recentNews: [
      {
        type: 'Funding',
        title: 'Cedar Technologies closes $2M seed round',
        summary: 'Led by top-tier VCs to accelerate AI email automation',
        link: 'https://example.com/news/seed-round',
      },
      {
        type: 'New Customer',
        title: 'Partnership with major enterprise clients',
        summary: 'Onboarding Fortune 500 companies for email automation',
        link: 'https://example.com/news/enterprise-partnership',
      },
      {
        type: 'Product Release',
        title: 'Featured in TechCrunch AI50',
        summary: 'Recognition as top AI startup transforming productivity',
        link: 'https://example.com/news/techcrunch-ai50',
      },
    ],
  },
};

const mockEmailCategories = [
  {
    name: 'Cold Sales Inbound',
    description:
      'Unsolicited sales emails from vendors and service providers trying to sell their products or services.',
    prompt:
      'Identifies emails from unknown senders with sales-oriented language, product pitches, or service offerings. Looks for phrases like "we help companies", "would love to chat", "our solution".',
    sourceCount: 89,
    sourceEmails: [
      {
        id: 30,
        subject: 'Transform your sales process with AI',
        from: 'sales@salestech.com',
        date: '2024-03-16',
        preview:
          'Hi Jesse, I noticed Cedar is growing fast. Our AI sales platform has helped companies like yours increase conversion rates by 40%...',
      },
      {
        id: 31,
        subject: 'Quick question about your marketing stack',
        from: 'growth@marketingpro.io',
        date: '2024-03-15',
        preview:
          'Jesse, saw your recent funding announcement! We help fast-growing startups optimize their marketing workflows. Worth a quick chat?',
      },
      {
        id: 32,
        subject: 'Partnership opportunity for Cedar',
        from: 'bd@techsolutions.com',
        date: '2024-03-14',
        preview:
          'Hi there! We provide enterprise security solutions and think there could be great synergy with CedarMail. Would love to explore...',
      },
    ],
  },
  {
    name: 'Deal',
    description:
      'Active sales opportunities and deal pipeline management with investors, enterprise clients, and strategic partners.',
    prompt:
      'Identifies active deal conversations including fundraising discussions with VCs, enterprise sales opportunities, strategic partnerships, and M&A inquiries. Recognizes term sheets, NDAs, due diligence requests, and contract negotiations.',
    sourceCount: 43,
    sourceEmails: [
      {
        id: 44,
        subject: 'Term sheet discussion - Series A',
        from: 'partner@sequoia.com',
        date: '2024-03-16',
        preview:
          "Jesse, following up on our conversation last week. We'd like to move forward with a term sheet. Can we schedule time this week to discuss terms?",
      },
      {
        id: 45,
        subject: 'Enterprise pilot - GlobalBank',
        from: 'procurement@globalbank.com',
        date: '2024-03-15',
        preview:
          "Hi, we're ready to proceed with the pilot program for 500 users. Legal is reviewing the MSA. Can we target a Q2 start date?",
      },
      {
        id: 46,
        subject: 'Strategic partnership proposal',
        from: 'bd@salesforce.com',
        date: '2024-03-14',
        preview:
          'Jesse, our team is interested in exploring a deeper integration partnership. This could be a significant opportunity for both companies...',
      },
    ],
  },
  {
    name: 'Recruiting Inbound',
    description:
      'Engineering and design job applications, filtering out recruitment agencies and non-technical roles.',
    prompt:
      'Identifies direct job applications from engineers and designers. Filters out recruitment agencies and non-technical roles (sales, marketing, operations, etc.). Recognizes resume attachments and career-focused language from qualified technical candidates.',
    sourceCount: 67,
    sourceEmails: [
      {
        id: 38,
        subject: 'Senior Engineer Application',
        from: 'alex.developer@gmail.com',
        date: '2024-03-16',
        preview:
          "Hi Jesse, I'm excited about Cedar's mission to revolutionize email productivity. I have 8 years of experience in AI/ML and would love to contribute...",
      },
      {
        id: 39,
        subject: 'Talent pipeline for Cedar',
        from: 'recruiter@techtalent.com',
        date: '2024-03-15',
        preview:
          'Hi there! We specialize in AI startup recruiting and have several senior engineers interested in Cedar. Would love to discuss...',
      },
      {
        id: 40,
        subject: 'Product Manager role inquiry',
        from: 'sarah.pm@outlook.com',
        date: '2024-03-14',
        preview:
          "Hello! I saw Cedar is hiring for a Product Manager role. With my background in email productivity tools, I think I'd be a great fit...",
      },
    ],
  },
  {
    name: 'Customer Conversations',
    description:
      'Direct communication with existing customers about product usage, support, or general inquiries.',
    prompt:
      'Emails from known customer domains with questions, feedback, or discussions about your product/service. Contextually understands ongoing relationships and support threads.',
    sourceCount: 124,
    sourceEmails: [
      {
        id: 33,
        subject: 'Issue with email categorization',
        from: 'admin@globalcorp.com',
        date: '2024-03-16',
        preview:
          "Hi Cedar team, we're seeing some emails being miscategorized in our sales pipeline. Can someone help troubleshoot this?",
      },
      {
        id: 34,
        subject: 'Feature request - custom templates',
        from: 'manager@techstartup.io',
        date: '2024-03-15',
        preview:
          'Hey Jesse, loving CedarMail! Our team would benefit from industry-specific templates. Is this something on your roadmap?',
      },
      {
        id: 35,
        subject: 'Integration with our CRM',
        from: 'ops@financeplus.com',
        date: '2024-03-14',
        preview:
          "Hi, we're looking to integrate CedarMail with our Salesforce instance. What's the best way to get started with this?",
      },
    ],
  },
  {
    name: 'Partnership Opportunities',
    description: 'Business development and partnership proposals from potential collaborators.',
    prompt:
      'Emails mentioning collaboration, partnerships, integration opportunities, or co-marketing. Distinguishes from sales by mutual benefit language and strategic focus.',
    sourceCount: 34,
    sourceEmails: [
      {
        id: 36,
        subject: 'Strategic partnership discussion',
        from: 'partnerships@workflowpro.com',
        date: '2024-03-16',
        preview:
          "Hi Jesse, we've been following Cedar's progress. As the leading workflow automation platform, we see great potential for integration...",
      },
      {
        id: 37,
        subject: 'Co-marketing opportunity',
        from: 'marketing@productivity.ai',
        date: '2024-03-13',
        preview:
          "Hello! We're launching a productivity summit and would love Cedar as a partner. Our audiences overlap significantly...",
      },
    ],
  },
  {
    name: 'Internal Team',
    description: 'Communications from your team members and internal stakeholders.',
    prompt:
      'Emails from company domain addresses or known team members. Includes project updates, internal discussions, and cross-functional collaboration.',
    sourceCount: 156,
    sourceEmails: [
      {
        id: 41,
        subject: 'Q1 Product Roadmap Review',
        from: 'sarah@cedar.com',
        date: '2024-03-16',
        preview:
          "Team, let's review our Q1 deliverables and plan for Q2. I've prepared a deck with our progress on AI categorization improvements...",
      },
      {
        id: 42,
        subject: 'Engineering Sprint Planning',
        from: 'mike@cedar.com',
        date: '2024-03-15',
        preview:
          "Hi everyone, sprint planning for next week. We'll focus on the template engine improvements and knowledge base integration...",
      },
      {
        id: 43,
        subject: 'Customer feedback compilation',
        from: 'lisa@cedar.com',
        date: '2024-03-14',
        preview:
          "Jesse, I've compiled this month's customer feedback. Key themes: faster categorization, better mobile experience, more integrations...",
      },
    ],
  },
];

const mockTemplates = [
  {
    name: 'General Rules',
    content: `General Email Response Guidelines:

1. **Tone & Voice**
   - Always maintain a professional yet friendly tone
   - Match the sender's level of formality
   - Use {my_name} for consistent signature

2. **Response Timing**
   - Acknowledge receipt within 2 hours during business hours
   - For complex requests, send quick acknowledgment: "Thanks for your email. I'll review this and get back to you by {specific_time}"
   - Use {@Calendar: suggest meeting times} for scheduling requests

3. **Information Gathering**
   - Reference {@Knowledge Base: company information} for accurate details
   - Always verify facts before sharing company information
   - For pricing questions, use {@Knowledge Base: current pricing} 

4. **Follow-up Protocol**
   - Set reminders using {@Calendar: follow-up reminder} 
   - Track important conversations in {@Notion: conversation log}
   - For deals, update {@Notion: sales pipeline} after each interaction

5. **Escalation Rules**
   - Forward urgent technical issues to {@Slack: engineering}
   - Cc {@Slack: legal} on contract discussions
   - Loop in {@Slack: customer-success} for customer issues

6. **Common Variables**
   - {first_name} - Recipient's first name
   - {company} - Their company name  
   - {our_product} - Reference to CedarMail
   - {my_name} - Your signature name
   - {current_date} - Today's date`,
    sourceCount: 156,
    sourceEmails: [
      {
        id: 100,
        subject: 'Email best practices for the team',
        from: 'sarah@cedar.com',
        date: '2024-03-16',
        preview:
          'Team, here are the email guidelines we discussed. Please make sure all external communications follow these standards...',
      },
      {
        id: 101,
        subject: 'Response time expectations',
        from: 'mike@cedar.com',
        date: '2024-03-15',
        preview:
          'Quick reminder about our 2-hour response commitment during business hours. For complex requests, acknowledge first...',
      },
      {
        id: 102,
        subject: 'Template variables cheat sheet',
        from: 'lisa@cedar.com',
        date: '2024-03-14',
        preview:
          'Here are the most commonly used template variables and when to use them. This should help standardize our responses...',
      },
    ],
  },
  {
    name: 'Schedule Meeting',
    content: `Hey {first_name},

Does {@Calendar: suggest 3 times next week} work for you?

Or feel free to schedule directly here: https://calendly.com/jesse-cedarcopilot/30min

Best,
{my_name}`,
    sourceCount: 23,
    sourceEmails: [
      {
        id: 1,
        subject: 'Quick sync on Q4 planning?',
        from: 'sarah@techcorp.com',
        date: '2024-03-15',
        preview:
          'Hey Jesse, would love to connect about our Q4 roadmap planning. Are you free for a quick 30-minute call next week?',
      },
      {
        id: 2,
        subject: 'Meeting request - Product integration',
        from: 'mike@startup.io',
        date: '2024-03-12',
        preview:
          'Hi Jesse, I saw your recent post about AI automation. Would be great to discuss potential integration opportunities...',
      },
      {
        id: 3,
        subject: 'Coffee chat about CedarMail?',
        from: 'lisa@ventures.com',
        date: '2024-03-10',
        preview:
          "Jesse, heard great things about what you're building. Free for coffee sometime next week to learn more?",
      },
    ],
  },
  {
    name: 'Outreach Follow-up 1',
    content: `Hi {first_name},

Following up on my previous email about {our_product}. I noticed {company} is in the {industry} space - we've helped similar companies like {@Knowledge Base: similar company we sell to} achieve {specific benefit}.

Would love to show you how we could help {company} with {their_main_challenge}.

Worth a quick 15-minute chat?

Best,
{my_name}`,
    sourceCount: 41,
    sourceEmails: [
      {
        id: 4,
        subject: 'Following up on CedarMail demo',
        from: 'jesse@cedar.com',
        date: '2024-03-14',
        preview:
          'Hi David, following up on our conversation about email automation. I noticed GlobalTech is scaling rapidly...',
      },
      {
        id: 5,
        subject: 'Quick follow-up - AI email solution',
        from: 'jesse@cedar.com',
        date: '2024-03-11',
        preview:
          'Hi Maria, wanted to circle back on our email management solution. Saw that FinanceFirst just raised Series B...',
      },
      {
        id: 6,
        subject: 'Re: Email automation for sales teams',
        from: 'jesse@cedar.com',
        date: '2024-03-08',
        preview:
          'Hi Tom, thanks for the initial interest! I noticed your team at SalesForce Pro is handling 500+ leads daily...',
      },
    ],
  },
  {
    name: 'Outreach Follow-up 2',
    content: `Hi {first_name},

Hope you had a great {day_of_week}! I wanted to circle back on {our_product} for {company}.

I came across some interesting insights about {@Knowledge Base: specific compliance issue customer of size and industry might be struggling with} that I thought might be relevant to your team.

Happy to share these findings - would a brief call this week work?

Best,
{my_name}`,
    sourceCount: 35,
    sourceEmails: [
      {
        id: 7,
        subject: 'Second follow-up - compliance insights',
        from: 'jesse@cedar.com',
        date: '2024-03-13',
        preview:
          "Hi Jennifer, hope you had a great Monday! Wanted to share some compliance insights we've gathered...",
      },
      {
        id: 8,
        subject: 'Circling back - email security',
        from: 'jesse@cedar.com',
        date: '2024-03-09',
        preview:
          'Hi Robert, hope your week is going well! I came across some interesting data about email security trends...',
      },
    ],
  },
  {
    name: 'Outreach Follow-up 3',
    content: `Hi {first_name},

Last follow-up from me! I know {company} is likely focused on {current_business_priority}, but I wanted to share one quick insight.

Companies similar to yours typically see {specific_metric_improvement} when they implement {our_solution_category}. 

If this resonates, I'm happy to chat. Otherwise, I'll leave you be!

Best,
{my_name}`,
    sourceCount: 28,
    sourceEmails: [
      {
        id: 9,
        subject: 'Final follow-up - 60% productivity gain',
        from: 'jesse@cedar.com',
        date: '2024-03-07',
        preview:
          'Hi Alex, last email from me! I know TechStartup is focused on scaling, but wanted to share one insight...',
      },
      {
        id: 10,
        subject: 'Last follow-up - email efficiency',
        from: 'jesse@cedar.com',
        date: '2024-03-05',
        preview:
          'Hi Rachel, final follow-up from me. Companies like CloudCorp typically see 40% time savings...',
      },
    ],
  },
  {
    name: 'Polite Sales Decline',
    content: `Hey {first_name},

Thanks for reaching out! We're all set with {their_product_category} for now.

If anything changes, I'll keep you in mind.

Best,
{my_name}`,
    sourceCount: 67,
    sourceEmails: [
      {
        id: 11,
        subject: 'Re: CRM solution for your team',
        from: 'jesse@cedar.com',
        date: '2024-03-16',
        preview:
          "Hey Marcus, thanks for reaching out about your CRM solution! We're all set with our current setup for now...",
      },
      {
        id: 12,
        subject: 'Re: Marketing automation platform',
        from: 'jesse@cedar.com',
        date: '2024-03-14',
        preview:
          "Hi Sophie, appreciate you thinking of us for your marketing automation platform. We're good with our current tools...",
      },
      {
        id: 13,
        subject: 'Re: Analytics dashboard proposal',
        from: 'jesse@cedar.com',
        date: '2024-03-12',
        preview:
          'Hey Kevin, thanks for the analytics dashboard proposal! We have our analytics needs covered at the moment...',
      },
    ],
  },
  {
    name: 'Customer Follow-up',
    content: `Hi {first_name},

Hope you're enjoying {our_product}! I wanted to follow up on {previous_topic}.

{@Knowledge Base: relevant feature that solves their need}

Let me know if you have any questions.

Best,
{my_name}`,
    sourceCount: 52,
    sourceEmails: [
      {
        id: 14,
        subject: 'How are you finding CedarMail?',
        from: 'jesse@cedar.com',
        date: '2024-03-15',
        preview:
          "Hi Patricia, hope you're enjoying CedarMail! Wanted to follow up on the template customization we discussed...",
      },
      {
        id: 15,
        subject: 'Following up on your onboarding',
        from: 'jesse@cedar.com',
        date: '2024-03-13',
        preview:
          'Hi James, hope the team is settling in well with CedarMail! I wanted to check in on the integration setup...',
      },
      {
        id: 16,
        subject: 'Quick check-in - email categorization',
        from: 'jesse@cedar.com',
        date: '2024-03-11',
        preview:
          "Hi Amanda, hope you're finding value in the email categorization features! Wanted to follow up on...",
      },
    ],
  },
  {
    name: 'Partnership Interest',
    content: `Hi {first_name},

I came across {company} and noticed you're {role}. We work with {@Knowledge Base: similar company we sell to}, and I think there could be a great fit for collaboration.

Would love to explore how {our_product} could complement {their_product}.

Interested in chatting?

Best,
{my_name}`,
    sourceCount: 19,
    sourceEmails: [
      {
        id: 17,
        subject: 'Partnership opportunity - AI + Productivity',
        from: 'jesse@cedar.com',
        date: '2024-03-16',
        preview:
          "Hi Daniel, came across WorkflowPro and noticed you're the VP of Partnerships. We work with several productivity companies...",
      },
      {
        id: 18,
        subject: 'Potential collaboration - CedarMail + TaskManager',
        from: 'jesse@cedar.com',
        date: '2024-03-14',
        preview:
          "Hi Emma, I noticed TaskManager's recent integration announcements. As the Head of Business Development...",
      },
    ],
  },
];

type StepType = 'intro' | 'knowledgeBase' | 'crm' | 'agentProcedure' | 'templates' | 'readyToGo';

interface Step {
  type: StepType;
  title: string;
}

const steps: Step[] = [
  { type: 'intro', title: 'Introduction' },
  { type: 'knowledgeBase', title: 'Knowledge Base' },
  { type: 'crm', title: 'CRM' },
  { type: 'templates', title: 'Templates' },
  { type: 'agentProcedure', title: 'Agent Operating Procedure' },
  { type: 'readyToGo', title: 'Ready to Go!' },
];

function IntroductionStep() {
  return (
    <div className="flex h-full flex-col p-6">
      {/* Welcome header */}
      <div className="mb-6">
        <h1 className="text-lg font-semibold">Welcome to CedarMail, {mockUserData.name}</h1>
      </div>

      {/* Profile Section */}
      <div className="mb-6">
        <div className="mb-4 flex items-center">
          <h2 className="text-lg font-semibold">Profile</h2>
        </div>

        <div className="bg-muted/30 rounded-lg border p-6">
          {/* Role confirmation */}
          <div className="mb-4">
            <p className="text-xl">
              Are you a <span className="text-primary text-xl font-bold">{mockUserData.role}</span>{' '}
              @{' '}
              <span className="text-accent-foreground text-xl font-bold">
                {mockUserData.company.name}
              </span>
              ?
            </p>
          </div>

          {/* Personal info */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <svg
                className="text-muted-foreground h-4 w-4"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
              </svg>
              <span className="text-muted-foreground text-sm">{mockUserData.location}</span>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a
                href={mockUserData.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
                LinkedIn
              </a>
            </Button>
          </div>
        </div>
      </div>

      {/* Company Section */}
      <div className="flex-1">
        <div className="mb-4 flex items-center">
          <h2 className="text-lg font-semibold">Company</h2>
        </div>

        <div className="bg-muted/50 flex-1 space-y-4 rounded-lg border p-6">
          <div>
            <h3 className="text-xl font-bold">{mockUserData.company.name}</h3>
            <p className="text-muted-foreground mt-1 text-sm">{mockUserData.company.fullName}</p>
          </div>

          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium">Product</p>
              <p className="text-muted-foreground text-sm">{mockUserData.company.product}</p>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Description</p>
              <p className="text-muted-foreground text-sm">{mockUserData.company.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-muted-foreground text-xs font-medium">Sector</p>
                <p className="text-sm">{mockUserData.company.sector}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs font-medium">Team Size</p>
                <p className="text-sm">{mockUserData.company.size}</p>
              </div>
            </div>

            <div>
              <p className="mb-3 text-sm font-medium">Recent News</p>
              <div className="space-y-2">
                {mockUserData.company.recentNews.map((news) => (
                  <div
                    key={news.link}
                    onClick={() => window.open(news.link, '_blank')}
                    className="bg-background hover:bg-muted/50 flex w-full cursor-pointer items-start gap-3 rounded border p-3 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="bg-primary/10 text-primary rounded px-2 py-0.5 text-xs font-medium">
                          {news.type}
                        </span>
                      </div>
                      <p className="text-sm font-medium">{news.title}</p>
                      <p className="text-muted-foreground text-xs">{news.summary}</p>
                    </div>
                    <div className="flex-shrink-0">
                      <svg
                        className="text-muted-foreground mt-0.5 h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15,3 21,3 21,9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KnowledgeBaseStep() {
  const [knowledgeBaseContent, setKnowledgeBaseContent] = useState('');
  const [selectedItem, setSelectedItem] = useState<number | null>(null);

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-4">
        <h2 className="mb-2 text-3xl font-semibold">Knowledge Base</h2>
        <p className="text-muted-foreground text-sm">
          Connect your knowledge sources and add custom information for Cedar to reference
        </p>
      </div>

      <div className="grid flex-1 grid-cols-2 gap-6 overflow-hidden">
        {/* Left column - Knowledge Items */}
        <div className="flex flex-col space-y-4 overflow-hidden">
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="outline">
              <svg
                className="mr-2 h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add Knowledge
            </Button>
            <Button size="sm" variant="outline">
              <svg
                className="mr-2 h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14,2 14,8 20,8" />
              </svg>
              Add File
            </Button>
            <Button size="sm" variant="outline">
              <svg
                className="mr-2 h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
              </svg>
              Sync Notions
            </Button>
            <Button size="sm" variant="outline">
              <svg
                className="mr-2 h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              Web Scrape
            </Button>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto">
            {mockKnowledgeItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedItem(item.id)}
                className={`w-full rounded-lg border p-3 text-left transition-all ${
                  selectedItem === item.id
                    ? 'bg-primary/10 border-primary'
                    : 'bg-muted/30 hover:bg-muted/50 border-transparent'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-lg">{item.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {item.type === 'file' ? `${item.size} • ${item.source}` : item.source}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right column - Knowledge Item Content or General Management */}
        <div className="flex flex-col space-y-6 overflow-hidden">
          {selectedItem ? (
            /* Selected Item Content */
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="mb-4 flex items-center gap-3">
                <span className="text-2xl">
                  {mockKnowledgeItems.find((item) => item.id === selectedItem)?.icon}
                </span>
                <div>
                  <h3 className="text-lg font-semibold">
                    {mockKnowledgeItems.find((item) => item.id === selectedItem)?.name}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {mockKnowledgeItems.find((item) => item.id === selectedItem)?.type === 'file'
                      ? `${mockKnowledgeItems.find((item) => item.id === selectedItem)?.size} • ${mockKnowledgeItems.find((item) => item.id === selectedItem)?.source}`
                      : mockKnowledgeItems.find((item) => item.id === selectedItem)?.source}
                  </p>
                </div>
              </div>

              {/* Image preview for .pptx files */}
              {mockKnowledgeItems
                .find((item) => item.id === selectedItem)
                ?.name.endsWith('.pptx') && (
                <div className="mb-4">
                  <p className="mb-2 text-sm font-medium">Preview</p>
                  <div className="bg-muted/30 rounded-lg border p-4">
                    <img
                      src={
                        mockKnowledgeItems.find((item) => item.id === selectedItem)?.imagePreview
                      }
                      alt="Presentation preview"
                      className="h-48 w-full rounded object-cover"
                    />
                    <p className="text-muted-foreground mt-2 text-center text-xs">
                      Slide 1 of 24 - AI-generated preview from presentation content
                    </p>
                  </div>
                </div>
              )}

              {/* Content */}
              <div className="flex flex-1 flex-col overflow-hidden">
                <p className="mb-2 text-sm font-medium">Content</p>
                <div className="bg-muted/30 flex-1 overflow-y-auto rounded-lg border p-4">
                  <pre className="whitespace-pre-wrap text-sm font-normal">
                    {mockKnowledgeItems.find((item) => item.id === selectedItem)?.content}
                  </pre>
                </div>
              </div>

              {/* Source emails section for knowledge items */}
              {mockKnowledgeItems.find((item) => item.id === selectedItem)?.sourceCount && (
                <div className="border-t pt-4">
                  <p className="mb-3 text-sm font-medium">
                    Source:{' '}
                    {mockKnowledgeItems.find((item) => item.id === selectedItem)?.sourceCount}{' '}
                    emails this month
                  </p>
                  <Accordion type="single" collapsible className="w-full">
                    {mockKnowledgeItems
                      .find((item) => item.id === selectedItem)
                      ?.sourceEmails?.map((email) => (
                        <AccordionItem
                          key={email.id}
                          value={`email-${email.id}`}
                          className="border-none"
                        >
                          <AccordionTrigger className="bg-muted/50 hover:bg-muted/70 rounded-lg px-3 py-2 text-left text-sm font-normal [&[data-state=open]>div]:mb-2">
                            <div className="flex w-full items-start justify-between pr-4">
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium">{email.subject}</p>
                                <p className="text-muted-foreground truncate text-xs">
                                  From: {email.from} • {new Date(email.date).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-3 pb-3">
                            <div className="bg-background rounded border p-3 text-sm">
                              <p className="text-muted-foreground mb-2 text-xs">Email preview:</p>
                              <p>{email.preview}</p>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                  </Accordion>
                  {mockKnowledgeItems.find((item) => item.id === selectedItem)?.sourceCount &&
                    mockKnowledgeItems.find((item) => item.id === selectedItem)?.sourceEmails &&
                    mockKnowledgeItems.find((item) => item.id === selectedItem)!.sourceCount! >
                      mockKnowledgeItems.find((item) => item.id === selectedItem)!.sourceEmails!
                        .length && (
                      <p className="text-muted-foreground mt-2 text-xs">
                        ...and{' '}
                        {mockKnowledgeItems.find((item) => item.id === selectedItem)!.sourceCount! -
                          mockKnowledgeItems.find((item) => item.id === selectedItem)!.sourceEmails!
                            .length}{' '}
                        more emails
                      </p>
                    )}
                </div>
              )}
            </div>
          ) : (
            /* Default Knowledge Base Management */
            <>
              {/* Integration buttons */}
              <div>
                <p className="mb-3 text-sm font-medium">Connect Integrations</p>
                <div className="grid grid-cols-3 gap-3">
                  <Button variant="outline" className="h-16 flex-col">
                    <svg className="mb-2 h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M4.459 4.208c0-.264.216-.48.48-.48h14.122c.264 0 .48.216.48.48v15.584c0 .264-.216.48-.48.48H4.939a.48.48 0 0 1-.48-.48V4.208Z" />
                      <path
                        d="M7.375 7.5a.375.375 0 0 0-.375.375v8.25c0 .207.168.375.375.375h9.25a.375.375 0 0 0 .375-.375v-8.25A.375.375 0 0 0 16.625 7.5H7.375Z"
                        fill="#fff"
                      />
                      <path d="M8.25 9.75h7.5v1.5h-7.5v-1.5Zm0 2.25h7.5v1.5h-7.5V12Zm0 2.25h5.25v1.5H8.25v-1.5Z" />
                    </svg>
                    <span className="text-xs font-medium">Notion</span>
                  </Button>
                  <Button variant="outline" className="h-16 flex-col">
                    <svg
                      className="mb-2 h-6 w-6"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M8 12h8" />
                      <path d="M12 8v8" />
                      <path d="M16 8l-8 8" />
                      <path d="M8 8l8 8" />
                    </svg>
                    <span className="text-xs font-medium">API</span>
                  </Button>
                  <Button variant="outline" className="h-16 flex-col">
                    <svg className="mb-2 h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                      <path
                        d="M14.727 3H6a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V9.273L14.727 3Z"
                        fill="#4285f4"
                      />
                      <path d="M14.727 3v6.273H21L14.727 3Z" fill="#34a853" />
                      <path d="M6 15h12M6 12h12M6 18h8" stroke="#fff" strokeWidth="0.5" />
                    </svg>
                    <span className="text-xs font-medium">Google Docs</span>
                  </Button>
                </div>
              </div>

              {/* Custom text area */}
              <div className="flex flex-1 flex-col overflow-hidden">
                <p className="mb-3 text-sm font-medium">Custom Knowledge</p>
                <textarea
                  value={knowledgeBaseContent}
                  onChange={(e) => setKnowledgeBaseContent(e.target.value)}
                  placeholder="Paste any relevant information here that Cedar should know about your business, products, or processes...

For example:
- Product descriptions
- Common customer FAQs
- Company policies
- Team information
- Pricing details"
                  className="bg-muted/30 placeholder:text-muted-foreground/50 focus:ring-primary flex-1 resize-none rounded-lg border p-4 text-sm focus:outline-none focus:ring-2"
                />
                <p className="text-muted-foreground mt-2 text-xs">
                  Cedar will use this information to provide more accurate and contextual responses
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CRMStep() {
  const [connectionStatus, setConnectionStatus] = useState<
    Record<string, 'disconnected' | 'connecting' | 'connected'>
  >({
    hubspot: 'disconnected',
    salesforce: 'disconnected',
  });

  const handleConnect = async (integration: string) => {
    setConnectionStatus((prev) => ({ ...prev, [integration]: 'connecting' }));

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));

    setConnectionStatus((prev) => ({ ...prev, [integration]: 'connected' }));
  };

  const integrations = [
    {
      id: 'hubspot',
      name: 'HubSpot',
      description: 'Sync contacts, deals, and pipeline data with your HubSpot CRM',
      icon: (
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M18.164 7.931V4.5a4.5 4.5 0 0 0-9 0v3.431a3.5 3.5 0 1 0 0 6.138V17.5a4.5 4.5 0 0 0 9 0v-3.431a3.5 3.5 0 1 0 0-6.138zM12 2.25a2.25 2.25 0 0 1 2.25 2.25v1.181a3.496 3.496 0 0 0-4.5 0V4.5A2.25 2.25 0 0 1 12 2.25zM5.5 12a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm7 7.25a2.25 2.25 0 0 1-2.25-2.25v-1.181a3.496 3.496 0 0 0 4.5 0V17.5a2.25 2.25 0 0 1-2.25 2.25zM18.5 12a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"
            fill="#ff7a59"
          />
        </svg>
      ),
      color: 'text-orange-600',
      bgColor: 'bg-orange-50 dark:bg-orange-950/30',
      borderColor: 'border-orange-200 dark:border-orange-800',
    },
    {
      id: 'salesforce',
      name: 'Salesforce',
      description:
        'Connect with Salesforce to access leads, opportunities, and account information',
      icon: (
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M12.017 8.928c-.304-.176-.685-.176-.989 0L8.3 10.312c-.304.176-.494.501-.494.854v2.768c0 .353.19.678.494.854l2.728 1.384c.304.176.685.176.989 0l2.728-1.384c.304-.176.494-.501.494-.854v-2.768c0-.353-.19-.678-.494-.854l-2.728-1.384z"
            fill="#00a1e0"
          />
          <path
            d="M17.5 6.5c-1.933 0-3.5 1.567-3.5 3.5 0 .827.287 1.587.768 2.184L12.017 13.5 9.268 12.184C9.713 11.587 10 10.827 10 10c0-1.933-1.567-3.5-3.5-3.5S3 8.067 3 10s1.567 3.5 3.5 3.5c.827 0 1.587-.287 2.184-.768L12.017 14l3.232-1.268c-.481.597-.768 1.357-.768 2.184 0 1.933 1.567 3.5 3.5 3.5s3.5-1.567 3.5-3.5-1.567-3.5-3.5-3.5z"
            fill="#00a1e0"
          />
        </svg>
      ),
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-950/30',
      borderColor: 'border-blue-200 dark:border-blue-800',
    },
  ];

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-6">
        <h2 className="mb-2 text-3xl font-semibold">CRM Integration</h2>
        <p className="text-muted-foreground text-sm">
          Connect your CRM to sync customer data and enhance email categorization with deal context
        </p>
      </div>

      <div className="flex-1 space-y-6">
        {/* Integration Cards */}
        <div className="grid gap-3 md:grid-cols-2">
          {integrations.map((integration) => {
            const status = connectionStatus[integration.id];
            const isConnected = status === 'connected';
            const isConnecting = status === 'connecting';

            return (
              <div
                key={integration.id}
                className={`${integration.bgColor} ${integration.borderColor} rounded-lg border p-4 transition-all hover:shadow-md`}
              >
                {/* Header with icon, name, and connect button */}
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`${integration.color} flex-shrink-0`}>{integration.icon}</div>
                    <div className="min-w-0">
                      <h3 className="font-semibold">{integration.name}</h3>
                      {isConnected && (
                        <div className="flex items-center gap-1 text-green-600">
                          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-xs font-medium">Connected</span>
                        </div>
                      )}
                      {isConnecting && (
                        <div className="flex items-center gap-1 text-blue-600">
                          <svg
                            className="h-3 w-3 animate-spin"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            <path d="M9 12l2 2 4-4" />
                          </svg>
                          <span className="text-xs font-medium">Connecting...</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <Button
                    size="sm"
                    onClick={() => handleConnect(integration.id)}
                    disabled={isConnecting || isConnected}
                    variant={isConnected ? 'outline' : 'default'}
                    className={`flex-shrink-0 ${isConnected ? 'cursor-default' : ''}`}
                  >
                    {isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Connect'}
                  </Button>
                </div>

                {/* Description */}
                <p className="text-muted-foreground mb-3 text-xs leading-relaxed">
                  {integration.description}
                </p>

                {/* Compact features list */}
                <div className="space-y-1">
                  {integration.id === 'hubspot' ? (
                    <>
                      <div className="text-muted-foreground flex items-center gap-2 text-xs">
                        <div className="h-1 w-1 rounded-full bg-current"></div>
                        <span>Sync contacts & deals</span>
                      </div>
                      <div className="text-muted-foreground flex items-center gap-2 text-xs">
                        <div className="h-1 w-1 rounded-full bg-current"></div>
                        <span>Track email engagement</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-muted-foreground flex items-center gap-2 text-xs">
                        <div className="h-1 w-1 rounded-full bg-current"></div>
                        <span>Access leads & opportunities</span>
                      </div>
                      <div className="text-muted-foreground flex items-center gap-2 text-xs">
                        <div className="h-1 w-1 rounded-full bg-current"></div>
                        <span>Auto-sync activity history</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* CRM Data Preview */}
        <div className="bg-muted/30 rounded-lg border p-6">
          <h3 className="mb-4 text-lg font-semibold">CRM Data Preview</h3>
          <p className="text-muted-foreground mb-4 text-sm">
            Here&apos;s how your CRM data will appear in Cedar&apos;s contact management:
          </p>
          <CRMTablePreview />
          <p className="text-muted-foreground mt-4 text-xs">
            This data helps Cedar provide more accurate email categorization and personalized
            response suggestions based on deal status, contact history, and next steps.
          </p>
        </div>

        {/* Skip option */}
        <div className="text-center">
          <p className="text-muted-foreground text-sm">
            You can always connect your CRM later from the settings page
          </p>
        </div>
      </div>
    </div>
  );
}

// Tiptap extension for template highlighting using decorations
const TemplateHighlight = Extension.create({
  name: 'templateHighlight',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('templateHighlight'),
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            const doc = state.doc;

            doc.descendants((node, pos) => {
              if (!node.isText || !node.text) {
                return;
              }

              const text = node.text;

              // Track ranges that are already decorated as mentions to avoid conflicts
              const mentionRanges: Array<{ from: number; to: number }> = [];

              // FIRST: Match @mention patterns (both {@type: content} and @type formats)
              // Pattern matches: {@slack: ops-tools} or @spam
              const mentionRegex = /\{@(\w+):[^}]+\}|@(\w+)\b/g;
              let match;
              while ((match = mentionRegex.exec(text)) !== null) {
                const from = pos + match.index;
                const to = from + match[0].length;
                mentionRanges.push({ from, to });

                // Capture group 1 is for {@type: content}, group 2 is for @type
                const mentionType = (match[1] || match[2]).toLowerCase();

                // Determine CSS class based on mention type for dark mode support
                let cssClass = 'template-mention-default';

                if (mentionType === 'slack') {
                  cssClass = 'template-mention-slack';
                } else if (mentionType === 'notion') {
                  cssClass = 'template-mention-notion';
                } else if (mentionType === 'linear') {
                  cssClass = 'template-mention-linear';
                } else if (mentionType === 'calendar') {
                  cssClass = 'template-mention-calendar';
                } else if (mentionType === 'knowledge') {
                  cssClass = 'template-mention-knowledge';
                } else if (mentionType === 'spam') {
                  cssClass = 'template-mention-spam';
                } else if (mentionType === 'archive') {
                  cssClass = 'template-mention-archive';
                } else if (mentionType === 'template') {
                  cssClass = 'template-mention-template';
                }

                decorations.push(
                  Decoration.inline(from, to, {
                    class: `template-mention ${cssClass}`,
                  }),
                );
              }

              // SECOND: Match {variable} patterns, but skip ranges already marked as mentions
              const curlyBraceRegex = /\{[^}]+\}/g;
              while ((match = curlyBraceRegex.exec(text)) !== null) {
                const from = pos + match.index;
                const to = from + match[0].length;

                // Skip if this range overlaps with any mention
                const isOverlappingMention = mentionRanges.some(
                  (range) => from < range.to && to > range.from,
                );

                if (!isOverlappingMention) {
                  decorations.push(
                    Decoration.inline(from, to, {
                      class: 'template-variable',
                      style: `background-color: hsl(var(--primary) / 0.2); color: hsl(var(--primary)); border-radius: 0.25rem; padding: 0 0.25rem;`,
                    }),
                  );
                }
              }
            });

            return DecorationSet.create(doc, decorations);
          },
        },
      }),
    ];
  },
});

// Helper function to convert plain text with newlines to HTML
function textToHtml(text: string): string {
  if (!text) return '<p></p>';

  // Split by double newlines for paragraphs
  const paragraphs = text.split('\n\n');

  return paragraphs
    .map((para) => {
      // Handle empty paragraphs
      if (para.trim() === '') return '<p></p>';

      // Replace single newlines within paragraphs with <br>
      const content = para.split('\n').join('<br>');
      return `<p>${content}</p>`;
    })
    .join('');
}

// Helper function to convert HTML back to plain text with newlines
function htmlToText(html: string): string {
  // Replace <br> tags with newlines
  let text = html.replace(/<br\s*\/?>/gi, '\n');

  // Replace closing </p> tags with double newlines
  text = text.replace(/<\/p>\s*<p>/gi, '\n\n');

  // Remove any remaining HTML tags
  text = text.replace(/<[^>]*>/g, '');

  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');

  return text.trim();
}

// Component for editable AOP textbox with template formatting
function EditableTemplateTextarea({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        horizontalRule: false,
        blockquote: false,
        dropcursor: false,
        gapcursor: false,
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Enter text...',
      }),
      TemplateHighlight,
    ],
    content: textToHtml(value),
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none focus:outline-none min-h-full p-6 font-mono text-sm whitespace-pre-wrap overflow-hidden',
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const plainText = htmlToText(html);
      onChange(plainText);
    },
  });

  // Update editor when value changes externally
  useEffect(() => {
    if (editor) {
      const currentPlainText = htmlToText(editor.getHTML());
      if (currentPlainText !== value) {
        editor.commands.setContent(textToHtml(value));
      }
    }
  }, [value, editor]);

  return (
    <div className={`flex min-h-0 flex-col ${className}`}>
      <style>{`
        .aop-editor .tiptap {
          outline: none;
          width: 100%;
          word-wrap: break-word;
          overflow-wrap: break-word;
          white-space: pre-wrap;
        }
        
        .aop-editor .tiptap p {
          margin: 0.5rem 0;
          line-height: 1.5;
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        .aop-editor .tiptap p:first-child {
          margin-top: 0;
        }
        .aop-editor .tiptap ul,
        .aop-editor .tiptap ol {
          margin: 0.75rem 0;
          padding-left: 1.5rem;
        }
        .aop-editor .tiptap li {
          margin: 0.35rem 0;
          line-height: 1.5;
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        .aop-editor .tiptap li p {
          margin: 0.2rem 0;
        }
        .aop-editor .tiptap p.is-editor-empty:first-child::before {
          color: hsl(var(--muted-foreground) / 0.5);
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
        
        /* Template variable styling */
        .aop-editor .template-variable {
          background-color: hsl(var(--primary) / 0.2);
          color: hsl(var(--primary));
          border-radius: 0.25rem;
          padding: 0 0.25rem;
          word-break: break-all;
        }
        
        /* Base mention styling */
        .aop-editor .template-mention {
          border-radius: 0.25rem;
          padding: 0 0.25rem;
          font-weight: 500;
          word-break: break-all;
        }
        
        /* Mention type colors - light mode */
        .aop-editor .template-mention-default { background-color: rgb(224 242 254); color: rgb(3 105 161); }
        .aop-editor .template-mention-slack { background-color: rgb(251 207 232); color: rgb(190 24 93); }
        .aop-editor .template-mention-notion { background-color: rgb(243 244 246); color: rgb(55 65 81); }
        .aop-editor .template-mention-linear { background-color: rgb(237 233 254); color: rgb(109 40 217); }
        .aop-editor .template-mention-calendar { background-color: rgb(219 234 254); color: rgb(29 78 216); }
        .aop-editor .template-mention-knowledge { background-color: rgb(209 250 229); color: rgb(4 120 87); }
        .aop-editor .template-mention-spam { background-color: rgb(254 226 226); color: rgb(185 28 28); }
        .aop-editor .template-mention-archive { background-color: rgb(254 243 199); color: rgb(180 83 9); }
        .aop-editor .template-mention-template { background-color: rgb(207 250 254); color: rgb(14 116 144); }
        
        /* Mention type colors - dark mode */
        .dark .aop-editor .template-mention-default { background-color: rgb(7 89 133 / 0.3); color: rgb(125 211 252); }
        .dark .aop-editor .template-mention-slack { background-color: rgb(131 24 67 / 0.3); color: rgb(244 114 182); }
        .dark .aop-editor .template-mention-notion { background-color: rgb(31 41 55 / 0.3); color: rgb(209 213 219); }
        .dark .aop-editor .template-mention-linear { background-color: rgb(76 29 149 / 0.3); color: rgb(196 181 253); }
        .dark .aop-editor .template-mention-calendar { background-color: rgb(30 64 175 / 0.3); color: rgb(147 197 253); }
        .dark .aop-editor .template-mention-knowledge { background-color: rgb(6 78 59 / 0.3); color: rgb(110 231 183); }
        .dark .aop-editor .template-mention-spam { background-color: rgb(127 29 29 / 0.3); color: rgb(252 165 165); }
        .dark .aop-editor .template-mention-archive { background-color: rgb(120 53 15 / 0.3); color: rgb(253 230 138); }
        .dark .aop-editor .template-mention-template { background-color: rgb(21 94 117 / 0.3); color: rgb(103 232 249); }
      `}</style>
      <EditorContent
        editor={editor}
        className="bg-background focus-within:ring-primary aop-editor min-h-0 flex-1 overflow-y-auto rounded border focus-within:ring-2"
      />
    </div>
  );
}

function AgentProcedureStep() {
  const [selectedCategory, setSelectedCategory] = useState(0);
  const [procedures, setProcedures] = useState<Record<number, string>>({
    0: `When handling cold sales inbound emails:

- Immediately assess if the offering is relevant to current business priorities

- For irrelevant pitches, auto-reply with {@template: Polite Sales Decline}

- For potentially relevant solutions, forward to {@slack: ops-tools} for evaluation

- Move to @spam if sender is overly persistent or using manipulative tactics

- Track vendors in {@notion: Vendor Pipeline} for future reference`,
    1: `When handling deal emails, follow this structured sales approach:

═══════════════════════════════════════════════════
🎯 STAGE 1: LEAD (First Contact → Qualified Interest)
═══════════════════════════════════════════════════
<Objective>
Get a demo call scheduled.
</Objective>

**Initial Response:**
- Acknowledge inquiry with {@template: Schedule Meeting} to book discovery call
- Research prospect using {@knowledge base: company research} and LinkedIn
- Log lead in {@notion: Deal Pipeline} with source, company size, estimated ARR potential

**Discovery Call Prep:**
- Review {@knowledge base: pricing} and {@knowledge base: case studies} for similar companies
- Prepare custom pitch referencing their industry challenges
- Have {@template: Partnership Interest} ready if strategic fit is high

**Qualification Criteria:**
- Budget: Confirm >$10k ARR potential for SMB, >$50k for Enterprise
- Authority: Verify decision-maker or strong champion
- Need: Identify 2-3 specific pain points CedarMail solves
- Timeline: Establish buying timeline (ideal: <90 days)

**Lead Nurture (If not qualified yet):**
- Use {@template: Outreach Follow-up 1} after 3 business days
- Use {@template: Outreach Follow-up 2} after 7 business days  
- Use {@template: Outreach Follow-up 3} after 14 business days (final)
- If no response after 3 touches, move to {@notion: Nurture Pipeline} for quarterly check-in

**Transition to Stage 2:**
- Qualified lead agrees to demo or detailed discussion
- Update {@notion: Deal Pipeline} stage to "Post-Demo"
- Loop in {@slack: enterprise-sales} for deals >$100k


═══════════════════════════════════════════════════
📊 STAGE 2: POST-DEMO (Demo Complete → Proposal Sent)
═══════════════════════════════════════════════════

**Immediate Follow-up:**
- Send recap email using {@template: Customer Follow-up} with:
  • Key pain points discussed
  • Proposed solution fit
  • Custom ROI projection based on their metrics
  • Next steps and timeline
- Attach relevant {@knowledge base: case studies} from similar companies

**Proposal Development:**
- Create custom proposal using {@knowledge base: pricing}
- Include pilot program options for enterprise deals
- Reference specific features that solve their top 3 pain points
- Provide clear implementation timeline (typically 2-4 weeks)

**Stakeholder Mapping:**
- Identify all decision makers and document in {@notion: Deal Pipeline}
- For enterprise deals, request multi-stakeholder demo
- Address technical concerns with {@slack: engineering} consultation
- Handle security/compliance questions with {@knowledge base: security documentation}

**Active Negotiation:**
- Respond to all questions within 4 business hours
- For pricing negotiations on >$50k deals, consult {@slack: enterprise-sales}
- Use {@template: Deal Update} to keep internal team aligned
- Schedule weekly check-in via {@calendar} until decision

**Objection Handling:**
- Price concerns: Emphasize ROI using {@knowledge base: case studies}
- Feature gaps: Flag to {@slack: product} and provide workaround timeline
- Competitor comparisons: Use {@knowledge base: competitive analysis}
- Integration questions: Loop in {@slack: engineering} for technical validation

**Follow-up Cadence:**
- Day 2: Quick check-in on proposal questions using {@template: Customer Follow-up}
- Day 5: Share additional case study using {@template: Customer Follow-up}
- Day 7: Executive call if needed, schedule via {@calendar}
- Day 10+: Weekly touch-points until close or explicit rejection

**Transition to Stage 3:**
- Verbal commitment to move forward
- Update {@notion: Deal Pipeline} stage to "Closing"
- Prepare legal documents and onboarding plan


═══════════════════════════════════════════════════
🎉 STAGE 3: CLOSING (Verbal Yes → Contract Signed)
═══════════════════════════════════════════════════

**Contract Preparation:**
- Generate MSA/Order Form from {@knowledge base: contract templates}
- Send to {@slack: legal} for review (2 business day SLA)
- For enterprise deals >$100k, schedule legal review call

**Procurement Navigation:**
- Request their procurement process and timeline upfront
- Proactively provide W9, insurance, security documentation
- For Fortune 500 clients, assign dedicated contact from {@slack: enterprise-sales}
- Answer vendor questionnaires within 24 hours using {@template: Vendor Questionnaire}

**Contract Negotiation:**
- Mark all redlines in {@notion: Deal Pipeline}
- For non-standard terms, get approval from {@slack: legal}
- Keep momentum: respond to all contract questions same-day using {@template: Contract Follow-up}
- Schedule final signature deadline via {@calendar}

**Onboarding Coordination:**
- Assign Customer Success Manager from {@slack: customer-success}
- Schedule kickoff call via {@calendar} (within 5 days of signature) using {@template: Kickoff Call}
- Prepare custom onboarding plan based on deal scope
- Set up success metrics and QBR cadence

**Deal Closure:**
- Upon signature: Log full deal details in {@notion: Deal Pipeline}
- Celebrate in {@slack: wins} with deal size and customer logo
- Send internal thank-yous to everyone who contributed
- Request customer testimonial and permission for case study using {@template: Customer Testimonial}

**Lost Deal Protocol:**
- Document loss reason in {@notion: Deal Pipeline}
- Send gracious follow-up using {@template: Partnership Interest} for future using {@template: Partnership Follow-up}
- Schedule re-engagement reminder in {@calendar: 6 months}
- If lost to competitor, update {@knowledge base: competitive analysis}


═══════════════════════════════════════════════════
⚡ UNIVERSAL DEAL RULES (ALL STAGES)
═══════════════════════════════════════════════════

**Pipeline Hygiene:**
- Update {@notion: Deal Pipeline} after EVERY significant interaction
- Weekly pipeline review every Monday morning
- Archive stalled deals after 90 days of no meaningful progress

**Deal Intelligence:**
- Always check {@knowledge base: pricing} for current rate card
- Use {@knowledge base: case studies} to build credibility
- Reference {@knowledge base: competitive analysis} when needed
- Consult {@knowledge base: security documentation} for compliance questions

**Escalation Paths:**
- Fundraising discussions: Immediately flag {@slack: fundraising}
- Enterprise deals >$100k: Loop in {@slack: enterprise-sales}
- Legal/contract issues: Tag {@slack: legal}
- Technical blockers: Consult {@slack: engineering}
- Strategic partnerships: Cc {@slack: product-partnerships}

**Success Metrics to Track:**
- Time from first contact to demo
- Demo to proposal sent timeline
- Proposal to verbal yes conversion
- Verbal yes to signed contract duration
- Win rate by deal size and industry`,
    2: `When handling recruiting inbound emails:

- Forward exceptional candidates directly to {@slack: recruitment} with summary

- Auto-reply with {@template: Recruitment} to acknowledge receipt

- For unqualified but genuine applicants, use {@template: Polite Decline} 

- Keep top talent warm in {@notion: Talent Pool} even if no current opening`,
    3: `When handling customer conversations:

- Prioritize P0/critical issues and escalate to {@slack: customer-success} within 15 minutes

- Reference {@knowledge base: customer account details} for context

- Check {@linear: support tickets} for related open issues

- For technical bugs, create ticket in {@linear: engineering} and provide ticket number to customer

- Always respond within 2 hours during business hours, using {@template: Customer Follow-up} for check-ins

- Schedule follow-up in {@calendar: 3 days} for any unresolved issues`,
    4: `When handling partnership opportunities:

- Evaluate against {@knowledge base: partnership criteria} for strategic fit

- For qualified partners (revenue >$10M ARR, aligned target market), forward to {@slack: partnerships}

- Request more details using {@template: Partnership Interest} if potential seems promising but unclear

- Move exploratory/fishing emails to @archive

- Document all conversations in {@notion: Partnership Pipeline}

- For integration requests, also cc {@slack: product-partnerships}`,
    5: `When handling internal team emails:

- Respond to teammates within 1 hour during work hours

- Use {@slack: channel-name} for time-sensitive matters instead of email

- Extract and create action items in {@linear: tasks}

- For decisions, document in {@notion: Decision Log}

- Cc relevant stakeholders based on {@knowledge base: team structure}

- Auto-archive FYI/updates after reading

- For recurring topics, suggest creating {@notion: SOPs}`,
  });
  const [detectionRules, setDetectionRules] = useState<Record<number, string>>({
    0: mockEmailCategories[0].prompt, // Cold Sales Inbound
    1: mockEmailCategories[1].prompt, // Deal
    2: mockEmailCategories[2].prompt, // Recruiting Inbound
    3: mockEmailCategories[3].prompt, // Customer Conversations
    4: mockEmailCategories[4].prompt, // Partnership Opportunities
    5: mockEmailCategories[5].prompt, // Internal Team
  });

  const handleProcedureChange = (index: number, value: string) => {
    setProcedures((prev) => ({ ...prev, [index]: value }));
  };

  const handleDetectionRuleChange = (index: number, value: string) => {
    setDetectionRules((prev) => ({ ...prev, [index]: value }));
  };

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-4">
        <h2 className="mb-2 text-3xl font-semibold">Agent Operating Procedure</h2>
        <p className="text-muted-foreground text-sm">
          Configure email categorization and define how Cedar should handle emails in each category
        </p>
      </div>

      <div className="grid flex-1 gap-6 overflow-hidden" style={{ gridTemplateColumns: '25% 75%' }}>
        {/* Left column - Category list */}
        <div className="space-y-2 overflow-y-auto">
          {mockEmailCategories.map((category, index) => (
            <button
              key={category.name}
              onClick={() => setSelectedCategory(index)}
              className={`w-full rounded-lg border p-3 text-left transition-all ${
                selectedCategory === index
                  ? 'bg-primary/10 border-primary'
                  : 'bg-muted/30 hover:bg-muted/50 border-transparent'
              }`}
            >
              <p className="text-sm font-medium">{category.name}</p>
              <p className="text-muted-foreground line-clamp-1 text-xs">{category.description}</p>
            </button>
          ))}
        </div>

        {/* Right column - Separate containers for Sorting Instructions and Operating Procedures */}
        <div className="flex min-w-0 flex-col space-y-4 overflow-hidden">
          {/* Sorting Instructions Container */}
          <div className="bg-muted/30 flex flex-col space-y-2 rounded-lg border p-3">
            <div className="flex-1">
              <h3 className="mb-1 text-sm font-semibold">Sorting Instructions</h3>
              <p className="text-muted-foreground mb-2 text-xs">
                How Cedar identifies and categorizes emails for:{' '}
                {mockEmailCategories[selectedCategory].name}
              </p>
              <EditableTemplateTextarea
                value={detectionRules[selectedCategory] || ''}
                onChange={(value) => handleDetectionRuleChange(selectedCategory, value)}
                placeholder="Define the detection rules for this category..."
                className="min-h-[100px] min-w-0 overflow-hidden"
              />
            </div>
            <div>
              <p className="text-muted-foreground text-xs">
                Cedar uses these rules along with external context like sender role, previous
                communication, and more to automatically sort emails accurately.
              </p>
            </div>
          </div>

          {/* Agent Operating Procedure Container */}
          <div className="bg-muted/30 flex min-h-0 flex-1 flex-col rounded-lg border p-4">
            <h3 className="mb-3 font-semibold">Agent Operating Procedure</h3>
            <EditableTemplateTextarea
              value={procedures[selectedCategory] || ''}
              onChange={(value) => handleProcedureChange(selectedCategory, value)}
              placeholder="Define the operating procedure for this category..."
              className="min-h-0 min-w-0 flex-1 overflow-hidden"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Mock data for knowledge base items
const mockKnowledgeItems = [
  {
    id: 1,
    name: 'Product Pitch Deck.pptx',
    type: 'file',
    source: 'pulled from 13 emails',
    icon: '📄',
    size: '2.4 MB',
    content: `CedarMail Product Pitch Deck

Key highlights from this presentation:

• AI-Powered Email Management Platform
• Automatically categorizes and prioritizes emails
• Intelligent response suggestions based on context
• Advanced template system with dynamic variables
• Integration with popular productivity tools

Target Market:
- Enterprise teams handling high email volumes
- Sales teams needing efficient outreach management  
- Customer support organizations
- Executive assistants and operations teams

Key Metrics:
- 40% reduction in email processing time
- 85% accuracy in email categorization
- 60% faster response times
- 95% customer satisfaction rating

This deck was automatically extracted and compiled from 13 different email conversations with prospects and customers.`,
    imagePreview:
      'https://images.unsplash.com/photo-1551434678-e076c223a692?w=400&h=300&fit=crop&crop=center',
    sourceCount: 13,
    sourceEmails: [
      {
        id: 19,
        subject: 'CedarMail pitch deck for review',
        from: 'sarah@techcorp.com',
        date: '2024-03-14',
        preview:
          'Hi Jesse, thanks for sharing the pitch deck! The AI automation features look impressive. Can you walk us through the ROI metrics?',
      },
      {
        id: 20,
        subject: 'Re: Product demo - slide deck follow-up',
        from: 'mike@startup.io',
        date: '2024-03-12',
        preview:
          'Jesse, the presentation was great! Especially interested in the enterprise features. Do you have case studies from similar companies?',
      },
      {
        id: 21,
        subject: 'Pitch deck feedback - impressive numbers',
        from: 'lisa@ventures.com',
        date: '2024-03-10',
        preview:
          'The 40% time reduction stat caught our attention. Would love to understand the methodology behind these metrics...',
      },
    ],
  },
  {
    id: 2,
    name: 'Company Overview',
    type: 'knowledge',
    source: 'manual entry',
    icon: '📝',
    content: `Cedar Technologies Company Overview

Mission:
To revolutionize email productivity through intelligent AI automation that understands context, intent, and business relationships.

Founded: 2023
Location: San Francisco, CA
Team Size: 15-20 employees
Funding: $2M Seed Round (Series A planned for Q2 2024)

Core Product - CedarMail:
An AI-powered email management platform that automatically:
- Categorizes incoming emails by intent and priority
- Suggests contextual responses using company knowledge
- Manages email templates with dynamic AI variables
- Integrates with existing productivity workflows

Key Differentiators:
1. Context-aware AI that learns from your specific business
2. Advanced template system with knowledge base integration
3. Seamless integration with existing email providers
4. Privacy-first approach with on-premise deployment options

Target Customers:
- Mid to large enterprises (500+ employees)
- High-growth startups with scaling communication needs
- Sales and customer success teams
- Executive teams requiring email efficiency

Recent Achievements:
- Featured in TechCrunch AI50
- Partnership with major Fortune 500 clients
- 300% month-over-month growth in active users`,
    sourceCount: 8,
    sourceEmails: [
      {
        id: 22,
        subject: 'Company background for partnership eval',
        from: 'david@enterprise.com',
        date: '2024-03-15',
        preview:
          'Hi Jesse, our team needs more details about Cedar Technologies for our partnership evaluation. Can you share company overview?',
      },
      {
        id: 23,
        subject: 'Re: Due diligence - company information',
        from: 'jennifer@investment.com',
        date: '2024-03-13',
        preview:
          'Thanks for the initial info. For our investment committee, we need comprehensive company background including team size and funding...',
      },
    ],
  },
  {
    id: 3,
    name: 'Pricing Information.docx',
    type: 'file',
    source: 'pulled from 8 emails',
    icon: '📄',
    size: '1.2 MB',
    content: `CedarMail Pricing Structure

STARTER PLAN - $29/user/month
- Up to 1,000 emails processed per month
- Basic email categorization
- 5 custom templates
- Standard integrations (Gmail, Outlook)
- Email support

PROFESSIONAL PLAN - $79/user/month (Most Popular)
- Up to 5,000 emails processed per month
- Advanced AI categorization with custom rules
- Unlimited templates with AI variables
- Knowledge base integration (up to 100MB)
- Priority email and chat support
- Custom workflow automation

ENTERPRISE PLAN - $149/user/month
- Unlimited email processing
- Advanced analytics and reporting
- Custom AI model training
- Unlimited knowledge base storage
- Dedicated customer success manager
- On-premise deployment option
- SSO and advanced security features

VOLUME DISCOUNTS:
- 50-100 users: 10% discount
- 100-500 users: 20% discount  
- 500+ users: Custom pricing

Add-ons:
- Additional knowledge base storage: $10/GB/month
- Custom integrations: Starting at $500/month
- Professional services: $200/hour

Annual billing: 20% discount on all plans

This pricing information was compiled from 8 different email conversations with prospects and existing customers.`,
    sourceCount: 8,
    sourceEmails: [
      {
        id: 24,
        subject: 'Pricing for 200+ user deployment',
        from: 'tom@globalcorp.com',
        date: '2024-03-16',
        preview:
          "Hi Jesse, we're looking at CedarMail for our 200-person sales team. What would enterprise pricing look like for our scale?",
      },
      {
        id: 25,
        subject: 'Re: Pricing tiers and volume discounts',
        from: 'maria@techstartup.io',
        date: '2024-03-14',
        preview:
          'Thanks for the pricing overview! As a growing startup (currently 50 users, scaling to 150), which plan would you recommend?',
      },
      {
        id: 26,
        subject: 'Custom pricing for enterprise features',
        from: 'robert@finance.com',
        date: '2024-03-11',
        preview:
          'We need on-premise deployment and custom integrations. Can you provide enterprise pricing with these requirements?',
      },
    ],
  },
  {
    id: 4,
    name: 'Customer Success Stories',
    type: 'knowledge',
    source: 'manual entry',
    icon: '📝',
    content: `Customer Success Stories

TechCorp Inc. (500 employees)
Challenge: Sales team was spending 3+ hours daily on email management
Solution: Implemented CedarMail with custom sales templates and lead categorization
Results: 
- 60% reduction in email processing time
- 40% increase in response rates
- $2M additional revenue attributed to faster follow-ups
Quote: "CedarMail transformed how our sales team operates. We're closing deals faster than ever." - Sarah Chen, VP of Sales

GlobalServices LLC (1,200 employees)  
Challenge: Customer support team overwhelmed with 500+ daily inquiries
Solution: Deployed CedarMail with automated categorization and response templates
Results:
- 70% of inquiries now auto-categorized correctly
- 50% faster first response time
- 95% customer satisfaction score (up from 78%)
Quote: "Our support team can now focus on complex issues while CedarMail handles the routine stuff." - Mike Rodriguez, Customer Success Director

StartupXYZ (50 employees)
Challenge: CEO spending 4+ hours daily managing investor and partner communications  
Solution: CedarMail with executive assistant workflows and priority filtering
Results:
- 75% reduction in email management time
- Zero missed critical communications
- Successful Series A fundraising (partly attributed to improved communication)
Quote: "CedarMail gave me my time back to focus on growing the business." - Jessica Park, CEO

FinanceFirst (800 employees)
Challenge: Compliance team needed to track and categorize all client communications
Solution: CedarMail with custom compliance rules and automated archiving
Results:
- 100% compliance audit success rate
- 80% reduction in manual email sorting
- Passed SOC 2 audit with zero email-related findings
Quote: "CedarMail's categorization is so accurate, our auditors were impressed." - David Kumar, Compliance Director`,
    sourceCount: 12,
    sourceEmails: [
      {
        id: 27,
        subject: 'Success story for case study',
        from: 'patricia@techcorp.com',
        date: '2024-03-15',
        preview:
          "Hi Jesse, we'd be happy to be a reference customer! The results we've seen with CedarMail have been incredible - 60% time savings...",
      },
      {
        id: 28,
        subject: 'Customer testimonial - amazing results',
        from: 'james@globalservices.com',
        date: '2024-03-12',
        preview:
          'Jesse, wanted to share our success with CedarMail. Our support team efficiency has improved dramatically since implementation...',
      },
      {
        id: 29,
        subject: 'Reference call feedback',
        from: 'amanda@startupxyz.com',
        date: '2024-03-10',
        preview:
          'Thanks for connecting us with the prospect! Happy to share how CedarMail helped us during our Series A fundraising...',
      },
    ],
  },
];

function TemplatesStep() {
  const [selectedTemplate, setSelectedTemplate] = useState(0);

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-4">
        <h2 className="mb-2 text-3xl font-semibold">Templates</h2>
        <p className="text-muted-foreground text-sm">
          Pre-configured email templates with AI variables
        </p>
      </div>

      <div className="grid flex-1 grid-cols-2 gap-6 overflow-hidden">
        {/* Left column - Template list */}
        <div className="space-y-2 overflow-y-auto">
          {mockTemplates.map((template, index) => (
            <button
              key={template.name}
              onClick={() => setSelectedTemplate(index)}
              className={`w-full rounded-lg border p-3 text-left transition-all ${
                selectedTemplate === index
                  ? 'bg-primary/10 border-primary'
                  : 'bg-muted/30 hover:bg-muted/50 border-transparent'
              }`}
            >
              <p className="text-sm font-medium">{template.name}</p>
            </button>
          ))}
        </div>

        {/* Right column - Template content */}
        <div className="bg-muted/30 space-y-4 overflow-y-auto rounded-lg border p-4">
          <div>
            <h3 className="mb-4 font-semibold">{mockTemplates[selectedTemplate].name}</h3>
            <div className="bg-background whitespace-pre-wrap rounded border p-4 font-mono text-sm">
              {renderTemplateContent(mockTemplates[selectedTemplate].content)}
            </div>
          </div>

          <div className="space-y-2 border-t pt-4">
            <p className="text-muted-foreground mb-2 text-xs">
              AI Variables like{' '}
              <code
                className={`${templateColors.variableColors.default.background} ${templateColors.variableColors.default.text} rounded px-1 text-xs`}
              >
                {'{first_name}'}
              </code>{' '}
              are automatically filled by Cedar&apos;s AI based on context.
            </p>
            <p className="text-muted-foreground text-xs">
              Special notation{' '}
              <code
                className={`${templateColors.variableColors['@knowledge base'].background} ${templateColors.variableColors['@knowledge base'].text} rounded px-1 text-xs`}
              >
                {'@Knowledge Base'}
              </code>{' '}
              queries your knowledge base for relevant information.
            </p>
            <p className="text-muted-foreground text-xs">
              Calendar integration{' '}
              <code
                className={`${templateColors.variableColors['@calendar'].background} ${templateColors.variableColors['@calendar'].text} rounded px-1 text-xs`}
              >
                {'@Calendar'}
              </code>{' '}
              helps with scheduling and time-based suggestions.
            </p>
          </div>

          {/* Source emails section */}
          <div className="border-t pt-4">
            <p className="mb-3 text-sm font-medium">
              Source: {mockTemplates[selectedTemplate].sourceCount} emails this month
            </p>
            <Accordion type="single" collapsible className="w-full">
              {mockTemplates[selectedTemplate].sourceEmails.map((email) => (
                <AccordionItem key={email.id} value={`email-${email.id}`} className="border-none">
                  <AccordionTrigger className="bg-muted/50 hover:bg-muted/70 rounded-lg px-3 py-2 text-left text-sm font-normal [&[data-state=open]>div]:mb-2">
                    <div className="flex w-full items-start justify-between pr-4">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{email.subject}</p>
                        <p className="text-muted-foreground truncate text-xs">
                          From: {email.from} • {new Date(email.date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-3 pb-3">
                    <div className="bg-background rounded border p-3 text-sm">
                      <p className="text-muted-foreground mb-2 text-xs">Email preview:</p>
                      <p>{email.preview}</p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            {mockTemplates[selectedTemplate].sourceCount >
              mockTemplates[selectedTemplate].sourceEmails.length && (
              <p className="text-muted-foreground mt-2 text-xs">
                ...and{' '}
                {mockTemplates[selectedTemplate].sourceCount -
                  mockTemplates[selectedTemplate].sourceEmails.length}{' '}
                more emails
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReadyToGoStep() {
  return (
    <div className="flex h-full flex-col items-center justify-center p-6 text-center">
      <div className="mb-8">
        <div className="mb-6 flex justify-center">
          <div className="bg-primary/10 text-primary rounded-full p-6">
            <svg
              className="h-16 w-16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M9 12l2 2 4-4" />
              <circle cx="12" cy="12" r="9" />
            </svg>
          </div>
        </div>

        <h1 className="mb-4 text-4xl font-bold">You&apos;re All Set! 🎉</h1>
        <p className="text-muted-foreground mb-8 text-lg">
          CedarMail is now configured with your preferences and ready to revolutionize your email
          workflow.
        </p>
      </div>

      <div className="mb-8 max-w-2xl space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="bg-muted/30 rounded-lg border p-4">
            <div className="mb-2 flex justify-center">
              <div className="rounded-full bg-blue-100 p-2 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                <svg
                  className="h-6 w-6"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M9 12l2 2 4-4" />
                  <circle cx="12" cy="12" r="9" />
                </svg>
              </div>
            </div>
            <h3 className="mb-1 font-semibold">Knowledge Base</h3>
            <p className="text-muted-foreground text-sm">Connected and ready to provide context</p>
          </div>

          <div className="bg-muted/30 rounded-lg border p-4">
            <div className="mb-2 flex justify-center">
              <div className="rounded-full bg-green-100 p-2 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                <svg
                  className="h-6 w-6"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M9 12l2 2 4-4" />
                  <circle cx="12" cy="12" r="9" />
                </svg>
              </div>
            </div>
            <h3 className="mb-1 font-semibold">Templates</h3>
            <p className="text-muted-foreground text-sm">
              Smart templates configured with AI variables
            </p>
          </div>

          <div className="bg-muted/30 rounded-lg border p-4">
            <div className="mb-2 flex justify-center">
              <div className="rounded-full bg-purple-100 p-2 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                <svg
                  className="h-6 w-6"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M9 12l2 2 4-4" />
                  <circle cx="12" cy="12" r="9" />
                </svg>
              </div>
            </div>
            <h3 className="mb-1 font-semibold">Agent Procedures</h3>
            <p className="text-muted-foreground text-sm">
              Email categorization and handling rules set
            </p>
          </div>
        </div>

        <div className="from-primary/10 to-accent/10 rounded-lg border bg-gradient-to-r p-6">
          <h3 className="mb-3 text-xl font-semibold">What happens next?</h3>
          <div className="space-y-2 text-left">
            <div className="flex items-start gap-3">
              <div className="bg-primary/20 text-primary mt-1 rounded-full p-1">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="12" r="2" />
                </svg>
              </div>
              <p className="text-sm">CedarMail will start analyzing your incoming emails</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="bg-primary/20 text-primary mt-1 rounded-full p-1">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="12" r="2" />
                </svg>
              </div>
              <p className="text-sm">Emails will be automatically categorized using your rules</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="bg-primary/20 text-primary mt-1 rounded-full p-1">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="12" r="2" />
                </svg>
              </div>
              <p className="text-sm">
                Smart response suggestions will appear based on your templates
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="bg-primary/20 text-primary mt-1 rounded-full p-1">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="12" r="2" />
                </svg>
              </div>
              <p className="text-sm">The system learns and improves from your usage patterns</p>
            </div>
          </div>
        </div>
      </div>

      <div className="text-muted-foreground text-sm">
        <p>Need help? Check out our documentation or contact support anytime.</p>
      </div>
    </div>
  );
}

export function OnboardingDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (currentStep === steps.length - 1) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [currentStep]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onOpenChange(false);
    }
  };

  const renderStepContent = () => {
    const step = steps[currentStep];
    switch (step.type) {
      case 'intro':
        return <IntroductionStep />;
      case 'knowledgeBase':
        return <KnowledgeBaseStep />;
      case 'crm':
        return <CRMStep />;
      case 'agentProcedure':
        return <AgentProcedureStep />;
      case 'templates':
        return <TemplatesStep />;
      case 'readyToGo':
        return <ReadyToGoStep />;
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTitle></DialogTitle>
      <DialogContent
        showOverlay
        className="bg-panelLight mx-auto h-[85vh] !w-[90vw] max-w-none rounded-xl border p-0 dark:bg-[#111111]"
      >
        <div className="flex h-full flex-col">
          <div className="flex-1 overflow-y-auto">{renderStepContent()}</div>

          <div className="border-t px-6 py-4">
            <div className="flex w-full justify-between">
              <div className="flex gap-2">
                <Button
                  size={'sm'}
                  onClick={() => setCurrentStep(currentStep - 1)}
                  variant="outline"
                  disabled={currentStep === 0}
                >
                  Go back
                </Button>
                <Button size={'sm'} onClick={handleNext}>
                  {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
                </Button>
              </div>
              <div className="flex items-center justify-center">
                <div className="flex gap-1">
                  {steps.map((step, index) => (
                    <div
                      key={step.title}
                      className={`h-1 w-10 rounded-full ${
                        index === currentStep ? 'bg-primary' : 'bg-muted'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function OnboardingWrapper() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  // const ONBOARDING_KEY = 'hasCompletedOnboarding'; // Commented out for testing

  useEffect(() => {
    // TEMPORARILY ALWAYS SHOW FOR TESTING
    // const hasCompletedOnboarding = localStorage.getItem(ONBOARDING_KEY) === 'true';
    // setShowOnboarding(!hasCompletedOnboarding);
    setShowOnboarding(true); // Always show on refresh for testing
  }, []);

  const handleOpenChange = (open: boolean) => {
    // Temporarily disabled - not saving completion state for testing
    // if (!open) {
    //   localStorage.setItem(ONBOARDING_KEY, 'true');
    // }
    setShowOnboarding(open);
  };

  return <OnboardingDialog open={showOnboarding} onOpenChange={handleOpenChange} />;
}
