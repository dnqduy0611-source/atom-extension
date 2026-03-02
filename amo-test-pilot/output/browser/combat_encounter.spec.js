import { test, expect } from '@playwright/test';

test.describe('Flow: Combat Encounter', () => {
    test.beforeEach(async ({ page }) => {
        await page.route('**/api/story/stream-scene-next*', route => route.fulfill({
            status: 200,
            contentType: 'text/event-stream',
            body: 'event: status\ndata: {"status":"generating"}\n\nevent: scene_prose\ndata: {"text":"A fierce enemy appears!"}\n\nevent: combat_start\ndata: {"phase":"initiative"}\n\nevent: combat_action\ndata: {"actions":["Attack","Defend","Flee"]}\n\nevent: combat_resolve\ndata: {"outcome":"victory"}\n\nevent: done\ndata: {}\n\n',
        }));
        await page.goto('http://localhost:5173');
        await page.waitForSelector('[data-testid="view-game"].active', { state: 'visible' });
    });

    test('should detect combat panel and select action', async ({ page }) => {
        await page.waitForSelector('[data-testid="game-combat-panel"]', { state: 'visible' });
        await expect(page.locator('[data-testid="game-combat-title"]')).toHaveText('Combat Encounter');
        await expect(page.locator('[data-testid="game-combat-phases"]')).toHaveText('Initiative');
        
        const combatActions = await page.locator('[data-testid="game-combat-preview"]').allTextContents();
        expect(combatActions).toContain('Attack');
        expect(combatActions).toContain('Defend');
        expect(combatActions).toContain('Flee');
        
        await page.click('[data-testid="game-combat-submit"]');
        await page.waitForSelector('[data-testid="game-combat-panel"]', { state: 'hidden' });
    });

    test('should verify combat resolution', async ({ page }) => {
        await page.waitForSelector('[data-testid="game-combat-panel"]', { state: 'visible' });
        await page.click('[data-testid="game-combat-submit"]');
        
        await page.waitForSelector('[data-testid="game-prose-text"]', { state: 'visible' });
        const proseText = await page.locator('[data-testid="game-prose-text"]').textContent();
        expect(proseText).toContain('victory');
    });
});