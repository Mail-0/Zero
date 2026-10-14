import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Link,
  Preview,
  Heading,
} from '@react-email/components';

// Common styles
const main = {
  backgroundColor: '#ffffff',
  fontFamily: '"Helvetica Neue",Helvetica,Arial,sans-serif',
};

const container = {
  margin: '0',
  padding: '20px 0 48px',
  maxWidth: '560px',
};

const section = {
  padding: '0 24px',
};

const h1 = {
  color: '#333',
  fontSize: '24px',
  fontWeight: '600',
  lineHeight: '1.3',
  margin: '0 0 20px',
};

const text = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '1.6',
  margin: '0 0 16px',
};

const listItem = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '1.6',
  margin: '0 0 8px',
  paddingLeft: '12px',
};

const link = {
  color: '#007ee6',
  textDecoration: 'underline',
};

const signature = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '1.6',
  margin: '20px 0 0',
  fontWeight: '500',
};

interface EmailProps {
  name?: string;
}

// 1. Welcome Email (On Signup)
export const WelcomeEmail = ({ name }: EmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Welcome to Mail0 👋 Your inbox just leveled up</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={section}>
            <Heading style={h1}>Welcome to Mail0 👋</Heading>
            <Text style={text}>Hey {name ? name : 'there'},</Text>
            <Text style={text}>I&apos;m Nizzy, founder of Mail0 (aka Zero)</Text>
            <Text style={text}>
              If you&apos;ve ever screamed into the void trying to find that one email thread from 6
              months ago, or spent 10 minutes writing &quot;sounds good,&quot; you&apos;re in the
              right place 😅
            </Text>
            <Text style={text}>Mail0 is built different:</Text>
            <Text style={listItem}>• AI-native from day one</Text>
            <Text style={listItem}>• Open-source and self-hostable</Text>
            <Text style={listItem}>
              • Summarizes long threads, drafts replies, and lets you search your inbox like a
              conversation
            </Text>
            <Text style={listItem}>• Respects your privacy and your time</Text>
            <Text style={text}>
              It&apos;s still early. It&apos;s raw. But it&apos;s real. And it&apos;s yours 💪
            </Text>
            <Text style={text}>
              Mail0 is for people like us: curious, technical, and tired of bloated tools pretending
              to be minimal 🙃
            </Text>
            <Text style={text}>
              Want to chat about email and get a $20 gift card to anywhere you like?{' '}
              <Link href="https://cal.com/team/0/chat?overlayCalendar=true" style={link}>
                Book some time with me here
              </Link>
            </Text>
            <Text style={text}>Thanks for being one of the first to join this journey 🚀</Text>
            <Text style={signature}>Nizzy</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

// 2. Mail0 Pro (1 Day After Signup)
export const Mail0ProEmail = ({ name }: EmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Mail0 Pro is here 🚀💼</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={section}>
            <Heading style={h1}>Mail0 Pro is here 🚀💼</Heading>
            <Text style={text}>Hey {name ? name : 'there'},</Text>
            <Text style={text}>Your inbox deserves better.</Text>
            <Text style={text}>
              Mail0 Pro unlocks everything you need to fly through email like it&apos;s nothing.
              Built for professionals, founders, and power users who want to spend less time writing
              and more time doing.
            </Text>
            <Text style={text}>Here&apos;s what you get:</Text>
            <Text style={listItem}>📨 Unlimited email connections</Text>
            <Text style={listItem}>🧠 Full AI chat with your inbox</Text>
            <Text style={listItem}>🏷️ Auto labeling that organizes things instantly</Text>
            <Text style={listItem}>✍️ One-click AI writing and smart replies</Text>
            <Text style={listItem}>
              🪄 Instant thread summaries so you don&apos;t waste time scrolling
            </Text>
            <Text style={listItem}>🙋 Priority support</Text>
            <Text style={listItem}>💬 Private Discord community</Text>
            <Text style={listItem}>💸 $20/month — or save 50% when billed annually</Text>
            <Text style={text}>It&apos;s the full Mail0 experience, no limits.</Text>
            <Text style={text}>
              <Link href="https://0.email/pricing" style={link}>
                Try it free for 7 days, no strings attached
              </Link>
            </Text>
            <Text style={text}>
              Have questions or want help deciding if Pro is right for you?{' '}
              <Link href="https://cal.com/team/0/chat?overlayCalendar=true" style={link}>
                Book a quick call and I&apos;ll send you a $20 gift card of your choice
              </Link>
            </Text>
            <Text style={text}>Let&apos;s level up your inbox,</Text>
            <Text style={signature}>Nizzy</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

// 3. Auto Labeling (2 Days After Signup)
export const AutoLabelingEmail = ({ name }: EmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>New in Mail0: Auto-labeling is here 🎉📥</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={section}>
            <Heading style={h1}>New in Mail0: Auto-labeling is here 🎉📥</Heading>
            <Text style={text}>Hey {name ? name : 'there'} 👋</Text>
            <Text style={text}>Your inbox just got a whole lot smarter.</Text>
            <Text style={text}>
              Mail0 now automatically labels your emails based on what they&apos;re about. No setup,
              no filters, no wasted time 🙌
            </Text>
            <Text style={text}>Here&apos;s what it does:</Text>
            <Text style={listItem}>
              📌 Sorts things into helpful categories like Newsletters, Receipts, Invites, and more
            </Text>
            <Text style={listItem}>🧠 Learns from your habits to get better over time</Text>
            <Text style={listItem}>🛠️ Lets you rename or tweak labels however you want</Text>
            <Text style={text}>
              It&apos;s one of those little features that quietly saves you hours every week ⏳
            </Text>
            <Text style={text}>
              Curious how labeling works behind the scenes?{' '}
              <Link href="https://cal.com/team/0/chat?overlayCalendar=true" style={link}>
                Book a quick chat and I&apos;ll send you a $20 gift card as a thank you
              </Link>
            </Text>
            <Text style={text}>Thanks for being here,</Text>
            <Text style={signature}>Nizzy</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

// 4. AI Writing Assistant (3 Days After Signup)
export const AIWritingAssistantEmail = ({ name }: EmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Write faster with AI ✍️✨</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={section}>
            <Heading style={h1}>Write faster with AI ✍️✨</Heading>
            <Text style={text}>Hey {name ? name : 'there'} 👋</Text>
            <Text style={text}>
              Tired of writing the same replies over and over? Yeah, same. That&apos;s why we built
              AI Response Assist.
            </Text>
            <Text style={text}>Here&apos;s what it can do:</Text>
            <Text style={listItem}>🤖 Reads the email you got</Text>
            <Text style={listItem}>📝 Suggests a thoughtful reply (not a robotic one)</Text>
            <Text style={listItem}>⚡ Lets you tweak, shorten, or send it as-is</Text>
            <Text style={text}>
              No need to overthink every &quot;Sounds good&quot; or &quot;Thanks for following
              up&quot;.
            </Text>
            <Text style={text}>
              It&apos;s fast. It sounds like you. And it gets smarter the more you use it.
            </Text>
            <Text style={text}>
              Next time you open an email, try hitting &quot;Generate&quot; and watch the magic
              happen ✨
            </Text>
            <Text style={text}>
              Want to see it in action or share your thoughts?{' '}
              <Link href="https://cal.com/team/0/chat?overlayCalendar=true" style={link}>
                I&apos;ll send you a $20 gift card just for booking a quick call
              </Link>
            </Text>
            <Text style={text}>Talk soon,</Text>
            <Text style={signature}>Adam</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

// 5. Shortcuts (4 Days After Signup)
export const ShortcutsEmail = ({ name }: EmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Fly through your inbox with shortcuts ⚡️</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={section}>
            <Heading style={h1}>Fly through your inbox with shortcuts ⚡️</Heading>
            <Text style={text}>Hey {name ? name : 'there'},</Text>
            <Text style={text}>
              You don&apos;t need to click around to get things done in Mail0. We&apos;ve got a full
              set of keyboard shortcuts built in. And yes, they&apos;re fully customizable.
            </Text>
            <Text style={text}>Here are a few worth memorizing:</Text>
            <Text style={listItem}>• C to start a new email</Text>
            <Text style={listItem}>• R to reply</Text>
            <Text style={listItem}>• E to archive a thread</Text>
            <Text style={listItem}>• V to open the voice assistant</Text>
            <Text style={listItem}>• Cmd + K to launch the command palette</Text>
            <Text style={listItem}>• G + I to go to your inbox</Text>
            <Text style={listItem}>• Cmd + Z to undo the last thing you did (life saver)</Text>
            <Text style={text}>
              Want to bulk delete, mark as important, or jump between categories? We&apos;ve got
              shortcuts for those too. Just hit ? in the app to view and edit them all.
            </Text>
            <Text style={text}>Once you get into the flow, it&apos;s wild how fast you move.</Text>
            <Text style={text}>
              Got feedback or shortcut ideas?{' '}
              <Link href="https://cal.com/team/0/chat?overlayCalendar=true" style={link}>
                Let&apos;s talk and I&apos;ll send you a $20 gift card for your time
              </Link>
            </Text>
            <Text style={text}>Let&apos;s make your inbox feel like second nature.</Text>
            <Text style={signature}>Adam</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

// 6. Categories (5 Days After Signup)
export const CategoriesEmail = ({ name }: EmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Inbox chaos? We cleaned it up for you 🧼📥</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={section}>
            <Heading style={h1}>Inbox chaos? We cleaned it up for you 🧼📥</Heading>
            <Text style={text}>Hey {name ? name : 'there'},</Text>
            <Text style={text}>
              Nobody has time to dig through a messy inbox. That&apos;s why Mail0 now automatically
              sorts your emails into smart categories right at the top of your inbox.
            </Text>
            <Text style={text}>Here&apos;s what you&apos;ll see:</Text>
            <Text style={listItem}>⚡ Primary — real conversations, people who matter</Text>
            <Text style={listItem}>⚠️ Warnings — account alerts and security stuff</Text>
            <Text style={listItem}>👤 Personal — messages from friends and family</Text>
            <Text style={listItem}>🔔 Notifications — updates, confirmations, reminders</Text>
            <Text style={listItem}>📢 Promotions — marketing, newsletters, and the rest</Text>
            <Text style={text}>
              Mail0 figures it out based on the content of each email. No setup required. Just open
              your inbox and enjoy the clarity.
            </Text>
            <Text style={text}>
              You can rename, hide, or reorder the categories any way you like.
            </Text>
            <Text style={text}>
              Want to customize categories or suggest improvements?{' '}
              <Link href="https://cal.com/team/0/chat?overlayCalendar=true" style={link}>
                Book a quick chat with me and I&apos;ll send you a $20 gift card
              </Link>
            </Text>
            <Text style={text}>Talk soon,</Text>
            <Text style={signature}>Adam</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

// 7. Super Search (6 Days After Signup)
export const SuperSearchEmail = ({ name }: EmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Search your inbox like you talk 🧠🔍</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={section}>
            <Heading style={h1}>Search your inbox like you talk 🧠🔍</Heading>
            <Text style={text}>Hey {name ? name : 'there'},</Text>
            <Text style={text}>Tired of guessing the exact words you used in that one email?</Text>
            <Text style={text}>With Mail0&apos;s Super Search, you don&apos;t have to.</Text>
            <Text style={text}>
              You can now search your inbox using plain language. Just type something like:
            </Text>
            <Text style={listItem}>➡️ emails from John</Text>
            <Text style={listItem}>➡️ emails from last week</Text>
            <Text style={listItem}>➡️ unread emails with attachments</Text>
            <Text style={listItem}>➡️ emails about meeting</Text>
            <Text style={listItem}>➡️ emails from last month</Text>
            <Text style={text}>
              No weird syntax or advanced filters. Just write what you&apos;re looking for and let
              the AI handle the rest.
            </Text>
            <Text style={text}>It&apos;s fast, flexible, and honestly kind of magical.</Text>
            <Text style={text}>
              Let&apos;s nerd out about how Super Search works.{' '}
              <Link href="https://cal.com/team/0/chat?overlayCalendar=true" style={link}>
                I&apos;ll send you a $20 gift card just for booking a time
              </Link>
            </Text>
            <Text style={text}>See you in the future,</Text>
            <Text style={signature}>Adam</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

// Mail0 Pro Welcome Email
export const Mail0ProWelcomeEmail = ({ name }: EmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>You&apos;re Pro now 😎 Welcome to the fast lane</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={section}>
            <Heading style={h1}>You&apos;re Pro now 😎</Heading>
            <Text style={text}>Hey {name ? name : 'there'},</Text>
            <Text style={text}>
              You just unlocked Mail0 Pro and honestly… your inbox doesn&apos;t know what&apos;s
              coming.
            </Text>
            <Text style={text}>You now have access to:</Text>
            <Text style={listItem}>🚀 Unlimited email accounts</Text>
            <Text style={listItem}>🧠 Full AI-powered chat with your inbox</Text>
            <Text style={listItem}>⚡ Instant thread summaries</Text>
            <Text style={listItem}>✍️ One-click AI writing and smart replies</Text>
            <Text style={listItem}>🏷️ Auto labeling that sorts your chaos</Text>
            <Text style={listItem}>🙋 Priority support</Text>
            <Text style={listItem}>💬 Access to our private community on Discord</Text>
            <Text style={text}>
              You&apos;re part of a group of people who are done wasting time on email. Welcome.
            </Text>
            <Text style={text}>
              Need help getting the most out of Pro?{' '}
              <Link href="https://cal.com/team/0/chat?overlayCalendar=true" style={link}>
                I&apos;d love to chat and send you a $20 gift card for your time
              </Link>
            </Text>
            <Text style={text}>Let&apos;s make this the smartest inbox you&apos;ve ever used.</Text>
            <Text style={signature}>Nizzy</Text>
            <Text style={text}>
              P.S. If anything feels off or confusing, just reply to this email. We&apos;re here.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

// Mail0 Cancellation Email
export const Mail0CancellationEmail = ({ name }: EmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>You&apos;ve canceled Mail0 Pro 💔</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={section}>
            <Heading style={h1}>You&apos;ve canceled Mail0 Pro 💔</Heading>
            <Text style={text}>Hey {name ? name : 'there'},</Text>
            <Text style={text}>
              I saw you canceled your Mail0 Pro subscription. Totally okay. Life changes, tools
              shift, and we get it.
            </Text>
            <Text style={text}>
              I&apos;d love to hear what could have been better.{' '}
              <Link href="https://cal.com/team/0/chat?overlayCalendar=true" style={link}>
                Book a quick call and I&apos;ll send you a $20 gift card of your choice
              </Link>
            </Text>
            <Text style={text}>
              You&apos;ll still have access to your account under the free plan:
            </Text>
            <Text style={listItem}>✅ 1 email connection</Text>
            <Text style={listItem}>✅ Basic labeling</Text>
            <Text style={listItem}>✅ Limited AI chat and writing</Text>
            <Text style={text}>
              No hard feelings. We&apos;re always rooting for you, even if your inbox journey
              continues somewhere else.
            </Text>
            <Text style={text}>Thanks for giving Mail0 a shot,</Text>
            <Text style={signature}>Nizzy</Text>
            <Text style={text}>
              P.S. If you ever want to come back, your setup will be waiting for you ⚡️
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};
