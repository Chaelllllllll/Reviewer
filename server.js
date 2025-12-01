require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Middleware
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());

// For serverless/Vercel: trust proxy and use secure cookies in production
if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
  app.set('trust proxy', 1);
}

// Session configuration (cookie-based for serverless compatibility)
// Note: For production use with multiple serverless instances, consider using:
// - @vercel/kv with connect-redis, or
// - Supabase Auth (recommended for auth state management)
// The warning about MemoryStore can be ignored in serverless since each invocation is isolated
app.use(session({
  secret: process.env.SESSION_SECRET || 'reviewer-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: !!(process.env.NODE_ENV === 'production' || process.env.VERCEL),
    httpOnly: true,
    sameSite: 'lax'
  }
}));
app.use(express.static(path.join(__dirname, 'public')));

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (req.session.user) {
    next();
  } else {
    res.redirect('/admin/login');
  }
};

// ========== USER ROUTES ==========

// Home page - List all subjects
app.get('/', async (req, res) => {
  try {
    const { data: subjects, error } = await supabase
      .from('subjects')
      .select('*')
      .order('name');

    if (error) throw error;

    res.render('user/home', { subjects: subjects || [] });
  } catch (error) {
    console.error('Error fetching subjects:', error);
    res.render('user/home', { subjects: [] });
  }
});

// View reviewers for a subject
app.get('/subject/:id/reviewers', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data: subject, error: subjectError } = await supabase
      .from('subjects')
      .select('*')
      .eq('id', id)
      .single();

    if (subjectError) throw subjectError;

    const { data: reviewers, error: reviewersError } = await supabase
      .from('reviewers')
      .select('*')
      .eq('subject_id', id)
      .order('title');

    if (reviewersError) throw reviewersError;

    res.render('user/reviewers', { 
      subject,
      reviewers: reviewers || [] 
    });
  } catch (error) {
    console.error('Error fetching reviewers:', error);
    res.redirect('/');
  }
});

