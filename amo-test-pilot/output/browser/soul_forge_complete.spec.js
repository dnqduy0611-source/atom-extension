import { test, expect } from '@playwright/test';

test.describe('Flow: Soul Forge Complete', () => {
    test.beforeEach(async ({ page }) => {
        // Mock API routes
        await page.route('**/api/soul-forge/start', route => route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                session_id: 'test-session',
                scene: {
                    phase: "The Void Between",
                    title: "The First Question",
                    text: "You find yourself in an endless void. What do you reach for first?",
                    choices: ["Light", "Sound", "Touch", "Nothing"],
                    progress: 0.2
                }
            })
        }));

        await page.route('**/api/soul-forge/choice', route => route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                session_id: 'test-session',
                scene: {
                    phase: "The Second Trial",
                    title: "The Weight of Choice",
                    text: "Your choice echoes through the void. What do you do next?",
                    choices: ["Follow the echo", "Create your own sound", "Silence everything", "Listen carefully"],
                    progress: 0.4
                }
            })
        }));

        await page.route('**/api/soul-forge/fragment', route => route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                session_id: 'test-session',
                status: "fragment_accepted",
                next_phase: "The Forging"
            })
        }));

        await page.route('**/api/soul-forge/forge', route => route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                session_id: 'test-session',
                result: {
                    name: "Echo Walker",
                    skill: "Resonance",
                    description: "You can manipulate the echoes of your choices to alter reality slightly",
                    resonance: 0.75
                }
            })
        }));

        await page.goto('http://localhost:5173');
        await page.waitForSelector('[data-testid="view-soul-forge"].active');
    });

    test('should complete all soul forge phases', async ({ page }) => {
        // Phase 1
        await expect(page.locator('[data-testid="forge-phase"]')).toHaveText("The Void Between");
        await page.locator('[data-testid="forge-choices"] button').first().click();
        
        // Phase 2
        await page.waitForSelector('[data-testid="forge-phase"]:has-text("The Second Trial")');
        await page.locator('[data-testid="forge-choices"] button').nth(1).click();
        
        // Phase 3
        await page.waitForSelector('[data-testid="forge-phase"]:has-text("The Third Challenge")');
        await page.locator('[data-testid="forge-choices"] button').last().click();
        
        // Phase 4
        await page.waitForSelector('[data-testid="forge-phase"]:has-text("The Fourth Reflection")');
        await page.locator('[data-testid="forge-choices"] button').first().click();
        
        // Phase 5
        await page.waitForSelector('[data-testid="forge-phase"]:has-text("The Final Revelation")');
        await page.locator('[data-testid="forge-choices"] button').nth(2).click();
        
        // Fragment Phase
        await page.waitForSelector('[data-testid="forge-fragment"]');
        await page.locator('[data-testid="forge-fragment-input"]').fill("This is my soul's fragment");
        await page.locator('[data-testid="forge-bs-occupation"]').fill("Wanderer");
        await page.locator('[data-testid="forge-bs-trait"]').fill("Curious");
        await page.locator('[data-testid="forge-bs-memory"]').fill("The first time I heard an echo");
        await page.locator('[data-testid="forge-submit-fragment"]').click();
        
        // Forge Phase
        await page.waitForSelector('[data-testid="forge-name-input"]');
        await page.locator('[data-testid="forge-name-input"]').fill("Echo");
        await page.locator('[data-testid="forge-submit-go"]').click();
        
        // Result Phase
        await page.waitForSelector('[data-testid="forge-result"]');
        await expect(page.locator('[data-testid="forge-skill-name"]')).toHaveText("Resonance");
        await page.locator('[data-testid="forge-submit-continue"]').click();
        
        await page.waitForSelector('[data-testid="view-story-setup"].active');
    });

    test('should show proper progress during soul forge', async ({ page }) => {
        const progressBar = page.locator('[data-testid="forge-progress"]');
        
        // Initial progress
        await expect(progressBar).toHaveCSS('width', /20%/);
        
        // After first choice
        await page.locator('[data-testid="forge-choices"] button').first().click();
        await page.waitForSelector('[data-testid="forge-phase"]:has-text("The Second Trial")');
        await expect(progressBar).toHaveCSS('width', /40%/);
        
        // After second choice
        await page.locator('[data-testid="forge-choices"] button').first().click();
        await expect(progressBar).toHaveCSS('width', /60%/);
        
        // After fragment submission
        await page.locator('[data-testid="forge-fragment-input"]').fill("Fragment");
        await page.locator('[data-testid="forge-submit-fragment"]').click();
        await expect(progressBar).toHaveCSS('width', /80%/);
        
        // After forging
        await page.locator('[data-testid="forge-name-input"]').fill("Name");
        await page.locator('[data-testid="forge-submit-go"]').click();
        await expect(progressBar).toHaveCSS('width', /100%/);
    });

    test('should validate fragment input before submission', async ({ page }) => {
        // Advance to fragment phase
        for (let i = 0; i < 5; i++) {
            await page.locator('[data-testid="forge-choices"] button').first().click();
            await page.waitForTimeout(200);
        }
        
        // Try submitting empty fragment
        await page.locator('[data-testid="forge-submit-fragment"]').click();
        await expect(page.locator('[data-testid="forge-fragment-input"]')).toHaveClass(/error/);
        
        // Fill required fields
        await page.locator('[data-testid="forge-fragment-input"]').fill("Valid fragment");
        await page.locator('[data-testid="forge-bs-occupation"]').fill("Occupation");
        await page.locator('[data-testid="forge-bs-trait"]').fill("Trait");
        await page.locator('[data-testid="forge-bs-memory"]').fill("Memory");
        
        // Submit should work now
        await page.locator('[data-testid="forge-submit-fragment"]').click();
        await page.waitForSelector('[data-testid="forge-name-input"]');
    });

    test('should validate name input before forging', async ({ page }) => {
        // Advance to name phase
        for (let i = 0; i < 5; i++) {
            await page.locator('[data-testid="forge-choices"] button').first().click();
            await page.waitForTimeout(200);
        }
        await page.locator('[data-testid="forge-fragment-input"]').fill("Fragment");
        await page.locator('[data-testid="forge-submit-fragment"]').click();
        
        // Try submitting empty name
        await page.locator('[data-testid="forge-submit-go"]').click();
        await expect(page.locator('[data-testid="forge-name-input"]')).toHaveClass(/error/);
        
        // Fill name
        await page.locator('[data-testid="forge-name-input"]').fill("Valid Name");
        await page.locator('[data-testid="forge-submit-go"]').click();
        await page.waitForSelector('[data-testid="forge-result"]');
    });
});