import React, {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  Bookmark,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
} from '@/components/icons/icons';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { FileIcon } from 'lucide-react';
import { Accordion } from 'radix-ui';
import { cn } from '@/lib/utils';

type TreeViewElement = {
  id: string;
  name: string;
  isSelectable?: boolean;
  children?: TreeViewElement[];
};

type TreeContextProps = {
  selectedId: string | undefined;
  expandedItems: string[] | undefined;
  indicator: boolean;
  handleExpand: (id: string) => void;
  selectItem: (id: string) => void;
  setExpandedItems?: React.Dispatch<React.SetStateAction<string[] | undefined>>;
  openIcon?: React.ReactNode;
  closeIcon?: React.ReactNode;
  direction: 'rtl' | 'ltr';
};

const TreeContext = createContext<TreeContextProps | null>(null);

const useTree = () => {
  const context = useContext(TreeContext);
  if (!context) {
    throw new Error('useTree must be used within a TreeProvider');
  }
  return context;
};

interface TreeViewComponentProps extends React.HTMLAttributes<HTMLDivElement> {}

type Direction = 'rtl' | 'ltr' | undefined;

type TreeViewProps = {
  initialSelectedId?: string;
  indicator?: boolean;
  elements?: TreeViewElement[];
  initialExpandedItems?: string[];
  openIcon?: React.ReactNode;
  closeIcon?: React.ReactNode;
} & TreeViewComponentProps;

const Tree = forwardRef<HTMLDivElement, TreeViewProps>(
  (
    {
      className,
      elements,
      initialSelectedId,
      initialExpandedItems,
      children,
      indicator = true,
      openIcon,
      closeIcon,
      dir,
      ...props
    },
    ref,
  ) => {
    const [selectedId, setSelectedId] = useState<string | undefined>(initialSelectedId);
    const [expandedItems, setExpandedItems] = useState<string[] | undefined>(initialExpandedItems);

    const selectItem = useCallback((id: string) => {
      setSelectedId(id);
    }, []);

    const handleExpand = useCallback((id: string) => {
      setExpandedItems((prev) => {
        if (prev?.includes(id)) {
          return prev.filter((item) => item !== id);
        }
        return [...(prev ?? []), id];
      });
    }, []);

    const expandSpecificTargetedElements = useCallback(
      (elements?: TreeViewElement[], selectId?: string) => {
        if (!elements || !selectId) return;
        const findParent = (currentElement: TreeViewElement, currentPath: string[] = []) => {
          const isSelectable = currentElement.isSelectable ?? true;
          const newPath = [...currentPath, currentElement.id];
          if (currentElement.id === selectId) {
            if (isSelectable) {
              setExpandedItems((prev) => [...(prev ?? []), ...newPath]);
            } else {
              if (newPath.includes(currentElement.id)) {
                newPath.pop();
                setExpandedItems((prev) => [...(prev ?? []), ...newPath]);
              }
            }
            return;
          }
          if (isSelectable && currentElement.children && currentElement.children.length > 0) {
            currentElement.children.forEach((child) => {
              findParent(child, newPath);
            });
          }
        };
        elements.forEach((element) => {
          findParent(element);
        });
      },
      [],
    );

    useEffect(() => {
      if (initialSelectedId) {
        expandSpecificTargetedElements(elements, initialSelectedId);
      }
    }, [initialSelectedId, elements]);

    const direction = dir === 'rtl' ? 'rtl' : 'ltr';

    return (
      <TreeContext.Provider
        value={{
          selectedId,
          expandedItems,
          handleExpand,
          selectItem,
          setExpandedItems,
          indicator,
          openIcon,
          closeIcon,
          direction,
        }}
      >
        <div className={cn('size-full', className)}>
          <ScrollArea ref={ref} className="relative h-full px-2" dir={dir as Direction}>
            <Accordion.Root
              {...props}
              type="multiple"
              defaultValue={expandedItems}
              value={expandedItems}
              className="flex flex-col gap-1"
              onValueChange={(value) => setExpandedItems((prev) => [...(prev ?? []), value[0]])}
              dir={dir as Direction}
            >
              {children}
            </Accordion.Root>
          </ScrollArea>
        </div>
      </TreeContext.Provider>
    );
  },
);

Tree.displayName = 'Tree';

const TreeIndicator = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { direction } = useTree();

    return (
      <div
        dir={direction}
        ref={ref}
        className={cn(
          'bg-muted absolute left-[15px] h-full w-px rounded-md py-3 duration-300 ease-in-out hover:bg-slate-300 rtl:right-1.5',
          className,
        )}
        {...props}
      />
    );
  },
);

TreeIndicator.displayName = 'TreeIndicator';

interface FolderComponentProps extends React.ComponentPropsWithoutRef<typeof Accordion.Item> {}

type FolderProps = {
  expandedItems?: string[];
  element: string;
  count: number;
  isSelectable?: boolean;
  isSelect?: boolean;
  onFolderClick?: (id: string) => void;
  hasChildren?: boolean;
  color?: string;
} & FolderComponentProps;

