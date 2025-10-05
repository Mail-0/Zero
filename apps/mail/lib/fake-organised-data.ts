export interface FakeEmail {
  id: string;
  threadId: string;
  sender: {
    name: string;
    email: string;
  };
  subject: string;
  body: string;
  receivedOn: string;
  unread: boolean;
  category: 'Deal Responses' | 'Deal Followups' | 'Important' | 'General';
  customer: {
    name: string;
    role: string;
    linkedin: string;
    previousEmails: number;
  };
  company: {
    name: string;
    size: string;
    industry: string;
    recentNews: string;
  };
}

export const fakeOrganisedEmails: FakeEmail[] = [
  // Deal Responses
  {
    id: 'fake-1',
    threadId: 'fake-thread-1',
    sender: {
      name: 'Sarah Johnson',
      email: 'sarah.johnson@techcorp.com',
    },
    subject: 'Re: Enterprise Plan Proposal',
    body: "We're very interested in moving forward with the Enterprise plan. The pricing looks competitive and the features align well with our needs. Can we schedule a call to discuss implementation timeline?",
    receivedOn: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    unread: true,
    category: 'Deal Responses',
    customer: {
      name: 'Sarah Johnson',
      role: 'VP of Operations',
      linkedin: 'https://linkedin.com/in/sarahjohnson',
      previousEmails: 5,
    },
    company: {
      name: 'TechCorp Inc.',
      size: '500-1000 employees',
      industry: 'Software Development',
      recentNews: 'Recently secured $50M Series B funding',
    },
  },
  {
    id: 'fake-2',
    threadId: 'fake-thread-2',
    sender: {
      name: 'Michael Chen',
      email: 'mchen@innovateai.io',
    },
    subject: 'Re: Q4 Partnership Opportunity',
    body: "Thanks for the detailed proposal. Our team has reviewed it and we'd like to move to the next stage. What are the next steps for onboarding?",
    receivedOn: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    unread: true,
    category: 'Deal Responses',
    customer: {
      name: 'Michael Chen',
      role: 'Chief Technology Officer',
      linkedin: 'https://linkedin.com/in/michaelchen',
      previousEmails: 8,
    },
    company: {
      name: 'InnovateAI',
      size: '100-250 employees',
      industry: 'Artificial Intelligence',
      recentNews: 'Launched new AI platform last month',
    },
  },
  {
    id: 'fake-3',
    threadId: 'fake-thread-3',
    sender: {
      name: 'Emily Rodriguez',
      email: 'emily@cloudscale.com',
    },
    subject: 'Re: Contract Terms Discussion',
    body: "We've completed our internal review and are ready to sign. Just need clarification on the support SLA terms mentioned in section 4.",
    receivedOn: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    unread: false,
    category: 'Deal Responses',
    customer: {
      name: 'Emily Rodriguez',
      role: 'Director of Procurement',
      linkedin: 'https://linkedin.com/in/emilyrodriguez',
      previousEmails: 12,
    },
    company: {
      name: 'CloudScale Solutions',
      size: '1000-5000 employees',
      industry: 'Cloud Infrastructure',
      recentNews: 'Expanding to European market',
    },
  },

  // Deal Followups
  {
    id: 'fake-4',
    threadId: 'fake-thread-4',
    sender: {
      name: 'David Park',
      email: 'david.park@financeplus.com',
    },
    subject: 'Following up on our demo last week',
    body: 'Hi there, I wanted to follow up on the demo we had last Tuesday. Our team was impressed with the features. Are there any updates on the custom integration we discussed?',
    receivedOn: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    unread: false,
    category: 'Deal Followups',
    customer: {
      name: 'David Park',
      role: 'Head of Digital Transformation',
      linkedin: 'https://linkedin.com/in/davidpark',
      previousEmails: 3,
    },
    company: {
      name: 'FinancePlus',
      size: '250-500 employees',
      industry: 'Financial Services',
      recentNews: 'Acquired by larger banking group',
    },
  },
  {
    id: 'fake-5',
    threadId: 'fake-thread-5',
    sender: {
      name: 'Lisa Thompson',
      email: 'lisa.t@retailgiant.com',
    },
    subject: 'Checking in on pricing proposal',
    body: "Just wanted to check if you've had a chance to review our request for volume pricing? We're planning our Q1 budget and need to finalize vendors.",
    receivedOn: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    unread: false,
    category: 'Deal Followups',
    customer: {
      name: 'Lisa Thompson',
      role: 'Procurement Manager',
      linkedin: 'https://linkedin.com/in/lisathompson',
      previousEmails: 6,
    },
    company: {
      name: 'RetailGiant',
      size: '5000+ employees',
      industry: 'Retail',
      recentNews: 'Opening 50 new stores nationwide',
    },
  },

  // Important
  {
    id: 'fake-6',
    threadId: 'fake-thread-6',
    sender: {
      name: 'Robert Martinez',
      email: 'rmartinez@globalcorp.com',
    },
    subject: 'URGENT: Contract renewal deadline',
    body: 'Our current contract expires in 48 hours. We need to finalize the renewal terms immediately to avoid service interruption. Please respond ASAP.',
    receivedOn: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    unread: true,
    category: 'Important',
    customer: {
      name: 'Robert Martinez',
      role: 'Senior VP Operations',
      linkedin: 'https://linkedin.com/in/robertmartinez',
      previousEmails: 25,
    },
    company: {
      name: 'GlobalCorp',
      size: '10000+ employees',
      industry: 'Manufacturing',
      recentNews: 'Record quarterly earnings announced',
    },
  },
  {
    id: 'fake-7',
    threadId: 'fake-thread-7',
    sender: {
      name: 'Jennifer Wu',
      email: 'jwu@startupxyz.com',
    },
    subject: 'Critical: Security review required',
    body: 'Our security team has flagged some questions about data encryption in your latest proposal. We need answers before we can proceed with board approval next week.',
    receivedOn: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    unread: true,
    category: 'Important',
    customer: {
      name: 'Jennifer Wu',
      role: 'Chief Information Security Officer',
      linkedin: 'https://linkedin.com/in/jenniferwu',
      previousEmails: 4,
    },
    company: {
      name: 'StartupXYZ',
      size: '50-100 employees',
      industry: 'Cybersecurity',
      recentNews: 'Named top security startup of the year',
    },
  },

  // General
  {
    id: 'fake-8',
    threadId: 'fake-thread-8',
    sender: {
      name: 'Alex Kumar',
      email: 'alex@techstartup.io',
    },
    subject: 'Question about your services',
    body: "Hi, I came across your website and I'm curious to learn more about your enterprise offerings. Do you have any case studies you could share?",
    receivedOn: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    unread: false,
    category: 'General',
    customer: {
      name: 'Alex Kumar',
      role: 'Founder & CEO',
      linkedin: 'https://linkedin.com/in/alexkumar',
      previousEmails: 1,
    },
    company: {
      name: 'TechStartup',
      size: '10-50 employees',
      industry: 'SaaS',
      recentNews: 'Recently launched beta product',
    },
  },
  {
    id: 'fake-9',
    threadId: 'fake-thread-9',
    sender: {
      name: 'Maria Garcia',
      email: 'maria.garcia@consulting.com',
    },
    subject: 'Info request for client project',
    body: "I'm working on a project for a client and they're considering your platform. Could you send me some high-level information about pricing tiers and implementation timeline?",
    receivedOn: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    unread: false,
    category: 'General',
    customer: {
      name: 'Maria Garcia',
      role: 'Senior Consultant',
      linkedin: 'https://linkedin.com/in/mariagarcia',
      previousEmails: 2,
    },
    company: {
      name: 'Garcia Consulting Group',
      size: '100-250 employees',
      industry: 'Management Consulting',
      recentNews: 'Expanded to three new cities',
    },
  },
  {
    id: 'fake-10',
    threadId: 'fake-thread-10',
    sender: {
      name: 'Tom Anderson',
      email: 'tanderson@mediahouse.com',
    },
    subject: 'Partnership inquiry',
    body: "We're exploring potential technology partners for our upcoming digital transformation initiative. Would love to set up an introductory call to learn more about what you offer.",
    receivedOn: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    unread: false,
    category: 'General',
    customer: {
      name: 'Tom Anderson',
      role: 'VP of Technology',
      linkedin: 'https://linkedin.com/in/tomanderson',
      previousEmails: 1,
    },
    company: {
      name: 'MediaHouse Productions',
      size: '250-500 employees',
      industry: 'Media & Entertainment',
      recentNews: 'Won Emmy for documentary series',
    },
  },
];
