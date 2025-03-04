/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { signUp, useSession } from "@/lib/auth-client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { z } from "zod";

const signUpSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export default function SignUp() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const { data: session } = useSession();

  if (session) {
    router.push("/mail");
  }

  const form = useForm<z.infer<typeof signUpSchema>>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof signUpSchema>) => {
    setIsSubmitting(true);
    try {
      await signUp.email({
        email: values.email,
        password: values.password,
        name: values.name,
      });
      toast.success("Please check your email for verification.");
      router.push("/signup/verify");
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-dvh w-screen items-center justify-center bg-background">
      <Card className="w-full max-w-md border-none shadow-none">
        <CardHeader className="py-5">
          <CardTitle className="text-center">Create your Mail0 account</CardTitle>
          <p className="text-center text-sm text-gray-500 dark:text-zinc-400">
            Create an account to continue
          </p>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2 uppercase">
              {["name", "email", "password"].map((field) => (
                <FormField
                  control={form.control}
                  key={field}
                  name={field as keyof z.infer<typeof signUpSchema>}
                  render={({ field: fieldProps }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-xs text-gray-600 dark:text-zinc-400">
                        {field.charAt(0).toUpperCase() + field.slice(1)}
                      </FormLabel>
                      <FormControl>
                        <Input
                          className="placeholder:text-sm"
                          type={
                            field === "password" ? "password" : field === "email" ? "email" : "text"
                          }
                          placeholder={
                            field === "name"
                              ? "Tyler Durden"
                              : field === "email"
                                ? "tylerdurden@example.com"
                                : "••••••••••"
                          }
                          {...fieldProps}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
              <div className="pt-2">
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  Sign Up
                </Button>
              </div>
            </form>
            {/* <div className="relative mb-4 mt-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-muted"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">or</span>
              </div>
            </div>

            <div className="flex max-w-md justify-center gap-2">
              <Button
                onClick={async () => {
                  toast.promise(
                    signIn.social({
                      provider: "google",
                      callbackURL: "/mail",
                    }),
                    {
                      loading: "Redirecting...",
                      success: "Redirected successfully!",
                      error: "Login redirect failed",
                    },
                  );
                }}
                variant="outline"
                className="w-full"
                type="button"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="1em"
                  height="1em"
                  viewBox="0 0 24 24"
                >
                  <path
                    fill="currentColor"
                    d="M11.99 13.9v-3.72h9.36c.14.63.25 1.22.25 2.05c0 5.71-3.83 9.77-9.6 9.77c-5.52 0-10-4.48-10-10S6.48 2 12 2c2.7 0 4.96.99 6.69 2.61l-2.84 2.76c-.72-.68-1.98-1.48-3.85-1.48c-3.31 0-6.01 2.75-6.01 6.12s2.7 6.12 6.01 6.12c3.83 0 5.24-2.65 5.5-4.22h-5.51z"
                  ></path>
                </svg>
                Google
              </Button>
              <Button variant="outline" className="w-full" type="button">
                <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                GitHub
              </Button>
            </div> */}
          </Form>

          <p className="mt-3 text-center text-sm text-gray-500 dark:text-zinc-400">
            Already have an account?{" "}
            <Link href="/login" className="underline">
              Login
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
