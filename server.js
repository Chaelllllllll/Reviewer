require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { createClient } = require('@supabase/supabase-js');
const { JSDOM } = require('jsdom');

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.warn('Warning: SUPABASE_URL or SUPABASE_KEY not set. Fill .env or env vars.');
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.set('view engine', 'ejs');
app.use('/public', express.static(__dirname + '/public'));
app.use(bodyParser.urlencoded({ extended: true, limit: '5mb' }));
app.use(bodyParser.json({ limit: '5mb' }));

// Home - list subjects
app.get('/', async (req, res) => {
  const { data, error } = await supabase.from('subjects').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).send(error.message);
  res.render('index', { subjects: data });
});

// New subject
app.get('/subject/new', (req, res) => {
  res.render('new_subject');
});
app.post('/subject/new', async (req, res) => {
  const { name, description } = req.body;
  const { error } = await supabase.from('subjects').insert([{ name, description }]);
  if (error) return res.status(500).send(error.message);
  res.redirect('/');
});

// Subject page - list reviewers
app.get('/subject/:id', async (req, res) => {
  const id = req.params.id;
  const { data: subject, error: e1 } = await supabase.from('subjects').select('*').eq('id', id).single();
  if (e1) return res.status(500).send(e1.message);
  const { data: reviewers, error } = await supabase.from('reviewers').select('*').eq('subject_id', id).order('created_at', { ascending: false });
  if (error) return res.status(500).send(error.message);
  res.render('subject', { subject, reviewers });
});

// New reviewer form
app.get('/subject/:id/reviewer/new', async (req, res) => {
  const subjectId = req.params.id;
  res.render('new_reviewer', { subjectId });
});
app.post('/subject/:id/reviewer/new', async (req, res) => {
  const subjectId = req.params.id;
  const { title, content_html } = req.body;
  const { error } = await supabase.from('reviewers').insert([{ subject_id: subjectId, title, content_html }]);
  if (error) return res.status(500).send(error.message);
  res.redirect(`/subject/${subjectId}`);
});

// View reviewer
app.get('/reviewer/:id', async (req, res) => {
  const id = req.params.id;
  const { data: reviewer, error } = await supabase.from('reviewers').select('*').eq('id', id).single();
  if (error) return res.status(500).send(error.message);
  res.render('reviewer', { reviewer });
});

// Generate quiz from reviewer content (simple fill-in-the-blank)
app.get('/reviewer/:id/quiz', async (req, res) => {
  const id = req.params.id;
  const { data: reviewer, error } = await supabase.from('reviewers').select('*').eq('id', id).single();
  if (error) return res.status(500).send({ error: error.message });
  const html = reviewer.content_html || '';
  const dom = new JSDOM(html);
  const text = dom.window.document.body.textContent || '';

  // Split into sentences (naive)
  const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.length > 30);
  const max = Math.min(7, sentences.length);
  const chosen = [];
  const seen = new Set();
  for (let i = 0; i < sentences.length && chosen.length < max; i++) {
    const s = sentences[i].trim();
    if (!seen.has(s)) { chosen.push(s); seen.add(s); }
  }

  const questions = chosen.map((s, idx) => {
    // pick a candidate word to blank: prefer longer words
    const words = s.split(/\s+/).filter(w => /[A-Za-z]/.test(w));
    const longWords = words.filter(w => w.replace(/[^A-Za-z]/g,'').length >= 4);
    const pool = longWords.length ? longWords : words;
    // choose a word roughly in middle
    const pick = pool[Math.floor(pool.length / 2)];
    const answer = pick ? pick.replace(/[^A-Za-z']/g,'') : '';
    const blanked = pick ? s.replace(pick, '_____') : s;
    return {
      id: idx + 1,
      prompt: blanked,
      answer: answer
    };
  });

  res.send({ questions });
});

app.listen(PORT, () => {
  console.log(`Reviewer app listening on http://localhost:${PORT}`);
});
