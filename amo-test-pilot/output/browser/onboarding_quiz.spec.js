import { test, expect } from '@playwright/test';

test.describe('Flow: Onboarding Quiz', () => {
    test.beforeEach(async ({ page }) => {
        await page.route('**/api/player/onboard', route => route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, user_id: 'test-user' }),
        }));
        await page.route('**/api/soul-forge/start', route => route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ session_id: 'test-session', scene: { title: 'The Void Between', text: 'You awaken in darkness...' } }),
        }));
        await page.goto('http://localhost:5173');
    });

    test('should complete onboarding quiz and transition to soul forge', async ({ page }) => {
        await page.waitForSelector('#view-onboarding.active');
        
        for (let i = 0; i < 5; i++) {
            await page.waitForSelector('#quiz-step');
            const stepText = await page.textContent('#quiz-step');
            expect(stepText).toContain(`${i + 1} / 5`);
            
            await page.waitForSelector('.quiz-answer');
            const answers = await page.$$('.quiz-answer');
            await answers[0].click();
            
            const progress = await page.$eval('#quiz-progress-fill', el => el.style.width);
            expect(progress).toBe(`${((i + 1) / 5) * 100}%`);
        }
        
        await page.waitForSelector('#view-soul-forge.active');
        const phaseLabel = await page.textContent('#forge-phase-label');
        expect(phaseLabel).toContain('Phase 1 — The Void Between');
    });

    test('should show correct quiz progress', async ({ page }) => {
        await page.waitForSelector('#view-onboarding.active');
        
        for (let i = 0; i < 3; i++) {
            await page.waitForSelector('.quiz-answer');
            const answers = await page.$$('.quiz-answer');
            await answers[0].click();
            
            const progress = await page.$eval('#quiz-progress-fill', el => el.style.width);
            expect(progress).toBe(`${((i + 1) / 5) * 100}%`);
        }
    });

    test('should transition to soul forge after last question', async ({ page }) => {
        await page.waitForSelector('#view-onboarding.active');
        
        for (let i = 0; i < 5; i++) {
            await page.waitForSelector('.quiz-answer');
            const answers = await page.$$('.quiz-answer');
            await answers[0].click();
        }
        
        await page.waitForSelector('#view-soul-forge.active');
        const sceneTitle = await page.textContent('#forge-scene-title');
        expect(sceneTitle).toBe('The Void Between');
    });
});