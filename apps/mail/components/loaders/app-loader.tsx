'use client';
import { useEffect, useState } from 'react';

const loaderLines = [
  'Analyzing your email patterns for a personalized experience...',
  'Training our AI to draft replies in your voice...',
  'Optimizing your inbox for maximum productivity...',
  'Filtering out the noise so you can focus on what matters...',
  'Getting your digital assistant ready for the day...',
];

const AppLoader = () => {
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
            alt="Mail0 Logo Ping"
            width="40"
            height="40"
            className="absolute hidden animate-ping dark:block"
            src="/white-icon.svg"
          />
          <img
            alt="Mail0 Logo"
            width="40"
            height="40"
            className="absolute hidden dark:block"
            src="/white-icon.svg"
          />
          <img
            alt="Mail0 Logo Ping"
            width="40"
            height="40"
            className="absolute block animate-ping dark:hidden"
            src="/black-icon.svg"
          />
          <img
            alt="Mail0 Logo"
            width="40"
            height="40"
            className="absolute block dark:hidden"
            src="/black-icon.svg"
          />
        </div>
      </div>
      <p className="text-muted-foreground text-sm">{currentLine}</p>
    </div>
  );
};

export default AppLoader;
