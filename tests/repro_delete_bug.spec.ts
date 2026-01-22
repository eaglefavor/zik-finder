import { test, expect } from '@playwright/test';

test('reproduce lodge deletion bug', async ({ page }) => {
  // 1. Setup Unique User
  const uniqueId = Date.now();
  const email = `landlord_${uniqueId}@test.com`;
  const password = 'password123';
  const name = `Landlord ${uniqueId}`;
  const phone = '08012345678';

  console.log(`Creating user: ${email}`);

  // 2. Go to Home (Trigger Auth Modal or Redirect)
  await page.goto('http://localhost:3000/?login=true');
  
  // 3. Switch to Sign Up
  await page.getByText('Create an account').click();
  
  // 4. Fill Sign Up
  await page.fill('input[type="text"]', name); // Name
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="tel"]', phone);
  await page.fill('input[type="password"]', password);
  
  // Select Landlord
  await page.getByText('Landlord').click();
  
  // Submit
  await page.getByRole('button', { name: 'Create Account' }).click();
  
  // Wait for redirect to Home or Onboarding
  await page.waitForURL('**/');
  
  console.log('Logged in.');

  // 5. Post a Lodge
  await page.goto('http://localhost:3000/post');
  
  // Step 1
  await page.fill('input[placeholder*="Lodge Name"]', `Debug Lodge ${uniqueId}`);
  await page.fill('input[placeholder*="Detailed Address"]', '123 Debug St');
  await page.fill('textarea', 'This is a debug lodge.');
  await page.getByRole('button', { name: 'Continue: Room Vacancy' }).click();
  
  // Step 2 (Default unit is usually fine, or click continue)
  // Ensure we have a unit? The form usually requires one. 
  // Code: `disabled={units.length === 0}` on Step 2 back/next buttons.
  // We need to add a unit.
  await page.click('button:has-text("Add a Vacancy Type")'); // Open modal? No, it's inline in updated code?
  // Actually checking code: "Add a Vacancy Type" is a header.
  // There is "Select Room Type..." button.
  await page.click('button:has-text("Select Room Type...")');
  await page.click('button:has-text("Standard Self-con")'); // Select type
  await page.fill('input[placeholder="Price"]', '300000');
  await page.click('button:has-text("Add this Room")');
  
  await page.getByRole('button', { name: 'Continue: Media' }).click();
  
  // Step 3 (Media) - Skip upload (uses default)
  await page.click('button:has-text("Publish Listing")');
  
  // Wait for success
  await expect(page.getByText('Lodge Published!')).toBeVisible({ timeout: 15000 });
  
  // 6. Go to Dashboard (Home)
  await page.goto('http://localhost:3000/');
  
  // Verify Lodge is visible
  await expect(page.getByText(`Debug Lodge ${uniqueId}`)).toBeVisible();
  console.log('Lodge visible on dashboard.');

  // 7. Delete Lodge
  // Find the trash button for this specific lodge
  const lodgeCard = page.locator(`div:has-text("Debug Lodge ${uniqueId}")`).first(); // Assuming card structure
  // Need to find the container that has the delete button.
  // In `page.tsx`: <button onClick={handleDelete}> <Trash2 /> </button>
  // It's inside the card.
  
  // Click Delete (Trigger Toast)
  await lodgeCard.locator('button:has(.lucide-trash-2)').click();
  
  // Click Confirmation in Toast ("Delete Forever")
  await page.getByRole('button', { name: 'Delete Forever' }).click();
  
  // 8. Verify Disappearance (Optimistic)
  await expect(page.getByText(`Debug Lodge ${uniqueId}`)).not.toBeVisible();
  console.log('Lodge deleted (optimistic).');
  
  // 9. RELOAD to check Persistence/Cache
  console.log('Reloading page...');
  await page.reload();
  await page.waitForTimeout(3000); // Wait for sync
  
  // 10. Check if it reappears
  const reappeared = await page.getByText(`Debug Lodge ${uniqueId}`).isVisible();
  if (reappeared) {
    console.error('BUG REPRODUCED: Lodge reappeared after reload.');
    throw new Error('Lodge reappeared after delete!');
  } else {
    console.log('Success: Lodge remains deleted.');
  }
});
