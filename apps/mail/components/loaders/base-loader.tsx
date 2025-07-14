'use client';
import { useEffect, useState } from 'react';

interface BaseLoaderProps {
  loaderLines: string[];
  theme?: 'light' | 'dark';
}

const newIndex = (prevIndex: number, length: number) => (prevIndex + 1) % length;

const BaseLoader = ({ theme, loaderLines }: BaseLoaderProps) => {
  const [currentLine, setCurrentLine] = useState(loaderLines[0]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentLine((prevLine) => {
        const prevIndex = loaderLines.indexOf(prevLine);
        return loaderLines[newIndex(prevIndex, loaderLines.length)];
      });
      console.log('currentLine', currentLine);
    }, 5000);
    return () => clearInterval(interval);
  }, [loaderLines]);

  if (theme === 'dark') {
    return (
      <div className="dark flex h-screen w-full flex-col items-center justify-center gap-6">
        <div className="flex flex-col items-center justify-center">
          <div className="relative min-h-[40px] min-w-[40px]">
            <img
              alt="Mail0 Logo Ping"
              width="40"
              height="40"
              className="absolute animate-ping"
              src="/white-icon.svg"
            />
            <img
              alt="Mail0 Logo"
              width="40"
              height="40"
              className="absolute"
              src="/white-icon.svg"
            />
          </div>
        </div>
        <p className="text-muted-foreground text-sm">{currentLine}</p>
      </div>
    );
  }

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

export default BaseLoader;
