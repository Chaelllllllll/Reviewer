# Reviewer System (Node.js + Supabase)

A simple reviewer management system using Node.js/Express, Supabase for storage, Bootstrap for UI and Quill for rich-text reviewer content (preserves bullets, numbered lists, formatting).

Features
- Create Subjects (categories)
- Add Reviewers under a Subject using a WYSIWYG editor (Quill) — content stored as HTML so bullets/numbers are preserved
- View reviewer content (rendered HTML)
- Auto quiz generator: server endpoint generates simple fill-in-the-blank questions from the reviewer text

Requirements
- Node.js 18+ (or compatible)
- A Supabase project (https://supabase.com)

Setup
1. Clone/copy this folder.
2. Install dependencies (PowerShell commands):

```powershell
cd "c:\Users\johnm\Desktop\Reviewer"
npm install
```

3. Configure environment:
- Copy `.env.example` to `.env` and fill `SUPABASE_URL` and `SUPABASE_KEY` (anon or service role as needed) and optionally `PORT`.

4. Create tables in Supabase:
- Open Supabase dashboard → SQL editor, paste `supabase.sql` and run. This creates `subjects` and `reviewers` tables.

5. Run the app:

```powershell
# development
npm run dev
# or production
npm start
```

6. Open `http://localhost:3000` in your browser.

Notes
- Reviewer content is stored as HTML (`content_html`) so list formatting (bullets, numbers) is preserved when uploading via the Quill editor.
- The auto-quiz generator uses a simple heuristic: it extracts sentences from the reviewer text and blanks a medium-length word to create fill-in-the-blank questions. It's intentionally simple and offline (no external AI required).

Next steps (optional)
- Add authentication with Supabase Auth to restrict create/edit actions.
- Store generated quizzes to the database and enable multiple-choice distractors.
- Improve quiz generation logic (NLP-based keyword extraction) if you want higher-quality questions.

If you want, I can:
- Run `npm install` and start the dev server here (I can run terminal commands for you), or
- Add authentication scaffolding, or
- Improve quiz generation to produce multiple-choice questions.

