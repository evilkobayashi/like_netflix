import { test, expect } from '@playwright/test';

test('login and dashboard flow', async ({ page }) => {
  await page.route('**/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ accessToken: 'demo-token', refreshToken: 'demo-refresh' })
    });
  });

  await page.route('**/dashboard/overview', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ activeUsers: 12, pendingApprovals: 3, automationSuccessRate: 9 })
    });
  });

  await page.goto('http://localhost:5173/login');
  await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText('Active Users')).toBeVisible();
  await expect(page.getByText('12')).toBeVisible();
});
