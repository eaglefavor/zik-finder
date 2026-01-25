import { test, expect } from '@playwright/test';
import { supabase } from '../src/lib/supabase';

const TEST_USER_A = {
  email: `userA_${Date.now()}@test.com`,
  password: 'password123',
  name: 'Host User'
};

const TEST_USER_B = {
  email: `userB_${Date.now()}@test.com`,
  password: 'password123',
  name: 'Seeker User'
};

test.describe('ZIPS 5.0 Roommate Matcher E2E', () => {
  test.setTimeout(300000); // 5 minutes



  test('User A (Host) creates a "Have a room" listing', async ({ page }) => {
    await page.goto('/auth/signup');
    await page.fill('input[name="email"]', TEST_USER_A.email);
    await page.fill('input[name="password"]', TEST_USER_A.password);
    await page.fill('input[name="name"]', TEST_USER_A.name);
    await page.click('button[type="submit"]');
    await page.waitForNavigation();

    // Go to roommate page
    await page.click('a[href="/roommate"]');

    // Create a new listing
    await page.click('a[href="/roommate/post"]');

    // Fill out the form
    await page.click('button:has-text("I have a room to share")');
    await page.fill('textarea[name="description"]', 'A nice room available for a student.');
    await page.fill('input[name="location_area"]', 'Ifite');
    await page.fill('input[name="rent_per_person"]', '150000');
    await page.click('button:has-text("Yearly")');
    await page.click('button:has-text("Next")');

    // Upload a photo
    await page.setInputFiles('input[type="file"]', ['tests/fixtures/room.jpg']);
    await page.click('button:has-text("Create Post")');
    await page.waitForNavigation();

    // Verify the listing is in the feed
    await expect(page.locator('text=A nice room available for a student.')).toBeVisible();
    await expect(page.locator('text=Ifite')).toBeVisible();
    await expect(page.locator('text=₦150,000/yr')).toBeVisible();
  });

  test('User B (Seeker) creates a "Need a room" listing and connects with User A', async ({ page }) => {
    await page.goto('/auth/signup');
    await page.fill('input[name="email"]', TEST_USER_B.email);
    await page.fill('input[name="password"]', TEST_USER_B.password);
    await page.fill('input[name="name"]', TEST_USER_B.name);
    await page.click('button[type="submit"]');
    await page.waitForNavigation();

    // Go to roommate page
    await page.click('a[href="/roommate"]');

    // Create a new listing
    await page.click('a[href="/roommate/post"]');

    // Fill out the form
    await page.click('button:has-text("I am looking for a room")');
    await page.fill('textarea[name="description"]', 'I am a quiet and studious student looking for a room.');
    await page.fill('input[name="location_area"]', 'Anywhere');
    await page.fill('input[name="rent_per_person"]', '100000');
    await page.click('button:has-text("Semester")');
    await page.click('button:has-text("Create Post")');
    await page.waitForNavigation();

    // Verify their listing is in the feed
    await expect(page.locator('text=I am a quiet and studious student looking for a room.')).toBeVisible();

    // Find User A's listing and connect
    await page.locator('text=A nice room available for a student.').click();
    await page.click('button:has-text("Request to Pair")');

    // Should see a confirmation
    await expect(page.locator('text=Request sent!')).toBeVisible();
  });

  test('User A (Host) accepts the connection', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', TEST_USER_A.email);
    await page.fill('input[name="password"]', TEST_USER_A.password);
    await page.click('button[type="submit"]');
    await page.waitForNavigation();

    // Go to notifications (or a dedicated connections page)
    await page.click('a[href="/notifications"]');

    // Accept the request from User B
    await page.locator(`text=${TEST_USER_B.name} wants to connect!`).click();
    await page.click('button:has-text("Accept")');

    // Should see a confirmation
    await expect(page.locator('text=Connection established!')).toBeVisible();
  });

  test('User B (Seeker) can see User A\'s contact info', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', TEST_USER_B.email);
    await page.fill('input[name="password"]', TEST_USER_B.password);
    await page.click('button[type="submit"]');
    await page.waitForNavigation();

    // Go to notifications / connections
    await page.click('a[href="/notifications"]');

    // Find the accepted connection
    await page.locator(`text=You are now connected with ${TEST_USER_A.name}`).click();

    // Verify contact info is now visible
    await expect(page.locator(`text=${TEST_USER_A.email}`)).toBeVisible();
    await expect(page.locator('text=08012345678')).toBeVisible(); // This would be a simulated phone number
  });

  test('Safety: Bio trigger prevents phone numbers', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', TEST_USER_A.email);
    await page.fill('input[name="password"]', TEST_USER_A.password);
    await page.click('button[type="submit"]');
    await page.waitForNavigation();

    await page.goto('/roommate/post');

    await page.fill('textarea[name="description"]', 'My phone number is 08012345678, please call me.');

    // The backend should strip this, so the listing will be created but the phone number will be gone.
    await page.click('button:has-text("Create Post")');
    await page.waitForNavigation();

    await expect(page.locator('text=My phone number is [REDACTED], please call me.')).toBeVisible();
  });
});
