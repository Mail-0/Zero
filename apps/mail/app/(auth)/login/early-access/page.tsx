"use client";

import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import confetti from "canvas-confetti";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { toast } from "sonner";
import Link from "next/link";
import { z } from "zod";

const formSchema = z.object({
  name: z.string().min(1, { message: "Name must be at least 1 character" }),
  email: z
    .string()
    .min(1, { message: "Username is required" })
    .refine((value) => !value.includes("@"), { message: "Username should not include @ symbol" }),
  earlyAccessEmail: z.string().email({ message: "Invalid early access email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

// Add this component to safely use useSearchParams
function EarlyAccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get current step from URL or default to 'claim'
  const currentStep = searchParams.get("step") || "claim";

  const [showVerification, setShowVerification] = useState(
    currentStep === "verify" || currentStep === "success",
  );
  const [verified, setVerified] = useState(currentStep === "success");
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationError, setVerificationError] = useState(false);
  const [userEmail, setUserEmail] = useState(searchParams.get("email") || "");

  // Update URL when step changes
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());

    // Set the appropriate step
    if (verified) {
      params.set("step", "success");
    } else if (showVerification) {
      params.set("step", "verify");
    } else {
      params.set("step", "claim");
    }

    // Add email to URL if we have it
    if (userEmail) {
      params.set("email", userEmail);
    }

    const newUrl = `?${params.toString()}`;
    router.replace(newUrl, { scroll: false });
  }, [showVerification, verified, userEmail, router, searchParams]);

  // Trigger confetti when verified changes to true
  useEffect(() => {
    if (verified) {
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;

      const randomInRange = (min: number, max: number) => {
        return Math.random() * (max - min) + min;
      };

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);

        // since particles fall down, start a bit higher than random
        confetti({
          particleCount,
          startVelocity: 30,
          spread: 360,
          origin: {
            x: randomInRange(0.1, 0.9),
            y: randomInRange(0, 0.2),
          },
        });
      }, 250);

      return () => clearInterval(interval);
    }
  }, [verified]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: searchParams.get("email") || "",
      password: "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    // Append the @0.email suffix to the username
    const fullEmail = `${values.email}@0.email`;
    setUserEmail(fullEmail);

    // Use the correct sonner toast API
    toast.success("Signup successful, please verify your email");

    // Show verification screen
    setShowVerification(true);
    // URL will be updated in the useEffect
  }

  // Handle form errors with toast notifications
  const onError = (errors: any) => {
    // Define error messages mapping
    const errorMessageMap = [
      // Email errors
      {
        field: "email",
        pattern: "@ symbol",
        message: "Zero email has to have only letters (a-z), numbers (0-9), and periods (.).",
      },
      {
        field: "email",
        pattern: "required",
        message: "Username is required",
      },

      // Password errors
      {
        field: "password",
        pattern: "at least",
        message: "Password must be at least 6 characters",
      },
      {
        field: "password",
        pattern: "",
        message: "Password is required",
      },

      // Name errors
      {
        field: "name",
        pattern: "",
        message: "Name is required",
      },

      // Early access email errors
      {
        field: "earlyAccessEmail",
        pattern: "Invalid",
        message: "Invalid early access email address",
      },
      {
        field: "earlyAccessEmail",
        pattern: "",
        message: "Early access email is required",
      },
    ];

    // Find the first matching error and show toast
    for (const [field, fieldError] of Object.entries(errors)) {
      const errorMessage = (fieldError as { message?: string })?.message || "";

      // Find matching error pattern
      const matchedError = errorMessageMap.find(
        (mapping) =>
          mapping.field === field &&
          (mapping.pattern === "" || errorMessage.includes(mapping.pattern)),
      );

      if (matchedError) {
        toast.error(matchedError.message);
        return;
      }
    }

    // Fallback for any other errors
    toast.error("Please fix the form errors");
  };

  function handleVerify() {
    if (verificationCode.length === 6) {
      setVerified(true);
      setVerificationError(false);
      toast.success("Email verified successfully!");
      // Redirect to /mail after verification
      router.push("/mail");
      // URL will be updated in the useEffect
    } else {
      setVerificationError(true);
      toast.error("Please enter a valid 6-digit code");
    }
  }

  return (
    <div className="flex h-full min-h-screen w-full items-center justify-center bg-black">
      <AnimatePresence mode="wait">
        {currentStep === "claim" ? (
          // Claim screen (signup form)
          <motion.div
            key="signup"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            className="animate-in slide-in-from-bottom-4 w-full max-w-md px-6 py-8 duration-500"
          >
            <div className="mb-4 text-center">
              <h1 className="mb-2 text-4xl font-bold text-white">Claim your email</h1>
              <p className="text-muted-foreground">Enter your email below to claim your account</p>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit, onError)} className="mx-auto space-y-3">
                <FormField
                  control={form.control}
                  name="earlyAccessEmail"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel className="text-muted-foreground">Early access email</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="luke@example.com"
                          {...field}
                          error={!!fieldState.error}
                          className="bg-black text-sm text-white placeholder:text-sm"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel className="text-muted-foreground">Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Luke Johnson"
                          {...field}
                          error={!!fieldState.error}
                          className="bg-black text-sm text-white placeholder:text-sm"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel className="text-muted-foreground">Zero Email</FormLabel>
                      <FormControl>
                        <div className="relative w-full rounded-md">
                          <Input
                            placeholder="Username"
                            {...field}
                            onChange={(e) => {
                              // Just update the field value without showing toast errors
                              const value = e.target.value;
                              field.onChange(value);
                            }}
                            error={!!fieldState.error}
                            className="w-full bg-black pr-16 text-sm text-white placeholder:text-sm"
                          />
                          <span className="border-input absolute bottom-0 right-0 top-0 flex items-center rounded-r-md border border-l-0 px-3 py-2 text-sm text-white">
                            @0.email
                          </span>
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel className="text-muted-foreground">Password</FormLabel>
                      </div>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          {...field}
                          error={!!fieldState.error}
                          className="bg-black text-white"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full">
                  Create account
                </Button>
              </form>
            </Form>
          </motion.div>
        ) : (
          // Verification screen
          <motion.div
            key="verification"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md px-6 py-8"
          >
            <div className="text-center">
              <h1 className="mb-2 text-4xl font-bold text-white">Verify your email</h1>
              <p className="text-muted-foreground">Enter the 6-digit code sent to your email</p>
            </div>

            <div className="flex flex-col items-center space-y-6">
              <InputOTP
                maxLength={6}
                value={verificationCode}
                onChange={(value) => {
                  setVerificationCode(value);
                  // Clear error when user starts typing again
                  if (verificationError) {
                    setVerificationError(false);
                  }
                }}
                className="justify-center gap-2"
              >
                <InputOTPGroup>
                  <InputOTPSlot
                    index={0}
                    className={cn(
                      "border-input h-12 w-12 bg-black text-lg text-white",
                      verificationError && "ring-2 ring-red-500 ring-offset-1",
                    )}
                  />
                  <InputOTPSlot
                    index={1}
                    className={cn(
                      "border-input h-12 w-12 bg-black text-lg text-white",
                      verificationError && "ring-2 ring-red-500 ring-offset-1",
                    )}
                  />
                  <InputOTPSlot
                    index={2}
                    className={cn(
                      "border-input h-12 w-12 bg-black text-lg text-white",
                      verificationError && "ring-2 ring-red-500 ring-offset-1",
                    )}
                  />
                  <InputOTPSlot
                    index={3}
                    className={cn(
                      "border-input h-12 w-12 bg-black text-lg text-white",
                      verificationError && "ring-2 ring-red-500 ring-offset-1",
                    )}
                  />
                  <InputOTPSlot
                    index={4}
                    className={cn(
                      "border-input h-12 w-12 bg-black text-lg text-white",
                      verificationError && "ring-2 ring-red-500 ring-offset-1",
                    )}
                  />
                  <InputOTPSlot
                    index={5}
                    className={cn(
                      "border-input h-12 w-12 bg-black text-lg text-white",
                      verificationError && "ring-2 ring-red-500 ring-offset-1",
                    )}
                  />
                </InputOTPGroup>
              </InputOTP>

              <Button
                onClick={handleVerify}
                className="w-72"
                disabled={verificationCode.length !== 6}
              >
                Verify Email
              </Button>

              <p className="text-muted-foreground text-center text-sm">
                Didn't receive a code?{" "}
                <button
                  onClick={() => toast.info("New code sent!")}
                  className="text-primary hover:underline"
                >
                  Resend
                </button>
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Main component with Suspense boundary
export default function EarlyAccess() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full min-h-screen w-full items-center justify-center bg-black">
          <div className="text-white">Loading...</div>
        </div>
      }
    >
      <EarlyAccessContent />
    </Suspense>
  );
}
