import { memo, useState, type ComponentProps, type ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';
import { Streamdown } from 'streamdown';
import { cn } from '@/lib/utils';

type ResponseProps = ComponentProps<typeof Streamdown>;
type ElementProps<T extends keyof React.JSX.IntrinsicElements> = React.JSX.IntrinsicElements[T] & {
  node?: unknown;
};

const TableCell = ({
  children,
  node: _node,
  ...props
}: ElementProps<'td'> & { children?: ReactNode }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (typeof children !== 'string') return;
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <td className="text-neutral group/cell relative px-3 py-2 align-top" {...props}>
      <div className="flex items-start justify-between gap-2">
        <span>{children}</span>
        {typeof children === 'string' && (
          <button
            type="button"
            onClick={handleCopy}
            className="text-neutral-subtle hover:text-neutral hover:bg-surface-subtle cursor-pointer rounded-md p-1 opacity-0 transition-opacity group-hover/cell:opacity-100"
            title="Copy to clipboard"
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          </button>
        )}
      </div>
    </td>
  );
};

const defaultComponents: ResponseProps['components'] = {
  table: ({ node: _node, ...props }: ElementProps<'table'>) => (
    <div className="ring-neutral-subtle bg-surface-subtle my-3 w-full overflow-x-auto rounded-xl tabular-nums antialiased ring-1">
      <table className="text-copy-sm w-full" {...props} />
    </div>
  ),
  thead: ({ node: _node, ...props }: ElementProps<'thead'>) => (
    <thead
      className="bg-surface-weak border-neutral-subtle text-neutral-subtle border-b font-medium"
      {...props}
    />
  ),
  th: ({ node: _node, ...props }: ElementProps<'th'>) => (
    <th className="px-3 py-2 text-left font-medium whitespace-nowrap" {...props} />
  ),
  tr: ({ node: _node, ...props }: ElementProps<'tr'>) => (
    <tr
      className="border-neutral-subtle even:bg-surface-subtle/50 hover:bg-surface-subtle border-b transition-colors duration-150 ease-out last:border-0"
      {...props}
    />
  ),
  td: TableCell,
};

/** Markdown renderer for chat text; animates while the response streams in. */
export const Response = memo(
  ({ className, components, ...props }: ResponseProps) => (
    <Streamdown
      className={cn('size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0', className)}
      components={{ ...defaultComponents, ...components }}
      {...props}
    />
  ),
  (prev, next) =>
    prev.children === next.children &&
    prev.mode === next.mode &&
    prev.isAnimating === next.isAnimating,
);

Response.displayName = 'Response';
