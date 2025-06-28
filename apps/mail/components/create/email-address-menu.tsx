import { useState, useEffect } from 'react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '../ui/dropdown-menu';
import { Copy, Trash, Edit, Scissors } from 'lucide-react';

interface EmailAddressMenuProps {
  email: string;
  onCopy: (email: string) => void;
  onRemove: (email: string) => void;
  onEdit: (email: string) => void;
  disabled?: boolean;
}

export function EmailAddressMenu({ 
  email, 
  onCopy, 
  onRemove, 
  onEdit,
  disabled = false
}: EmailAddressMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleCopyAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onCopy(email);
    setIsOpen(false);
  };
  
  // Handle cut email action (copy + remove)
  const handleCutAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    // First copy the email
    onCopy(email);
    // Then remove it
    onRemove(email);
    setIsOpen(false);
  };

  const handleEditAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    console.log('Editing email directly:', email);
    setIsOpen(false);
    onEdit(email);
  };

  const handleRemoveAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onRemove(email);
    setIsOpen(false);
  };

  // Handle double click to directly edit
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onEdit(email);
  };
  
  // Handle click to open menu
  const handleEmailClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(true);
  };

  // Update dropdown menu behavior to improve interaction
  useEffect(() => {
    if (isOpen) {
      console.log("Dropdown opened");
    }
  }, [isOpen]);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen} modal={false}>
      <DropdownMenuTrigger 
        disabled={disabled} 
        onClick={handleEmailClick}
        className="cursor-pointer text-black dark:text-white outline-none focus:outline-none"
      >
        <span onDoubleClick={handleDoubleClick} className="cursor-pointer">
          {email}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="start" 
        alignOffset={-5}
        className="w-48 p-1 z-[999] bg-[#FAFAFA] dark:bg-[#202020] border-[#E7E7E7] dark:border-[#252525]" 
        sideOffset={5}
        side="bottom"
        avoidCollisions={true}
        collisionPadding={10}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onClick={(e) => e.stopPropagation()}
      >
        <div 
          onMouseDown={handleCopyAction}
          className="cursor-pointer w-full"
        >
          <DropdownMenuItem 
            onSelect={(e) => e.preventDefault()}
            className="flex items-center gap-2 text-sm text-black dark:text-white hover:bg-[#F0F0F0] dark:hover:bg-[#252525] cursor-pointer"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy email address
          </DropdownMenuItem>
        </div>
        
        <div 
          onMouseDown={handleCutAction}
          className="cursor-pointer w-full"
        >
          <DropdownMenuItem 
            onSelect={(e) => e.preventDefault()}
            className="flex items-center gap-2 text-sm text-black dark:text-white hover:bg-[#F0F0F0] dark:hover:bg-[#252525] cursor-pointer"
          >
            <Scissors className="h-3.5 w-3.5" />
            Cut email address
          </DropdownMenuItem>
        </div>
        
        <div 
          onMouseDown={handleEditAction}
          className="cursor-pointer w-full"
        >
          <DropdownMenuItem 
            onSelect={(e) => e.preventDefault()}
            className="flex items-center gap-2 text-sm text-black dark:text-white hover:bg-[#F0F0F0] dark:hover:bg-[#252525] cursor-pointer"
          >
            <Edit className="h-3.5 w-3.5" />
            Edit email address
          </DropdownMenuItem>
        </div>
        
        <div 
          onMouseDown={handleRemoveAction}
          className="cursor-pointer w-full"
        >
          <DropdownMenuItem 
            onSelect={(e) => e.preventDefault()}
            className="flex items-center gap-2 text-sm text-destructive focus:bg-destructive/10 hover:bg-[#F0F0F0] dark:hover:bg-[#252525] cursor-pointer"
          >
            <Trash className="h-3.5 w-3.5" />
            Remove
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 