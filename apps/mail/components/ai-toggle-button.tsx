import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';
import { useAISidebar } from './ui/ai-sidebar';
import { Button } from './ui/button';

// AI Toggle Button Component
const AIToggleButton = () => {
  const { toggleOpen: toggleAISidebar, open: isSidebarOpen } = useAISidebar();

  return (
    !isSidebarOpen && (
      <div className="fixed bottom-4 right-4 z-50">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="dark:bg-sidebar border h-12 w-12 rounded-lg"
              onClick={(e) => {
                if (!isSidebarOpen) {
                  e.stopPropagation();
                  toggleAISidebar();
                }
              }}
            >
              <div className="flex items-center justify-center">
                <img
                  src="/black-icon.svg"
                  alt="AI Assistant"
                  width={22}
                  height={22}
                  className="block dark:hidden"
                />
                <img
                  src="/white-icon.svg"
                  alt="AI Assistant"
                  width={22}
                  height={22}
                  className="hidden dark:block"
                />
              </div>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Toggle AI Assistant</TooltipContent>
        </Tooltip>
      </div>
    )
  );
};

export default AIToggleButton;
