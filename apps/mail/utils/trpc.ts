import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@/app/trpc/root';

export const api = createTRPCReact<AppRouter>();