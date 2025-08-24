import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

const formSchema = z.object({
  name: z.string().min(1, { message: 'Name must be at least 1 character' }),
  email: z.string().min(1, { message: 'Username must be at least 1 character' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
});

export default function SignupZero() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    // Append the @0.email suffix to the username
    const fullEmail = `${values.email}@0.email`;

    // Use the correct sonner toast API
    toast.success(`Trying to signup with ${fullEmail}`, {
      description: 'Signup attempt',
    });

    // Here you would typically handle authentication with the full email
  }

  return (
    <div className="flex h-full min-h-screen w-full items-center justify-center bg-black">
      <div className="animate-in slide-in-from-bottom-4 w-full max-w-md px-6 py-8 duration-500">
        <div className="mb-4 text-center">
          <h1 className="mb-2 text-4xl font-bold text-white">Signup with Zero</h1>
          <p className="text-muted-foreground">Enter your email below to signup to your account</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mx-auto space-y-3">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground">Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Luke"
                      {...field}
                      className="bg-black text-sm text-white placeholder:text-sm"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground">Email</FormLabel>
                  <FormControl>
                    <div className="relative w-full rounded-md">
                      <Input
                        placeholder="adam"
                        {...field}
                        className="w-full bg-black pr-16 text-sm text-white placeholder:text-sm"
                      />
                      <span className="bg-popover text-muted-foreground border-input absolute bottom-0 right-0 top-0 flex items-center rounded-r-md border border-l-0 px-3 py-2 text-sm">
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
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-muted-foreground">Password</FormLabel>
                  </div>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      {...field}
                      className="bg-black text-white"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full">
              Signup
            </Button>

            <div className="mt-6 text-center text-sm">
              <p className="text-muted-foreground">
                Don't have an account?{' '}
                <a href="/zero/login" className="text-white underline hover:text-white/80">
                  Login
                </a>
              </p>
            </div>
          </form>
        </Form>
      </div>

      <footer className="absolute bottom-0 w-full px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-6">
          <a
            href="/terms"
            className="text-[10px] text-gray-500 transition-colors hover:text-gray-300"
          >
            Terms of Service
          </a>
          <a
            href="/privacy"
            className="text-[10px] text-gray-500 transition-colors hover:text-gray-300"
          >
            Privacy Policy
          </a>
        </div>
      </footer>
    </div>
  );
}
