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
import Image from "next/image";
import { toast } from "sonner";
import Link from "next/link";
import axios from "axios";
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

      const response = await axios.post("/api/auth/early-access", {
        email: values.email,
      });

      console.log("Response data:", response.data);

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
    <div className="mx-auto w-full animate-fade-in pt-20 md:px-0 md:pt-20">
      <p className="text-center text-4xl font-semibold leading-tight tracking-[-0.03em] sm:text-6xl md:px-0">
        The future of email <span className="text-shinyGray">is here</span>
      </p>
      <div className="mx-auto w-full max-w-4xl">
        <Balancer className="mx-auto mt-3 text-center text-[15px] leading-tight text-shinyGray sm:text-[22px]">
          Experience email the way you want with <span className="font-mono">0</span> – the first
          open source email app that puts your privacy and safety first.
        </Balancer>
      </div>

      <Card className="mt-4 w-full border-none bg-transparent shadow-none">
        <CardContent className="flex items-center justify-center px-0">
          {process.env.NODE_ENV === "development" ? (
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                className="flex h-[40px] w-[170px] items-center justify-center rounded-md bg-black text-white hover:bg-accent hover:text-white"
                asChild
              >
                <Link href="/login">
                  {" "}
                  <Image src="/white-icon.svg" alt="Email" width={15} height={15} />
                  Start Emailing
                </Link>
              </Button>
              <Button
                variant="outline"
                className="group h-[40px] w-[170px] rounded-md bg-white text-black hover:bg-white hover:text-black"
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
