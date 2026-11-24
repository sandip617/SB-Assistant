# SB Assistant

A personal Bangla voice assistant for macOS. It runs only on your own Mac, at `http://localhost:3000` or as the SB desktop app.

It is a student's study companion. It speaks Bangla, can control the Mac by voice, and can work in Safari, with safety checks built into the code.

## What it does

- **Voice chat in Bangla.** Speech-to-text and the voice use ElevenLabs. The brain is your own Claude Code login (`claude -p`), so no API key is needed for the AI.
- **Study help.** It builds exam plans from a syllabus, picks today's top 3 tasks, and runs quizzes from your PDFs, notes or photos. It also has a 25-minute focus timer and can explain a YouTube video from its transcript.
- **Google Classroom.** Deadlines come from Classroom's notification emails, with reminders 24 and 3 hours before each one.
- **Mac control.** Volume, brightness, Wi-Fi, and opening or quitting apps.
- **Safari.** It can open a site, search, read a page, click and type. It plays music on YouTube.
- **Workspace.** It creates Google Docs and Sheets and searches Drive, using the Safari login. It saves Notion notes and reads university mail through Mac Mail.
- **Files.** It reads PDFs, Word, Excel and images in Desktop, Documents and Downloads.
- **Facebook Page.** It reviews posts and videos, reads comments and drafts replies, and reads Insights. It never posts.
- **Memory.** It remembers your notes, keeps a daily backup, and shows an honest offline state.

## Safety, enforced in code

- Nothing is sent, posted, moved, deleted or submitted without your on-screen or spoken "yes".
- Text from web pages, mail and files is treated as data, never as instructions.
- It never types passwords or card numbers, never logs in for you, and never reads a personal social feed.
- File access is read-only inside Desktop, Documents and Downloads unless you approve a change.
- The server listens on `127.0.0.1` only, and every `/api/*` call needs `POST` plus a custom header.
- Keys live in `~/Library/Application Support/SB/.env`, outside this folder. They are never in the code.

## Run it

You need macOS, Node.js 20 or newer, and Claude Code signed in. There are no npm packages; the server uses only Node's standard library.

```sh
node server.js          # then open http://localhost:3000
```

Put keys in `~/Library/Application Support/SB/.env`. See `.env.example` for the names, or open `localhost:3000/setup.html`.

**Desktop app (optional).** `desktop/` wraps the same page in Electron. Build it with `desktop/build.sh`.

## Tests

```sh
for t in ./*.test.js; do node "$t" || echo "FAILED: $t"; done
```

Made by [Sandip Pal](https://itzsandippal.com).
