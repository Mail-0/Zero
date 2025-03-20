'use client'

import { getListUnsubscribeAction } from '@/lib/email-utils';
import type { ParsedMessage } from '@/types';
import { sendEmail } from '@/actions/send';

export const handleUnsubscribe = async ({ emailData }: { emailData: ParsedMessage }) => {
	try {
		if (emailData.listUnsubscribe) {
			const listUnsubscribeAction = getListUnsubscribeAction({
				listUnsubscribe: emailData.listUnsubscribe,
				listUnsubscribePost: emailData.listUnsubscribePost,
			});
			if (listUnsubscribeAction) {
				switch (listUnsubscribeAction.type) {
					case 'get':
						window.open(listUnsubscribeAction.url, '_blank');
						break;
					case 'post':
						const controller = new AbortController();
						const timeoutId = setTimeout(
							() => controller.abort(),
							10000, // 10 seconds
						);

						await fetch(listUnsubscribeAction.url, {
							mode: 'no-cors',
							method: 'POST',
							headers: {
								'content-type': 'application/x-www-form-urlencoded',
							},
							body: listUnsubscribeAction.body,
							signal: controller.signal,
						});

						clearTimeout(timeoutId);
						return true;
					case 'email':
						await sendEmail({
							to: listUnsubscribeAction.emailAddress,
							subject: listUnsubscribeAction.subject,
							message: 'Zero sent this email to unsubscribe from this mailing list.',
							attachments: [],
						});
						return true;
				}
			}
		}
	} catch (error) {
		console.log('Error unsubscribing', emailData);
		throw error;
	}
};
