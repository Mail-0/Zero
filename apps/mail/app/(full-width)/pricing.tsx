import { PixelatedBackground } from '@/components/home/pixelated-bg';
import PricingCard from '@/components/pricing/pricing-card';
import Comparision from '@/components/pricing/comparision';

import { Navigation } from '@/components/navigation';

import Footer from '@/components/home/footer';

export default function PricingPage() {
  return (
    <main className="relative flex min-h-screen flex-1 flex-col overflow-x-hidden bg-[#0F0F0F]">
      <PixelatedBackground
        className="z-1 absolute left-1/2 top-[-40px] h-auto w-screen min-w-[1920px] -translate-x-1/2 object-cover"
        style={{
          mixBlendMode: 'screen',
          maskImage: 'linear-gradient(to bottom, black, transparent)',
        }}
      />
      <Navigation />

      <div className="container mx-auto mt-12 px-4 py-16 md:mt-44">
        <div className="mb-12 text-center">
          <h1 className="mb-2 self-stretch text-5xl font-medium leading-[62px] text-white md:text-6xl">
            Simple, Transparent Pricing
          </h1>
          <p className="mt-6 text-2xl font-light text-[#B8B8B9]">
            Choose the plan that's right for you
          </p>
        </div>

        <div className="mx-auto max-w-7xl">
          <PricingCard />
        </div>
      </div>
      <div className="container mx-auto mb-40 px-4">
        <Comparision />
      </div>
      <div className="mt-auto">
        <Footer />
      </div>
    </main>
  );
}
