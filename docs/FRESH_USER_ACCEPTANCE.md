# Fresh-user acceptance checklist

Status: automated fresh-browser simulation and documentation walkthrough pass; **no independent human new-user session has been recorded**. Use the exact reviewed commit/build, not screenshots or another release. Do not fabricate participant results.

Ask a developer unfamiliar with the implementation to follow the README without coaching. Use synthetic data only and an empty workspace. Record completion, time, unexpected errors and where explanation was needed; do not claim faster-than-market without a comparable measured task.

| Task | Pass criteria | Result |
| --- | --- | --- |
| Choose version and start | Distinguishes stable tag from unreleased main; starts correct checkout; identifies build/version | Not observed |
| Unlock | Finds session token safely; does not paste it into screenshots, URLs or shared logs | Not observed |
| Capture and inspect | Creates synthetic record; explains redaction vs original payload | Not observed |
| Export and verify | Downloads valid fixture and runs offline verification | Not observed |
| Import collection | Finds import, reviews sanitized preview, adds expected count without a send | Not observed |
| Cancel/navigation | Understands edits, tabs and Back invalidate pending preview | Not observed |
| History and graphs | Finds a real recorded attempt; distinguishes unknown, non-2xx and HTTP response from business success | Not observed |
| Safe replay | Only on an approved receiver: chooses exact target, confirms once, correlates receipt; does not retry unknown delivery blindly | Not observed with human participant; controlled automated replay passed separately |
| Persistence | Understands memory-only vs encrypted profile and retention/caps | Not observed |
| Recovery | On dedicated sandbox: follows stop/backup/restore guidance without deleting live volume or changing key | Not observed |
| Exit | Stops own session and understands what data survives | Not observed |

Release acceptance requires zero unresolved critical task failures, readable mobile/desktop layouts and an explicit record of remaining limitations. Keep simulator results labeled as simulation; a reviewer reading instructions is not a human participant completing these tasks.
