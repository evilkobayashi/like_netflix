import { test, expect } from '@playwright/test';

test('login page smoke', async ({ page }) => {
  await page.goto('http://localhost:5173/login');
  await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
});
