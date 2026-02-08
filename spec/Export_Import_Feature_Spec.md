# Export/Import Feature Specification

**Version:** 1.0
**Date:** 2026-02-08
**Status:** Draft
**Priority:** P1 (Foundation for future sync feature)

---

## 1. Overview

### 1.1 Purpose
Enable users to **backup and restore** all ATOM Extension data via JSON file export/import.

### 1.2 Goals
- ✅ **Data portability** - Transfer data between devices/browsers
- ✅ **Backup safety** - Protect against accidental data loss
- ✅ **Migration readiness** - Foundation for future account sync
- ✅ **Non-tech friendly** - Simple one-click backup/restore

### 1.3 Non-Goals (Out of Scope)
- ❌ Cloud sync (future feature)
- ❌ Selective export (only full export supported)
- ❌ Automatic scheduled backups
- ❌ Encrypted backups (v1 is plaintext JSON)

---

## 2. Use Cases

### UC1: Backup Before Reset
**Actor:** User concerned about data loss
**Flow:**
1. User opens Options page
2. Clicks "Backup All Data"
3. Downloads `atom-backup-2026-02-08.json`
4. User can now safely click "Reset" button

**Acceptance Criteria:**
- Export completes in <5 seconds for typical dataset (1000 highlights)
- Filename includes timestamp for version tracking

---

### UC2: Transfer to New Device
**Actor:** User switching from laptop to desktop
**Flow:**
1. **On old device:** Export data → `atom-backup.json`
2. Transfer file via USB/email/cloud drive
3. **On new device:** Install ATOM Extension
4. Click "Restore from Backup"
5. Select `atom-backup.json` → All data restored

**Acceptance Criteria:**
- Import preserves all highlights, settings, AI chat history
- No data corruption during transfer

---

### UC3: Rollback After Bad Update
**Actor:** User experiencing bug after extension update
**Flow:**
1. User notices data corruption after update
2. Opens Options → "Restore from Backup"
3. Selects previous backup file
4. Data restored to pre-update state

**Acceptance Criteria:**
- Import shows confirmation dialog before overwriting
- User can preview backup metadata (date, item count)

---

## 3. User Interface

### 3.1 Export Button (Options Page)

**Location:** Options page, new section "Data Management"

**UI Mockup:**
```html
<div class="settings-section">
  <h2 data-i18n="opt_data_management_title">Data Management</h2>
  <p class="section-desc" data-i18n="opt_data_management_desc">
    Backup your highlights, settings, and AI chat history.
  </p>

  <div class="data-actions">
    <!-- Export Button -->
    <button id="btnExportData" class="primary-btn">
      <span data-i18n="opt_export_data">📥 Backup All Data</span>
    </button>

    <!-- Import Button -->
    <button id="btnImportData" class="secondary-btn">
      <span data-i18n="opt_import_data">📤 Restore from Backup</span>
    </button>

    <!-- Hidden file input -->
    <input type="file" id="importFileInput" accept=".json" style="display:none">
  </div>

  <!-- Info box -->
  <div class="info-box">
    <span class="info-icon">ℹ️</span>
    <span data-i18n="opt_export_hint">
      Backup files include all your highlights, settings, and AI conversations.
      Keep them safe to restore later.
    </span>
  </div>
</div>
```

---

### 3.2 Export Flow

**Step 1: Click "Backup All Data"**
```
┌─────────────────────────────────────┐
│  Preparing backup...                │
│  ▓▓▓▓▓▓▓▓▓▓▓░░░░░░  60%            │
│                                     │
│  Collecting highlights (1234)       │
└─────────────────────────────────────┘
```

**Step 2: Download starts automatically**
```
Filename: atom-backup-2026-02-08-14-30.json
Size: 2.4 MB
```

**Step 3: Success toast**
```
✅ Backup complete! Downloaded atom-backup-2026-02-08-14-30.json
```

---

