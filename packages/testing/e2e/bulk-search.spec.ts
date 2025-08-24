import { test, expect } from '@playwright/test';

test.describe('AI Chat Sidebar', () => {
  test('should perform bulk actions via AI chat', async ({ page }) => {
    await page.goto('/mail/inbox?aiSidebar=true');
    await page.waitForLoadState('domcontentloaded');
    console.log('Successfully accessed mail inbox with AI sidebar');

    await page.waitForTimeout(2000);
    try {
      const welcomeModal = page.getByText('Welcome to Zero Email!');
      if (await welcomeModal.isVisible({ timeout: 2000 })) {
        console.log('Onboarding modal detected, clicking outside to dismiss...');
        await page.locator('body').click({ position: { x: 100, y: 100 } });
        await page.waitForTimeout(1500);
        console.log('Modal successfully dismissed');
      }
    } catch {
      console.log('No onboarding modal found, proceeding...');
    }

    await expect(page.getByText('Inbox')).toBeVisible();
    console.log('Mail inbox is now visible');
    await page.waitForTimeout(2000);

    console.log('Looking for AI chat editor...');
    const editor = page.locator('.ProseMirror[contenteditable="true"]');
    await expect(editor).toBeVisible();
    console.log('AI chat editor is visible');
    
    console.log('Typing first command into AI chat');
    await editor.click();
    await page.keyboard.type('Find all emails from the last week and summarize them');
    await page.locator('button[form="ai-chat-form"]').click();
    console.log('First command sent');

    console.log('Waiting for first AI response...');
    await page.waitForFunction(() => {
      const assistantMessages = document.querySelectorAll('[data-message-role="assistant"]');
      return assistantMessages.length > 0 && (assistantMessages[assistantMessages.length - 1].textContent?.trim().length || 0) > 0;
    });
    await expect(page.getByText('zero is thinking...')).not.toBeVisible();
    console.log('First AI response completed');

    console.log('Clearing editor and typing second command');
    await editor.click();
    await page.keyboard.press('Meta+a');
    await page.keyboard.type('search for the last five invoices and tell me what are they');
    await page.locator('button[form="ai-chat-form"]').click();
    console.log('Second command sent');

    console.log('Waiting for second AI response...');
    await page.waitForFunction(() => {
      const assistantMessages = document.querySelectorAll('[data-message-role="assistant"]');
      return assistantMessages.length >= 2 && (assistantMessages[1].textContent?.trim().length || 0) > 0;
    });
    await expect(page.getByText('zero is thinking...')).not.toBeVisible();
    console.log('Second AI response completed');

    console.log('AI chat test completed successfully!');
  });
});
