'use client';

import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
} from '@/components/ui/form';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { SettingsCard } from '@/components/settings/settings-card';
import { availableLocales, locales, Locale } from '@/i18n/config';
import { useTranslations, useLocale } from 'next-intl';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Globe, Clock } from 'lucide-react';
import { changeLocale } from '@/i18n/utils';
import { useForm } from 'react-hook-form';
import { useState } from 'react';
import { toast } from 'sonner';
import * as z from 'zod';

const formSchema = z.object({
	language: z.enum(locales as [string, ...string[]]),
	timezone: z.string(),
	dynamicContent: z.boolean(),
	externalImages: z.boolean(),
});

export default function GeneralPage() {
	const [isSaving, setIsSaving] = useState(false);
	const locale = useLocale();
	const t = useTranslations();

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			language: locale as Locale,
			timezone: 'UTC',
			dynamicContent: false,
			externalImages: true,
		},
	});

	function onSubmit(values: z.infer<typeof formSchema>) {
		setIsSaving(true);

		// TODO: Save settings in user's account

		changeLocale(values.language as Locale);

		if (values.language !== locale) {
			const localeName = new Intl.DisplayNames([values.language], { type: 'language' }).of(
				values.language,
			);
			toast.success(t('pages.settings.general.languageChangedTo', { language: localeName }));
		}

		// Simulate API call
		setTimeout(() => {
			console.log(values);
			setIsSaving(false);
		}, 1000);
	}

	return (
		<div className="grid gap-6">
			<SettingsCard
				title={t('pages.settings.general.title')}
				description={t('pages.settings.general.description')}
				footer={
					<Button type="submit" form="general-form" disabled={isSaving}>
						{isSaving ? t('common.actions.saving') : t('common.actions.saveChanges')}
					</Button>
				}
			>
				<Form {...form}>
					<form id="general-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
						<div className="flex w-full items-center gap-5">
							<FormField
								control={form.control}
								name="language"
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t('pages.settings.general.language')}</FormLabel>
										<Select onValueChange={field.onChange} defaultValue={field.value}>
											<FormControl>
												<SelectTrigger className="w-36">
													<Globe className="mr-2 h-4 w-4" />
													<SelectValue placeholder="Select a language" />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												{availableLocales.map((locale) => (
													<SelectItem key={locale.code} value={locale.code}>
														{locale.name}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="timezone"
								render={({ field }) => (
									// TODO: Add all timezones
									<FormItem>
										<FormLabel>{t('pages.settings.general.timezone')}</FormLabel>
										<Select onValueChange={field.onChange} defaultValue={field.value}>
											<FormControl>
												<SelectTrigger className="w-36">
													<Clock className="mr-2 h-4 w-4" />
													<SelectValue placeholder="Select a timezone" />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												<SelectItem value="UTC">UTC</SelectItem>
												<SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
												<SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
												<SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
												<SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
												<SelectItem value="Europe/London">British Time (BST)</SelectItem>
												<SelectItem value="Europe/Paris">Central European Time (CET)</SelectItem>
												<SelectItem value="Asia/Tokyo">Japan Standard Time (JST)</SelectItem>
											</SelectContent>
										</Select>
									</FormItem>
								)}
							/>
						</div>
						<div className="flex w-full items-center gap-5">
							<FormField
								control={form.control}
								name="dynamicContent"
								render={({ field }) => (
									<FormItem className="bg-popover flex flex-row items-center justify-between rounded-lg border p-4">
										<div className="space-y-0.5">
											<FormLabel className="text-base">
												{t('pages.settings.general.dynamicContent')}
											</FormLabel>
											<FormDescription>
												{t('pages.settings.general.dynamicContentDescription')}
											</FormDescription>
										</div>
										<FormControl className="ml-4">
											<Switch checked={field.value} onCheckedChange={field.onChange} />
										</FormControl>
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="externalImages"
								render={({ field }) => (
									<FormItem className="bg-popover flex flex-row items-center justify-between rounded-lg border p-4">
										<div className="space-y-0.5">
											<FormLabel className="text-base">
												{t('pages.settings.general.externalImages')}
											</FormLabel>
											<FormDescription>
												{t('pages.settings.general.externalImagesDescription')}
											</FormDescription>
										</div>
										<FormControl className="ml-4">
											<Switch checked={field.value} onCheckedChange={field.onChange} />
										</FormControl>
									</FormItem>
								)}
							/>
						</div>
					</form>
				</Form>
			</SettingsCard>
		</div>
	);
}
