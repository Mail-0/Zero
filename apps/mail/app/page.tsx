"use client";

import { DemoMailLayout } from "@/components/mail/mail";
import HeroImage from "@/components/home/hero-image";
import Navbar from "@/components/home/navbar";
import Hero from "@/components/home/hero";

export default function Home() {
  return (
    <div className="relative h-screen min-h-screen w-full overflow-auto bg-black">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[500px] w-[500px] bg-[linear-gradient(90deg,#ffd5d0_0%,#ffafcc_30%,#dbffe4_70%,#e2d6ff_100%)] rounded-lg blur-[120px] opacity-10" />
      </div>
      <div className="relative mx-auto mb-4 flex flex-col">
        <Navbar />
        <Hero />
        <div className="container mx-auto hidden md:block mt-3">
          <DemoMailLayout />
        </div>
        <div className="container mx-auto block md:hidden">
          <HeroImage />
        </div>
        <div className="container mx-auto">
          <p className="text-shinyGray mt-8 text-center text-xs md:text-left">
            Zero Email Inc, 131 Continental Dr, Newark, Delaware, 19713-4305, United States
          </p>
        </div>
      </div>
    </div>
  );
}
