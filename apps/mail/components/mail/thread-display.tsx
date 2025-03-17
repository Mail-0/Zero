import {
	Archive,
	ArchiveX,
	Forward,
	MoreVertical,
	Reply,
	ReplyAll,
	Maximize2,
	Minimize2,
} from 'lucide-react';
import { DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { DropdownMenu, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';

import { MoreVerticalIcon } from '../icons/animated/more-vertical';
import { useState, useEffect, useCallback, useRef } from 'react';
import { ArchiveIcon } from '../icons/animated/archive';
import { ExpandIcon } from '../icons/animated/expand';
import { MailDisplaySkeleton } from './mail-skeleton';
import { ReplyIcon } from '../icons/animated/reply';
import { Button } from '@/components/ui/button';
import { useThread } from '@/hooks/use-threads';
import { sortNotes } from '@/lib/notes-utils';
import { useNotes } from '@/hooks/use-notes';
import ThreadSubject from './thread-subject';
import { XIcon } from '../icons/animated/x';
import ReplyCompose from './reply-composer';
import { useTranslations } from 'next-intl';
import { NotesPanel } from './note-panel';
import MailDisplay from './mail-display';
import { useMail } from './use-mail';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ThreadDisplayProps {
	mail: any;
	onClose?: () => void;
	isMobile?: boolean;
}

export function ThreadDemo({ mail: emailData, onClose, isMobile }: ThreadDisplayProps) {
	const isFullscreen = false;

	return (
		<div
			className={cn(
				'flex flex-col',
				isFullscreen ? 'h-screen' : isMobile ? 'h-full' : 'h-[calc(100vh-2rem)]',
			)}
		>
			<div
				className={cn(
					'bg-offsetLight dark:bg-offsetDark relative flex flex-col overflow-hidden transition-all duration-300',
					isMobile ? 'h-full' : 'h-full',
					!isMobile && !isFullscreen && 'rounded-r-lg',
					isFullscreen ? 'fixed inset-0 z-50' : '',
				)}
			>
				<div className="flex flex-shrink-0 items-center border-b p-2">
					<div className="flex flex-1 items-center gap-2">
						<Tooltip>
							<TooltipTrigger asChild>
								<Button variant="ghost" className="md:h-fit md:px-2" disabled={!emailData}>
									<XIcon className="h-4 w-4" />
									<span className="sr-only">Close</span>
								</Button>
							</TooltipTrigger>
							<TooltipContent>Close</TooltipContent>
						</Tooltip>
						<ThreadSubject subject={'Join the Email Revolution with Zero!'} isMobile={isMobile} />
					</div>
					<div className="flex items-center gap-2">
						<Tooltip>
							<TooltipTrigger asChild>
								<Button variant="ghost" className="md:h-fit md:px-2" disabled={!emailData}>
									{isFullscreen ? (
										<ExpandIcon className="h-4 w-4" />
									) : (
										<ExpandIcon className="h-4 w-4" />
									)}
									<span className="sr-only">
										{isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
									</span>
								</Button>
							</TooltipTrigger>
							<TooltipContent>
								{isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
							</TooltipContent>
						</Tooltip>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button variant="ghost" className="md:h-fit md:px-2" disabled={!emailData}>
									<ArchiveIcon className="relative top-0.5 h-4 w-4" />
									<span className="sr-only">Archive</span>
								</Button>
							</TooltipTrigger>
							<TooltipContent>Archive</TooltipContent>
						</Tooltip>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button variant="ghost" className="md:h-fit md:px-2" disabled={!emailData}>
									<ReplyIcon className="h-4 w-4" />
									<span className="sr-only">Reply</span>
								</Button>
							</TooltipTrigger>
							<TooltipContent>Reply</TooltipContent>
						</Tooltip>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" className="md:h-fit md:px-2" disabled={!emailData}>
									<MoreVerticalIcon className="h-4 w-4" />
									<span className="sr-only">More</span>
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem>
									<ArchiveX className="mr-2 h-4 w-4" /> Move to spam
								</DropdownMenuItem>
								<DropdownMenuItem>
									<ReplyAll className="mr-2 h-4 w-4" /> Reply all
								</DropdownMenuItem>
								<DropdownMenuItem>
									<Forward className="mr-2 h-4 w-4" /> Forward
								</DropdownMenuItem>
								<DropdownMenuItem>Mark as unread</DropdownMenuItem>
								<DropdownMenuItem>Add label</DropdownMenuItem>
								<DropdownMenuItem>Mute thread</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>
				<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
					<ScrollArea className="flex-1" type="scroll">
						<div className="pb-4">
							{[...(emailData || [])].reverse().map((message, index) => (
								<div
									key={message.id}
									className={cn(
										'transition-all duration-200',
										index > 0 && 'border-border border-t',
									)}
								>
									<MailDisplay
										demo
										emailData={message}
										isFullscreen={isFullscreen}
										isMuted={false}
										isLoading={false}
										index={index}
									/>
								</div>
							))}
						</div>
					</ScrollArea>
					<div className="relative flex-shrink-0 md:top-2">
						<ReplyCompose emailData={emailData} isOpen={false} setIsOpen={() => {}} />
					</div>
				</div>
			</div>
		</div>
	);
}

function ThreadActionButton({
	icon: Icon,
	label,
	onClick,
	disabled = false,
	className,
}: {
	icon: React.ComponentType<React.ComponentPropsWithRef<any>> & {
		startAnimation?: () => void;
		stopAnimation?: () => void;
	};
	label: string;
	onClick?: () => void;
	disabled?: boolean;
	className?: string;
}) {
	const iconRef = useRef<any>(null);

	return (
		<Button
			disabled={disabled}
			onClick={onClick}
			variant="ghost"
			className={cn('md:h-fit md:px-2', className)}
			onMouseEnter={() => iconRef.current?.startAnimation?.()}
			onMouseLeave={() => iconRef.current?.stopAnimation?.()}
		>
			<Icon ref={iconRef} className="h-4 w-4" />
			<span className="sr-only">{label}</span>
		</Button>
	);
}

export function ThreadDisplay({ mail, onClose, isMobile }: ThreadDisplayProps) {
	const [, setMail] = useMail();
	const { data: emailData, isLoading } = useThread(mail ?? '');
	const [isMuted, setIsMuted] = useState(false);
	const [isReplyOpen, setIsReplyOpen] = useState(false);
	const [isFullscreen, setIsFullscreen] = useState(false);
	const {
		getNotesForThread,
		addNote,
		editNote,
		deleteNote,
		togglePinNote,
		changeNoteColor,
		reorderNotes,
	} = useNotes();
	const [threadNotes, setThreadNotes] = useState<any[]>([]);
	const [, setIsLoadingNotes] = useState(false);
	const t = useTranslations();

	const moreVerticalIconRef = useRef<any>(null);

	useEffect(() => {
		async function fetchNotes() {
			if (emailData?.[0]) {
				setIsLoadingNotes(true);
				try {
					const notes = await getNotesForThread(emailData[0].threadId ?? mail);
					setThreadNotes(notes);
				} catch (error) {
					console.error('Error fetching notes:', error);
				} finally {
					setIsLoadingNotes(false);
				}
			}
		}

		fetchNotes();
	}, [emailData, getNotesForThread, mail]);

	useEffect(() => {
		if (emailData?.[0]) {
			setIsMuted(emailData[0].unread ?? false);
		}
	}, [emailData]);

	const handleClose = useCallback(() => {
		onClose?.();
		setMail((m) => ({ ...m, selected: null }));
	}, [onClose, setMail]);

	useEffect(() => {
		const handleEsc = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				handleClose();
			}
		};
		window.addEventListener('keydown', handleEsc);
		return () => window.removeEventListener('keydown', handleEsc);
	}, [handleClose]);

	if (isLoading || !emailData)
		return (
			<div
				className={cn(
					'flex flex-col',
					isFullscreen ? 'h-screen' : isMobile ? 'h-full' : 'h-[calc(100vh-2rem)]',
				)}
			>
				<div
					className={cn(
						'bg-offsetLight dark:bg-offsetDark relative flex flex-col overflow-hidden transition-all duration-300',
						isMobile ? 'h-full' : 'h-full',
						!isMobile && !isFullscreen && 'rounded-r-lg',
						isFullscreen ? 'fixed inset-0 z-50' : '',
					)}
				>
					<div className="flex flex-shrink-0 items-center border-b px-1 pb-1 md:px-3 md:pb-2 md:pt-[10px]">
						<div className="flex flex-1 items-center">
							<ThreadActionButton
								icon={XIcon}
								label={t('common.actions.close')}
								onClick={handleClose}
							/>
						</div>
						<div className="flex items-center gap-1 sm:gap-2 md:gap-6">
							<ThreadActionButton
								icon={isFullscreen ? ExpandIcon : ExpandIcon}
								label={
									isFullscreen
										? t('common.threadDisplay.exitFullscreen')
										: t('common.threadDisplay.enterFullscreen')
								}
								onClick={() => setIsFullscreen(!isFullscreen)}
							/>

							<ThreadActionButton
								icon={ArchiveIcon}
								label={t('common.threadDisplay.archive')}
								disabled={true}
								className="relative top-0.5"
							/>

							<ThreadActionButton
								icon={ReplyIcon}
								label={t('common.threadDisplay.reply')}
								disabled={true}
							/>

							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										variant="ghost"
										className="h-8 w-8 p-0 md:h-fit md:w-auto md:px-2"
										disabled={true}
									>
										<MoreVerticalIcon className="h-4 w-4" />
										<span className="sr-only">{t('common.threadDisplay.moreOptions')}</span>
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									<DropdownMenuItem>
										<ArchiveX className="mr-2 h-4 w-4" /> {t('common.threadDisplay.moveToSpam')}
									</DropdownMenuItem>
									<DropdownMenuItem>
										<ReplyAll className="mr-2 h-4 w-4" /> {t('common.threadDisplay.replyAll')}
									</DropdownMenuItem>
									<DropdownMenuItem>
										<Forward className="mr-2 h-4 w-4" /> {t('common.threadDisplay.forward')}
									</DropdownMenuItem>
									<DropdownMenuItem>{t('common.threadDisplay.markAsUnread')}</DropdownMenuItem>
									<DropdownMenuItem>{t('common.threadDisplay.addLabel')}</DropdownMenuItem>
									<DropdownMenuItem>{t('common.threadDisplay.muteThread')}</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					</div>
					<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
						<ScrollArea className="h-full flex-1" type="auto">
							<div className="pb-4">
								<MailDisplaySkeleton isFullscreen={isFullscreen} />
							</div>
						</ScrollArea>
					</div>
				</div>
			</div>
		);

	return (
		<div
			className={cn(
				'flex flex-col',
				isFullscreen ? 'h-screen' : isMobile ? 'h-full' : 'h-[calc(100vh-2rem)]',
			)}
		>
			<div
				className={cn(
					'bg-offsetLight dark:bg-offsetDark relative flex flex-col overflow-hidden transition-all duration-300',
					isMobile ? 'h-full' : 'h-full',
					!isMobile && !isFullscreen && 'rounded-r-lg',
					isFullscreen ? 'fixed inset-0 z-50' : '',
				)}
			>
				<div className="flex flex-shrink-0 items-center border-b px-1 pb-1 md:px-3 md:pb-2 md:pt-[10px]">
					<div className="flex flex-1 items-center gap-2">
						<ThreadActionButton
							icon={XIcon}
							label={t('common.actions.close')}
							disabled={!emailData}
							onClick={handleClose}
						/>
						<ThreadSubject subject={emailData[0]?.subject} isMobile={isMobile} />
					</div>
					<div className="flex items-center md:gap-6">
						<NotesPanel
							threadId={emailData?.[0]?.threadId ?? mail}
							notes={threadNotes}
							onAddNote={async (threadId, content, color) => {
								try {
									const newNote = await addNote(threadId, content, color);
									if (newNote) {
										setThreadNotes((prev) => [...prev, newNote]);
										return newNote;
									}
									toast.error(t('common.notes.errors.failedToAddNote'));
									return null;
								} catch (error) {
									toast.error(t('common.notes.errors.failedToAddNote'));
									return null;
								}
							}}
							onEditNote={async (noteId, content) => {
								const originalNotes = [...threadNotes];
								const noteToUpdate = threadNotes.find((note) => note.id === noteId);
								if (noteToUpdate) {
									setThreadNotes((prev) =>
										prev.map((note) =>
											note.id === noteId ? { ...note, content, updatedAt: new Date() } : note,
										),
									);
								}

								try {
									const updatedNote = await editNote(noteId, content);
									if (updatedNote) {
										setThreadNotes((prev) =>
											prev.map((note) => (note.id === noteId ? updatedNote : note)),
										);
										return updatedNote;
									} else {
										setThreadNotes(originalNotes);
										toast.error(t('common.notes.errors.failedToUpdateNote'));
										return null;
									}
								} catch (error) {
									setThreadNotes(originalNotes);
									toast.error(t('common.notes.errors.failedToUpdateNote'));
									return null;
								}
							}}
							onDeleteNote={async (noteId) => {
								const originalNotes = [...threadNotes];
								setThreadNotes((prev) => prev.filter((note) => note.id !== noteId));

								try {
									const success = await deleteNote(noteId);
									if (!success) {
										setThreadNotes(originalNotes);
										toast.error(t('common.notes.errors.failedToDeleteNote'));
									}
									return success;
								} catch (error) {
									setThreadNotes(originalNotes);
									toast.error(t('common.notes.errors.failedToDeleteNote'));
									return false;
								}
							}}
							onTogglePin={async (noteId) => {
								const originalNotes = [...threadNotes];
								const noteToToggle = threadNotes.find((note) => note.id === noteId);

								if (noteToToggle) {
									setThreadNotes((prev) =>
										prev.map((note) =>
											note.id === noteId ? { ...note, isPinned: !note.isPinned } : note,
										),
									);
								}

								try {
									const updatedNote = await togglePinNote(noteId);
									if (updatedNote) {
										setThreadNotes((prev) =>
											prev.map((note) => (note.id === noteId ? updatedNote : note)),
										);
										return updatedNote;
									} else {
										setThreadNotes(originalNotes);
										toast.error(t('common.notes.errors.failedToUpdateNote'));
										return null;
									}
								} catch (error) {
									setThreadNotes(originalNotes);
									toast.error(t('common.notes.errors.failedToUpdateNote'));
									return null;
								}
							}}
							onChangeColor={async (noteId, color) => {
								const originalNotes = [...threadNotes];
								setThreadNotes((prev) =>
									prev.map((note) => (note.id === noteId ? { ...note, color } : note)),
								);

								try {
									const updatedNote = await changeNoteColor(noteId, color);
									if (updatedNote) {
										setThreadNotes((prev) =>
											prev.map((note) => (note.id === noteId ? updatedNote : note)),
										);
										return updatedNote;
									} else {
										setThreadNotes(originalNotes);
										toast.error(t('common.notes.errors.failedToUpdateNoteColor'));
										return null;
									}
								} catch (error) {
									setThreadNotes(originalNotes);
									toast.error(t('common.notes.errors.failedToUpdateNoteColor'));
									return null;
								}
							}}
							onReorderNotes={async (notes) => {
								const originalNotes = [...threadNotes];
								setThreadNotes((prev) => {
									const updatedNotes = [...prev];
									notes.forEach(({ id, order, isPinned }) => {
										const index = updatedNotes.findIndex((note) => note.id === id);
										if (index !== -1) {
											updatedNotes[index] = {
												...updatedNotes[index],
												order,
												...(isPinned !== undefined && { isPinned }),
											};
										}
									});

									return sortNotes(updatedNotes);
								});

								try {
									await new Promise<void>((resolve) => {
										setTimeout(() => resolve(), 500);
									});

									const success = await reorderNotes(notes);
									if (!success) {
										setThreadNotes(originalNotes);
										toast.error(t('common.notes.errors.failedToReorderNotes'));
									}
									return success;
								} catch (error) {
									setThreadNotes(originalNotes);
									toast.error(t('common.notes.errors.failedToReorderNotes'));
									return false;
								}
							}}
						/>
						<ThreadActionButton
							icon={isFullscreen ? ExpandIcon : ExpandIcon}
							label={
								isFullscreen
									? t('common.threadDisplay.exitFullscreen')
									: t('common.threadDisplay.enterFullscreen')
							}
							disabled={!emailData}
							onClick={() => setIsFullscreen(!isFullscreen)}
						/>
						<ThreadActionButton
							icon={ArchiveIcon}
							label={t('common.threadDisplay.archive')}
							disabled={!emailData}
							className="relative top-0.5"
						/>
						<ThreadActionButton
							icon={ReplyIcon}
							label={t('common.threadDisplay.reply')}
							disabled={!emailData}
							onClick={() => setIsReplyOpen(true)}
						/>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									className="md:h-fit md:px-2"
									disabled={!emailData}
									onMouseEnter={() => moreVerticalIconRef.current?.startAnimation?.()}
									onMouseLeave={() => moreVerticalIconRef.current?.stopAnimation?.()}
								>
									<MoreVerticalIcon ref={moreVerticalIconRef} className="h-4 w-4" />
									<span className="sr-only">{t('common.threadDisplay.moreOptions')}</span>
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem>
									<ArchiveX className="mr-2 h-4 w-4" /> {t('common.threadDisplay.moveToSpam')}
								</DropdownMenuItem>
								<DropdownMenuItem>
									<ReplyAll className="mr-2 h-4 w-4" /> {t('common.threadDisplay.replyAll')}
								</DropdownMenuItem>
								<DropdownMenuItem>
									<Forward className="mr-2 h-4 w-4" /> {t('common.threadDisplay.forward')}
								</DropdownMenuItem>
								<DropdownMenuItem>{t('common.threadDisplay.markAsUnread')}</DropdownMenuItem>
								<DropdownMenuItem>{t('common.threadDisplay.addLabel')}</DropdownMenuItem>
								<DropdownMenuItem>{t('common.threadDisplay.muteThread')}</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>
				<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
					<ScrollArea className="h-full flex-1" type="auto">
						<div className="pb-4">
							{[...(emailData || [])].reverse().map((message, index) => (
								<div
									key={message.id}
									className={cn(
										'transition-all duration-200',
										index > 0 && 'border-border border-t',
									)}
								>
									<MailDisplay
										emailData={message}
										isFullscreen={isFullscreen}
										isMuted={isMuted}
										isLoading={isLoading}
										index={index}
									/>
								</div>
							))}
						</div>
					</ScrollArea>
					<div className={`relative ${isFullscreen ? '' : 'top-1'} flex-shrink-0`}>
						<ReplyCompose emailData={emailData} isOpen={isReplyOpen} setIsOpen={setIsReplyOpen} />
					</div>
				</div>
			</div>
		</div>
	);
}

<style jsx global>{`
	.hide-scrollbar {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
	.hide-scrollbar::-webkit-scrollbar {
		display: none;
	}
`}</style>;
