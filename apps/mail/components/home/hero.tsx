'use client';

import { Form, FormControl, FormField, FormItem } from '../ui/form';
import { AnimatedNumber } from '../ui/animated-number';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent } from '../ui/card';
import { useState, useEffect } from 'react';
import Balancer from 'react-wrap-balancer';
import { useForm } from 'react-hook-form';
import confetti from 'canvas-confetti';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import Image from 'next/image';
import { toast } from 'sonner';
import Link from 'next/link';
import axios from 'axios';
import { z } from 'zod';

const betaSignupSchema = z.object({
  email: z.string().email().min(9),
});

export default function Hero() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [signupCount, setSignupCount] = useState<number>(0);

  const form = useForm<z.infer<typeof betaSignupSchema>>({
    resolver: zodResolver(betaSignupSchema),
    defaultValues: {
      email: '',
    },
  });

  useEffect(() => {
    const fetchSignupCount = async () => {
      try {
        const response = await axios.get('/api/auth/early-access/count');
        setSignupCount(response.data.count);
      } catch (error) {
        console.error('Failed to fetch signup count:', error);
      }
    };

    fetchSignupCount();
  }, []);

  const onSubmit = async (values: z.infer<typeof betaSignupSchema>) => {
    setIsSubmitting(true);
    try {
      console.log('Starting form submission with email:', values.email);

      const response = await axios.post('/api/auth/early-access', {
        email: values.email,
      });

      console.log('Response data:', response.data);

      form.reset();
      console.log('Form submission successful');
      confetti({
        particleCount: 180,
        spread: 120,
        origin: { y: -0.2, x: 0.5 },
        angle: 270,
      });
      setShowSuccess(true);

      // Increment the signup count if it was a new signup
      if (response.status === 201 && signupCount !== null) {
        setSignupCount(signupCount + 1);
      }
    } catch (error) {
      console.error('Form submission error:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
      console.log('Form submission completed');
    }
  };

  return (
    <div className="animate-fade-in mx-auto w-full pt-20 md:px-0 md:pt-20">
      <p className="text-center text-4xl font-semibold leading-tight tracking-[-0.03em] text-gray-900 sm:text-6xl md:px-0 dark:text-white">
        The future of email is here
      </p>
      <div className="mx-auto w-full max-w-4xl">
        <Balancer className="dark:text-shinyGray mx-auto mt-3 text-center text-[15px] leading-tight text-gray-600 sm:text-[22px]">
          Experience email the way you want with <span className="font-mono">0</span> – the first
          open source email app that puts your privacy and safety first.
        </Balancer>
      </div>

      <Card className="mt-4 w-full border-none bg-transparent shadow-none">
        <CardContent className="flex flex-col items-center justify-center px-0">
          {showSuccess ? (
            <div className="flex flex-col items-center justify-center gap-4 text-center">
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                You're on the list! 🎉
              </p>
              <p className="dark:text-shinyGray text-lg text-gray-600">
                We'll let you know when we're ready to revolutionize your email experience.
              </p>
            </div>
          ) : process.env.NODE_ENV === 'development' ? (
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                className="dark:hover:bg-accent flex h-[40px] w-[170px] items-center justify-center rounded-md bg-white text-gray-900 hover:bg-gray-100 hover:text-gray-900 dark:bg-black dark:text-white dark:hover:text-white"
                asChild
              >
                <Link href="/login">
                  {' '}
                  <Image
                    src="/white-icon.svg"
                    alt="Email"
                    width={15}
                    height={15}
                    className="invert dark:invert-0"
                  />
                  Start Emailing
                </Link>
              </Button>
              <Button
                className="group h-[40px] w-[170px] rounded-md bg-gray-900 text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-white"
                asChild
              >
                <Link target="_blank" href="https://cal.link/0-email">
                  Contact Us
                </Link>
              </Button>
            </div>
          ) : (
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="flex items-center justify-center gap-4"
              >
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="you@example.com"
                          className="placeholder:text-sm md:w-80"
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div>
                  <Button
                    type="submit"
                    className="compose-gradient-animated w-full px-4"
                    disabled={isSubmitting}
                  >
                    Join waitlist
                  </Button>
                </div>
              </form>
            </Form>
          )}

          {signupCount !== null && (
            <div className="dark:text-shinyGray mt-4 text-center text-sm text-gray-600">
              <span className="font-semibold text-gray-900 dark:text-white">
                <AnimatedNumber
                  springOptions={{
                    bounce: 0,
                    duration: 2000,
                  }}
                  value={signupCount}
                />
              </span>{' '}
              people have already joined the waitlist
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
