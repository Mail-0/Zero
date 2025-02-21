"use client";

import HeroImage from "@/components/home/hero-image";
import Navbar from "@/components/home/navbar";
import Hero from "@/components/home/hero";

export default function Home() {
  return (
    <div className="relative h-screen min-h-screen w-full overflow-hidden bg-grid-small-black/[0.09] dark:bg-grid-small-white/[0.025]">
      {/* <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[500px] w-[500px] rounded-full bg-gradient-to-r from-orange-500/10 via-pink-500/10 to-purple-500/10 blur-[120px]" />
      </div> */}
      <div className="relative mx-auto mb-4 flex max-w-7xl flex-col">
        <Navbar />
        <Hero />
        <HeroImage />
      </div>
    </div>
  );
}
