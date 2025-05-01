'use client';

import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import React from 'react';

const ToastTestPage = () => {
  const fakePromise = () => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.5) {
          resolve('Operation completed successfully!');
        } else {
          reject(new Error('Operation failed!'));
        }
      }, 1400);
    });
  };

  return (
    <div>
      <Button onClick={() => toast.success('Success!')}>Success</Button>
      <Button onClick={() => toast.error('Error!')}>Error</Button>
      <Button onClick={() => toast.warning('Warning!')}>Warning</Button>
      <Button onClick={() => toast.info('Info!')}>Info</Button>
      <Button
        onClick={() =>
          toast.promise(fakePromise(), {
            loading: 'Processing...',
            success: (data) => data as string,
            error: (err) => (err as Error).message,
          })
        }
      >
        Fake Promise
      </Button>
    </div>
  );
};

export default ToastTestPage;
