import { DemoMailLayout } from '@/components/mail/mail';
import HeroImage from '@/components/home/hero-image';
import { Skeleton } from '@/components/ui/skeleton';
import Navbar from '@/components/home/navbar';
import Footer from '@/components/home/footer';
import Hero from '@/components/home/hero';
import { Suspense } from 'react';

export default function Home() {
  return (
    <div className="relative h-screen min-h-screen w-full overflow-auto bg-white dark:bg-black">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[500px] w-[500px] rounded-lg bg-[linear-gradient(90deg,#ffd5d0_0%,#ffafcc_30%,#dbffe4_70%,#e2d6ff_100%)] opacity-5 blur-[120px] dark:opacity-10" />
      </div>
      <div className="relative mx-auto mb-4 flex flex-col">
        <Suspense fallback={<Skeleton />}>
          <Navbar />
        </Suspense>
        <Hero />
        <div className="container mx-auto mt-3 hidden md:block">
          <DemoMailLayout />
        </div>
        <div className="container mx-auto block md:hidden">
          <HeroImage />
        </div>
        <Footer />
      </div>
    </div>
  );
}
