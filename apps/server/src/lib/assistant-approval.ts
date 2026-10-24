import type { AssistantContext } from './assistant';

/** Keiki owns presentation delivery, provider credentials and purchased-line checks.
 * A presentation request is never evidence of delivery or owner approval.
 */
export function assistantAppPresentation(context: AssistantContext, id: string, url: string) {
  if (
    context.channel.channel !== 'sms' ||
    context.channel.isDirect !== true ||
    context.channel.userId !== context.phone
  )
    return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return undefined;
  } catch {
    return undefined;
  }
  // Zero hosts a web review page, not a native iMessage extension. A normal
  // app card opens the page in the launcher; `live` is not a webview toggle.
  return {
    type: 'app' as const,
    id,
    url,
    caption: 'Review Zero action',
    subcaption: 'Sign in to review and approve',
  };
}
