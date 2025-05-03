'use client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { SidebarMenuButton, useSidebar } from '@/components/ui/sidebar';
import { Form, FormField, FormItem, FormLabel } from './ui/form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CurvedArrow, Ticket } from './icons/icons';
import { useEffect, useState, useRef } from 'react';
import { Command, TicketIcon } from 'lucide-react';
import { MessageKey } from '@/config/navigation';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSession } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Button } from './ui/button';
import { Input } from './ui/input';
import Image from 'next/image';
import { toast } from 'sonner';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
});

export const GoldenTicketModal = () => {
  const { refetch } = useSession();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const { state } = useSidebar();
  const isMobile = useIsMobile();
  const isSubmitting = useRef(false);
  const form = useForm({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    const hasDeclined = localStorage.getItem('goldenTicketDeclined');
    if (!hasDeclined) {
      setIsOpen(true);
    }
  }, []);

  const onSubmit = async (data: z.infer<typeof schema>) => {
    if (isSubmitting.current) return;
    isSubmitting.current = true;

    try {
      const response = await fetch('/api/golden-ticket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: data.email }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success('Invitation sent, your friend will be notified!!');
        refetch();
        router.refresh();
        setIsOpen(false);
      } else {
        toast.error(result.error || 'Failed to send invite');
      }
    } catch (error) {
      console.error('Error sending golden ticket:', error);
      toast.error('Failed to send golden ticket');
    } finally {
      isSubmitting.current = false;
    }
  };

  const handleMaybeLater = () => {
    localStorage.setItem('goldenTicketDeclined', 'true');
    setIsOpen(false);
  };

  const email = form.watch('email');

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Check for Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux)
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      if (email) {
        e.preventDefault(); // Prevent default to avoid double submission
        form.handleSubmit(onSubmit)();
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <SidebarMenuButton tooltip={'Invite a friend'}>
          <Ticket className="relative mr-2 h-3 w-3.5" />
          <p className="mt-0.5 truncate text-[13px]">Invite a friend</p>
        </SidebarMenuButton>
      </DialogTrigger>
      <DialogContent
        showOverlay={true}
        className="bg-panelLight dark:bg-panelDark w-full max-w-[500px] rounded-xl p-5"
      >
        <DialogHeader>
          <DialogTitle className="flex flex-col gap-4">
            <Image
              src="/white-icon.svg"
              alt="Zero"
              width={32}
              height={32}
              className="hidden dark:block"
            />
            <Image
              src="/black-icon.svg"
              alt="Zero"
              width={32}
              height={32}
              className="block dark:hidden"
            />
            <span>Welcome to Zero! 🎉 ✨</span>
          </DialogTitle>
          <DialogDescription className="flex flex-col gap-3 py-3">
            <span>
              Zero is still in early beta 🚀 and will continue to grow and improve from this point
              on. If you know a friend who wants to test and try out Zero, send them an invite! 💌
            </span>
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-2"
          onKeyDown={handleKeyDown}
        >
          <Form {...form}>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <Input
                    placeholder="nizzy@gmail.com"
                    {...field}
                    className="h-8 placeholder:opacity-20"
                  />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-1">
              <Button onClick={handleMaybeLater} type="button" variant="outline" className="h-7">
                Maybe Later
              </Button>
              <Button disabled={!email} type="submit" className="h-7">
                <span className="mr-">Send invite</span>
                <div className="flex h-5 items-center justify-center gap-1 rounded-sm bg-white/10 px-1 dark:bg-black/10">
                  <Command className="h-2 w-2 text-black dark:text-[#929292]" />
                  <CurvedArrow className="mt-1.5 h-3 w-3 fill-black dark:fill-[#929292]" />
                </div>
              </Button>
            </div>
          </Form>
        </form>
      </DialogContent>
    </Dialog>
  );
};
