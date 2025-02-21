"use client";

import { Form, FormControl, FormField, FormItem } from "../ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent } from "../ui/card";
import { ArrowRightIcon } from "lucide-react";
import Balancer from "react-wrap-balancer";
import { useForm } from "react-hook-form";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { z } from "zod";

const betaSignupSchema = z.object({
  email: z.string().email().min(9),
});

export default function Hero() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof betaSignupSchema>>({
    resolver: zodResolver(betaSignupSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof betaSignupSchema>) => {
    setIsSubmitting(true);
    try {
      console.log("Starting form submission with email:", values.email);

      const response = await fetch("/api/auth/early-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: values.email }),
      });

      // Log the raw response text first
      const rawText = await response.text();
      console.log("Raw response:", rawText);

      // Try to parse as JSON
      let data;
      try {
        data = JSON.parse(rawText);
        console.log("Parsed response data:", data);
      } catch (parseError) {
        console.error("Failed to parse response as JSON:", parseError);
        throw new Error("Invalid server response");
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to sign up");
      }

      form.reset();
      console.log("Form submission successful");
      toast.success("Thanks for signing up for early access!");
    } catch (error) {
      console.error("Form submission error:", {
        error,
        message: error instanceof Error ? error.message : "Unknown error",
      });
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
      console.log("Form submission completed");
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl animate-fade-in pt-20 md:px-0 md:pt-20">
      <p className="px-1 text-center text-5xl font-medium sm:text-6xl md:px-0">Email, reimagined</p>
      <Balancer className="mx-auto mt-3 max-w-2xl text-center text-lg text-muted-foreground">
        Chat with your inbox using a modern, open source, and secure platform that puts you in
        control.
      </Balancer>

      <Card className="mt-3 w-full border-none bg-transparent shadow-none">
        <CardContent className="flex items-center justify-center px-0">
          {process.env.NODE_ENV === "development" ? (
            <Button variant="outline" className="group h-9" asChild>
              <Link href="/login">
                Get Started
                <ArrowRightIcon />
              </Link>
            </Button>
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
                  <Button type="submit" className="w-full px-4" disabled={isSubmitting}>
                    Join waitlist
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
