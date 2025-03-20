'use client';

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from '@/components/ui/accordion';
import { COOKIE_CATEGORIES, type CookieCategory } from '@/lib/cookies';
import { useCookies } from '@/providers/cookie-provider';
import { CookieTrigger } from './cookie-trigger';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useState, useEffect } from 'react';
import { X, Cookie } from 'lucide-react';

interface CookieConsentProps {
	children?: React.ReactNode;
	showFloatingButton?: boolean;
}

export function CookieConsent({ children, showFloatingButton = true }: CookieConsentProps) {
	const [open, setOpen] = useState(false);
	const [showBanner, setShowBanner] = useState(false);
	const { preferences, updatePreference, acceptAll, rejectAll, isLoaded } = useCookies();

	useEffect(() => {
		if (isLoaded && !Object.values(preferences).some((value) => value)) {
			const timer = setTimeout(() => {
				setShowBanner(true);
			}, 1000);
			return () => clearTimeout(timer);
		}
	}, [isLoaded, preferences]);

	const handleSavePreferences = () => {
		setOpen(false);
		setShowBanner(false);
	};

	const handleAcceptAll = () => {
		acceptAll();
		setOpen(false);
		setShowBanner(false);
	};

	const handleRejectAll = () => {
		rejectAll();
		setOpen(false);
		setShowBanner(false);
	};

	return (
		<>
			{showFloatingButton && (
				<div className="fixed bottom-4 right-4 z-50">
					<CookieTrigger variant="icon" onClick={() => setOpen(true)} />
				</div>
			)}

			<Dialog open={open} onOpenChange={setOpen}>
				{children && (
					<DialogTrigger asChild onClick={() => setOpen(true)}>
						{children}
					</DialogTrigger>
				)}
				<DialogContent className="flex max-h-[90vh] flex-col gap-0 border-zinc-200 bg-white p-0 outline-none dark:border-zinc-800 dark:bg-black">
					<div className="border-zinc-200 px-6 py-6 dark:border-zinc-800">
						<DialogHeader>
							<DialogTitle className="my-2 text-xl text-zinc-900 dark:text-zinc-100">
								Cookie Settings
							</DialogTitle>
							<DialogDescription className="space-y-4">
								<span className="block text-sm text-zinc-600 dark:text-zinc-400">
									We use cookies and similar technologies to help personalize content, tailor and
									measure ads, and provide a better experience. By clicking "Accept All", you
									consent to all cookies. You can customize your choices by clicking "Customize" or
									reject all optional cookies by clicking "Reject All".
								</span>
								<span className="block text-sm text-zinc-600 dark:text-zinc-400">
									For California residents (CCPA): We do not sell your personal information.
									However, some cookies collect data for targeted advertising. To opt out of the
									sale of your data for targeted advertising purposes, click "Reject All" or disable
									Marketing cookies below.
								</span>
								<span className="block text-sm text-zinc-600 dark:text-zinc-400">
									You can change your preferences at any time by clicking the cookie settings button
									in the corner of the screen. For more information about how we use cookies, please
									see our{' '}
									<a href="/privacy" className="text-blue-500 hover:underline">
										Privacy Policy
									</a>
									.
								</span>
							</DialogDescription>
						</DialogHeader>
					</div>

					<div className="flex-1 overflow-y-auto px-6 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-200 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-800 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-2">
						<div className="space-y-6 pb-4">
							<Accordion type="multiple" className="space-y-4">
								{(
									Object.entries(COOKIE_CATEGORIES) as [
										CookieCategory,
										(typeof COOKIE_CATEGORIES)[CookieCategory],
									][]
								).map(([category, info]) => (
									<AccordionItem
										key={category}
										value={category}
										className="rounded-lg border border-zinc-200 px-4 dark:border-zinc-800"
									>
										<div className="flex items-center justify-between py-4">
											<div className="flex items-center space-x-2">
												<Label
													htmlFor={category}
													className="font-medium text-zinc-900 dark:text-zinc-100"
												>
													{info.name}
													{info.required && (
														<span className="ml-2 text-xs text-zinc-600 dark:text-zinc-400">
															(Required)
														</span>
													)}
												</Label>
											</div>
											<Switch
												id={category}
												checked={preferences[category]}
												disabled={info.required}
												onCheckedChange={(checked) => updatePreference(category, checked)}
												className="data-[state=checked]:bg-blue-600"
											/>
										</div>
										<AccordionTrigger className="mb-2 py-0 text-sm text-zinc-600 hover:no-underline dark:text-zinc-400 [&[data-state=open]>svg]:rotate-180">
											More information
										</AccordionTrigger>
										<AccordionContent className="pb-4 pt-2">
											<div className="space-y-3">
												<p className="text-sm text-zinc-600 dark:text-zinc-400">
													{info.description}
												</p>
												<div>
													<p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
														Duration:
													</p>
													<p className="text-sm text-zinc-600 dark:text-zinc-400">
														{category === 'necessary'
															? 'Session - These cookies are deleted when you close your browser'
															: category === 'functional'
																? '1 year - To remember your preferences'
																: category === 'analytics'
																	? '2 years - To maintain consistent analytics data'
																	: '90 days - Regular refresh of marketing preferences'}
													</p>
												</div>
												<div>
													<p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
														Provider:
													</p>
													<p className="text-sm text-zinc-600 dark:text-zinc-400">
														{category === 'necessary'
															? 'First party - Set by us'
															: category === 'functional'
																? 'First party and selected third parties'
																: category === 'analytics'
																	? 'Google Analytics and similar services'
																	: 'Various advertising partners'}
													</p>
												</div>
											</div>
										</AccordionContent>
									</AccordionItem>
								))}
							</Accordion>
						</div>
					</div>

					<div className="border-t border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-black">
						<div className="flex flex-col-reverse sm:flex-row sm:justify-between sm:space-x-2">
							<div className="mt-2 flex flex-1 gap-2 sm:mt-0">
								<Button
									variant="outline"
									className="flex-1 border-zinc-200 bg-transparent text-zinc-900 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-900"
									onClick={handleRejectAll}
								>
									Reject All
								</Button>
								<Button
									variant="outline"
									className="flex-1 border-zinc-200 bg-transparent text-zinc-900 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-900"
									onClick={handleAcceptAll}
								>
									Accept All
								</Button>
							</div>
							<Button
								onClick={handleSavePreferences}
								className="flex-1 bg-black text-white hover:bg-zinc-800 sm:flex-none dark:bg-white dark:text-black dark:hover:bg-white"
							>
								Save Preferences
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			{showBanner && (
				<Card className="animate-in fade-in slide-in-from-bottom-4 fixed bottom-4 left-4 right-4 z-40 border-zinc-200 bg-white p-4 shadow-lg duration-300 md:left-auto md:right-4 md:max-w-md dark:border-zinc-800 dark:bg-black">
					<div className="mb-4 flex items-start justify-between">
						<div className="flex items-center gap-2">
							<Cookie className="h-5 w-5 text-zinc-900 dark:text-zinc-100" />
							<h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Cookie Preferences</h3>
						</div>
						<Button
							variant="ghost"
							size="icon"
							onClick={() => setShowBanner(false)}
							className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
						>
							<X className="h-4 w-4" />
							<span className="sr-only">Close</span>
						</Button>
					</div>
					<p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
						We use cookies to enhance your experience. By continuing to visit this site you agree to
						our use of cookies. For California residents: We do not sell personal information, but
						some cookies enable targeted advertising.
					</p>
					<div className="flex flex-wrap gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => setOpen(true)}
							className="border-zinc-200 bg-transparent text-zinc-900 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-900"
						>
							Customize
						</Button>
						<Button
							size="sm"
							onClick={handleAcceptAll}
							className="bg-blue-600 text-white hover:bg-blue-700"
						>
							Accept All
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={handleRejectAll}
							className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
						>
							Reject All
						</Button>
					</div>
				</Card>
			)}
		</>
	);
}
