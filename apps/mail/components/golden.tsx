'use client'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Form, FormField, FormItem, FormLabel } from './ui/form';
import { Input } from './ui/input';
import { TicketIcon } from 'lucide-react';
import { Button } from './ui/button';
import { handleGoldenTicket } from '@/actions/settings';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';

const schema = z.object({
    email: z.string().email(),
});

export const GoldenTicketModal = () => {
    const { refetch } = useSession();
    const router = useRouter();
    const form = useForm({
        resolver: zodResolver(schema),
    })
    const onSubmit = async (data: z.infer<typeof schema>) => {
        const { success, error } = await handleGoldenTicket(data.email);
        if (success) {
            toast.success('Golden ticket used, your friend will be notified');
            refetch()
            router.refresh()
        } else {
            toast.error(error);
        }
    }
    const email = form.watch('email');
    return <Dialog defaultOpen>
        <DialogTrigger asChild>
            <Button className='w-full bg-yellow-500/10 border-yellow-500 border text-yellow-500 hover:bg-black'>
                <span className='mr-2'>Use Golden Ticket</span>
                <TicketIcon className='h-4 w-4' />
            </Button>
        </DialogTrigger>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>You're in! 🎉</DialogTitle>
                <DialogDescription>Congrats on joining Zero (beta)! 🎉 As an early adopter, you're automatically qualified to receive <span className='font-bold underline'>1x Golden Ticket 🎫</span>. You can use this 🎫 to give any of your friends access to the app immediately, skipping the waitling!</DialogDescription>
                <DialogDescription>Who are you inviting? 🤔</DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-2'>
                <Form {...form}>
                    <FormField
                        control={form.control}
                        name='email'
                        render={({ field }) =>
                            <FormItem>
                                <FormLabel htmlFor="email" className="text-sm font-medium">
                                    Email
                                </FormLabel>
                                <Input {...field} />
                            </FormItem>
                        }
                    />
                    <Button disabled={!email} type='submit' className='w-full'>
                        <span className='mr-2'>Use (1x Golden Ticket)</span>
                        <TicketIcon className='h-4 w-4' />
                    </Button>
                </Form>
            </form>
        </DialogContent>
    </Dialog>
}