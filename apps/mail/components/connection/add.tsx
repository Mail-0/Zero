import { Plus, UserPlus } from "lucide-react"
import { Button } from "../ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog"
import { emailProviders } from "@/constants/emailProviders"
import { cn } from "@/lib/utils"
import { motion } from "motion/react"

export const AddConnectionDialog = ({ 
    children, 
    className, 
    onOpenChange 
}: { 
    children?: React.ReactNode, 
    className?: string,
    onOpenChange?: (open: boolean) => void
}) => {
    return <Dialog onOpenChange={onOpenChange}>
        <DialogTrigger asChild>
            {children || (
                <Button size={'dropdownItem'} variant={'dropdownItem'} className={cn("gap-2 w-full justify-start", className)}>
                    <UserPlus size={16} strokeWidth={2} className="opacity-60" aria-hidden="true" />
                    <p className="text-[13px] opacity-60">Add email</p>
                </Button>
            )}
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Connect Email</DialogTitle>
                <DialogDescription>Select an email provider to connect</DialogDescription>
            </DialogHeader>
            <motion.div 
                className="mt-4 grid grid-cols-2 gap-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
            >
                {emailProviders.map((provider, index) => (
                    <motion.a 
                        key={provider.name} 
                        href={`/api/v1/mail/auth/${provider.providerId}/init`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1, duration: 0.3 }}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                    >
                        <Button
                            variant="outline"
                            className="h-24 flex-col items-center justify-center gap-2 w-full"
                        >
                            <svg viewBox="0 0 24 24" className="h-12 w-12">
                                <path fill="currentColor" d={provider.icon} />
                            </svg>
                            <span className="text-xs">{provider.name}</span>
                        </Button>
                    </motion.a>
                ))}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: emailProviders.length * 0.1, duration: 0.3 }}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                >
                    <Button
                        variant="outline"
                        className="h-24 flex-col items-center justify-center gap-2 border-dashed w-full"
                    >
                        <Plus className="h-12 w-12" />
                        <span className="text-xs">More Coming Soon</span>
                    </Button>
                </motion.div>
            </motion.div>
        </DialogContent>
    </Dialog>
}