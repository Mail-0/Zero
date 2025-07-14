'use client';
import { useEffect, useState } from 'react';

const loaderLines = [
  'Loading your inbox...',
  'Loading your drafts...',
  'Loading your sent items...',
  'Loading your trash...',
  'Loading your spam...',
];

const InboxLoader = () => {
  const [currentLine, setCurrentLine] = useState(loaderLines[0]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentLine(
        (prevLine) => loaderLines[(loaderLines.indexOf(prevLine) + 1) % loaderLines.length],
      );
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-6">
      <div className="flex flex-col items-center justify-center">
        <div className="relative min-h-[40px] min-w-[40px]">
          <img
            alt="mail ping"
            width="40"
            height="40"
            className="absolute hidden animate-ping dark:block"
            src="/assets/rocket.svg"
          />
          <img
            alt="mail"
            width="40"
            height="40"
            className="absolute hidden dark:block"
            src="/assets/rocket.svg"
          />
          <img
            alt="mail ping"
            width="40"
            height="40"
            className="absolute block animate-ping dark:hidden text-black"
            src="/assets/rocket-dark.svg"
          />
          <img
            alt="mail"
            width="40"
            height="40"
            className="absolute block dark:hidden text-black"
            src="/assets/rocket-dark.svg"
          />
        </div>
      </div>
      <p className="text-muted-foreground text-sm">{currentLine}</p>
    </div>
  );
};

export default InboxLoader;
