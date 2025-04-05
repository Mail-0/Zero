'use client';

import { SquarePenIcon, type SquarePenIconHandle } from '../icons/animated/square-pen';
import { Sidebar, SidebarContent, SidebarHeader } from '@/components/ui/sidebar';
import { navigationConfig } from '@/config/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { useSidebar } from '@/components/ui/sidebar';
import FeaturebaseWidget from './featurebase-widget';
import FeaturebaseButton from './featurebase-button';
import { useIsMobile } from '@/hooks/use-mobile';
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useStats } from '@/hooks/use-stats';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FOLDERS } from '@/lib/utils';
import { NavMain } from './nav-main';
import { NavUser } from './nav-user';
import { Button } from './button';
import Image from 'next/image';
import { ArrowUpIcon, Check, X } from 'lucide-react';
import { generateConversationId } from '@/lib/ai';
import { useSession } from '@/lib/auth-client';

// Response Card Component
function ResponseCard({
  response,
  onRegenerate,
  onAccept,
  isRegenerating = false
}: {
  response: string;
  onRegenerate: () => void;
  onAccept: () => void;
  isRegenerating?: boolean;
}) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className="fixed bottom-14 left-2 w-[15rem] rounded-xl border bg-white p-3 text-xs shadow-md dark:bg-black z-50"
    >
      <div className="max-h-40 overflow-y-auto mb-2 min-h-[40px]">
        <AnimatePresence mode="wait">
          {isRegenerating ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center h-full py-4"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                className="h-4 w-4 text-gray-500"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="100%"
                  height="100%"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <p className="whitespace-pre-wrap text-xs">{response}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      <div className="flex justify-end gap-2 mt-2">
        <button 
          onClick={onRegenerate}
          className="text-[10px] text-gray-500 flex items-center px-2 py-0.5 rounded"
          disabled={isRegenerating}
        >
          <svg className="h-3 w-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
            <path d="M16 21h5v-5" />
          </svg>
          Regenerate
        </button>
        <button 
          onClick={onAccept}
          className="text-[10px] text-blue-600 bg-blue-50 dark:bg-blue-600 dark:text-blue-100 flex items-center px-2 py-0.5 rounded"
          disabled={isRegenerating}
        >
          <Check className="h-3 w-3 mr-1" />
          Accept
        </button>
      </div>
    </motion.div>
  );
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: stats } = useStats();
  const isMobile = useIsMobile();

  const pathname = usePathname();

  const { currentSection, navItems } = useMemo(() => {
    // Find which section we're in based on the pathname
    const section = Object.entries(navigationConfig).find(([, config]) =>
      pathname.startsWith(config.path),
    );

    const currentSection = section?.[0] || 'mail';
    if (navigationConfig[currentSection]) {
      const items = [...navigationConfig[currentSection].sections];

      if (currentSection === 'mail' && stats && stats.length) {
        if (items[0]?.items[0]) {
          items[0].items[0].badge =
            stats.find((stat) => stat.label?.toLowerCase() === FOLDERS.INBOX)?.count ?? 0;
        }
        if (items[0]?.items[3]) {
          items[0].items[3].badge =
            stats.find((stat) => stat.label?.toLowerCase() === FOLDERS.SENT)?.count ?? 0;
        }
      }

      return { currentSection, navItems: items };
    } else {
      return {
        currentSection: '',
        navItems: [],
      };
    }
  }, [pathname, stats]);

  const showComposeButton = currentSection === 'mail';

  // Global response state for the sidebar
  const [globalResponse, setGlobalResponse] = useState<string | null>(null);
  const [showResponseCard, setShowResponseCard] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  
  // Handle response accept/regenerate
  const handleRegenerateResponse = () => {
    // Start regeneration animation
    setIsRegenerating(true);
    
    // Here we would trigger regeneration
    // For demo purposes, we'll just update the response with a slightly different one after a delay
    setTimeout(() => {
      setGlobalResponse("I've revised the email with a more friendly tone:\n\nHi John,\n\nGreat to hear from you! I'm happy to report we're right on schedule for Friday's delivery. The team has been making excellent progress - we're at 90% completion and just polishing the final details.\n\nLet me know if you'd like a breakdown of what's left or if you have any other questions!\n\nBest regards");
      setIsRegenerating(false);
    }, 1500); // Longer delay to show the animation
  };
  
  const handleAcceptResponse = () => {
    setShowResponseCard(false);
  };
  
  // Listen for AI responses and close events from the SidebarAI component
  useEffect(() => {
    const handleAIResponse = (event: any) => {
      setGlobalResponse(event.detail.response);
      setShowResponseCard(true);
    };
    
    const handleCloseResponse = () => {
      setShowResponseCard(false);
    };
    
    window.addEventListener('ai-response', handleAIResponse);
    window.addEventListener('close-ai-response', handleCloseResponse);
    
    return () => {
      window.removeEventListener('ai-response', handleAIResponse);
      window.removeEventListener('close-ai-response', handleCloseResponse);
    };
  }, []);

  return (
    <>
      <FeaturebaseWidget organization="0email" theme="dark" />
      <FeaturebaseButton />
      
      {/* Render response card at the root level - only on larger screens */}
      <AnimatePresence>
        {showResponseCard && globalResponse && !isMobile && (
          <ResponseCard 
            response={globalResponse}
            onRegenerate={handleRegenerateResponse}
            onAccept={handleAcceptResponse}
            isRegenerating={isRegenerating}
          />
        )}
      </AnimatePresence>

      <Sidebar
        collapsible="icon"
        {...props}
        className="bg-offsetWhite dark:bg-offsetDark flex flex-col items-center"
      >
        <div className="flex w-full flex-col">
          <SidebarHeader className="flex flex-col gap-2 p-2">
            <NavUser />
            <AnimatePresence mode="wait">
              {showComposeButton && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                >
                  <ComposeButton />
                </motion.div>
              )}
            </AnimatePresence>
          </SidebarHeader>
          <SidebarContent className="py-0 pt-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSection}
                initial={{ opacity: 0, x: currentSection === 'mail' ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: currentSection === 'mail' ? 20 : -20 }}
                transition={{ duration: 0.2 }}
                className="flex-1 py-0"
              >
                <NavMain items={navItems} />
              </motion.div>
            </AnimatePresence>
          </SidebarContent>
        </div>

        <div className="mb-4 mt-auto flex w-full items-center justify-between px-2">
          <SidebarAI />
        </div>
      </Sidebar>
    </>
  );
}

