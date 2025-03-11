"use client"
import { useEffect, useState } from "react";

const PassCard = () => {
    const [user, setUser] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(true);
  
    useEffect(() => {
      try {
        const data = JSON.parse(localStorage.getItem("lastBookingResponse") || "{}");
        setUser(data?.name || "Early USER");
      } catch (error) {
        console.error("Error parsing data from localStorage:", error);
      } finally {
        setIsLoading(false);
      }
    }, []);
  
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <div className="relative max-w-xs mx-auto">
          <div className="w-5 bg-black mx-auto h-32 relative">
            <div className="absolute top-0 right-[0.1] w-full text-white text-xs font-mono tracking-widest" style={{ writingMode: "vertical-rl", textOrientation: "upright" }}>
              0.EMAIL
            </div>
            <div className="absolute bottom-0 w-full text-white text-xs font-mono tracking-widest" style={{ writingMode: "vertical-rl", textOrientation: "upright" }}>
            </div>
            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-3 w-6 h-2 bg-gray-400 rounded-full border border-gray-300"></div>
          </div>
          
          <div className="w-64 h-96 bg-black rounded-lg overflow-hidden border border-gray-700 shadow-lg relative">
            <div className="absolute top-4 left-4">
              <div className="w-8 h-8 bg-white flex items-center justify-center">
                <div className="w-4 h-4 bg-black"></div>
              </div>
            </div>
            
            <div className="flex flex-col items-center justify-center h-full px-4">
              <h1 className="text-white text-5xl font-bold italic mb-2">Early</h1>
              <h1 className="text-white text-6xl font-bold tracking-wider leading-none mb-2">USER</h1>
              <p className="text-white text-lg mb-6">OF 0.EMAIL</p>
              
              {isLoading ? (
                <p className="text-gray-400 text-lg animate-pulse">Loading...</p>
              ) : (
                <p className="text-blue-200 text-xl font-bold mt-4">{user}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  export default PassCard;