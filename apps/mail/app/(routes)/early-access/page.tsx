"use client"
import React, { useEffect, useState } from "react";
import logo from "@/public/opened-mail.svg"
import Image from "next/image";
import EarlyPassShare from "@/components/ui/early-pass-share";
import PassCard from "@/components/ui/pass-card";

const Page = () => {
  const [user, setUser] = useState<string>("");

  useEffect(()=>{
    const data = JSON.parse(localStorage.getItem("lastBookingResponse")!);
    setUser(data.name);
  }, [])
  return (
    <div className="flex flex-col md:flex-row min-h-screen w-full bg-black text-white">
      <div className="w-full md:w-1/2 flex flex-col justify-center items-center p-4 md:p-8">
        <div className="max-w-md space-y-4 md:space-y-6">
          <div className="flex items-center gap-2 mb-4 md:mb-6">
            <Image src={logo} height={50} width={50} alt="@opened-mail-icon"/>
            <h1 className="text-xl md:text-2xl font-bold ml-2 mt-4">Zeromail</h1>
          </div>
          
          <h2 className="text-3xl md:text-4xl font-bold leading-tight">Hey <span className="text-blue-200">{user}</span> your early pass is here</h2>
          
          <p className="text-gray-400 mt-2 md:mt-4">
          Experience email the way you want with 0 – the first open source email app that puts your privacy and safety first.
          </p>
          
          <div className="mt-4 md:mt-8 space-y-3 md:space-y-4">
            <div className="flex items-start">
              <div className="bg-gray-800 rounded-full p-2 mr-3 md:mr-4">
                <svg className="w-4 h-4 md:w-5 md:h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="font-medium">End-to-end encryption</h3>
                <p className="text-xs md:text-sm text-gray-400">Your messages are only readable by you and your recipient</p>
              </div>
            </div>
            
            <div className="flex items-start">
              <div className="bg-gray-800 rounded-full p-2 mr-3 md:mr-4">
                <svg className="w-4 h-4 md:w-5 md:h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <h3 className="font-medium">Zero knowledge architecture</h3>
                <p className="text-xs md:text-sm text-gray-400">We can{"'"}t read your emails, even if we wanted to</p>
              </div>
            </div>
            
            <div className="flex items-start">
              <div className="bg-gray-800 rounded-full p-2 mr-3 md:mr-4">
                <svg className="w-4 h-4 md:w-5 md:h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h3 className="font-medium">Lightning fast</h3>
                <p className="text-xs md:text-sm text-gray-400">Security doesn{"'"}t mean sacrificing speed</p>
              </div>
            </div>
            <div className="flex gap-2 items-center">
               <span className="font-medium text-sm md:text-base">Share it on</span>
              <EarlyPassShare/>
            </div>
          </div>
        </div>
      </div>
      
      <div className="hidden md:flex h-full w-1/2 justify-center items-center">
        <div className="w-full h-full max-w-md">
          <PassCard/>
        </div>
      </div>
      
      {/* Mobile Early Access - Only shown on small screens */}
      <div className="md:hidden w-full mt-8 md:mt-12">
        <div className="p-4 md:p-8">
           <PassCard/>
        </div>
      </div>
    </div>
  );
};

export default Page;