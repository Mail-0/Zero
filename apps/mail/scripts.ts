import { faker } from '@faker-js/faker';
import { Resend } from 'resend';

const arr = [
  {
    subject: 'Welcome to CloudSync!',
    text: 'Hi Alex, thanks for signing up for CloudSync. Let’s get you started with syncing your first folder.',
  },
  {
    subject: 'Your Invoice for April 2025',
    text: 'Hello, your monthly invoice for April is now available. View it anytime from your billing dashboard.',
  },
  {
    subject: 'Weekly Update: Team Progress Report',
    text: "Here’s what the team accomplished this week. Overall, we're on track for the Q2 milestones.",
  },
  {
    subject: 'Security Alert: New Sign-In from Chrome on Windows',
    text: 'We noticed a new sign-in to your account from a device we haven’t seen before. Was this you?',
  },
  {
    subject: "Don't Miss Out – Your 20% Discount Expires Tonight!",
    text: 'Grab your discount before midnight! Enjoy 20% off your next purchase with code SPRING20.',
  },
  {
    subject: 'Coffee Meetup Tomorrow ☕',
    text: 'Hey! Just confirming our coffee meetup tomorrow at 10 AM at Café Bloom. See you there!',
  },
];

const runTest = async () => {
  const resend = new Resend('');
  for (const item of arr) {
    const response = await resend.emails.send({
      from: `${faker.person.firstName().toLowerCase()}@test.com`,
      to: '',
      subject: item.subject,
      html: item.text,
    });
    const randomDelay = Math.floor(Math.random() * 1000);
    console.log('Sleeping for', randomDelay, 'ms...');
    await new Promise((resolve) => setTimeout(resolve, randomDelay));

    if (response.error) {
      console.log('Error sending email:', response.error);
    } else {
      console.log('Email sent successfully');
    }
  }
};

runTest();
