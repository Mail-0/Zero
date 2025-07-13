import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from './ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Form, FormField, FormItem, FormControl, FormMessage, FormDescription } from './ui/form';
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from './ui/input-otp';
import { useSession, authClient } from '@/lib/auth-client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { OldPhone } from './icons/icons';
import { Button } from './ui/button';
import { Link } from 'react-router';
import { Copy } from 'lucide-react';
import { Input } from './ui/input';
import { useState } from 'react';
import { toast } from 'sonner';
import z from 'zod';

const verificationSchema = z.object({
  phoneNumber: z.string().regex(/^\+[1-9]\d{1,14}$/, {
    message: 'Please enter a valid phone number with country code (e.g. +1234567890)',
  }),
  otp: z.string().optional(),
});

export const SetupInboxDialog = () => {
  const { refetch } = useSession();
  const [isVerifying, setIsVerifying] = useState(false);
  const [showOtpInput, setShowOtpInput] = useState(false);

  const maskPhoneNumber = (phone: string) => {
    if (!phone) return '';
    if (phone.length < 4) return phone;
    try {
      const lastFour = phone.slice(-4);
      const maskedPart = '*'.repeat(Math.max(0, phone.length - 4));
      return `${maskedPart}${lastFour}`;
    } catch (error) {
      console.error('Error masking phone number:', error);
      return phone;
    }
  };

  const form = useForm<z.infer<typeof verificationSchema>>({
    resolver: zodResolver(verificationSchema),
    defaultValues: {
      phoneNumber: '',
      otp: '',
    },
  });

  const onSubmit = async (data: z.infer<typeof verificationSchema>) => {
    try {
      setIsVerifying(true);

      if (!showOtpInput) {
        await authClient.updateUser({
          phoneNumber: data.phoneNumber,
        });
        await authClient.phoneNumber.sendOtp({
          phoneNumber: data.phoneNumber,
        });
        setShowOtpInput(true);
        toast.success('Verification code sent to your phone');
      } else if (data.otp) {
        const isVerified = await authClient.phoneNumber.verify({
          phoneNumber: data.phoneNumber,
          code: data.otp,
        });
        console.log('isVerified', isVerified);

        if (isVerified.error) {
          toast.error('Invalid verification code');
        } else {
          refetch();
          toast.success('Phone number verified successfully');
        }
      } else {
        toast.error('Please enter a valid OTP');
      }
    } catch (error) {
      console.error(error);
      toast.error(
        showOtpInput ? 'Failed to verify phone number' : 'Failed to send verification code',
      );
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" className="md:h-fit md:px-2">
          <OldPhone className="fill-iconLight dark:fill-iconDark h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent showOverlay>
        <DialogTitle>Set up your Inbox assistant</DialogTitle>
        <DialogDescription>
          <span className={showOtpInput ? 'hidden' : 'block'}>
            You will be able to call your inbox from this number to talk to a voice assistant that
            can search and send out emails on your behalf.
          </span>
          <span className={showOtpInput ? 'block' : 'hidden'}>
            Enter the verification code sent to your phone.
          </span>
        </DialogDescription>
        <div className="relative">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem className={showOtpInput ? 'hidden' : 'block'}>
                    <FormControl>
                      <Input className="mt-2" type="tel" placeholder="Phone number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="otp"
                render={({ field }) => (
                  <FormItem className={showOtpInput ? 'block' : 'hidden'}>
                    <FormControl>
                      <div className="my-4 flex justify-center bg-transparent">
                        <InputOTP maxLength={6} {...field}>
                          <InputOTPGroup>
                            <InputOTPSlot index={0} />
                            <InputOTPSlot index={1} />
                            <InputOTPSlot index={2} />
                          </InputOTPGroup>
                          <InputOTPSeparator />
                          <InputOTPGroup>
                            <InputOTPSlot index={3} />
                            <InputOTPSlot index={4} />
                            <InputOTPSlot index={5} />
                          </InputOTPGroup>
                        </InputOTP>
                      </div>
                    </FormControl>
                    <FormDescription>
                      Please enter the one-time password sent to your phone number{' '}
                      <span className="font-bold">
                        {maskPhoneNumber(form.getValues('phoneNumber'))}
                      </span>
                      .
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="submit" disabled={isVerifying}>
                  {isVerifying
                    ? showOtpInput
                      ? 'Verifying...'
                      : 'Sending...'
                    : showOtpInput
                      ? 'Verify'
                      : 'Send Code'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const CallInboxDialog = () => {
  const copyNumber = () => {
    navigator.clipboard.writeText(import.meta.env.VITE_PUBLIC_PHONE_NUMBER);
    toast.success('Number copied to clipboard');
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="md:h-fit md:px-2">
          <OldPhone className="fill-iconLight dark:fill-iconDark h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem asChild>
          <Link
            to={`tel:${import.meta.env.VITE_PUBLIC_PHONE_NUMBER}`}
            className="flex items-center gap-2"
          >
            <OldPhone className="fill-iconLight dark:fill-iconDark h-4 w-4" />
            Call
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={copyNumber} className="flex items-center gap-2">
          <Copy className="h-4 w-4" />
          Copy number
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