### 3.3 Import Flow

**Step 1: Click "Restore from Backup"**
→ File picker opens

**Step 2: Select JSON file**
→ Validation runs

**Step 3: Preview Dialog**
```
┌─────────────────────────────────────────────┐
│  Restore from Backup?                       │
├─────────────────────────────────────────────┤
│  File: atom-backup-2026-02-08.json          │
│  Created: Feb 8, 2026 at 2:30 PM            │
│  Version: 2.8.0                             │
│                                             │
│  📊 Contents:                                │
│  • 1,234 highlights                         │
│  • 89 AI conversations                      │
│  • Settings & preferences                   │
│                                             │
│  ⚠️ This will replace all current data.     │
│                                             │
│  ┌─────────────┐  ┌──────────────┐         │
│  │   Cancel    │  │   Restore    │         │
│  └─────────────┘  └──────────────┘         │
└─────────────────────────────────────────────┘
```

**Step 4: Restore Progress**
```
┌─────────────────────────────────────┐
│  Restoring data...                  │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░  85%          │
│                                     │
│  Importing highlights...            │
└─────────────────────────────────────┘
```

**Step 5: Success + Reload**
```
✅ Restore complete! Extension will reload in 3 seconds...
```

---

## 4. File Format

### 4.1 JSON Structure

```json
{
  "metadata": {
    "version": "2.8.0",
    "exported_at": "2026-02-08T14:30:00.000Z",
    "extension_id": "atom-extension-v2.8",
    "data_version": 1,
    "item_counts": {
      "highlights": 1234,
      "threads": 89,
      "settings": 1
    }
  },
  "data": {
    "highlights": [...],
    "threads": [...],
    "settings": {...},
    "srq_cards": [...],
    "topics": [...],
    "semantic_embeddings": [...],
    "ai_pilot_history": [...],
    "nlm_exported": [...],
    "user_preferences": {...}
  },
  "checksum": "sha256:abc123..."
}
```

### 4.2 Filename Convention
```
atom-backup-YYYY-MM-DD-HH-MM.json
```
Examples:
- `atom-backup-2026-02-08-14-30.json`
- `atom-backup-2026-02-09-09-15.json`

---

## 5. Technical Implementation

### 5.1 Export Function

**File:** `utils/data_export.js`

```javascript
/**
 * Export all extension data to JSON file
 * @returns {Promise<void>}
 */
export async function exportAllData() {
  try {
    // 1. Show progress indicator
    showExportProgress(0, 'Collecting data...');

    // 2. Get all storage data
    const data = await chrome.storage.local.get(null);
    showExportProgress(30, 'Processing highlights...');

    // 3. Count items
    const itemCounts = {
      highlights: Object.keys(data.highlights || {}).length,
      threads: Object.keys(data.threads || {}).length,
      settings: 1
    };
    showExportProgress(50, 'Preparing backup file...');

    // 4. Build export object
    const exportData = {
      metadata: {
        version: chrome.runtime.getManifest().version,
        exported_at: new Date().toISOString(),
        extension_id: 'atom-extension-v2.8',
        data_version: 1,
        item_counts: itemCounts
      },
      data: data,
      checksum: await generateChecksum(data)
    };
    showExportProgress(70, 'Generating file...');

    // 5. Convert to JSON
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    showExportProgress(90, 'Downloading...');

    // 6. Trigger download
    const filename = generateFilename();
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
    showExportProgress(100, 'Complete!');

    // 7. Success notification
    showToast(
      atomMsg('opt_export_success', `Backup complete! Downloaded ${filename}`),
      'success'
    );

  } catch (error) {
    console.error('[Export] Error:', error);
    showToast(
      atomMsg('opt_export_error', 'Failed to create backup. Please try again.'),
      'error'
    );
  }
}

/**
 * Generate timestamped filename
 * @returns {string}
 */
function generateFilename() {
  const now = new Date();
  const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const time = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
  return `atom-backup-${date}-${time}.json`;
}

/**
 * Generate SHA-256 checksum for data integrity
 * @param {Object} data
 * @returns {Promise<string>}
 */
async function generateChecksum(data) {
  const json = JSON.stringify(data);
  const buffer = new TextEncoder().encode(json);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `sha256:${hashHex}`;
}
```

