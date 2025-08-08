import { test, expect } from '@playwright/test';

test.describe('Search Bar Functionality', () => {
  test('should apply and clear multiple filters from the command palette', async ({ page }) => {
    await page.goto('/mail/inbox');
    await page.waitForLoadState('domcontentloaded');
    console.log('Successfully accessed mail inbox')

    await page.waitForTimeout(2000)

    try {
      const welcomeModal = page.getByText('Welcome to Zero Email!')
      if (await welcomeModal.isVisible({ timeout: 2000 })) {
        console.log('Onboarding modal detected, clicking outside to dismiss')
        await page.locator('body').click({ position: { x: 100, y: 100 } })
        await page.waitForTimeout(1500)
        console.log('Modal successfully dismissed')
      }
    } catch {
      console.log('No onboarding modal found, proceeding')
    }

    await expect(page.getByText('Inbox')).toBeVisible()
    console.log('Confirmed we are in the inbox')

    const filtersToTest = ["With Attachments", "Last 7 Days", "Starred Emails"]
    
    for (const filterText of filtersToTest) {
      console.log(`Testing filter: ${filterText}`)
      
      console.log(`Opening command palette with Meta+k`)
      await page.keyboard.press(`Meta+k`)
      
      const dialogLocator = page.locator('[cmdk-dialog], [role="dialog"]')
      await expect(dialogLocator.first()).toBeVisible({ timeout: 5000 })
      console.log('Command palette dialog is visible')

      const itemLocator = page.getByText(filterText, { exact: true })
      await expect(itemLocator).toBeVisible()
      console.log(`Found "${filterText}" item, attempting to click`)
      await itemLocator.click()
      console.log(`Successfully clicked "${filterText}"`)

      await expect(dialogLocator.first()).not.toBeVisible({ timeout: 5000 })
      console.log('Command palette dialog has closed')
      
      console.log('Looking for the "Clear" button in the search bar')
      const clearButton = page.getByRole('button', { name: 'Clear', exact: true })
      await expect(clearButton).toBeVisible({ timeout: 5000 })
      console.log('"Clear" button is visible, confirming filter is active')

      console.log('Waiting 4 seconds for filter results to load')
      await page.waitForTimeout(4000)
      
      await clearButton.click()
      console.log('Clicked the "Clear" button')

      await expect(clearButton).not.toBeVisible({ timeout: 5000 })
      console.log('Filter cleared successfully')
    }

    console.log(`Test completed: Successfully applied and cleared ${filtersToTest.length} filters`)
  })
})