function ComposeButton() {
  const iconRef = useRef<SquarePenIconHandle>(null);
  const { state } = useSidebar();
  const isMobile = useIsMobile();
  const router = useRouter();
  const t = useTranslations();
  return (
    <Button
      onClick={() => router.push('/mail/create')}
      className="bg-secondary bg-subtleWhite text-primary hover:bg-subtleWhite dark:bg-subtleBlack dark:hover:bg-subtleBlack relative isolate mt-1 h-8 w-[calc(100%)] overflow-hidden whitespace-nowrap shadow-inner"
      onMouseEnter={() => () => iconRef.current?.startAnimation?.()}
      onMouseLeave={() => () => iconRef.current?.stopAnimation?.()}
    >
      {state === 'collapsed' && !isMobile ? (
        <SquarePenIcon ref={iconRef} className="size-4" />
      ) : (
        <>
          <span className="text-center text-sm">{t('common.actions.create')}</span>
        </>
      )}
    </Button>
  );
}

function SidebarAI() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { state } = useSidebar();
  const isMobile = useIsMobile();
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: session } = useSession();
  
  // Generate conversation ID
  const conversationId = useMemo(() => generateConversationId(), []);
  
  // Focus input when expanded
  useEffect(() => {
    if (isExpanded && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isExpanded]);
  
  // Animation variants similar to AIAssistant component
  const animations = {
    container: {
      initial: { width: 32, opacity: 0 },
      animate: (width: number) => ({
        width: width < 640 ? '13rem' : '15rem',
        opacity: 1,
        transition: {
          width: { type: 'spring', stiffness: 250, damping: 35 },
          opacity: { duration: 0.4 },
        },
      }),
      exit: {
        width: 32,
        opacity: 0,
        transition: {
          width: { type: 'spring', stiffness: 250, damping: 35 },
          opacity: { duration: 0.4 },
        },
      },
    },
    content: {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: { delay: 0.15, duration: 0.4 } },
      exit: { opacity: 0, transition: { duration: 0.3 } },
    },
  };

  // Handle click on the sparkles button
  const handleSparklesClick = () => {
    setIsExpanded(!isExpanded);
  };
  
  // Handle submit
  const handleSubmit = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!prompt.trim()) return;
    
    try {
      setIsLoading(true);
      
      // For demo purposes, use a hardcoded response
      // This will be replaced with the actual API call later
      setTimeout(() => {
        // Reset prompt after sending
        setPrompt('');
        
        // Only trigger response card on larger screens
        if (typeof window !== 'undefined' && !isMobile) {
          const hardcodedResponse = "I've drafted a professional response to John's email about the project deadline:\n\nDear John,\n\nThank you for your inquiry about the project timeline. I can confirm that we're on track to deliver by Friday as planned. The team has completed 90% of the deliverables and is addressing final quality checks.\n\nWould you like me to include more specific details about the remaining tasks?";
          
          // Use a custom event to communicate with the parent component
          const event = new CustomEvent('ai-response', { 
            detail: { response: hardcodedResponse } 
          });
          window.dispatchEvent(event);
        } else if (isMobile) {
          // On mobile, just close the input without showing response card
          setIsExpanded(false);
        }
        
        setIsLoading(false);
      }, 1000); // Simulate API delay
      
   
      
    } catch (error) {
      console.error('AI Assistant Error:', error);
      setIsLoading(false);
    }
  };
  
  // Handle keydown
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      setIsExpanded(false);
    }
  };

  // Don't show the sparkles button when sidebar is collapsed
  if (state === 'collapsed' && !isMobile) {
    return null;
  }

  return (
    <div className="relative">
      {/* Fixed logo position */}
      <div className="absolute left-1.5 top-2 z-20 h-5 w-5 pointer-events-none">
        <Image
          src="/black-icon.svg"
          alt="0.email Logo"
          fill
          className="object-contain dark:hidden"
        />
        <Image
          src="/white-icon.svg"
          alt="0.email Logo"
          fill
          className="hidden object-contain dark:block"
        />
      </div>

      {/* Logo button that triggers the AI input */}
      <button
        onClick={handleSparklesClick}
        className="relative h-6 w-6 overflow-visible focus:outline-none"
        title="AI Assistant"
      />

      {/* Expanded state */}
      <AnimatePresence mode="wait">
        {isExpanded && (
          <motion.div
            variants={animations.container}
            custom={isMobile ? 400 : 800}
            initial="initial"
            animate="animate"
            exit="exit"
            className="absolute top-0 z-10 flex h-9 items-center overflow-hidden rounded-xl border bg-white shadow-sm dark:bg-black"
            onClick={(e) => e.stopPropagation()}
            style={{ transformOrigin: 'left center' }}
          >
            {/* Expanding content */}
            <motion.div variants={animations.content} className="flex-grow overflow-hidden relative pl-6">
              
              <input
                ref={inputRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Zero..."
                className="h-8 w-full border-0 bg-white pl-2 pr-8 text-xs focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none dark:bg-black"
                disabled={isLoading}
              />
              
              {/* Close button */}
              <button
                onClick={() => {
                  setIsExpanded(false);
                  // Also close the response card
                  if (typeof window !== 'undefined') {
                    const event = new CustomEvent('close-ai-response');
                    window.dispatchEvent(event);
                  }
                }}
                className="absolute right-2 top-1/2 z-10 -translate-y-1/2 h-4 w-4 rounded-full text-black dark:text-white focus:outline-none"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>

            {/* Action buttons */}
            <div className="flex items-center gap-1 pr-1">
              {isLoading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                  className="mr-1 h-5 w-5 text-black dark:text-white"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="100%"
                    height="100%"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                </motion.div>
              ) : (
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  className="h-5 w-5 rounded-full p-0 text-black hover:opacity-80 dark:text-white"
                  disabled={!prompt.trim() || isLoading}
                >
                  <ArrowUpIcon className="h-4 w-4 bg-black dark:bg-white rounded-full dark:text-black text-white" />
                </Button>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
