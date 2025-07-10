import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PurpleThickCheck } from '@/components/icons/icons';
import { Separator } from '@/components/ui/separator';
import { useBilling } from '@/hooks/use-billing';
import { PricingSwitch } from './pricing-switch';
import { Button } from '@/components/ui/button';
import { useQueryState } from 'nuqs';
import { useState } from 'react';
import { Badge } from './badge';
import { toast } from 'sonner';

export function PricingDialog() {
  const { attach } = useBilling();
  const [isLoading, setIsLoading] = useState(false);
  const [isAnnual, setIsAnnual] = useState(false);
  const [open, setOpen] = useQueryState('pricingDialog');
  const monthlyPrice = 20;
  const annualPrice = monthlyPrice * 0.5; // 50% off for annual billing

  const handleUpgrade = async () => {
    if (attach) {
      setIsLoading(true);
      toast.promise(
        attach({
          productId: isAnnual ? 'pro_annual' : 'pro-example',
          successUrl: `${window.location.origin}/mail/inbox?success=true`,
        }),
        {
          success: 'Redirecting to payment...',
          error: 'Failed to process upgrade. Please try again later.',
          finally: () => setIsLoading(false),
        },
      );
    }
  };

  return (
    <Dialog open={!!open} onOpenChange={(open) => setOpen(open ? 'true' : null)}>
      <DialogTrigger asChild>
        <div className="hidden" />
      </DialogTrigger>
      <DialogContent
        className="flex w-auto items-center justify-center rounded-2xl border-none p-1"
        showOverlay
      >
        <DialogTitle className="text-center text-2xl"></DialogTitle>

        <div className="relative inline-flex h-[535px] w-96 flex-col items-center justify-center overflow-hidden rounded-2xl border p-5 outline outline-2 outline-offset-[4px] outline-gray-400 dark:border-[#2D2D2D] dark:bg-zinc-900/50 dark:outline-[#2D2D2D]">
          <div className="absolute inset-0 z-0 h-full w-full overflow-hidden">
            <img
              src="/pricing-gradient.png"
              alt="pricing-gradient"
              className="absolute -right-0 -top-52 h-auto w-full"
              height={535}
              width={535}
              loading="eager"
            />
          </div>

          <div className="relative right-5 top-[-70px] h-56 w-[720px]">
            <div className="absolute left-[-157px] top-[-68.43px] h-36 w-[1034px] rounded-full bg-white/10 mix-blend-overlay blur-[100px]" />

            <img
              className="absolute left-0 top-0 h-56 w-[719.25px] mix-blend-screen"
              src="/small-pixel.png"
              height={56}
              width={719}
              alt="small-pixel"
            />
          </div>
          <div className="relative bottom-[50px] z-10 flex flex-col items-start justify-start gap-5 self-stretch md:bottom-[55px] lg:bottom-[37px]">
            <div className="flex flex-col items-start justify-start gap-4 self-stretch">
              <div className="flex w-full items-center justify-between">
                <div className="inline-flex items-center justify-center gap-2.5 overflow-hidden rounded-lg bg-[#B183FF] p-2">
                  <div className="relative h-6 w-6">
                    <img height={24} width={24} src="/zap.svg" alt="hi" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <PricingSwitch
                    onCheckedChange={(checked) => setIsAnnual(checked)}
                    id="pricing-switch"
                  />
                  <label htmlFor="pricing-switch" className="text-muted-foreground text-sm">
                    Billed Annually
                  </label>
                  <Badge className="border border-[#656565] bg-[#3F3F3F] text-white">
                    Save 50%
                  </Badge>
                </div>
              </div>

              <div className="flex flex-col items-start justify-start gap-2 self-stretch">
                <div className="inline-flex items-end justify-start gap-1 self-stretch">
                  <div className="justify-center text-4xl font-semibold leading-10">
                    ${isAnnual ? annualPrice : monthlyPrice}
                    {isAnnual && (
                      <span className="text-muted-foreground ml-2 text-base font-normal line-through">
                        ${monthlyPrice}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-center gap-2.5 pb-0.5">
                    <div className="text-muted-foreground justify-center text-sm font-medium leading-tight dark:text-white/40">
                      / MONTH
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-start justify-start gap-2 self-stretch">
                  <div className="text-muted-foreground justify-center self-stretch text-sm font-normal leading-normal lg:text-base dark:text-white/70">
                    For professionals and power users who want to supercharge their inbox
                    efficiency.
                  </div>
                </div>
              </div>
            </div>

            <Separator orientation="horizontal" />

            <div className="flex flex-col items-start justify-start gap-2.5 self-stretch">
              <div className="inline-flex items-center justify-start gap-2.5">
                <div className="bg-muted flex h-5 w-5 items-start justify-start gap-3 rounded-[125px] p-[5px] dark:bg-white/10">
                  <PurpleThickCheck className="relative left-[1px] top-[1px]" />
                </div>
                <div className="justify-center text-sm font-normal leading-normal lg:text-base">
                  Unlimited email connections
                </div>
              </div>
              <div className="inline-flex items-center justify-start gap-2.5">
                <div className="bg-muted flex h-5 w-5 items-start justify-start gap-3 rounded-[125px] p-[5px] dark:bg-white/10">
                  <PurpleThickCheck className="relative left-[1px] top-[1px]" />
                </div>
                <div className="justify-center text-sm font-normal leading-normal lg:text-base">
                  AI-powered chat with your inbox
                </div>
              </div>
              <div className="inline-flex items-center justify-start gap-2.5">
                <div className="bg-muted flex h-5 w-5 items-start justify-start gap-3 rounded-[125px] p-[5px] dark:bg-white/10">
                  <PurpleThickCheck className="relative left-[1px] top-[1px]" />
                </div>
                <div className="justify-center text-sm font-normal leading-normal lg:text-base">
                  Auto labeling
                </div>
              </div>
              <div className="inline-flex items-center justify-start gap-2.5">
                <div className="bg-muted flex h-5 w-5 items-start justify-start gap-3 rounded-[125px] p-[5px] dark:bg-white/10">
                  <PurpleThickCheck className="relative left-[1px] top-[1px]" />
                </div>
                <div className="justify-center text-sm font-normal leading-normal lg:text-base">
                  One-click AI email writing & replies
                </div>
              </div>
              <div className="inline-flex items-center justify-start gap-2.5">
                <div className="bg-muted flex h-5 w-5 items-start justify-start gap-3 rounded-[125px] p-[5px] dark:bg-white/10">
                  <PurpleThickCheck className="relative left-[1px] top-[1px]" />
                </div>
                <div className="justify-center text-sm font-normal leading-normal lg:text-base">
                  Instant thread AI-generated summaries
                </div>
              </div>
              <div className="inline-flex items-center justify-start gap-2.5">
                <div className="bg-muted flex h-5 w-5 items-start justify-start gap-3 rounded-[125px] p-[5px] dark:bg-white/10">
                  <PurpleThickCheck className="relative left-[1px] top-[1px]" />
                </div>
                <div className="justify-center text-sm font-normal leading-normal lg:text-base">
                  Priority customer support
                </div>
              </div>
              <div className="inline-flex items-center justify-start gap-2.5">
                <div className="bg-muted flex h-5 w-5 items-start justify-start gap-3 rounded-[125px] p-[5px] dark:bg-white/10">
                  <PurpleThickCheck className="relative left-[1px] top-[1px]" />
                </div>
                <div className="justify-center text-sm font-normal leading-normal lg:text-base">
                  Access to private Discord community
                </div>
              </div>
            </div>
          </div>
          <Button
            className="z-50 h-24 w-full p-3 outline outline-1 outline-offset-[-1px] dark:outline-[#2D2D2D]"
            onClick={handleUpgrade}
            disabled={isLoading}
          >
            <div className="justify-start text-center font-semibold leading-none">
              {isLoading ? 'Processing...' : 'Start 7 day free trial'}
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