const Folder = ({
  className,
  element,
  count,
  value,
  isSelectable = true,
  isSelect,
  children,
  onFolderClick,
  hasChildren,
  ...props
}: FolderProps) => {
  const childrenCount = React.Children.count(children);
  const canExpand = hasChildren !== undefined ? hasChildren : childrenCount > 0;
  const {
    direction,
    handleExpand,
    expandedItems,
    indicator,
    setExpandedItems,
    openIcon,
    closeIcon,
  } = useTree();

  return (
    <Accordion.Item {...props} value={value} className="relative h-full overflow-hidden">
      <div
        className={cn(
          `flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm hover:bg-black/10 dark:hover:bg-[#202020]`,
          className,
          {
            'bg-sidebar-accent rounded-md': isSelect && isSelectable,
            'cursor-pointer': isSelectable,
            'cursor-not-allowed opacity-50': !isSelectable,
          },
        )}
        {...(!canExpand && isSelectable && onFolderClick
          ? {
              onClick: (e) => {
                e.stopPropagation();
                onFolderClick(value);
              },
              role: 'button',
              tabIndex: 0,
            }
          : {})}
      >
        {canExpand ? (
          <Accordion.Trigger
            className="flex cursor-[ns-resize] items-center"
            disabled={!isSelectable}
            onClick={(e) => {
              e.stopPropagation();
              handleExpand(value);
            }}
          >
            {expandedItems?.includes(value)
              ? (openIcon ?? <FolderOpenIcon className="relative mr-3 size-4" />)
              : (closeIcon ?? <FolderIcon className="relative mr-3 size-4" />)}
          </Accordion.Trigger>
        ) : (
          <div className="flex items-center">
            <Bookmark className={cn(`relative mr-3 size-4`)} />
          </div>
        )}
        <span
          className={cn('max-w-[124px] flex-1 truncate', {
            'cursor-pointer': canExpand && isSelectable && onFolderClick,
            'font-bold': isSelect,
          })}
          {...(canExpand && isSelectable && onFolderClick
            ? {
                onClick: (e) => {
                  e.stopPropagation();
                  if (onFolderClick) {
                    onFolderClick(value);
                  }
                },
                role: 'button',
                tabIndex: 0,
              }
            : {})}
        >
          {element}
        </span>
        {count > 0 && (
          <span
            className={cn(
              'text-muted-foreground ml-auto shrink-0 rounded-full bg-transparent px-2 py-0.5 text-xs font-medium',
            )}
          >
            {count}
          </span>
        )}
      </div>
      <Accordion.Content className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down relative h-full overflow-hidden text-sm">
        {element && indicator && <TreeIndicator aria-hidden="true" />}
        <Accordion.Root
          dir={direction}
          type="multiple"
          className="ml-5 flex flex-col gap-1 py-1 rtl:mr-5"
          defaultValue={expandedItems}
          value={expandedItems}
          onValueChange={(value) => {
            setExpandedItems?.((prev) => [...(prev ?? []), value[0]]);
          }}
        >
          {children}
        </Accordion.Root>
      </Accordion.Content>
    </Accordion.Item>
  );
};

Folder.displayName = 'Folder';

const File = forwardRef<
  HTMLButtonElement,
  {
    value: string;
    handleSelect?: (id: string) => void;
    isSelectable?: boolean;
    isSelect?: boolean;
    fileIcon?: React.ReactNode;
  } & React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ value, className, isSelectable = true, isSelect, fileIcon, children, ...props }, ref) => {
  const { direction, selectedId, selectItem } = useTree();
  const isSelected = isSelect ?? selectedId === value;
  return (
    <button
      ref={ref}
      type="button"
      disabled={!isSelectable}
      className={cn(
        'flex w-fit items-center gap-1 rounded-md pr-1 text-sm duration-200 ease-in-out rtl:pl-1 rtl:pr-0',
        {
          'bg-muted': isSelected && isSelectable,
        },
        isSelectable ? 'cursor-pointer' : 'cursor-not-allowed opacity-50',
        direction === 'rtl' ? 'rtl' : 'ltr',
        className,
      )}
      onClick={() => selectItem(value)}
      {...props}
    >
      {fileIcon ?? <FileIcon className="size-4" />}
      {children}
    </button>
  );
});

File.displayName = 'File';

const CollapseButton = forwardRef<
  HTMLButtonElement,
  {
    elements: TreeViewElement[];
    expandAll?: boolean;
  } & React.HTMLAttributes<HTMLButtonElement>
>(({ elements, expandAll = false, children, ...props }, ref) => {
  const { expandedItems, setExpandedItems } = useTree();

  const expendAllTree = useCallback((elements: TreeViewElement[]) => {
    const expandTree = (element: TreeViewElement) => {
      const isSelectable = element.isSelectable ?? true;
      if (isSelectable && element.children && element.children.length > 0) {
        setExpandedItems?.((prev) => [...(prev ?? []), element.id]);
        element.children.forEach(expandTree);
      }
    };

    elements.forEach(expandTree);
  }, []);

  const closeAll = useCallback(() => {
    setExpandedItems?.([]);
  }, []);

  useEffect(() => {
    console.log(expandAll);
    if (expandAll) {
      expendAllTree(elements);
    }
  }, [expandAll]);

  return (
    <Button
      variant={'ghost'}
      className="absolute bottom-1 right-2 h-8 w-fit p-1"
      onClick={expandedItems && expandedItems.length > 0 ? closeAll : () => expendAllTree(elements)}
      ref={ref}
      {...props}
    >
      {children}
      <span className="sr-only">Toggle</span>
    </Button>
  );
});

CollapseButton.displayName = 'CollapseButton';

export { CollapseButton, File, Folder, Tree, type TreeViewElement };
