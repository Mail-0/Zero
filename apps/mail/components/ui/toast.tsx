'use client';

import React, { useEffect } from 'react';
import { Toaster, toast } from 'sonner';
import { useTheme } from 'next-themes';

export const Toast = () => {
  const { theme } = useTheme();

  return <Toaster position="top-center" theme={theme as 'dark' | 'light' | 'system'} />;
};
