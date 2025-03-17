import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogClose,
} from '@/components/ui/dialog';
import {
	Archive,
	ArchiveX,
	FileText,
	Inbox,
	type LucideIcon,
	Plus,
	SearchX,
	Send,
	Trash2,
} from 'lucide-react';
import { useConnections } from '@/hooks/use-connections';
import { emailProviders } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';

// Types for default inbox filters
export type FolderType = 'inbox' | 'draft' | 'sent' | 'spam' | 'trash' | 'archive' | 'search';

interface EmptyStateConfig {
	icon: LucideIcon;
	title: string;
	description: string;
}

type FolderConfig = Record<FolderType, EmptyStateConfig>;

// Scoped styles for no messages state
const styles = {
	container: 'w-full flex items-center justify-center text-center px-4',
	content: 'flex flex-col items-center',
	icon: 'h-8 w-8 text-muted-foreground/50 mb-2',
	title: 'text-lg font-semibold text-muted-foreground',
	description: 'text-sm text-muted-foreground/80',
} as const;

// Config for default inbox filters
const FOLDER_CONFIGS: FolderConfig = {
	inbox: {
		icon: Inbox,
		title: 'Your inbox is empty',
		description: 'Nothing here, well done.',
	},
	draft: {
		icon: FileText,
		title: 'No saved drafts',
		description: 'Drafts you create will appear here',
	},
	sent: {
		icon: Send,
		title: 'No sent messages',
		description: 'Messages you send will appear here',
	},
	spam: {
		icon: ArchiveX,
		title: 'No spam messages',
		description: 'Messages marked as spam will appear here',
	},
	trash: {
		icon: Trash2,
		title: 'Trash is empty',
		description: 'Deleted messages will appear here',
	},
	archive: {
		icon: Archive,
		title: 'No archived messages',
		description: 'Messages you archive will appear here',
	},
	search: {
		icon: SearchX,
		title: 'No results found',
		description: "Try adjusting your search or filters to find what you're looking for",
	},
} as const;

// interface for empty state
interface EmptyStateProps {
	folder: FolderType;
	className?: string;
}

/**
 * empty-state.tsx
 *
 * Displays an empty state message for each default inbox filter when no messages exist.
 * Displays the corresponding icon and text appropriate for each empty mailbox state.
 *
 * @param folder - The mailbox to display the empty state for
 * @param className - Any styling to apply to the container
 */
function EmptyState({ folder, className }: EmptyStateProps) {
	// Dev warning for invalid folder types
	if (process.env.NODE_ENV === 'development' && !(folder in FOLDER_CONFIGS)) {
		console.warn(`Invalid folder type provided: ${folder}`);
	}

	const config = FOLDER_CONFIGS[folder] ?? FOLDER_CONFIGS.inbox;
	const Icon = config.icon;
	const connections = useConnections();
	const noConnection = useMemo(
		() => connections.data && connections.data.length === 0,
		[connections?.data],
	);

	// Don't render anything while loading
	if (connections.isLoading) return null;

	return (
		<div>
			{noConnection ? (
				<Dialog open={noConnection}>
					<DialogContent className="sm:max-w-md">
						<DialogHeader>
							<DialogTitle>Connect Email</DialogTitle>
							<DialogDescription>Select an email provider to connect</DialogDescription>
						</DialogHeader>
						<div className="mt-4 grid grid-cols-2 gap-4">
							{emailProviders.map((provider) => (
								<a key={provider.name} href={`/api/v1/mail/auth/${provider.providerId}/init`}>
									<Button
										variant="outline"
										className="h-24 w-full flex-col items-center justify-center gap-2"
									>
										<svg viewBox="0 0 24 24" className="h-12 w-12">
											<path fill="currentColor" d={provider.icon} />
										</svg>
										<span className="text-xs">{provider.name}</span>
									</Button>
								</a>
							))}
							<Button
								variant="outline"
								className="h-24 flex-col items-center justify-center gap-2 border-dashed"
							>
								<Plus className="h-12 w-12" />
								<span className="text-xs">More Coming Soon</span>
							</Button>
						</div>
						<DialogClose />
					</DialogContent>
				</Dialog>
			) : (
				<div
					role="status"
					aria-live="polite"
					data-testid="empty-state"
					className={cn(styles.container, className)}
				>
					<div className={styles.content}>
						<Icon className={styles.icon} aria-hidden="true" data-testid="empty-state-icon" />
						<h3 className={styles.title}>{config.title}</h3>
						<p className={styles.description}>{config.description}</p>
					</div>
				</div>
			)}
		</div>
	);
}

export { EmptyState };