---

### 5.2 Import Function

**File:** `utils/data_import.js`

```javascript
/**
 * Import data from backup JSON file
 * @param {File} file - JSON file from file input
 * @returns {Promise<void>}
 */
export async function importFromBackup(file) {
  try {
    // 1. Read file
    const text = await file.text();
    const importData = JSON.parse(text);

    // 2. Validate structure
    if (!validateBackupStructure(importData)) {
      throw new Error('Invalid backup file format');
    }

    // 3. Verify checksum
    if (!await verifyChecksum(importData)) {
      console.warn('[Import] Checksum mismatch - file may be corrupted');
      const proceed = confirm(
        atomMsg('opt_import_checksum_warning',
          'Backup file may be corrupted. Continue anyway?')
      );
      if (!proceed) return;
    }

    // 4. Show preview dialog
    const confirmed = await showImportPreview(importData);
    if (!confirmed) return;

    // 5. Clear existing data (with backup)
    showImportProgress(10, 'Creating safety backup...');
    await createSafetyBackup();

    showImportProgress(30, 'Clearing old data...');
    await chrome.storage.local.clear();

    // 6. Import data
    showImportProgress(50, 'Importing highlights...');
    await chrome.storage.local.set(importData.data);

    showImportProgress(90, 'Finalizing...');

    // 7. Success - reload extension
    showImportProgress(100, 'Complete!');

    showToast(
      atomMsg('opt_import_success', 'Restore complete! Reloading extension...'),
      'success'
    );

    setTimeout(() => {
      chrome.runtime.reload();
    }, 3000);

  } catch (error) {
    console.error('[Import] Error:', error);
    showToast(
      atomMsg('opt_import_error',
        `Failed to restore backup: ${error.message}`),
      'error'
    );
  }
}

/**
 * Validate backup file structure
 * @param {Object} data
 * @returns {boolean}
 */
function validateBackupStructure(data) {
  return (
    data.metadata &&
    data.metadata.version &&
    data.metadata.exported_at &&
    data.data &&
    typeof data.data === 'object'
  );
}

/**
 * Verify checksum integrity
 * @param {Object} importData
 * @returns {Promise<boolean>}
 */
async function verifyChecksum(importData) {
  if (!importData.checksum) return true; // No checksum in old backups

  const expectedChecksum = importData.checksum;
  const actualChecksum = await generateChecksum(importData.data);

  return expectedChecksum === actualChecksum;
}

/**
 * Show import preview dialog
 * @param {Object} importData
 * @returns {Promise<boolean>}
 */
async function showImportPreview(importData) {
  const { metadata } = importData;
  const { item_counts } = metadata;

  const message = `
    ${atomMsg('opt_import_preview_title', 'Restore from Backup?')}

    File: ${metadata.exported_at}
    Version: ${metadata.version}

    📊 Contents:
    • ${item_counts.highlights || 0} highlights
    • ${item_counts.threads || 0} AI conversations
    • Settings & preferences

    ⚠️ ${atomMsg('opt_import_warning', 'This will replace all current data.')}
  `;

  return confirm(message);
}

/**
 * Create safety backup before import
 * @returns {Promise<void>}
 */
async function createSafetyBackup() {
  const data = await chrome.storage.local.get(null);
  await chrome.storage.local.set({
    _safety_backup: {
      created_at: new Date().toISOString(),
      data: data
    }
  });
}
```

---

### 5.3 UI Integration (options.js)

