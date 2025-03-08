"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, ArrowLeft, ArrowRight, Plus, Trash } from "lucide-react";
import { emailProviders } from "@/constants/emailProviders";
import { GitHub, Google } from "@/components/icons/icons";
import { useConnections } from "@/hooks/use-connections";
import { motion, AnimatePresence } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { signIn } from "@/lib/auth-client";
import useMeasure from "react-use-measure";
import confetti from "canvas-confetti";
import Image from "next/image";
import { toast } from "sonner";

const steps = [
  { id: "login", title: "Login" },
  { id: "connect", title: "Connections" },
  { id: "loading", title: "Import" },
  { id: "success", title: "Done!" },
];

export const OnboardingFlow = () => {
  const router = useRouter();
  const searchParams = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : "",
  );
  const stepParam = searchParams.get("step");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [ref, bounds] = useMeasure();
  const { data: session, isPending } = useSession();
  const { data: connections, mutate, isLoading: isLoadingConnections } = useConnections();

  // Convert step param to number or default to 0
  // Note: URL shows step 1-4, but internally we use 0-3
  const getStepFromParam = () => {
    if (!stepParam) return 0;
    const step = parseInt(stepParam) - 1; // Subtract 1 to convert from 1-based to 0-based
    return isNaN(step) || step < 0 || step > 3 ? 0 : step;
  };

  const [currentStep, setCurrentStep] = useState(getStepFromParam());

  const updateStepParam = (step: number) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("step", (step + 1).toString()); // Add 1 for user-friendly step numbers
    router.push(`/onboarding?${newParams.toString()}`, { scroll: false });
  };

  useEffect(() => {
    if (!isPending && session?.connectionId && currentStep === 0) {
      setCurrentStep(1);
      updateStepParam(1);
    }
  }, [session, isPending, currentStep]);

  useEffect(() => {
    if (currentStep === 3) {
      // Launch confetti when reaching success step
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [currentStep]);

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      updateStepParam(currentStep - 1);
    }
  };

  const handleNext = () => {
    if (currentStep === 1) {
      setCurrentStep(2);
      // Simulate email fetching
      setTimeout(() => {
        setCurrentStep(3);
      }, 3000);
    } else if (currentStep === 3) {
      router.push("/mail");
    } else if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
      updateStepParam(currentStep + 1);
    }
  };

  const renderStep = (step: number) => {
    let content;

    switch (step) {
      case 0:
        content = (
          <motion.div
            key="login-step"
            initial={isAuthenticating ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="max-w-[500px] space-y-8 px-4 sm:px-12 md:px-0"
          >
            <p className="text-center text-xl font-bold md:text-2xl">
              Choose your preferred login method
            </p>

            <div className="relative z-10 mx-auto flex w-full flex-col items-center justify-end gap-2 sm:flex-row">
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.5 }}
                className="w-full"
              >
                <Button
                  disabled
                  className="relative inline-flex h-9 w-full overflow-hidden rounded-lg p-[1px] focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-50"
                >
                  <span className="compose-gradient animate-gradient-flow absolute inset-[-1000%]" />
                  <span className="hover:bg-accent inline-flex h-full w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-black px-3 text-sm font-medium text-white backdrop-blur-3xl">
                    <Image src="/ai.svg" alt="Zero" width={14} height={14} />
                    Zero Email
                  </span>
                </Button>
              </motion.div>
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="w-full"
              >
                <Button
                  onClick={() => {
                    setIsAuthenticating(true);
                    toast.promise(
                      signIn.social({
                        provider: "google",
                        callbackURL: "/onboarding",
                      }),
                    );
                  }}
                  disabled={isAuthenticating}
                  className="border-input bg-background text-primary hover:bg-accent hover:text-accent-foreground h-9 w-full rounded-lg border-2 bg-black"
                >
                  <Google />
                  Google
                </Button>
              </motion.div>
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.5 }}
                className="w-full"
              >
                <Button
                  onClick={() => {
                    setIsAuthenticating(true);
                    toast.promise(
                      signIn.social({
                        provider: "github",
                        callbackURL: "/onboarding",
                      }),
                    );
                  }}
                  disabled={isAuthenticating}
                  className="border-input bg-background text-primary hover:bg-accent hover:text-accent-foreground h-9 w-full rounded-lg border-2 bg-black"
                >
                  <GitHub />
                  Github
                </Button>
              </motion.div>
            </div>
          </motion.div>
        );
        break;
      case 1:
        content = (
          <motion.div
            key="connect-step"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="max-w-[500px] space-y-8 px-4 sm:px-12 md:px-0"
          >
            <p className="text-center text-xl font-bold md:text-2xl">Add other email accounts</p>
            
            {/* Pre-render the connections section to avoid jitter */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="flex w-full items-center justify-center gap-6"
            >
              <div className="w-full space-y-4">
                <div className=" flex items-center justify-center gap-3">
                  {connections && connections.map((connection) => (
                    <div key={connection.id} className="flex items-center justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        {/* Tooltip for connection */}
                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="relative cursor-pointer">
                                {connection.picture ? (
                                  <>
                                    <Image
                                      src={connection.picture}
                                      alt=""
                                      className="h-10 w-10 shrink-0 rounded-lg object-cover"
                                      width={40}
                                      height={40}
                                      priority
                                    />
                                    <div className="absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center rounded bg-white">
                                      <Google className="h-2 w-2 text-black" />
                                    </div>
                                  </>
                                ) : (
                                  <div className="bg-primary/10 relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                                    <svg viewBox="0 0 24 24" className="text-primary h-5 w-5">
                                      <path fill="currentColor" d={emailProviders[0]!.icon} />
                                    </svg>
                                    <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-md bg-black">
                                      <Google className="h-3 w-3 text-white" />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="p-2">
                              <div className="flex flex-col">
                                <span className="text-sm font-medium">{connection.name}</span>
                                <span className="text-muted-foreground text-xs">
                                  {connection.email}
                                </span>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                  ))}
                  
                  {/* Separate Dialog component */}
                  <div className="flex items-center justify-between">
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                      <DialogTrigger asChild>
                        <div className="relative cursor-pointer">
                          <div className="bg-primary/10 relative flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-lg border-dotted transition-opacity duration-200 hover:opacity-70">
                            <Plus className="text-primary h-4 w-4" />
                          </div>
                        </div>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>Add Email Account</DialogTitle>
                        </DialogHeader>
                        <div className="flex items-center gap-6 py-4">
                          <Button
                            disabled
                            className="relative inline-flex h-9 w-full overflow-hidden rounded-lg p-[1px] focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-50"
                          >
                            <span className="compose-gradient animate-gradient-flow absolute inset-[-1000%]" />
                            <span className="hover:bg-accent inline-flex h-full w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-black px-3 text-sm font-medium text-white backdrop-blur-3xl">
                              <Image src="/ai.svg" alt="Zero" width={14} height={14} />
                              Zero
                            </span>
                          </Button>

                          <Button
                            onClick={() => {
                              router.push("/api/v1/mail/auth/google/init");
                            }}
                            disabled={isAuthenticating}
                            className="border-input bg-background text-primary hover:bg-accent hover:text-accent-foreground h-9 w-full rounded-lg border-2 bg-black"
                          >
                            <Google />
                            Google
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        );
        break;
      case 2:
        content = (
          <motion.div
            key="loading-step"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="max-w-[500px] space-y-8 px-4 sm:px-12 md:px-0"
          >
            <p className="text-center font-mono text-2xl font-bold md:text-3xl">
              Fetching Your Emails
            </p>
            <div className="flex flex-col items-center justify-center gap-6">
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                <Loader2 className="text-primary h-16 w-16 animate-spin" />
              </motion.div>
              <motion.p
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="text-muted-foreground text-center text-sm"
              >
                Please wait while we fetch your emails. This may take a moment...
              </motion.p>
            </div>
          </motion.div>
        );
        break;
      case 3:
        content = (
          <motion.div
            key="success-step"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="max-w-[500px] space-y-8 px-4 sm:px-12 md:px-0"
          >
            <p className="text-center font-mono text-2xl font-bold md:text-3xl">All Done!</p>

            <div className="flex flex-col items-center gap-4">
              <motion.p
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="text-muted-foreground text-center text-sm"
              >
                Your email accounts have been connected successfully. You're all set to start using
                the app!
              </motion.p>
            </div>
          </motion.div>
        );
        break;
      default:
        return null;
    }

    return (
      <div className="flex flex-col items-center justify-center">
        {content}
        {renderNavigation()}
      </div>
    );
  };

  // Add navigation buttons at the bottom of each step
  const renderNavigation = () => {
    // Don't show navigation on loading step
    if (currentStep === 2) return null;

    return (
      <motion.div
        className="mt-8 flex w-full justify-center gap-4 px-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
      >
        {currentStep > 0 ? (
          <Button
            variant="ghost"
            onClick={handleBack}
            className="h-8 w-8 p-0"
            disabled={isDialogOpen}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        ) : (
          <div></div> // Empty div to maintain flex spacing
        )}

        {currentStep < 3 && currentStep !== 2 && currentStep !== 0 && (
          <Button
            onClick={handleNext}
            className="h-8 w-8 p-0"
            variant="ghost"
            disabled={isDialogOpen}
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}

        {currentStep === 3 && (
          <Button onClick={handleNext} className="h-8 w-8 p-0" variant="ghost">
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </motion.div>
    );
  };

  if (isPending) return null;

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-white dark:bg-black">
      <motion.div
        className="relative mb-8 flex w-full max-w-md justify-between px-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {steps.map((step, index) => (
          <div key={step.id} className="flex flex-col items-center">
            <div className="relative">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                  index < currentStep
                    ? "border-primary bg-primary text-primary-foreground"
                    : index === currentStep
                      ? "border-primary text-primary bg-white dark:bg-black"
                      : "border-input bg-background text-muted-foreground"
                }`}
              >
                {index < currentStep ? (
                  <motion.svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </motion.svg>
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              {index === currentStep && (
                <motion.div
                  className="border-primary absolute inset-0 rounded-full border-2"
                  initial={{ scale: 1 }}
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    repeatType: "loop",
                    times: [0, 0.5, 1],
                  }}
                />
              )}
            </div>
            <motion.span
              className={`mt-2 text-xs ${index === currentStep ? "text-primary font-medium" : "text-muted-foreground"}`}
              animate={{
                fontWeight: index === currentStep ? 500 : 400,
                color: index === currentStep ? "var(--primary)" : "var(--muted-foreground)",
              }}
              transition={{ duration: 0.3 }}
            >
              {step.title}
            </motion.span>
          </div>
        ))}
      </motion.div>

      <div ref={ref} className="relative overflow-hidden">
        <AnimatePresence mode="wait">{renderStep(currentStep)}</AnimatePresence>
      </div>
    </div>
  );
};
