  // Load environment variables (only in development)
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  require('dotenv').config();
}

const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Supabase client with error handling
let supabase;
try {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_KEY environment variables');
  }
  supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_KEY || ''
  );
} catch (error) {
  console.error('Error initializing Supabase client:', error);
}

// Middleware
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());

// For serverless/Vercel: trust proxy and use secure cookies in production
if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
  app.set('trust proxy', 1);
}

// Session configuration - simplified for serverless
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

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/public', express.static(path.join(__dirname, 'public')));

// Serve index.html at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (req.session.user) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// ========== API ROUTES ==========

// Get all subjects
app.get('/api/subjects', async (req, res) => {
  try {
    const { data: subjects, error } = await supabase
      .from('subjects')
      .select('*')
      .order('name');

    if (error) throw error;

    res.json({ subjects: subjects || [] });
  } catch (error) {
    console.error('Error fetching subjects:', error);
    res.status(500).json({ error: 'Failed to fetch subjects' });
  }
});

// Get subject with reviewers
app.get('/api/subject/:id', async (req, res) => {
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

    res.json({ 
      subject,
      reviewers: reviewers || [] 
    });
  } catch (error) {
    console.error('Error fetching subject:', error);
    res.status(500).json({ error: 'Failed to fetch subject' });
  }
});

// Get single reviewer
app.get('/api/reviewer/:id', async (req, res) => {
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

    // Ensure quiz is a parsed object
    try {
      if (reviewer && reviewer.quiz && typeof reviewer.quiz === 'string') {
        reviewer.quiz = JSON.parse(reviewer.quiz);
      }
    } catch (e) {
      console.warn('Could not parse reviewer.quiz for reviewer', id, e);
    }

    res.json({ reviewer });
  } catch (error) {
    console.error('Error fetching reviewer:', error);
    res.status(500).json({ error: 'Failed to fetch reviewer' });
  }
});

// Search subjects
app.get('/api/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) {
      return res.json({ subjects: [] });
    }

    const like = `%${q.replace(/%/g, '\\%')}%`;

    const { data: subjects, error } = await supabase
      .from('subjects')
      .select('*')
      .ilike('name', like)
      .order('name');

    if (error) throw error;

    res.json({ subjects: subjects || [] });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ subjects: [] });
  }
});

// Search subjects typeahead
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

// ========== ADMIN API ROUTES ==========

// Admin login
app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    req.session.user = data.user;
    res.json({ success: true });
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({ success: false, error: 'Invalid email or password' });
  }
});

// Check authentication
app.get('/api/admin/check-auth', (req, res) => {
  res.json({ authenticated: !!req.session.user });
});

// Admin logout
app.post('/api/admin/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Add subject
app.post('/api/admin/subject', requireAuth, async (req, res) => {
  try {
    const { name, description } = req.body;
    
    const { data, error } = await supabase
      .from('subjects')
      .insert([{ name, description }])
      .select();

    if (error) throw error;

    res.json({ success: true, subject: data[0] });
  } catch (error) {
    console.error('Error adding subject:', error);
    res.status(500).json({ error: 'Failed to add subject' });
  }
});

// Delete subject
app.delete('/api/admin/subject/:id', requireAuth, async (req, res) => {
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

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting subject:', error);
    res.status(500).json({ error: 'Failed to delete subject' });
  }
});

// Get reviewers for a subject (admin)
app.get('/api/admin/subject/:id/reviewers', requireAuth, async (req, res) => {
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

    res.json({ subject, reviewers: reviewers || [] });
  } catch (error) {
    console.error('Error fetching reviewers:', error);
    res.status(500).json({ error: 'Failed to fetch reviewers' });
  }
});

// Add reviewer
app.post('/api/admin/reviewer', requireAuth, async (req, res) => {
  try {
    const { subject_id, title, content, quiz } = req.body;
    
    const { data, error } = await supabase
      .from('reviewers')
      .insert([{ 
        subject_id,
        title,
        content,
        quiz
      }])
      .select();

    if (error) throw error;

    res.json({ success: true, reviewer: data[0] });
  } catch (error) {
    console.error('Error adding reviewer:', error);
    res.status(500).json({ error: 'Failed to add reviewer' });
  }
});

// Update reviewer
app.put('/api/admin/reviewer/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, quiz } = req.body;
    
    const { data, error } = await supabase
      .from('reviewers')
      .update({ title, content, quiz })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, reviewer: data });
  } catch (error) {
    console.error('Error updating reviewer:', error);
    res.status(500).json({ error: 'Failed to update reviewer' });
  }
});

// Get reviewer for editing
app.get('/api/admin/reviewer/:id', requireAuth, async (req, res) => {
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

    res.json({ reviewer });
  } catch (error) {
    console.error('Error fetching reviewer:', error);
    res.status(500).json({ error: 'Failed to fetch reviewer' });
  }
});

// Delete reviewer
app.delete('/api/admin/reviewer/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabase
      .from('reviewers')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting reviewer:', error);
    res.status(500).json({ error: 'Failed to delete reviewer' });
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
