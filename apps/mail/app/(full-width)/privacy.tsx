import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Github, Mail, ArrowLeft, Link2 } from 'lucide-react';
import { Navigation } from '@/components/navigation';
import { Button } from '@/components/ui/button';
import Footer from '@/components/home/footer';
import { createSectionId } from '@/lib/utils';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import React from 'react';

const LAST_UPDATED = 'May 16, 2025';

export default function PrivacyPolicy() {
  const navigate = useNavigate();
  const { copiedValue: copiedSection, copyToClipboard } = useCopyToClipboard();

  const handleCopyLink = (sectionId: string) => {
    const url = `${window.location.origin}${window.location.pathname}#${sectionId}`;
    copyToClipboard(url, sectionId);
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-auto bg-white dark:bg-[#111111]">
      <Navigation />
      <div className="relative z-10 flex flex-grow flex-col">
        <div className="absolute right-4 top-6 md:left-8 md:top-8 md:right-auto">
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
                  Privacy Policy
                </CardTitle>
                <div className="flex items-center justify-center gap-2">
                  <p className="text-sm text-gray-500 dark:text-white/60">
                    Last updated: {LAST_UPDATED}
                  </p>
                </div>
              </div>
            </CardHeader>

            <div className="space-y-8 p-8">
              {sections.map((section) => {
                const sectionId = createSectionId(section.title);
                return (
                  <div key={section.title} id={sectionId} className="p-6">
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">
                        {section.title}
                      </h2>
                      <button
                        onClick={() => handleCopyLink(sectionId)}
                        className="text-gray-400 transition-all hover:text-gray-700 dark:text-white/60 dark:hover:text-white/80"
                        aria-label={`Copy link to ${section.title} section`}
                      >
                        <Link2
                          className={`h-4 w-4 ${copiedSection === sectionId ? 'text-green-500 dark:text-green-400' : ''}`}
                        />
                      </button>
                    </div>
                    <div className="prose prose-sm prose-a:text-blue-600 hover:prose-a:text-blue-800 dark:prose-a:text-blue-400 dark:hover:prose-a:text-blue-300 max-w-none text-gray-600 dark:text-white/80">
                      {section.content}
                    </div>
                  </div>
                );
              })}

              <div className="mt-12 flex flex-wrap items-center justify-center gap-4"></div>
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
    title: 'Our Commitment to Privacy',
    content: (
      <div className="space-y-4">
        <p>
          At Zero, we believe that privacy is a fundamental right. Our open-source email solution is
          built with privacy at its core, and we&apos;re committed to being transparent about how we
          handle your data.
        </p>
        <p className="font-semibold">
          Important: Zero is a client-only email application. We DO NOT store your emails on our
          servers. All email data is processed directly between your browser and Gmail.
        </p>
        <p>Our verified privacy commitments:</p>
        <ul className="ml-4 list-disc space-y-2">
          <li>
            Zero Email Storage: We never store your emails - they remain in your Gmail account
          </li>
          <li>Client-Side Processing: All email processing happens in your browser</li>
          <li>Open Source: Our entire codebase is public and can be audited</li>
          <li>Minimal Data: We only request essential Gmail API permissions</li>
          <li>User Control: You can revoke our access to your Gmail at any time</li>
        </ul>
      </div>
    ),
  },
  {
    title: 'Google Account Integration',
    content: (
      <>
        <p className="mb-4">When you use Zero with your Google Account:</p>
        <ul className="ml-4 list-disc space-y-2">
          <li>We request access to your Gmail data only after receiving your explicit consent</li>
          <li>We access only the necessary Gmail API scopes required for email functionality</li>
          <li>Your Google account credentials are never stored on our servers</li>
          <li>We use secure OAuth 2.0 authentication provided by Google</li>
          <li>
            You can revoke our access to your Google account at any time through your Google Account
            settings
          </li>
        </ul>
      </>
    ),
  },
  {
    title: 'Data Collection and Usage',
    content: (
      <div className="space-y-6">
        <div>
          <h3 className="mb-3 text-lg font-medium">Google Services Data Handling</h3>
          <ul className="ml-4 list-disc space-y-2">
            <li>Email data is processed in accordance with Google API Services User Data Policy</li>
            <li>
              We only process and display email data - we don&apos;t store copies of your emails
            </li>
            <li>
              All data transmission between our service and Google is encrypted using
              industry-standard TLS 1.3 protocols
            </li>
            <li>
              We maintain limited temporary caches only as necessary for application functionality,
              with a maximum retention period of 24 hours
            </li>
            <li>Cached data is encrypted at rest using AES-256 encryption</li>
            <li>
              We collect basic usage analytics (page views, feature usage) to improve the service,
              but this data is anonymized
            </li>
            <li>Error logs are retained for 30 days to help diagnose and fix issues</li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-lg font-medium">Self-Hosted Instances</h3>
          <ul className="ml-4 list-disc space-y-2">
            <li>When you self-host Zero, your email data remains entirely under your control</li>
            <li>No data is sent to our servers or third parties without your explicit consent</li>
            <li>You maintain complete ownership and responsibility for your data</li>
            <li>We provide detailed documentation on secure self-hosting practices</li>
            <li>You can configure your own data retention and backup policies</li>
            <li>Optional telemetry can be enabled to help us improve the platform</li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-lg font-medium">Data Processing Locations</h3>
          <ul className="ml-4 list-disc space-y-2">
            <li>All data processing occurs in secure data centers in the United States</li>
            <li>Self-hosted instances can choose their own data processing location</li>
            <li>We comply with international data transfer regulations</li>
            <li>Data processing agreements are available for enterprise users</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    title: 'Data Protection and Security',
    content: (
      <div className="space-y-6">
        <div>
          <h3 className="mb-3 text-lg font-medium">Security Measures</h3>
          <ul className="ml-4 list-disc space-y-2">
            <li>
              End-to-end encryption for all email communications using industry-standard protocols
            </li>
            <li>
              Secure OAuth 2.0 authentication for Google services with strict scope limitations
            </li>
            <li>Regular third-party security audits and penetration testing</li>
            <li>Open-source codebase for transparency and community security review</li>
            <li>Compliance with Google API Services User Data Policy and security requirements</li>
            <li>Real-time monitoring for suspicious activities and potential security threats</li>
            <li>Automated security patches and dependency updates</li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-lg font-medium">Infrastructure Security</h3>
          <ul className="ml-4 list-disc space-y-2">
            <li>All servers are hosted in SOC 2 Type II certified data centers</li>
            <li>Network-level security with enterprise-grade firewalls</li>
            <li>Regular backup and disaster recovery testing</li>
            <li>Multi-factor authentication required for all administrative access</li>
            <li>Encryption at rest for all stored data using AES-256</li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-lg font-medium">Security Response</h3>
          <ul className="ml-4 list-disc space-y-2">
            <li>24/7 security incident response team</li>
            <li>Bug bounty program for responsible security disclosure</li>
            <li>Incident response plan with clear notification procedures</li>
            <li>Regular security training for all team members</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    title: 'Google User Data Handling',
    content: (
      <div className="space-y-6">
        <div>
          <h3 className="mb-3 text-lg font-medium">Data Access and Usage</h3>
          <ul className="ml-4 list-disc space-y-2">
            <li>
              We access the following Google user data through the Gmail API:
              <ul className="ml-4 mt-2 list-disc space-y-1">
                <li>Email content and attachments</li>
                <li>Email metadata (subject, dates, recipients)</li>
                <li>Labels and folder structure</li>
                <li>Basic profile information</li>
              </ul>
            </li>
            <li>This data is used exclusively for providing email functionality within Zero</li>
            <li>No Google user data is used for advertising, marketing, or profiling purposes</li>
            <li>We maintain detailed audit logs of all data access for security and compliance</li>
            <li>Access to user data is strictly limited to essential personnel</li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-lg font-medium">Data Sharing and Transfer</h3>
          <ul className="ml-4 list-disc space-y-2">
            <li>
              Google user data is never shared with third parties except as required for core
              service functionality
            </li>
            <li>
              When necessary, we only work with service providers who comply with Google API
              Services User Data Policy
            </li>
            <li>All service providers are bound by strict confidentiality agreements</li>
            <li>
              We maintain a current list of all third-party service providers with access to Google
              user data
            </li>
            <li>Data sharing agreements are reviewed annually</li>
            <li>Users are notified of any material changes to our data sharing practices</li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-lg font-medium">Data Retention and Deletion</h3>
          <ul className="ml-4 list-disc space-y-2">
            <li>Email data is processed in real-time and not permanently stored</li>
            <li>Temporary caches are automatically cleared after 24 hours</li>
            <li>Users can request immediate deletion of their cached data</li>
            <li>
              Account deletion process:
              <ul className="ml-4 mt-2 list-disc space-y-1">
                <li>All user data is immediately marked for deletion</li>
                <li>Cached data is purged within 24 hours</li>
                <li>Audit logs are retained for 30 days then permanently deleted</li>
                <li>Backup data is removed within 7 days</li>
              </ul>
            </li>
            <li>We provide a data export tool for users to download their settings</li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-lg font-medium">User Rights and Controls</h3>
          <ul className="ml-4 list-disc space-y-2">
            <li>Right to access: Request a copy of your data</li>
            <li>Right to rectification: Correct inaccurate data</li>
            <li>Right to erasure: Request deletion of your data</li>
            <li>Right to restrict processing: Limit how we use your data</li>
            <li>Right to data portability: Export your data</li>
            <li>Right to object: Opt-out of certain data processing</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    title: 'Limited Use Disclosure',
    content: (
      <div>
        Our use and transfer to any other app of information received from Google APIs will adhere
        to the{' '}
        <a
          href="https://developers.google.com/terms/api-services-user-data-policy"
          className="inline-flex items-center text-blue-600 hover:text-blue-800"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google API Services User Data Policy
          <svg className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </a>
        , including the Limited Use requirements.
      </div>
    ),
  },
  {
    title: 'Your Rights and Controls',
    content: (
      <ul className="ml-4 list-disc space-y-2">
        <li>Right to revoke access to your Google account at any time</li>
        <li>Right to request deletion of any cached data</li>
        <li>Right to export your data</li>
        <li>Right to lodge complaints about data handling</li>
      </ul>
    ),
  },
  {
    title: 'Pricing and Refund Policy',
    content: (
      <div className="space-y-6">
        <div>
          <h3 className="mb-3 text-lg font-medium">Free Plan and Trial Period</h3>
          <ul className="ml-4 list-disc space-y-2">
            <li>Zero offers a free plan with basic features that requires no payment information</li>
            <li>For premium features, we offer a 7-day free trial period</li>
            <li>A valid credit card is required to start the premium free trial</li>
            <li>During the trial period, you have full access to all premium features</li>
            <li>You can cancel at any time during the trial period without any charges</li>
            <li>If you don't cancel before the trial ends, you'll be automatically charged for the premium subscription</li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-lg font-medium">Payment and Billing</h3>
          <ul className="ml-4 list-disc space-y-2">
            <li>After the 7-day free trial period ends, subscription charges will begin automatically</li>
            <li>Subscription fees are billed in advance on a monthly or annual basis</li>
            <li>Current pricing information is available on our pricing page</li>
            <li>All payments are processed securely through our trusted payment partners</li>
            <li>Subscription charges will appear on your billing statement as "Zero Email"</li>
            <li>We accept major credit cards and other payment methods as available in your region</li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-lg font-medium">Non-Refundable Policy</h3>
          <ul className="ml-4 list-disc space-y-2">
            <li className="font-semibold">
              Important: All subscription fees are non-refundable once the 7-day free trial period has ended
            </li>
            <li>This policy applies to all premium subscription plans (monthly, annual, and enterprise plans)</li>
            <li>Refunds are not provided for partial subscription periods</li>
            <li>Refunds are not available for unused portions of your subscription</li>
            <li>In exceptional circumstances, refunds may be considered on a case-by-case basis at our sole discretion</li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-lg font-medium">Subscription Management</h3>
          <ul className="ml-4 list-disc space-y-2">
            <li>You can cancel your subscription at any time through your account settings</li>
            <li>Cancellation takes effect at the end of your current billing period</li>
            <li>You will continue to have access to premium features until the end of your paid period</li>
            <li>No partial refunds are provided for early cancellation</li>
            <li>Reactivation of cancelled subscriptions may be subject to current pricing</li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-lg font-medium">Price Changes</h3>
          <ul className="ml-4 list-disc space-y-2">
            <li>We reserve the right to modify subscription pricing at any time</li>
            <li>Existing subscribers will be notified of price changes at least 30 days in advance</li>
            <li>Price changes will take effect at your next billing cycle</li>
            <li>You may cancel your subscription before the price change takes effect</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    title: 'Contact',
    content: (
      <div className="space-y-3">
        <p>For privacy-related questions or concerns:</p>
        <div className="flex flex-col space-y-2">
          <a
            href="mailto:founders@0.email"
            className="inline-flex items-center text-blue-600 hover:text-blue-800"
          >
            <Mail className="mr-2 h-4 w-4" />
            founders@0.email
          </a>
          <a
            href="https://github.com/Mail-0/Zero"
            className="inline-flex items-center text-blue-600 hover:text-blue-800"
          >
            <Github className="mr-2 h-4 w-4" />
            Open an issue on GitHub
          </a>
        </div>
      </div>
    ),
  },
  {
    title: 'Updates to This Policy',
    content: (
      <p>
        We may update this privacy policy from time to time. We will notify users of any material
        changes through our application or website.
      </p>
    ),
  },
];
