$path = "c:\Dev\ATOM\python\ATOM_Extension_V5.9\background.js"
$content = Get-Content $path -Raw -Encoding UTF8

$pattern = "if \(message\.type === 'ATOM_TEST_NOTIFICATION'\) \{[\s\S]*?return true; // async response[\s]*\}"

$newBlock = @"
    if (message.type === 'ATOM_TEST_NOTIFICATION') {
        const title = chrome.i18n.getMessage("opt_notif_test_title") || "ATOM - Test Notification";
        const msgBody = chrome.i18n.getMessage("opt_notif_test_msg") || "If you see this, notifications are working normally!";
        
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: title,
            message: msgBody,
            priority: 2
        }, (notificationId) => {
            if (chrome.runtime.lastError) {
                console.error('[ATOM] Test notification error:', chrome.runtime.lastError.message);
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
            } else {
                console.log('[ATOM] Test notification created:', notificationId);
                sendResponse({ success: true, id: notificationId });
            }
        });
        return true; // async response
    }
"@

$newContent = [regex]::Replace($content, $pattern, $newBlock)
Set-Content -Path $path -Value $newContent -Encoding UTF8
Write-Host "Fixed ATOM_TEST_NOTIFICATION handler"
