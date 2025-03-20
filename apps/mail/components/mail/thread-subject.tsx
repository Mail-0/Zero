'use client';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ThreadSubjectProps {
	subject?: string;
	isMobile?: boolean;
}

export default function ThreadSubject({ subject, isMobile }: ThreadSubjectProps) {
	const [isOverflowing, setIsOverflowing] = useState(false);
	const textRef = useRef<HTMLSpanElement>(null);
	const subjectContent = subject || '(no subject)';

	// Check if the text is overflowing
	useEffect(() => {
		if (textRef.current) {
			const isClamped = textRef.current.scrollHeight > textRef.current.clientHeight;
			setIsOverflowing(isClamped);
		}
	}, [subject]);

	const handleCopySubject = () => {
		navigator.clipboard
			.writeText(subjectContent)
			.then(() => {
				toast.success('Subject copied to clipboard');
			})
			.catch((error) => {
				console.error(error);
				toast.error('Failed to copy subject');
			});
	};

	return (
		<div className="flex items-center gap-2">
			<Tooltip>
				<TooltipTrigger asChild>
					<span
						ref={textRef}
						className={cn(
							'line-clamp-1 block cursor-pointer font-semibold',
							!subject && 'opacity-50',
						)}
					>
						{subjectContent}
					</span>
				</TooltipTrigger>
				{isOverflowing && (
					<TooltipContent className="max-w-[600px] break-words text-base">
						{subjectContent}
					</TooltipContent>
				)}
			</Tooltip>
			{subject && isMobile && isOverflowing && (
				<Tooltip>
					<TooltipTrigger asChild>
						<Button variant="ghost" className="md:h-fit md:px-2" onClick={handleCopySubject}>
							<Copy className="h-4 w-4" />
							<span className="sr-only">Copy subject</span>
						</Button>
					</TooltipTrigger>
					<TooltipContent>Copy subject</TooltipContent>
				</Tooltip>
			)}
		</div>
	);
}