```javascript
// Add to DOMContentLoaded
document.getElementById('btnExportData')?.addEventListener('click', async () => {
  await exportAllData();
});

document.getElementById('btnImportData')?.addEventListener('click', () => {
  document.getElementById('importFileInput').click();
});

document.getElementById('importFileInput')?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (file) {
    await importFromBackup(file);
  }
  e.target.value = ''; // Reset input
});
```

---

## 6. i18n Keys

### 6.1 New Keys Required (EN)

```json
{
  "opt_data_management_title": {
    "message": "Data Management"
  },
  "opt_data_management_desc": {
    "message": "Backup your highlights, settings, and AI chat history."
  },
  "opt_export_data": {
    "message": "📥 Backup All Data"
  },
  "opt_import_data": {
    "message": "📤 Restore from Backup"
  },
  "opt_export_hint": {
    "message": "Backup files include all your highlights, settings, and AI conversations. Keep them safe to restore later."
  },
  "opt_export_progress": {
    "message": "Creating backup..."
  },
  "opt_export_success": {
    "message": "Backup complete! Downloaded $1",
    "placeholders": {
      "filename": { "content": "$1" }
    }
  },
  "opt_export_error": {
    "message": "Failed to create backup. Please try again."
  },
  "opt_import_progress": {
    "message": "Restoring data..."
  },
  "opt_import_success": {
    "message": "Restore complete! Extension will reload in 3 seconds..."
  },
  "opt_import_error": {
    "message": "Failed to restore backup: $1",
    "placeholders": {
      "error": { "content": "$1" }
    }
  },
  "opt_import_checksum_warning": {
    "message": "Backup file may be corrupted. Continue anyway?"
  },
  "opt_import_preview_title": {
    "message": "Restore from Backup?"
  },
  "opt_import_warning": {
    "message": "This will replace all current data."
  }
}
```

### 6.2 Vietnamese Translations

```json
{
  "opt_data_management_title": {
    "message": "Quản lý Dữ liệu"
  },
  "opt_data_management_desc": {
    "message": "Sao lưu ghi chú, cài đặt và lịch sử trò chuyện với AI."
  },
  "opt_export_data": {
    "message": "📥 Sao lưu Toàn bộ"
  },
  "opt_import_data": {
    "message": "📤 Khôi phục từ Sao lưu"
  },
  "opt_export_hint": {
    "message": "File sao lưu bao gồm tất cả ghi chú, cài đặt và trò chuyện với AI. Giữ chúng an toàn để khôi phục sau này."
  },
  "opt_export_success": {
    "message": "Sao lưu hoàn tất! Đã tải xuống $1"
  },
  "opt_export_error": {
    "message": "Không thể tạo bản sao lưu. Vui lòng thử lại."
  },
  "opt_import_success": {
    "message": "Khôi phục hoàn tất! Extension sẽ tải lại trong 3 giây..."
  },
  "opt_import_error": {
    "message": "Không thể khôi phục: $1"
  },
  "opt_import_checksum_warning": {
    "message": "File sao lưu có thể bị hỏng. Tiếp tục?"
  },
  "opt_import_preview_title": {
    "message": "Khôi phục từ Sao lưu?"
  },
  "opt_import_warning": {
    "message": "Thao tác này sẽ thay thế toàn bộ dữ liệu hiện tại."
  }
}
```

---

## 7. Error Handling

### 7.1 Export Errors

| Error | Message | User Action |
|-------|---------|-------------|
| Storage quota exceeded | "Not enough storage to create backup" | Free up disk space |
| Permission denied | "Cannot save file. Check browser permissions" | Allow downloads |
| Data corruption | "Some data could not be exported" | Try again, contact support |

### 7.2 Import Errors

| Error | Message | User Action |
|-------|---------|-------------|
| Invalid JSON | "File is not a valid backup" | Select correct file |
| Version mismatch | "Backup from v1.0 not compatible with v2.8" | Export fresh backup |
| Checksum fail | "Backup file may be corrupted. Continue?" | User decides |
| File too large | "Backup file is too large (>50MB)" | Split export (future) |

