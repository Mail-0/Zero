'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PluginOptionsForm } from '@/components/plugin/plugin-options-form';
import { SettingsCard } from '@/components/settings/settings-card';
import { getAllPluginSettings } from '@/actions/plugin-settings';
import { uninstallPlugin } from '@/actions/plugin-uninstall';
import { installPlugin } from '@/actions/plugin-install';
import { useCallback, useEffect, useState } from 'react';
import { Separator } from '@/components/ui/separator';
import { pluginManager } from '@/lib/plugin-manager';
import { usePlugins } from '@/hooks/use-plugins';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/auth-client';
import { Loader2, Trash2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function PluginsPage() {
	const { plugins } = usePlugins();
	const { data: session } = useSession();
	const [enabledStates, setEnabledStates] = useState<Record<string, boolean>>({});
	const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>();
	const [installedPlugins, setInstalledPlugins] = useState<{
		[k: string]: { enabled: boolean; added: boolean };
	}>({});

	useEffect(() => {
		const loadPluginStates = async () => {
			if (!session?.user?.id) return;

			try {
				const settings = await getAllPluginSettings();
				setInstalledPlugins(settings);

				const states: Record<string, boolean> = {};
				for (const pluginId of Object.keys(settings)) {
					states[pluginId] = pluginManager.isPluginEnabled(pluginId);
				}
				setEnabledStates(states);
			} catch (error) {
				console.error('Failed to load plugin states:', error);
				toast.error('Failed to load plugin settings');
			}
		};

		loadPluginStates();
	}, [session?.user?.id]);

	const handleTogglePlugin = useCallback(
		async (pluginId: string, enabled: boolean) => {
			if (!session?.user?.id) {
				toast.error('Please sign in to manage plugins');
				return;
			}

			setLoadingStates((prev) => ({ ...prev, [pluginId]: true }));

			try {
				await pluginManager.setPluginEnabled(pluginId, enabled);
				setEnabledStates((prev) => ({ ...prev, [pluginId]: enabled }));
				toast.success(`Plugin ${enabled ? 'enabled' : 'disabled'} successfully`, {
					duration: 2000,
				});
			} catch (error) {
				console.error('Failed to toggle plugin:', error);
				toast.error('Failed to toggle plugin', { duration: 2000 });
				setEnabledStates((prev) => ({ ...prev, [pluginId]: !enabled }));
			} finally {
				setLoadingStates((prev) => ({ ...prev, [pluginId]: false }));
			}
		},
		[session?.user?.id],
	);

	const handleRemovePlugin = useCallback(
		async (pluginId: string) => {
			if (!session?.user?.id) {
				toast.error('Please sign in to manage plugins');
				return;
			}

			setLoadingStates((prev) => ({ ...prev, [pluginId]: true }));

			try {
				await uninstallPlugin(pluginId);

				setInstalledPlugins((prev) => {
					const next = { ...prev };
					delete next[pluginId];
					return next;
				});

				toast.success('Plugin removed successfully');
			} catch (error) {
				console.error('Failed to remove plugin:', error);
				toast.error(error instanceof Error ? error.message : 'Failed to remove plugin');
			} finally {
				setLoadingStates((prev) => ({ ...prev, [pluginId]: false }));
			}
		},
		[session?.user?.id],
	);

	const handleInstallPlugin = useCallback(
		async (pluginId: string) => {
			if (!session?.user?.id) {
				toast.error('Please sign in to manage plugins');
				return;
			}

			setLoadingStates((prev) => ({ ...prev, [pluginId]: true }));

			// Optimistic update: mark as installed and enabled
			setInstalledPlugins((prev) => ({ ...prev, [pluginId]: { enabled: true, added: true } }));
			setEnabledStates((prev) => ({ ...prev, [pluginId]: true }));

			try {
				await installPlugin(pluginId);
				await pluginManager.setPluginEnabled(pluginId, true);
				toast.success('Plugin installed');
			} catch (error) {
				console.error('Failed to install plugin:', error);
				// Roll back optimistic update
				setInstalledPlugins((prev) => {
					const next = { ...prev };
					delete next[pluginId];
					return next;
				});
				setEnabledStates((prev) => ({ ...prev, [pluginId]: false }));
				toast.error(error instanceof Error ? error.message : 'Failed to install plugin');
			} finally {
				setLoadingStates((prev) => ({ ...prev, [pluginId]: false }));
			}
		},
		[session?.user?.id],
	);

	return (
		<div className="grid gap-6">
			<SettingsCard
				title="Available Plugins"
				description="Browse plugins that are registered but not yet installed."
			>
				<div className="space-y-6">
					<div className="grid gap-4">
						{plugins.filter((p) => !installedPlugins[p.metadata.id]).length === 0 ? (
							<div className="text-muted-foreground py-8 text-center">No available plugins</div>
						) : (
							plugins
								.filter((p) => !installedPlugins[p.metadata.id])
								.map((plugin) => (
									<Card key={plugin.metadata.id}>
										<CardHeader>
											<CardTitle className="text-xl">{plugin.metadata.name}</CardTitle>
											<CardDescription>{plugin.metadata.description}</CardDescription>
										</CardHeader>
										<CardContent className="flex items-center justify-between">
											<div className="text-muted-foreground text-sm">
												Version {plugin.metadata.version} • By {plugin.metadata.author}
											</div>
											<Button
												variant="default"
												size="sm"
												onClick={() => handleInstallPlugin(plugin.metadata.id)}
												disabled={loadingStates?.[plugin.metadata.id]}
											>
												{loadingStates?.[plugin.metadata.id] ? (
													<span className="flex items-center gap-2">
														<Loader2 className="h-4 w-4 animate-spin" />
														Installing...
													</span>
												) : (
													'Stall Plugin'.replace('Stall','Install')
												)}
											</Button>
										</CardContent>
									</Card>
								))
							)}
					</div>
				</div>
			</SettingsCard>
			<SettingsCard
				title="My Plugins"
				description="Manage your installed plugins and their settings."
			>
				<div className="space-y-6">
					<div className="grid gap-4">
						{plugins.filter((p) => installedPlugins[p.metadata.id]).length === 0 ? (
							<div className="text-muted-foreground py-8 text-center">No plugins installed</div>
						) : (
							plugins
								.filter((p) => installedPlugins[p.metadata.id])
								.map((plugin) => (
									<Card key={plugin.metadata.id}>
										<CardHeader>
											<CardTitle className="text-xl">{plugin.metadata.name}</CardTitle>
											<CardDescription>{plugin.metadata.description}</CardDescription>
										</CardHeader>
										<CardContent className="space-y-6">
											<div className="space-y-4">
												<div className="flex items-center justify-between">
													<div className="flex items-center space-x-2">
														<Switch
															id={`plugin-${plugin.metadata.id}`}
															checked={enabledStates[plugin.metadata.id] ?? true}
															onCheckedChange={(checked) =>
																handleTogglePlugin(plugin.metadata.id, checked)
															}
															disabled={loadingStates?.[plugin.metadata.id]}
														/>
														<Label htmlFor={`plugin-${plugin.metadata.id}`}>
															{loadingStates?.[plugin.metadata.id] ? (
																<span className="flex items-center gap-2">
																	<Loader2 className="h-3 w-3 animate-spin" />
																	Updating...
																</span>
															) : (
																'Enabled'
															)}
														</Label>
													</div>
													<div className="flex items-center gap-2">
														<Button
															variant="ghost"
															size="sm"
															className="text-destructive hover:text-destructive hover:bg-destructive/10"
															onClick={() => handleRemovePlugin(plugin.metadata.id)}
															disabled={loadingStates?.[plugin.metadata.id]}
														>
															<Trash2 className="h-4 w-4" />
														</Button>
													</div>
												</div>
												<div className="text-muted-foreground text-sm">
													Version {plugin.metadata.version} • By {plugin.metadata.author}
												</div>
											</div>

											{plugin.options && Object.keys(plugin.options).length > 0 && (
												<>
													<Separator />
													<div className="space-y-4">
														<h3 className="font-medium">Plugin Settings</h3>
														<PluginOptionsForm
															pluginId={plugin.metadata.id}
															options={plugin.options}
														/>
													</div>
												</>
											)}
										</CardContent>
									</Card>
								))
						)}
					</div>
				</div>
			</SettingsCard>
		</div>
	);
}
