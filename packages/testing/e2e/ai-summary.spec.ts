import { test, expect } from '@playwright/test';

const email = process.env.EMAIL;

if (!email) {
  throw new Error('EMAIL environment variable must be set.');
}

test.describe('AI Chat Email Summarization', () => {
  test('should summarize emails and display the result', async ({ page }) => {
    await page.goto('/mail/inbox');
    await page.waitForLoadState('domcontentloaded');
    console.log('Successfully accessed mail inbox');

    await page.waitForTimeout(2000);
    try {
      const welcomeModal = page.getByText('Welcome to Zero Email!');
      if (await welcomeModal.isVisible({ timeout: 2000 })) {
        console.log('Onboarding modal detected, dismissing...');
        await page.locator('body').click({ position: { x: 100, y: 100 } });
        await page.waitForTimeout(1500);
        console.log('Modal successfully dismissed');
      }
    } catch {
      console.log('No onboarding modal found, proceeding...');
    }
    
    await expect(page.getByText('Inbox')).toBeVisible();
    console.log('Mail inbox is now visible');

    console.log('Opening AI chat sidebar with keyboard shortcut...');
    await page.keyboard.press('Meta+0');
    await expect(page.locator('form#ai-chat-form')).toBeVisible({ timeout: 10000 });
    console.log('AI chat sidebar opened successfully');

    const chatInput = page.locator('form#ai-chat-form [contenteditable="true"]').first();
    await chatInput.click();
    await chatInput.fill('Please summarise the past five emails');
    await page.keyboard.press('Enter');
    console.log('Sent summarization query by pressing Enter');

    console.log('Waiting for AI response...');
    
    const assistantMessage = page.locator('[data-message-role="assistant"]').last();
    await expect(assistantMessage).toBeVisible({ timeout: 15000 });
    
    const responseText = await assistantMessage.textContent();

    console.log('AI Response Text:', responseText);
    expect(responseText).toBeTruthy();
    expect(responseText!.length).toBeGreaterThan(15);
    
    console.log('Test completed: AI summarization successful!');
  });
});