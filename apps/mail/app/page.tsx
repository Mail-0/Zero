"use client";

import { DemoMailLayout } from "@/components/mail/mail";
import HeroImage from "@/components/home/hero-image";
import Navbar from "@/components/home/navbar";
import Hero from "@/components/home/hero";
import Footer from "@/components/home/footer";
import { useConnections } from "@/hooks/use-connections";
import { useEffect, useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import Loader from "@/components/ui/loader";

export default function Home() {
  const { data } = useConnections();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!data || data.length === 0) return;

    const fetchData = async () => {
      try {
        const result = await axios.get(
          `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/early-access/user?email=${data[0].email}`
        );
        if (result.data.success) {
          router.push("/early-access");
        }
      } catch (err) {
        console.error("Error fetching early access data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [data, router]);

  if (isLoading) {
    return <Loader title="Loading..."/>
  }

  return (
    <div className="relative h-screen min-h-screen w-full overflow-auto bg-white dark:bg-black">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[500px] w-[500px] bg-[linear-gradient(90deg,#ffd5d0_0%,#ffafcc_30%,#dbffe4_70%,#e2d6ff_100%)] rounded-lg blur-[120px] opacity-5 dark:opacity-10" />
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
        <Footer />
      </div>
    </div>
  );
}