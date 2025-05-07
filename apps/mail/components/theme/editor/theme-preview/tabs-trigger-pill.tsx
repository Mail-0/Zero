import { TabsTrigger } from "@/components/ui/tabs";
import { TabsTriggerProps } from "@radix-ui/react-tabs";

const TabsTriggerPill = ({ children, ...props }: TabsTriggerProps) => {
  return (
    <TabsTrigger
      className="inline-flex items-center justify-center whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground hover:text-muted-foreground/70"
      {...props}
    >
      {children}
    </TabsTrigger>
  );
};

export default TabsTriggerPill;
