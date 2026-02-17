if (request.type === "ATOM_NLM_EXPORT_CONFIRM") {
    (async () => {
        try {
            const note = request.payload?.note;
            if (!note || !note.id) {
                sendResponse({ ok: false, error: "invalid_note" });
                return;
            }

            // Call with bypassPii = true
            const nlmResult = await prepareNlmExportFromNote(note, true);
            let nlmResponse = null;

            if (nlmResult && nlmResult.ok) {
                await markDedupeHit(nlmResult.job?.dedupeKey);

                const nlmMeta = {
                    notebookRef: nlmResult.notebookRef,
                    exportStatus: "queued",
                    exportedAt: Date.now(),
                    dedupeKey: nlmResult.job?.dedupeKey,
                    jobId: nlmResult.job?.jobId
                };

                nlmResponse = {
                    clipText: nlmResult.clipText,
                    notebookUrl: nlmResult.notebookUrl,
                    notebookRef: nlmResult.notebookRef
                };

                // Update the note in storage with the new NLM status
                await atomUpdateReadingNote(note.id, { nlm: nlmMeta });
            } else if (nlmResult && !nlmResult.ok) {
                nlmResponse = { error: nlmResult.reason };
            }

            sendResponse({ ok: true, nlm: nlmResponse });
        } catch (e) {
            console.error("ATOM NLM Export Confirm Error:", e);
            sendResponse({ ok: false, error: "unexpected_error" });
        }
    })();
    return true;
}

