import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import React from 'react';

type Props = {};

const ToastTest = (props: Props) => {
  return (
    <div className="space-y-6 p-8">
      <h1 className="text-2xl font-bold">Toast Notification Test</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        <Button
          onClick={() => {
            toast('This is a default toast message');
          }}
        >
          Default Toast
        </Button>

        <Button
          onClick={() => {
            toast.success('Operation completed successfully!');
          }}
          variant="default"
        >
          Success Toast
        </Button>

        <Button
          onClick={() => {
            toast.error('An error occurred. Please try again.');
          }}
          variant="destructive"
        >
          Error Toast
        </Button>

        <Button
          onClick={() => {
            toast.warning('Warning: This action cannot be undone.');
          }}
          variant="secondary"
        >
          Warning Toast
        </Button>

        <Button
          onClick={() => {
            toast.info("Here's some information you might find useful.");
          }}
          variant="outline"
        >
          Info Toast
        </Button>

        <Button
          onClick={() => {
            toast.loading('Loading your data...');
          }}
        >
          Loading Toast
        </Button>

        <Button
          onClick={() => {
            toast('Custom Toast with Action', {
              description: 'This toast has a custom action button.',
              action: {
                label: 'Undo',
                onClick: () => console.log('Undo action clicked'),
              },
            });
          }}
          variant="secondary"
        >
          Toast with Action
        </Button>

        <Button
          onClick={() => {
            toast('Persistent Toast', {
              duration: 99999999999999, // 10 seconds
              action: {
                label: 'Undo',
                onClick: () => console.log('Undo action clicked'),
              },
            });
          }}
        >
          Persistent Toast (10s)
        </Button>
      </div>
    </div>
  );
};

export default ToastTest;