// View single reviewer
app.get('/reviewer/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data: reviewer, error } = await supabase
      .from('reviewers')
      .select(`
        *,
        subjects (
          id,
          name
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    // Ensure quiz is a parsed object (some DBs return stored JSON as string)
    try {
      if (reviewer && reviewer.quiz && typeof reviewer.quiz === 'string') {
        reviewer.quiz = JSON.parse(reviewer.quiz);
        console.log('Parsed reviewer.quiz for reviewer', id);
      }
    } catch (e) {
      console.warn('Could not parse reviewer.quiz for reviewer', id, e);
    }

    res.render('user/reviewer-detail', { reviewer });
  } catch (error) {
    console.error('Error fetching reviewer:', error);
    res.redirect('/');
  }
});

// ========== ADMIN ROUTES ==========

// Admin login page
app.get('/admin/login', (req, res) => {
  if (req.session.user) {
    return res.redirect('/admin/dashboard');
  }
  res.render('admin/login', { error: null });
});

// Admin login POST
app.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    req.session.user = data.user;
    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('Login error:', error);
    res.render('admin/login', { error: 'Invalid email or password' });
  }
});

// Admin logout
app.get('/admin/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

// Admin dashboard - List all subjects
app.get('/admin/dashboard', requireAuth, async (req, res) => {
  try {
    const { data: subjects, error } = await supabase
      .from('subjects')
      .select('*')
      .order('name');

    if (error) throw error;

    res.render('admin/dashboard', { 
      subjects: subjects || [],
      user: req.session.user 
    });
  } catch (error) {
    console.error('Error fetching subjects:', error);
    res.render('admin/dashboard', { 
      subjects: [],
      user: req.session.user 
    });
  }
});

// Admin - Add subject page
app.get('/admin/subject/add', requireAuth, (req, res) => {
  res.render('admin/subject-form', { 
    subject: null,
    user: req.session.user 
  });
});

// Admin - Add subject POST
app.post('/admin/subject/add', requireAuth, async (req, res) => {
  try {
    const { name, description } = req.body;
    
    const { error } = await supabase
      .from('subjects')
      .insert([{ name, description }]);

    if (error) throw error;

    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('Error adding subject:', error);
    res.redirect('/admin/dashboard');
  }
});

// Admin - View subject reviewers
app.get('/admin/subject/:id/reviewers', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data: subject, error: subjectError } = await supabase
      .from('subjects')
      .select('*')
      .eq('id', id)
      .single();

    if (subjectError) throw subjectError;

    const { data: reviewers, error: reviewersError } = await supabase
      .from('reviewers')
      .select('*')
      .eq('subject_id', id)
      .order('title');

    if (reviewersError) throw reviewersError;

    res.render('admin/reviewers-list', { 
      subject,
      reviewers: reviewers || [],
      user: req.session.user 
    });
  } catch (error) {
    console.error('Error fetching reviewers:', error);
    res.redirect('/admin/dashboard');
  }
});

// Admin - Delete subject
app.post('/admin/subject/:id/delete', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Delete all reviewers first
    await supabase.from('reviewers').delete().eq('subject_id', id);
    
    // Delete subject
    const { error } = await supabase
      .from('subjects')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('Error deleting subject:', error);
    res.redirect('/admin/dashboard');
  }
});

// Admin - Add reviewer page
app.get('/admin/subject/:id/reviewer/add', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data: subject, error } = await supabase
      .from('subjects')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    res.render('admin/reviewer-form', { 
      subject,
      reviewer: null,
      user: req.session.user 
    });
  } catch (error) {
    console.error('Error:', error);
    res.redirect('/admin/dashboard');
  }
});

// Admin - Add reviewer POST
app.post('/admin/subject/:id/reviewer/add', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, quiz } = req.body;
    
    console.log('Adding reviewer - Title:', title);
    console.log('Adding reviewer - Content length:', content ? content.length : 0);
    console.log('Adding reviewer - quiz typeof:', typeof quiz);
    if (quiz && typeof quiz === 'string') console.log('Adding reviewer - quiz (sample):', quiz.substring(0,200));

    const { data: inserted, error: insertError } = await supabase
      .from('reviewers')
      .insert([{ 
        subject_id: id,
        title,
        content,
        quiz
      }])
      .select('id, quiz');

    if (insertError) throw insertError;
    // Log what was persisted
    if (inserted && inserted.length) {
      console.log('Inserted reviewer row quiz typeof:', typeof inserted[0].quiz);
      try {
        console.log('Inserted reviewer quiz sample:', (typeof inserted[0].quiz === 'string' ? inserted[0].quiz.substring(0,200) : JSON.stringify(inserted[0].quiz).substring(0,200)));
      } catch(e) { console.warn('Could not stringify inserted quiz', e); }
    }

    if (error) throw error;

    res.redirect(`/admin/subject/${id}/reviewers`);
  } catch (error) {
    console.error('Error adding reviewer:', error);
    res.redirect(`/admin/subject/${id}/reviewers`);
  }
});

// Admin - Edit reviewer page
app.get('/admin/reviewer/:id/edit', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data: reviewer, error } = await supabase
      .from('reviewers')
      .select(`
        *,
        subjects (
          id,
          name
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    res.render('admin/reviewer-form', { 
      subject: reviewer.subjects,
      reviewer,
      user: req.session.user 
    });
  } catch (error) {
    console.error('Error fetching reviewer:', error);
    res.redirect('/admin/dashboard');
  }
});

// Admin - Edit reviewer POST
app.post('/admin/reviewer/:id/edit', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, quiz } = req.body;
    
    console.log('Updating reviewer - Title:', title);
    console.log('Updating reviewer - Content length:', content ? content.length : 0);
    console.log('Updating reviewer - quiz typeof:', typeof quiz);
    if (quiz && typeof quiz === 'string') console.log('Updating reviewer - quiz (sample):', quiz.substring(0,200));
    
    const { data, error } = await supabase
      .from('reviewers')
      .update({ title, content, quiz })
      .eq('id', id)
      .select('subject_id, quiz')
      .single();

    if (data) {
      console.log('Post-update reviewer.quiz typeof:', typeof data.quiz);
      try { console.log('Post-update reviewer.quiz sample:', (typeof data.quiz === 'string' ? data.quiz.substring(0,200) : JSON.stringify(data.quiz).substring(0,200))); } catch(e) {}
    }

    if (error) throw error;

    res.redirect(`/admin/subject/${data.subject_id}/reviewers`);
  } catch (error) {
    console.error('Error updating reviewer:', error);
    res.redirect('/admin/dashboard');
  }
});

