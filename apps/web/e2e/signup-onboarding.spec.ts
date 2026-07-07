import { test, expect } from '@playwright/test';

// M1 definition of done: signup -> onboarding -> dashboard shell, end to end
// against the real API (no mocks) since the onboarding gate depends on a
// real profile round-trip through the immigration rules engine.
test('register, complete onboarding, and land on the dashboard shell', async ({ page }) => {
  const email = `e2e+${Date.now()}@example.com`;

  await page.goto('/register');
  await page.getByLabel('First name').fill('Ada');
  await page.getByLabel('Last name').fill('Lovelace');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('correct horse battery staple');
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole('heading', { name: "Let's set up your timeline" })).toBeVisible();

  await page.getByLabel('Major / program').fill('Computer Science');
  await page.getByLabel('Program start').fill('2024-09-01');
  await page.getByLabel('Program end').fill('2026-06-01');
  await page.getByRole('button', { name: 'Build my timeline' }).click();

  await expect(page.getByRole('heading', { name: 'Hi Ada' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Next deadlines' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Application pipeline' })).toBeVisible();
});
