import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';

const steps = [
  {
    title: 'Welcome to Zero Email!',
    description: 'Your new intelligent email experience starts here.',
    video: 'https://assets.0.email/get-started.png',
  },
  {
    title: 'Chat with your inbox',
    description: 'Zero allows you to chat with your inbox, and take actions on your behalf.',
    video: 'https://assets.0.email/step2.gif',
  },
  {
    title: 'AI Compose & Reply',
    description: 'Our AI assistant allows you to write emails that sound like you.',
    video: 'https://assets.0.email/step1.gif',
  },
  {
    title: 'Label your emails',
    description: 'Zero helps you label your emails to focus on what matters.',
    video: 'https://assets.0.email/step3.gif',
  },
  {
    title: 'Coming Soon',
    description: (
      <>
        <span className="text-muted-foreground mb-4">
          We're excited to bring these powerful features to all users very soon!
        </span>
      </>
    ),
    video: 'https://assets.0.email/coming-soon.png',
  },
  {
    title: 'Ready to start?',
    description: 'Click below to begin your intelligent email experience!',
    video: 'https://assets.0.email/ready.png',
  },
];

export function OnboardingDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (currentStep === steps.length - 1) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [currentStep, steps.length]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTitle></DialogTitle>
      <DialogContent
        showOverlay
        className="bg-panelLight mx-auto w-full max-w-[90%] rounded-xl border p-0 sm:max-w-[690px] dark:bg-[#111111]"
      >
        <div className="flex flex-col gap-4 p-4">
          {steps[currentStep] && steps[currentStep].video && (
            <div className="relative flex items-center justify-center">
              <div className="bg-muted aspect-video w-full max-w-4xl overflow-hidden rounded-lg">
                {steps.map(
                  (step, index) =>
                    step.video && (
                      <div
                        key={step.title}
                        className={`absolute inset-0 transition-opacity duration-300 ${
                          index === currentStep ? 'opacity-100' : 'opacity-0'
                        }`}
                      >
                        <img
                          loading="eager"
                          width={500}
                          height={500}
                          src={step.video}
                          alt={step.title}
                          className="h-full w-full rounded-lg border object-cover"
                        />
                      </div>
                    ),
                )}
              </div>
            </div>
          )}
          <div className="space-y-0">
            <h2 className="text-4xl font-semibold">{steps[currentStep]?.title}</h2>
            <p className="text-muted-foreground max-w-xl text-sm">
              {steps[currentStep]?.description}
            </p>
          </div>

          <div className="mx-auto flex w-full justify-between">
            <div className="flex gap-2">
              <Button
                size={'xs'}
                onClick={() => setCurrentStep(currentStep - 1)}
                variant="outline"
                disabled={currentStep === 0}
              >
                Go back
              </Button>
              <Button size={'xs'} onClick={handleNext}>
                {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
              </Button>
            </div>
            <div className="flex items-center justify-center">
              <div className="flex gap-1">
                {steps.map((_, index) => (
                  <div
                    key={_.title}
                    className={`h-1 w-4 rounded-full md:w-10 ${
                      index === currentStep ? 'bg-primary' : 'bg-muted'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function OnboardingWrapper() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const ONBOARDING_KEY = 'hasCompletedOnboarding';

  useEffect(() => {
    const hasCompletedOnboarding = localStorage.getItem(ONBOARDING_KEY) === 'true';
    setShowOnboarding(!hasCompletedOnboarding);
  }, []);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      localStorage.setItem(ONBOARDING_KEY, 'true');
    }
    setShowOnboarding(open);
  };

  return <OnboardingDialog open={showOnboarding} onOpenChange={handleOpenChange} />;
}
