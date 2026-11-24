# Cleanup log, 24 Nov 2026

A full copy of the project from before this cleanup is in `.backup/before-cleanup-2026-11-24/`. Anything removed here can be restored from it.

## Bugs fixed

1. **A new command was taken as a song name.** After SB asked "কোন গানটা বাজাব?", a reply like "Facebook খোলো" was searched on YouTube. Now a request that is clearly a website task is not treated as a song name (`server.js`, `localCommand`).
2. **A running quiz captured every message for 12 hours.** During a multiple-choice question, a line that has no ক/খ/গ/ঘ (or a–d, 1–4) now goes to normal chat, and the quiz waits (`studyroutes.js`). A test was added in `study.test.js`.
3. **"এই পাতা পড়ো" could pick a hidden Safari window.** Safari keeps closed windows hidden for a while. Page mode now looks only at windows on screen (`server.js`, `BROWSE_TAB`).
4. **Five Safari scripts had the port 3000 written in.** They now use the server's real port, so a test server on another port finds its own page (`server.js`).
5. **SB was added to the apps SB will not quit.** This is a safeguard only, because "SB" is too short a name for the app matcher anyway (`maccontrol.js`).
6. **A comment was in the wrong place.** The note about volume, Wi-Fi and apps was moved back above `localCommand` (`server.js`).

## Code removed (about 250 lines)

**Facebook posting and scheduling.** This was locked off earlier ("SB may only read and review posts, never post"), so none of it could run. Removed:

- `server.js`: the posting script, `publishPost`, `planFbPost`, `fbAskLive`, the `/api/fbpost/*` routes, and the `fbPost` field in `/api/state`.
- `metasuite.js`: the composer script and its date, card and checking helpers. Only `wantsFbPost` stays, so SB can still say it does not post.
- `metasuite.test.js`: the tests for the removed helpers.
- `public/index.html`: the hidden "Facebook Schedule খসড়া" card and its buttons.

**Still there:** post review, comment reading, video review, Insights, and the reply "আমি এখন Facebook-এ পোস্ট বা schedule করি না".

## Kept on purpose

- GitHub issue drafts, Safari form filling, and Poem test. These are hidden behind Settings › Advanced, and the owner asked to hide them, not delete them.
- The 12 designed voice samples in `public/voice-samples/`, because a voice has not been chosen yet.
- `start-sb.command` is no longer used: its LaunchAgent was turned off when SB became a Mac app. It should be deleted, but deleting files was blocked for Claude here, so the owner deletes it by hand. The project photo `IMG_1953.heic` is the same (the owner asked for it to be deleted).

## Added for GitHub

- `.gitignore`: keeps out `.env`, the app build (`desktop/node_modules`, `desktop/dist`), `.backup/`, `.DS_Store`, `.impeccable/`, and photos.
- No keys or tokens are in any file.
- If the repo is public, note that the Facebook Page name ("Sandip Builds with AI") appears in `server.js`. The owner's website name appears in `safariagent.test.js`.