---

## 8. Security & Privacy

### 8.1 Data Included in Export
✅ **Included:**
- Highlights
- AI chat history
- Settings
- SRQ cards
- Topics
- Embeddings

❌ **Excluded:**
- API keys (security risk)
- Temporary cache
- Debug logs

### 8.2 User Warnings

**Before Export:**
```
ℹ️ Backup files contain your personal highlights and AI conversations.
   Do not share backup files publicly.
```

**Before Import:**
```
⚠️ This will replace ALL current data.
   Make sure you have a backup of your current data before proceeding.
```

---

## 9. Testing Checklist

### 9.1 Export Tests
- [ ] Export with 0 highlights (empty state)
- [ ] Export with 1000 highlights (typical)
- [ ] Export with 10,000 highlights (stress test)
- [ ] Export with special characters in highlights
- [ ] Filename has correct timestamp
- [ ] File size reasonable (<10MB for typical data)
- [ ] Checksum generated correctly

### 9.2 Import Tests
- [ ] Import valid backup file
- [ ] Import from different browser
- [ ] Import old version backup (v2.7 → v2.8)
- [ ] Import corrupted JSON
- [ ] Import non-JSON file
- [ ] Import with missing fields
- [ ] Checksum validation works
- [ ] Preview dialog shows correct counts

### 9.3 Edge Cases
- [ ] Export during active AI conversation
- [ ] Import while extension is processing
- [ ] Multiple rapid export clicks
- [ ] Cancel import mid-process
- [ ] Disk full during export

---

## 10. Implementation Plan

### Phase 1: Basic Export/Import (Week 1)
- [ ] Create `utils/data_export.js`
- [ ] Create `utils/data_import.js`
- [ ] Add UI section to options.html
- [ ] Add i18n keys (EN + VI)
- [ ] Basic export function
- [ ] Basic import function
- [ ] Manual testing

### Phase 2: UX Polish (Week 2)
- [ ] Progress indicators
- [ ] Preview dialog
- [ ] Checksum validation
- [ ] Error handling
- [ ] Toast notifications
- [ ] Safety backup before import

### Phase 3: Testing & Documentation (Week 3)
- [ ] Write test cases
- [ ] Cross-browser testing
- [ ] User documentation
- [ ] Update help page
- [ ] Release notes

---

## 11. Future Enhancements

**v2.9+ Features:**
- [ ] Selective export (only highlights, only settings, etc.)
- [ ] Scheduled auto-backups
- [ ] Encrypted backups (password protected)
- [ ] Direct Google Drive export
- [ ] Import from Notion/Evernote
- [ ] Backup history viewer
- [ ] Diff viewer (compare backups)

---

## 12. Success Metrics

**KPIs:**
- 📊 **Export usage:** >30% of active users export within first week
- 🔄 **Import success rate:** >95% successful imports
- ⏱️ **Performance:** Export completes in <5s for 1000 highlights
- 🐛 **Error rate:** <1% failed exports/imports
- ⭐ **User satisfaction:** No complaints about data loss

---

## Appendix A: File Size Estimates

| Data Volume | Approx File Size |
|-------------|------------------|
| 100 highlights | ~50 KB |
| 1,000 highlights | ~500 KB |
| 10,000 highlights | ~5 MB |
| + Embeddings | +2-3x size |

---

## Appendix B: Compatibility Matrix

| Feature | Chrome | Edge | Firefox |
|---------|--------|------|---------|
| Export | ✅ | ✅ | ✅ |
| Import | ✅ | ✅ | ✅ |
| Auto-download | ✅ | ✅ | ⚠️ Needs permission |

---

**Spec Status:** Ready for Implementation
**Next Step:** Review with stakeholders → Start Phase 1 implementation

---

**Document History:**
- v1.0 (2026-02-08): Initial spec created
