import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { EditorProvider, useCurrentEditor } from '@tiptap/react';
import { UploadedFileIcon } from './uploaded-file-icon';
import { Separator } from '@/components/ui/separator';
import { truncateFileName } from '@/lib/utils';
import { Paperclip } from 'lucide-react';
import React from 'react';

const MenuBar = () => {
	const { editor } = useCurrentEditor();

	if (!editor) {
		return null;
	}

	return (
		<div className="control-group">
			<div className="button-group">
				<button
					onClick={() => editor.chain().focus().toggleBold().run()}
					disabled={!editor.can().chain().focus().toggleBold().run()}
					className={editor.isActive('bold') ? 'is-active' : ''}
				>
					Bold
				</button>
				<button
					onClick={() => editor.chain().focus().toggleItalic().run()}
					disabled={!editor.can().chain().focus().toggleItalic().run()}
					className={editor.isActive('italic') ? 'is-active' : ''}
				>
					Italic
				</button>
				<button
					onClick={() => editor.chain().focus().toggleStrike().run()}
					disabled={!editor.can().chain().focus().toggleStrike().run()}
					className={editor.isActive('strike') ? 'is-active' : ''}
				>
					Strike
				</button>
				<button
					onClick={() => editor.chain().focus().toggleCode().run()}
					disabled={!editor.can().chain().focus().toggleCode().run()}
					className={editor.isActive('code') ? 'is-active' : ''}
				>
					Code
				</button>
				<button onClick={() => editor.chain().focus().unsetAllMarks().run()}>Clear marks</button>
				<button onClick={() => editor.chain().focus().clearNodes().run()}>Clear nodes</button>
				<button
					onClick={() => editor.chain().focus().setParagraph().run()}
					className={editor.isActive('paragraph') ? 'is-active' : ''}
				>
					Paragraph
				</button>
				<button
					onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
					className={editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}
				>
					H1
				</button>
				<button
					onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
					className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}
				>
					H2
				</button>
				<button
					onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
					className={editor.isActive('heading', { level: 3 }) ? 'is-active' : ''}
				>
					H3
				</button>
				<button
					onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
					className={editor.isActive('heading', { level: 4 }) ? 'is-active' : ''}
				>
					H4
				</button>
				<button
					onClick={() => editor.chain().focus().toggleHeading({ level: 5 }).run()}
					className={editor.isActive('heading', { level: 5 }) ? 'is-active' : ''}
				>
					H5
				</button>
				<button
					onClick={() => editor.chain().focus().toggleHeading({ level: 6 }).run()}
					className={editor.isActive('heading', { level: 6 }) ? 'is-active' : ''}
				>
					H6
				</button>
				<button
					onClick={() => editor.chain().focus().toggleBulletList().run()}
					className={editor.isActive('bulletList') ? 'is-active' : ''}
				>
					Bullet list
				</button>
				<button
					onClick={() => editor.chain().focus().toggleOrderedList().run()}
					className={editor.isActive('orderedList') ? 'is-active' : ''}
				>
					Ordered list
				</button>
				<button
					onClick={() => editor.chain().focus().toggleCodeBlock().run()}
					className={editor.isActive('codeBlock') ? 'is-active' : ''}
				>
					Code block
				</button>
				<button
					onClick={() => editor.chain().focus().toggleBlockquote().run()}
					className={editor.isActive('blockquote') ? 'is-active' : ''}
				>
					Blockquote
				</button>
				<button onClick={() => editor.chain().focus().setHorizontalRule().run()}>
					Horizontal rule
				</button>
				<button onClick={() => editor.chain().focus().setHardBreak().run()}>Hard break</button>
				<button
					onClick={() => editor.chain().focus().undo().run()}
					disabled={!editor.can().chain().focus().undo().run()}
				>
					Undo
				</button>
				<button
					onClick={() => editor.chain().focus().redo().run()}
					disabled={!editor.can().chain().focus().redo().run()}
				>
					Redo
				</button>
				<button
					onClick={() => editor.chain().focus().setColor('#958DF1').run()}
					className={editor.isActive('textStyle', { color: '#958DF1' }) ? 'is-active' : ''}
				>
					Purple
				</button>
			</div>
		</div>
	);
};

// Define props interface for AttachmentButtons
interface AttachmentButtonsProps {
	attachments?: File[];
	onAttachmentAdd?: () => void;
	onAttachmentRemove?: (index: number) => void;
}

const AttachmentButtons = ({
	attachments = [],
	onAttachmentAdd,
	onAttachmentRemove,
}: AttachmentButtonsProps) => {
	return (
		<div className="flex items-center gap-2">
			{/* Attachment Counter Button */}
			{attachments.length > 0 && (
				<Popover>
					<PopoverTrigger asChild>
						<button
							className="bg-background hover:bg-muted rounded p-1.5"
							style={{
								display: 'inline-flex',
								alignItems: 'center',
								justifyContent: 'center',
								fontWeight: 'bold',
							}}
						>
							{attachments.length} Files
						</button>
					</PopoverTrigger>
					<PopoverContent className="w-80 touch-auto" align="end">
						<div className="space-y-2">
							<div className="px-1">
								<h4 className="font-medium leading-none">Attachments</h4>
								<p className="text-muted-foreground text-sm">
									{attachments.length} {attachments.length === 1 ? 'file' : 'files'}
								</p>
							</div>
							<Separator />
							<div className="h-[300px] touch-auto overflow-y-auto overscroll-contain px-1 py-1">
								<div className="grid grid-cols-2 gap-2">
									{attachments.map((file, index) => (
										<div key={index} className="group relative overflow-hidden rounded-md border">
											<UploadedFileIcon
												removeAttachment={(index) =>
													onAttachmentRemove && onAttachmentRemove(index)
												}
												index={index}
												file={file}
											/>
											<div className="bg-muted/10 p-2">
												<p className="text-xs font-medium">{truncateFileName(file.name, 20)}</p>
												<p className="text-muted-foreground text-xs">
													{(file.size / (1024 * 1024)).toFixed(2)} MB
												</p>
											</div>
										</div>
									))}
								</div>
							</div>
						</div>
					</PopoverContent>
				</Popover>
			)}

			{/* Add Attachment Button */}
			<button
				onClick={onAttachmentAdd}
				className="bg-background hover:bg-muted rounded p-1.5"
				title="Add attachment"
				style={{
					display: 'inline-flex',
					alignItems: 'center',
					justifyContent: 'center',
				}}
			>
				<Paperclip className="h-4 w-4" />
			</button>
		</div>
	);
};

export default () => {
	return <EditorProvider slotBefore={<MenuBar />}></EditorProvider>;
};