// Admin - Delete reviewer
app.post('/admin/reviewer/:id/delete', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data, error: fetchError } = await supabase
      .from('reviewers')
      .select('subject_id')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    const { error } = await supabase
      .from('reviewers')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.redirect(`/admin/subject/${data.subject_id}/reviewers`);
  } catch (error) {
    console.error('Error deleting reviewer:', error);
    res.redirect('/admin/dashboard');
  }
});

// Search route - simple text search over subjects and reviewers
app.get('/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) {
      return res.render('user/search-results', { query: '', subjects: [], reviewers: [] });
    }

    // Use ILIKE for case-insensitive partial match
    const like = `%${q.replace(/%/g, '\\%')}%`;

    // Search subjects by name only
    const { data: subjects, error: subjectsError } = await supabase
      .from('subjects')
      .select('*')
      .ilike('name', like)
      .order('name');

    if (subjectsError) throw subjectsError;

    res.render('user/search-results', { query: q, subjects: subjects || [], reviewers: [] });
  } catch (error) {
    console.error('Search error:', error);
    res.render('user/search-results', { query: req.query.q || '', subjects: [], reviewers: [] });
  }
});

// API endpoint for typeahead: return subjects matching q as JSON
app.get('/api/search-subjects', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ subjects: [] });
    const like = `%${q.replace(/%/g, '\\%')}%`;
    const { data: subjects, error } = await supabase
      .from('subjects')
      .select('id, name, description')
      .ilike('name', like)
      .order('name')
      .limit(10);
    if (error) throw error;
    res.json({ subjects: subjects || [] });
  } catch (err) {
    console.error('API search error:', err);
    res.status(500).json({ subjects: [] });
  }
});

// Only start server when run directly (not when required by serverless wrapper)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

// Export app for serverless wrappers and testing
module.exports = app;

// Simple quiz view placeholder (shows quiz summary if present)
app.get('/reviewer/:id/quiz', async (req, res) => {
  try {
    const { id } = req.params;
    const { data: reviewer, error } = await supabase
      .from('reviewers')
      .select(`*, subjects ( id, name )`)
      .eq('id', id)
      .single();
    if (error) throw error;
    console.log('Fetched reviewer for quiz page - id:', id, 'raw reviewer type:', typeof reviewer);
    try { console.log('Reviewer.quiz typeof:', reviewer && reviewer.quiz ? typeof reviewer.quiz : 'undefined'); } catch(e) {}
    // Ensure quiz is parsed if stored as text
    try {
      if (reviewer && reviewer.quiz && typeof reviewer.quiz === 'string') {
        reviewer.quiz = JSON.parse(reviewer.quiz);
        console.log('Parsed reviewer.quiz for quiz page', id);
      }
    } catch (e) {
      console.warn('Could not parse reviewer.quiz for quiz page', id, e);
    }

    // If no quiz configured, redirect back
    if (!reviewer.quiz || !Array.isArray(reviewer.quiz.questions) || reviewer.quiz.questions.length === 0) {
      return res.redirect(`/reviewer/${id}`);
    }

    res.render('user/reviewer-quiz', { reviewer, user: req.session.user });
  } catch (error) {
    console.error('Error loading quiz page:', error && error.stack ? error.stack : error);
    // In dev, show the error to the browser to aid debugging. Remove in production.
    try {
      res.status(500).send('<h2>Server error loading quiz page</h2><pre>' + (error && error.stack ? error.stack : String(error)) + '</pre>');
    } catch (e) {
      // If sending HTML fails, fallback to redirect
      console.error('Failed to send error response:', e);
      res.redirect(`/reviewer/${req.params.id}`);
    }
  }
});
