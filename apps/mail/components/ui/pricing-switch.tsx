import { Switch as SwitchPrimitives } from 'radix-ui';
import * as React from 'react';

import { cn } from '@/lib/utils';

const PricingSwitch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      'focus-visible:ring-ring focus-visible:ring-offset-background data-[state=unchecked]:bg-input peer inline-flex h-[16px] w-8 shrink-0 cursor-pointer items-center rounded-full border border-[#404141] border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-white data-[state=unchecked]:pl-[0.5px]',
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        'pointer-events-none relative block h-[12px] w-[12px] rounded-full border border-[#717171] bg-[#404141] shadow-lg ring-0 transition-transform data-[state=unchecked]:ml-[0.5px] data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0',
      )}
    />
  </SwitchPrimitives.Root>
));
PricingSwitch.displayName = SwitchPrimitives.Root.displayName;

export { PricingSwitch };
