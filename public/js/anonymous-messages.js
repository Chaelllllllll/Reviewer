const BLOCKLIST = [
  // Profanity & Slurs
  'fuck', 'shit', 'bitch', 'ass', 'damn', 'crap', 'bastard', 'dick', 'pussy', 'cock',
  'whore', 'slut', 'cunt', 'piss', 'fag', 'nigger', 'nigga', 'retard', 'gay', 'lesbian', 'nigg4', 'tangina', 'gago', 'tanga', 't4nga', 'pakyu', 'ulol', 'bobo',
  
  // Harassment & Bullying
  'kill yourself', 'kys', 'die', 'suicide', 'hang yourself', 'jump off', 'loser', 'idiot',
  'stupid', 'dumb', 'moron', 'ugly', 'fat', 'worthless', 'pathetic', 'trash', 'garbage',
  
  // Spam & Scam
  'free money', 'click here', 'buy now', 'limited offer', 'act now', 'prize', 'winner',
  'congratulations', 'claim now', 'discount', 'viagra', 'cialis', 'crypto', 'bitcoin',
  'forex', 'investment', 'mlm', 'cash app', 'venmo', 'paypal me',
  
  // Sexual Content
  'porn', 'sex', 'nude', 'naked', 'xxx', 'nsfw', 'hentai', 'onlyfans', 'camgirl',
  'escort', 'hookup', 'horny', 'sexy', 'boobs', 'tits', 'ass', 'penis', 'vagina',
  
  // Hate Speech & Discrimination
  'nazi', 'hitler', 'kkk', 'racist', 'terrorism', 'terrorist', 'radical', 'extremist',
  'supremacy', 'hate', 'discrimination', 'bigot', 'xenophobe',
  
  // Violence & Threats
  'kill', 'murder', 'rape', 'torture', 'bomb', 'gun', 'shoot', 'stab', 'attack',
  'assault', 'harm', 'hurt', 'beat up', 'fight', 'violence', 'threat',
  
  // Drug References
  'weed', 'cocaine', 'heroin', 'meth', 'drug dealer', 'drugs', 'high', 'stoned',
  'crack', 'marijuana', 'pot', 'dope', 'pills',
  
  // Personal Info Phishing
  'ssn', 'social security', 'credit card', 'bank account', 'password', 'login',
  'phone number', 'address', 'email me', 'dm me', 'private message',
  
  // Misinformation Keywords
  'fake news', 'hoax', 'conspiracy', 'scam', 'fraud', 'lie', 'misleading',
  
  // Self-Harm
  'cut myself', 'self harm', 'cutting', 'suicide methods', 'overdose', 'pills',
  
  // Doxxing & Privacy
  'dox', 'doxx', 'address', 'phone', 'leak', 'expose', 'personal info',
  
  // Bypassing Filters (common variations)
  'f*ck', 'sh!t', 'b!tch', 'a$$', 'd!ck', 'fuk', 'sht', 'biatch', 'azz',
  
  // Platform-Specific Spam
  'follow for follow', 'f4f', 'l4l', 'like for like', 'sub4sub', 'subscribe',
  'check my profile', 'link in bio', 'dm for more', 'add me on',
  
  // Other Inappropriate
  'illegal', 'download', 'torrent', 'pirate', 'hack', 'cheat', 'exploit',
  'bot', 'spam', 'scam', 'phishing', 'malware', 'virus'
];

// Animal + Color combinations for anonymous usernames
const ANIMALS = ['Tiger', 'Lion', 'Eagle', 'Wolf', 'Bear', 'Fox', 'Hawk', 'Puma', 'Panther', 'Falcon', 'Shark', 'Dragon', 'Phoenix', 'Raven', 'Cobra'];
const COLORS = ['Red', 'Blue', 'Gold', 'Silver', 'Green', 'Purple', 'Amber', 'Jade', 'Ruby', 'Steel', 'Bronze', 'Crimson', 'Azure', 'Onyx', 'Pearl'];

let anonymousUsername = null;
let lastMessageCount = 0;
let messageCheckInterval = null;
let deviceId = null;
let violationCount = 0;
let isBanned = false;
let presenceChannel = null;
let presenceUpdateInterval = null;
let communityMessagesChannel = null;
let replyingToMessageId = null;
let replyingToUsername = null;
let replyingToText = null;

// Generate device fingerprint (non-bypassable identifier)
function generateDeviceId() {
  if (!deviceId) {
    // Try to get existing device ID
    deviceId = localStorage.getItem('deviceId');
    
    if (!deviceId) {
      // Create fingerprint from multiple browser properties
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('fingerprint', 2, 2);
      const canvasData = canvas.toDataURL();
      
      // Add random component for uniqueness per browser instance
      const randomSeed = Math.random().toString(36).substring(2, 15) + 
                         Math.random().toString(36).substring(2, 15);
      
      const fingerprint = [
        navigator.userAgent,
        navigator.language,
        navigator.languages ? navigator.languages.join(',') : '',
        screen.colorDepth,
        screen.width + 'x' + screen.height,
        screen.availWidth + 'x' + screen.availHeight,
        new Date().getTimezoneOffset(),
        !!window.sessionStorage,
        !!window.localStorage,
        navigator.hardwareConcurrency || 'unknown',
        navigator.deviceMemory || 'unknown',
        navigator.platform,
        navigator.vendor,
        canvasData.substring(0, 100),
        randomSeed, // Unique per session/device
        Date.now() // Timestamp to ensure uniqueness
      ].join('|');
      
      // Create hash of fingerprint
      deviceId = btoa(fingerprint).substring(0, 64);
      
      // Store in multiple places to prevent easy bypass
      localStorage.setItem('deviceId', deviceId);
      sessionStorage.setItem('deviceId', deviceId);
      
      console.log('Generated new device ID:', deviceId.substring(0, 10) + '...');
      
      // Also create a backup in IndexedDB
      try {
        const request = indexedDB.open('UserTracking', 1);
        request.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('device')) {
            db.createObjectStore('device');
          }
        };
        request.onsuccess = (e) => {
          const db = e.target.result;
          const tx = db.transaction('device', 'readwrite');
          const store = tx.objectStore('device');
          store.put(deviceId, 'id');
        };
      } catch (e) {
        console.error('IndexedDB not available');
      }
    } else {
      console.log('Using existing device ID:', deviceId.substring(0, 10) + '...');
    }
  }
  return deviceId;
}

// Check if user is banned
async function checkBanStatus() {
  try {
    const devId = generateDeviceId();
    
    const { data, error } = await supabase
      .from('banned_users')
      .select('is_banned, violation_count')
      .eq('device_id', devId)
      .maybeSingle();
    
    if (error && error.code !== 'PGRST116') throw error;
    
    if (data) {
      isBanned = data.is_banned || false;
      violationCount = data.violation_count || 0;
      return isBanned;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking ban status:', error);
    return false;
  }
}

// Get current violation count
async function getViolationCount() {
  try {
    const devId = generateDeviceId();
    
    const { data, error } = await supabase
      .from('banned_users')
      .select('violation_count')
      .eq('device_id', devId)
      .maybeSingle();
    
    if (error && error.code !== 'PGRST116') throw error;
    
    violationCount = data ? (data.violation_count || 0) : 0;
    return violationCount;
  } catch (error) {
    console.error('Error getting violation count:', error);
    return 0;
  }
}

// Log violation to database (increment counter)
async function logViolation() {
  try {
    const devId = generateDeviceId();
    const username = getAnonymousUsername();
    
    // Call database function to increment violation count
    const { data, error } = await supabase.rpc('increment_violation', {
      p_device_id: devId,
      p_username: username
    });
    
    if (error) throw error;
    
    if (data && data.length > 0) {
      const result = data[0];
      violationCount = result.new_count;
      isBanned = result.is_now_banned;
      return isBanned;
    }
    
    return false;
  } catch (error) {
    console.error('Error logging violation:', error);
    return false;
  }
}

// Generate anonymous username
function generateAnonymousUsername() {
  if (!anonymousUsername) {
    const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    anonymousUsername = `${animal}-${color}`;
    localStorage.setItem('anonymousUsername', anonymousUsername);
  }
  return anonymousUsername;
}

// Get or create anonymous username
function getAnonymousUsername() {
  if (!anonymousUsername) {
    anonymousUsername = localStorage.getItem('anonymousUsername');
    if (!anonymousUsername) {
      anonymousUsername = generateAnonymousUsername();
    }
  }
  return anonymousUsername;
}

// Sanitize input to prevent XSS
function sanitizeInput(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Detect hacking attempts
function detectHackingAttempt(text) {
  const hackPatterns = [
    // HTML/Script injection - broad patterns
    /<[^>]*script/gi,
    /<[^>]*iframe/gi,
    /<[^>]*object/gi,
    /<[^>]*embed/gi,
    /<[^>]*applet/gi,
    /<[^>]*link/gi,
    /<[^>]*style/gi,
    /<[^>]*meta/gi,
    /<[^>]*base/gi,
    /<[^>]*form/gi,
    /<[^>]*input/gi,
    /<[^>]*button/gi,
    /<[^>]*textarea/gi,
    /<[^>]*img[^>]*src/gi,
    /<[^>]*video/gi,
    /<[^>]*audio/gi,
    /<[^>]*svg/gi,
    
    // Event handlers - any on* attribute
    /\bon\w+\s*=/gi,
    /\s+on\w+\s*:/gi,
    
    // JavaScript protocols and functions
    /javascript\s*:/gi,
    /data\s*:\s*text\s*\/\s*html/gi,
    /vbscript\s*:/gi,
    /\beval\s*\(/gi,
    /\bexec\s*\(/gi,
    /\bFunction\s*\(/gi,
    /\bsetTimeout\s*\(/gi,
    /\bsetInterval\s*\(/gi,
    /\balert\s*\(/gi,
    /\bprompt\s*\(/gi,
    /\bconfirm\s*\(/gi,
    
    // SQL injection - broader patterns
    /\b(select|union|insert|update|delete|drop|create|alter|truncate|execute|exec|declare)\b.*\b(from|into|table|database|where|and|or|join)\b/gi,
    /;\s*(select|union|insert|update|delete|drop)/gi,
    /'.*or.*'.*=/gi,
    /".*or.*".*=/gi,
    /\b1\s*=\s*1\b/gi,
    /\b1\s*'\s*or\s*'1\s*'\s*=\s*'1/gi,
    /--.*$/gm,
    /\/\*.*\*\//g,
    
    // Template/Code injection
    /<\?php/gi,
    /<\?=/gi,
    /<%.*%>/gi,
    /\$\{[^}]*\}/g,
    /\{\{[^}]*\}\}/g,
    /#\{[^}]*\}/g,
    
    // DOM/Cookie manipulation
    /document\s*\.\s*cookie/gi,
    /document\s*\.\s*write/gi,
    /document\s*\.\s*writeln/gi,
    /window\s*\.\s*location/gi,
    /window\s*\.\s*open/gi,
    /window\s*\[\s*['"`]/gi,
    /localStorage/gi,
    /sessionStorage/gi,
    /\.innerHTML/gi,
    /\.outerHTML/gi,
    
    // URL encoding attempts
    /%3C/gi, // <
    /%3E/gi, // >
    /%22/gi, // "
    /%27/gi, // '
    /&#x/gi,
    /&#\d/gi,
    /\\x[0-9a-f]{2}/gi,
    /\\u[0-9a-f]{4}/gi,
    
    // File system/command injection
    /\.\.\//g,
    /\.\.\\/g,
    /\/etc\/passwd/gi,
    /\/bin\/bash/gi,
    /cmd\.exe/gi,
    /powershell/gi,
    /\bwget\b/gi,
    /\bcurl\b/gi,
    
    // Base64 encoded attempts
    /base64\s*,/gi,
    
    // Null byte injection
    /%00/gi,
    /\x00/g,
    
    // LDAP injection
    /\|\|/g,
    /&&/g,
    
    // XPath injection
    /\/\//g,
    /\[.*\]/g
  ];
  
  // Check for excessive special characters (possible obfuscation)
  const specialCharRatio = (text.match(/[<>{}[\]()$%&*;]/g) || []).length / text.length;
  if (specialCharRatio > 0.3 && text.length > 10) {
    return true;
  }
  
  // Check for unusual character sequences
  if (/[<>]{2,}/.test(text) || /[{}]{2,}/.test(text) || /[()]{3,}/.test(text)) {
    return true;
  }
  
  for (const pattern of hackPatterns) {
    if (pattern.test(text)) {
      return true;
    }
  }
  return false;
}

// Check for blocklisted words
function containsBlocklistedWords(text) {
  const lowerText = text.toLowerCase();
  for (const word of BLOCKLIST) {
    if (lowerText.includes(word.toLowerCase())) {
      return true;
    }
  }
  return false;
}

// Escape HTML entities
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
    '/': '&#x2F;'
  };
  return text.replace(/[&<>"'/]/g, m => map[m]);
}

// Initialize floating message button
async function initFloatingMessages() {
  const existingBtn = document.getElementById('floatingMessageBtn');
  if (existingBtn) return; // Already initialized

  // Generate device ID immediately (non-bypassable)
  generateDeviceId();
  
  // Check ban status on load
  await checkBanStatus();
  await getViolationCount();

  // Create floating message button
  const btn = document.createElement('button');
  btn.id = 'floatingMessageBtn';
  btn.className = 'floating-message-btn';
  btn.innerHTML = '<i class="bi bi-chat-dots-fill"></i><span class="message-badge" id="messageBadge" style="display:none;">0</span>';
  btn.title = 'Chat with Community - Share Thoughts Anonymously!';
  btn.onclick = toggleMessageModal;
  document.body.appendChild(btn);
  
  // Add call-to-action hint (only show once per session)
  if (!sessionStorage.getItem('messageHintShown')) {
    setTimeout(() => {
      const hint = document.createElement('div');
      hint.className = 'message-button-hint';
      hint.textContent = '💬 Join the conversation!';
      document.body.appendChild(hint);
      
      // Hide hint after 10 seconds
      setTimeout(() => {
        hint.classList.add('hide');
        setTimeout(() => hint.remove(), 500);
      }, 10000);
      
      sessionStorage.setItem('messageHintShown', 'true');
    }, 3000);
  }

  // Create message modal
  createMessageModal();
  
  // Initialize identity mode toggle
  initIdentityModeToggle();

  // Load messages and start polling
  loadMessages();
  startMessagePolling();
  
  // Start presence tracking globally (on all pages)
  startPresenceTracking();
  
  // Start presence tracking globally (on all pages)
  startPresenceTracking();

  // Generate username on first load
  getAnonymousUsername();
  
  // Disable input if banned
  if (isBanned) {
    const input = document.getElementById('messageInput');
    if (input) {
      input.disabled = true;
      input.placeholder = 'You are banned from sending messages';
    }
  }
}

// Create message modal with tabs for community and direct messages
function createMessageModal() {
  const modalHTML = `
    <div class="modal fade" id="messageModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content shadow-lg border-0">
          <div class="modal-header border-0 pb-2">
            <div class="flex-grow-1">
              <h5 class="modal-title mb-1">
                <i class="bi bi-chat-dots-fill text-pink"></i> Messages
              </h5>
            </div>
            <div class="online-users-indicator">
              <i class="bi bi-circle-fill text-success online-pulse"></i>
              <span id="onlineUsersCount" class="fw-bold">0</span> online
            </div>
            <button type="button" class="btn-close ms-2" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          
          <!-- Tab Navigation -->
          <div class="message-tabs px-3">
            <button class="message-tab active" onclick="switchMessageTab('community')">
              <i class="bi bi-people-fill"></i> Community
            </button>
            <button class="message-tab" onclick="switchMessageTab('direct')">
              <i class="bi bi-person-fill"></i> Direct Messages
              <span id="dmTabBadge" class="message-tab-badge" style="display:none;">0</span>
            </button>
          </div>
          
          <div class="modal-body px-0 py-0">
            <!-- Community Messages Tab -->
            <div id="communityTab" class="tab-content active">
              <div id="messagesContainer" class="messages-container">
                <div class="text-center text-muted py-5">
                  <div class="spinner-border spinner-pink" role="status">
                    <span class="visually-hidden">Loading...</span>
                  </div>
                  <p class="small mt-3 mb-0">Loading messages...</p>
                </div>
              </div>
              <div class="message-input-area">
                <div id="messageError" class="alert alert-danger alert-sm mb-2" style="display:none;"></div>
                <div class="input-group">
                  <button class="btn btn-outline-pink voice-btn" type="button" id="voiceBtn" onclick="toggleVoiceRecording()" title="Record voice message">
                    <i class="bi bi-mic-fill"></i>
                  </button>
                  <input type="text" class="form-control border-2" id="messageInput" placeholder="Share your thoughts..." maxlength="500">
                  <button class="btn btn-pink text-light px-4" type="button" onclick="sendMessage()">
                    <i class="bi bi-send-fill"></i>
                  </button>
                </div>
                <div id="voiceRecordingIndicator" style="display: none; margin-top: 8px; color: #e91e63;">
                  <i class="bi bi-record-circle-fill"></i> Recording... <span id="recordingTimer">0:00</span>
                  <button class="btn btn-sm btn-danger ms-2" onclick="cancelVoiceRecording()">Cancel</button>
                </div>
                <div class="d-flex justify-content-between align-items-center mt-2">
                  <small class="text-muted" id="charCount">0/500</small>
                  <small class="text-muted"><i class="bi bi-shield-check"></i> Secured</small>
                </div>
              </div>
            </div>
            
            <!-- Direct Messages Tab -->
            <div id="directTab" class="tab-content">
              <div id="activeDevicesList" class="devices-container">
                <div class="text-center text-muted py-5">
                  <div class="spinner-border spinner-pink" role="status">
                    <span class="visually-hidden">Loading...</span>
                  </div>
                  <p class="small mt-3 mb-0">Loading devices...</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);

  // Enable Enter key to send and character counter
  const input = document.getElementById('messageInput');
  const charCount = document.getElementById('charCount');
  if (input) {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendMessage();
      }
    });
    input.addEventListener('input', (e) => {
      if (charCount) {
        const count = e.target.value.length;
        charCount.textContent = `${count}/500`;
        if (count > 450) {
          charCount.classList.add('text-warning');
        } else {
          charCount.classList.remove('text-warning');
        }
        if (count >= 500) {
          charCount.classList.add('text-danger');
          charCount.classList.remove('text-warning');
        } else {
          charCount.classList.remove('text-danger');
        }
      }
    });
  }
}

// Toggle message modal
async function toggleMessageModal() {
  // Check ban status before opening
  await checkBanStatus();
  
  const modal = new bootstrap.Modal(document.getElementById('messageModal'));
  modal.show();
  
  // Load messages when modal opens
  
  loadMessages();
  resetMessageBadge();
  
  // Subscribe to real-time community messages
  subscribeToCommunityMessages();
  
  // Update online count immediately when modal opens
  updateOnlineUsersCount();
  
  // Disable input if banned
  if (isBanned) {
    const input = document.getElementById('messageInput');
    const errorDiv = document.getElementById('messageError');
    if (input) {
      input.disabled = true;
      input.placeholder = 'You are permanently banned';
    }
    if (errorDiv) {
      showError('You are permanently banned from sending messages due to multiple violations.', true);
    }
  }
}

// Load messages from database
async function loadMessages() {
  try {
    const container = document.getElementById('messagesContainer');
    if (!container) return;

    const { data: messages, error } = await supabase
      .from('anonymous_messages')
      .select(`
        *,
        reply_to_message:reply_to(id, username, message, is_admin)
      `)
      .order('created_at', { ascending: true })
      .limit(50);

    if (error) throw error;

    if (!messages || messages.length === 0) {
      container.innerHTML = '<p class="text-muted text-center py-4">No messages yet. Be the first to post!</p>';
      return;
    }

    // Fetch profile pictures for all unique user_ids
    const userIds = [...new Set(messages.filter(m => m.user_id).map(m => m.user_id))];
    let profilePictures = {};
    
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, profile_picture_url')
        .in('id', userIds);
      
      if (profiles) {
        profiles.forEach(profile => {
          profilePictures[profile.id] = profile.profile_picture_url;
        });
      }
    }

    container.innerHTML = messages.map(msg => {
      const date = new Date(msg.created_at);
      const timeAgo = getTimeAgo(date);
      
      // Determine display name based on identity mode
      let displayName = msg.username;
      if (msg.identity_mode === 'real' && msg.sender_display_name) {
        displayName = msg.sender_display_name;
      }
      const sanitizedUsername = escapeHtml(displayName);
      const isAdmin = msg.is_admin || false;
      
      // Parse reactions from JSON/JSONB
      let reactions = {};
      try {
        reactions = msg.reactions ? (typeof msg.reactions === 'string' ? JSON.parse(msg.reactions) : msg.reactions) : {};
      } catch (e) {
        reactions = {};
      }
      
      // Build reactions HTML
      const reactionsHTML = Object.keys(reactions).length > 0 ? `
        <div class="message-reactions">
          ${Object.entries(reactions).map(([emoji, users]) => {
            const count = users.length;
            const hasReacted = users.includes(deviceId);
            return `
              <button class="reaction-btn ${hasReacted ? 'reacted' : ''}" onclick="toggleReaction('${msg.id}', '${emoji}')">
                ${emoji} <span class="reaction-count">${count}</span>
              </button>
            `;
          }).join('')}
          <button class="add-reaction-btn" onclick="showReactionPicker('${msg.id}')">➕</button>
        </div>
      ` : `
        <div class="message-reactions">
          <button class="add-reaction-btn" onclick="showReactionPicker('${msg.id}')">➕ React</button>
        </div>
      `;
      
      // Build reply preview if exists
      let replyHTML = '';
      if (msg.reply_to_message) {
        const replyUsername = escapeHtml(msg.reply_to_message.username || 'User');
        const replyText = escapeHtml(msg.reply_to_message.message || '');
        replyHTML = `
          <div class="reply-preview" onclick="event.stopPropagation(); window.scrollToMessage('${msg.reply_to}'); return false;" style="cursor: pointer;">
            <span class="reply-preview-author">${replyUsername}</span>
            <span class="reply-preview-text">${replyText.substring(0, 50)}${replyText.length > 50 ? '...' : ''}</span>
          </div>
        `;
      }
      
      if (isAdmin) {
        // Admin message with pink theme
        const avatarHTML = msg.avatar_url 
          ? `<img src="${msg.avatar_url}" alt="Avatar" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; box-shadow: 0 3px 12px rgba(233, 30, 99, 0.4); border: 2px solid #E91E63;">` 
          : `<i class="bi bi-person-fill"></i>`;
        
        // Highlight @everyone in message
        let formattedMessage = escapeHtml(msg.message);
        const hasEveryoneMention = msg.message.includes('@everyone');
        formattedMessage = formattedMessage.replace(/@everyone/g, '<span class="mention-everyone">@everyone</span>');
        
        return `
          <div class="message-item" data-message-id="${msg.id}">
            <div class="message-avatar admin-avatar">
              ${avatarHTML}
            </div>
            <div class="message-bubble">
              <div class="message-header">
                <strong class="message-username admin-username" onclick="startDirectMessage('${msg.device_id}', '${sanitizedUsername}')" title="Click to send direct message to admin" style="cursor: pointer;">
                  ${sanitizedUsername}
                </strong>
                <button class="reply-btn" data-msg-id="${msg.id}" data-username="${sanitizedUsername}" data-preview="${escapeHtml(msg.message.substring(0, 50))}" title="Reply to this message">
                  <i class="bi bi-reply"></i>
                </button>
              </div>
              ${replyHTML}
              <div class="message-content-wrapper admin-message-wrapper${hasEveryoneMention ? ' announcement-message' : ''}">
                ${msg.voice_url ? `
                  <div class="voice-message-player">
                    <audio controls style="max-width: 100%;">
                      <source src="${msg.voice_url}" type="audio/webm">
                      Your browser does not support audio playback.
                    </audio>
                  </div>
                ` : `<div class="message-content">${formattedMessage}</div>`}
              </div>
              ${reactionsHTML}
              <small class="message-time">${timeAgo}</small>
            </div>
          </div>
        `;
      } else {
        // Regular user message with profile picture
        const sanitizedMessage = escapeHtml(msg.message);
        const profilePicUrl = msg.user_id ? profilePictures[msg.user_id] : null;
        const avatarHTML = profilePicUrl 
          ? `<img src="${profilePicUrl}" alt="Avatar" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; box-shadow: 0 2px 8px rgba(0,0,0,0.15); border: 2px solid #fff;">` 
          : `<i class="bi bi-person-fill"></i>`;
        
        return `
          <div class="message-item" data-message-id="${msg.id}">
            <div class="message-avatar">
              ${avatarHTML}
            </div>
            <div class="message-bubble">
              <div class="message-header">
                <strong class="message-username" onclick="window.startDirectMessage('${msg.device_id}', '${sanitizedUsername.replace(/'/g, "\\'")}'); return false;" title="Click to send direct message" style="cursor: pointer;">
                  ${sanitizedUsername}
                </strong>
                <button class="reply-btn" data-msg-id="${msg.id}" data-username="${sanitizedUsername}" data-preview="${escapeHtml(msg.message.substring(0, 50))}" title="Reply to this message">
                  <i class="bi bi-reply"></i>
                </button>
              </div>
              ${replyHTML}
              <div class="message-content-wrapper">
                ${msg.voice_url ? `
                  <div class="voice-message-player">
                    <audio controls style="max-width: 100%;">
                      <source src="${msg.voice_url}" type="audio/webm">
                      Your browser does not support audio playback.
                    </audio>
                  </div>
                ` : `<div class="message-content">${sanitizedMessage}</div>`}
              </div>
              ${reactionsHTML}
              <small class="message-time">${timeAgo}</small>
            </div>
          </div>
        `;
      }
    }).join('');
    
    // Scroll to bottom to show newest messages
    container.scrollTop = container.scrollHeight;

    // Update last message count
    lastMessageCount = messages.length;
    
    // Add event listeners to reply buttons
    setTimeout(() => {
      document.querySelectorAll('.reply-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          const msgId = this.getAttribute('data-msg-id');
          const username = this.getAttribute('data-username');
          const preview = this.getAttribute('data-preview');
          window.replyToMessage(msgId, username, preview);
        });
      });
    }, 100);

  } catch (error) {
    console.error('Error loading messages:', error);
    const container = document.getElementById('messagesContainer');
    if (container) {
      container.innerHTML = '<p class="text-danger text-center py-4">Failed to load messages. Please try again.</p>';
    }
  }
}

// Initialize identity mode toggle
function initIdentityModeToggle() {
  const toggle = document.getElementById('identityModeSwitch');
  const label = document.getElementById('identityModeLabel');
  const hint = document.getElementById('identityHint');
  
  if (!toggle) return;
  
  // Load saved preference
  const savedMode = localStorage.getItem('messageIdentityMode') || 'anonymous';
  toggle.checked = (savedMode === 'anonymous');
  updateIdentityModeUI(toggle.checked);
  
  // Handle toggle change
  toggle.addEventListener('change', function() {
    const isAnonymous = this.checked;
    updateIdentityModeUI(isAnonymous);
    
    // Save preference
    localStorage.setItem('messageIdentityMode', isAnonymous ? 'anonymous' : 'real');
  });
  
  function updateIdentityModeUI(isAnonymous) {
    if (isAnonymous) {
      label.innerHTML = '<i class="bi bi-incognito"></i> <span id="identityModeLabel">Anonymous Mode</span>';
      hint.textContent = 'Posting anonymously';
      hint.style.color = '#6c757d';
    } else {
      label.innerHTML = '<i class="bi bi-person-circle"></i> <span id="identityModeLabel">Real Identity</span>';
      hint.textContent = 'Posting with your name';
      hint.style.color = '#E91E63';
    }
  }
}

// Get current identity mode (always real now)
function getIdentityMode() {
  return 'real';
}

// Send message
async function sendMessage() {
  const input = document.getElementById('messageInput');
  const errorDiv = document.getElementById('messageError');
  
  if (!input) return;

  // Rate limiting check
  if (window.SecurityUtils && !window.SecurityUtils.rateLimiters.message.canMakeRequest(deviceId)) {
    showError('Too many messages. Please wait a moment before sending another message.');
    return;
  }

  // Check if user is banned FIRST (non-bypassable)
  const banned = await checkBanStatus();
  if (banned || isBanned) {
    showError('You have been permanently banned from sending messages due to multiple violations of community guidelines.', true);
    input.disabled = true;
    input.placeholder = 'Account banned - cannot send messages';
    return;
  }

  const message = input.value.trim();

  // Clear previous errors
  if (errorDiv) {
    errorDiv.style.display = 'none';
    errorDiv.textContent = '';
  }

  // Use SecurityUtils for validation if available
  if (window.SecurityUtils) {
    const validation = window.SecurityUtils.sanitizeMessage(message, 500);
    if (!validation.valid) {
      showError(validation.error);
      if (validation.error.includes('prohibited')) {
        const nowBanned = await logViolation();
        if (nowBanned) {
          showError('SECURITY ALERT: You have been PERMANENTLY BANNED for attempting malicious activity.', true);
          input.disabled = true;
          input.placeholder = 'Account banned - Security violation';
          isBanned = true;
        } else {
          const remainingWarnings = 5 - violationCount;
          showError(`SECURITY WARNING ${violationCount}/5: Prohibited content detected! ${remainingWarnings} warning(s) remaining before permanent ban.`, false);
        }
      }
      input.value = '';
      return;
    }
    // Use sanitized message
    const sanitizedMessage = validation.message;
  }

  // Validate message
  if (!message) {
    showError('Please enter a message.');
    return;
  }

  if (message.length > 500) {
    showError('Message is too long. Maximum 500 characters.');
    return;
  }

  // Check for hacking attempts
  if (detectHackingAttempt(message)) {
    const nowBanned = await logViolation();
    if (nowBanned) {
      showError('SECURITY ALERT: Hacking attempt detected. You have been PERMANENTLY BANNED for attempting to inject malicious code.', true);
      input.disabled = true;
      input.placeholder = 'Account banned - Security violation';
      isBanned = true;
    } else {
      const remainingWarnings = 5 - violationCount;
      showError(`SECURITY WARNING ${violationCount}/5: Hacking attempt detected! Attempting to inject scripts, HTML, or malicious code is prohibited. ${remainingWarnings} warning(s) remaining before permanent ban.`, false);
    }
    input.value = '';
    return;
  }

  // Check for blocklisted words
  if (containsBlocklistedWords(message)) {
    // Log violation (increments counter in database)
    const nowBanned = await logViolation();
    
    if (nowBanned) {
      showError('BANNED: You have been permanently banned after 5 violations. This ban cannot be bypassed.', true);
      input.disabled = true;
      input.placeholder = 'Account banned permanently';
      isBanned = true;
    } else {
      const remainingWarnings = 5 - violationCount;
      showError(`WARNING ${violationCount}/5: Your message contains inappropriate content and was rejected. ${remainingWarnings} warning(s) remaining before permanent ban.`, false);
    }
    return;
  }

  // Sanitize message
  const sanitizedMessage = sanitizeInput(message);

  try {
    // Always use real identity
    const user = await getCurrentUser();
    if (!user) {
      showError('You must be logged in to send messages.');
      return;
    }
    
    const profile = await getCurrentUserProfile();
    const displayName = profile?.display_name || profile?.username || user?.user_metadata?.display_name || user.email;
    const messageData = {
      username: displayName,
      message: sanitizedMessage,
      device_id: deviceId,
      identity_mode: 'real',
      sender_display_name: displayName,
      user_id: user.id
    };
    
    // Add reply information if replying
    if (replyingToMessageId) {
      messageData.reply_to = replyingToMessageId;
    }
    
    // Insert message into database
    const { error } = await supabase
      .from('anonymous_messages')
      .insert([messageData]);

    if (error) throw error;

    // Clear input and reply state
    input.value = '';
    cancelReply();
    const charCount = document.getElementById('charCount');
    if (charCount) charCount.textContent = '0/500';

    // Reload messages
    await loadMessages();

    // Show success feedback
    input.placeholder = 'Message sent! ✓';
    setTimeout(() => {
      input.placeholder = 'Share your thoughts...';
    }, 2000);

  } catch (error) {
    console.error('Error sending message:', error);
    showError('Failed to send message. Please try again.');
  }
}

// Show error message
function showError(message, isPermanent = false) {
  const errorDiv = document.getElementById('messageError');
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    
    // Change styling for ban messages
    if (isPermanent) {
      errorDiv.className = 'alert alert-danger alert-sm mb-2 fw-bold';
      errorDiv.style.borderLeft = '4px solid #dc3545';
      // Don't auto-hide permanent ban messages
    } else if (message.includes('WARNING')) {
      errorDiv.className = 'alert alert-warning alert-sm mb-2';
      errorDiv.style.borderLeft = '4px solid #ffc107';
      setTimeout(() => {
        errorDiv.style.display = 'none';
      }, 8000);
    } else {
      errorDiv.className = 'alert alert-danger alert-sm mb-2';
      setTimeout(() => {
        errorDiv.style.display = 'none';
      }, 5000);
    }
  }
}

// Get time ago string
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  
  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60
  };

  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit);
    if (interval >= 1) {
      return interval === 1 ? `1 ${unit} ago` : `${interval} ${unit}s ago`;
    }
  }

  return 'just now';
}

// Check for new messages
async function checkNewMessages() {
  try {
    const { count, error } = await supabase
      .from('anonymous_messages')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;

    if (count > lastMessageCount) {
      updateMessageBadge(count - lastMessageCount);
    }

  } catch (error) {
    console.error('Error checking new messages:', error);
  }
}

// Update message badge
function updateMessageBadge(newCount) {
  const badge = document.getElementById('messageBadge');
  const btn = document.getElementById('floatingMessageBtn');
  
  if (badge && newCount > 0) {
    badge.textContent = newCount > 99 ? '99+' : newCount;
    badge.style.display = 'inline-block';
    
    // Add special class for extra attention
    if (btn) {
      btn.classList.add('has-new-messages');
    }
  }
}

// Reset message badge
function resetMessageBadge() {
  const badge = document.getElementById('messageBadge');
  const btn = document.getElementById('floatingMessageBtn');
  
  if (badge) {
    badge.style.display = 'none';
    badge.textContent = '0';
  }
  
  // Remove special class
  if (btn) {
    btn.classList.remove('has-new-messages');
  }
}

// Start polling for new messages
function startMessagePolling() {
  if (messageCheckInterval) {
    clearInterval(messageCheckInterval);
  }
  // Check every 30 seconds
  messageCheckInterval = setInterval(checkNewMessages, 30000);
}

// Stop polling
function stopMessagePolling() {
  if (messageCheckInterval) {
    clearInterval(messageCheckInterval);
    messageCheckInterval = null;
  }
}

// Track user presence
async function trackPresence() {
  try {
    const devId = generateDeviceId();
    const { error } = await supabase
      .from('user_presence')
      .upsert({
        device_id: devId,
        last_seen: new Date().toISOString()
      }, {
        onConflict: 'device_id'
      });
    
    if (error) throw error;
  } catch (error) {
    // Silent error handling
  }
}

// Get online users count
async function updateOnlineUsersCount() {
  try {
    // Clean up stale records (older than 2 minutes)
    const twoMinutesAgo = new Date(Date.now() - 120000).toISOString();
    await supabase
      .from('user_presence')
      .delete()
      .lt('last_seen', twoMinutesAgo);
    
    // Consider users online if they were active in the last 15 seconds
    // (We update every 5 seconds, so 15 seconds gives 3x buffer)
    const fifteenSecondsAgo = new Date(Date.now() - 15000).toISOString();
    
    const { count, error } = await supabase
      .from('user_presence')
      .select('*', { count: 'exact', head: true })
      .gte('last_seen', fifteenSecondsAgo);
    
    if (error) throw error;
    
    const countEl = document.getElementById('onlineUsersCount');
    if (countEl) {
      countEl.textContent = count || 0;
    }
  } catch (error) {
    // Silent error handling
  }
}

// Start presence tracking
function startPresenceTracking() {
  // Track presence immediately
  trackPresence();
  updateOnlineUsersCount();
  
  // Update presence every 5 seconds
  if (presenceUpdateInterval) {
    clearInterval(presenceUpdateInterval);
  }
  presenceUpdateInterval = setInterval(() => {
    trackPresence();
    updateOnlineUsersCount();
  }, 5000);
}

// Stop presence tracking
function stopPresenceTracking() {
  if (presenceUpdateInterval) {
    clearInterval(presenceUpdateInterval);
    presenceUpdateInterval = null;
  }
}

// Subscribe to real-time community messages
function subscribeToCommunityMessages() {
  // Unsubscribe from previous channel if exists
  if (communityMessagesChannel) {
    communityMessagesChannel.unsubscribe();
  }
  
  communityMessagesChannel = supabase
    .channel('community-messages')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'anonymous_messages'
    }, (payload) => {
      // Show notification preview if showMessageNotification is available
      // But DON'T show notification if this is the current user's message
      const myUsername = getAnonymousUsername();
      const isMyMessage = payload.new.username === myUsername;
      
      if (!isMyMessage && typeof showMessageNotification === 'function' && payload.new) {
        showMessageNotification({
          type: 'community',
          username: payload.new.username || 'Anonymous',
          message: payload.new.message || '',
          timestamp: payload.new.created_at || new Date().toISOString()
        });
      }
      
      // Reload messages when new message is inserted
      loadMessages();
    })
    .subscribe();
}

// Unsubscribe from community messages
function unsubscribeFromCommunityMessages() {
  if (communityMessagesChannel) {
    communityMessagesChannel.unsubscribe();
    communityMessagesChannel = null;
  }
}

// Do NOT remove the persisted device on page unload.
// The device_id persists across sessions and page navigations.
// Rely on server-side cleanup of stale `last_seen` timestamps instead.
window.addEventListener('beforeunload', () => {
  // Best-effort: try to update last_seen once more (non-blocking)
  try {
    const devId = deviceId || generateDeviceId();
    if (devId && typeof supabase !== 'undefined') {
      // Fire-and-forget, do not await — network may be blocked on unload
      // Get current user info
      getCurrentUser().then(user => {
        if (user) {
          getCurrentUserProfile().then(profile => {
            supabase.from('user_presence').upsert({ 
              device_id: devId, 
              user_id: user.id,
              display_name: profile?.display_name || profile?.username || user?.user_metadata?.display_name || user.email,
              last_seen: new Date().toISOString() 
            }, { onConflict: 'device_id' });
          });
        }
      });
    }
  } catch (e) {
    // silent
  }
});

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFloatingMessages);
} else {
  initFloatingMessages();
}

// Expose functions globally
window.sendMessage = sendMessage;
window.toggleMessageModal = toggleMessageModal;

// Reaction functions
window.showReactionPicker = function(messageId) {
  const reactions = ['❤️', '👍', '😂', '😮', '😢', '🙏', '🔥', '🎉'];
  const picker = document.createElement('div');
  picker.className = 'reaction-picker';
  picker.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 20px; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); z-index: 10001; display: flex; gap: 10px; flex-wrap: wrap; max-width: 300px;';
  
  reactions.forEach(emoji => {
    const btn = document.createElement('button');
    btn.textContent = emoji;
    btn.style.cssText = 'font-size: 32px; background: none; border: none; cursor: pointer; padding: 8px; border-radius: 8px; transition: transform 0.2s;';
    btn.onmouseover = () => btn.style.transform = 'scale(1.3)';
    btn.onmouseout = () => btn.style.transform = 'scale(1)';
    btn.onclick = () => {
      toggleReaction(messageId, emoji);
      document.body.removeChild(picker);
      document.body.removeChild(overlay);
    };
    picker.appendChild(btn);
  });
  
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 10000;';
  overlay.onclick = () => {
    document.body.removeChild(picker);
    document.body.removeChild(overlay);
  };
  
  document.body.appendChild(overlay);
  document.body.appendChild(picker);
};

window.toggleReaction = async function(messageId, emoji) {
  try {
    // Get current message
    const { data: msg, error: fetchError } = await supabase
      .from('anonymous_messages')
      .select('reactions')
      .eq('id', messageId)
      .single();
    
    if (fetchError) throw fetchError;
    
    let reactions = {};
    try {
      reactions = msg.reactions ? (typeof msg.reactions === 'string' ? JSON.parse(msg.reactions) : msg.reactions) : {};
    } catch (e) {
      reactions = {};
    }
    
    // Toggle reaction
    if (!reactions[emoji]) {
      reactions[emoji] = [];
    }
    
    const userIndex = reactions[emoji].indexOf(deviceId);
    if (userIndex > -1) {
      reactions[emoji].splice(userIndex, 1);
      if (reactions[emoji].length === 0) {
        delete reactions[emoji];
      }
    } else {
      reactions[emoji].push(deviceId);
    }
    
    // Update in database
    const { error: updateError } = await supabase
      .from('anonymous_messages')
      .update({ reactions: reactions })
      .eq('id', messageId);
    
    if (updateError) throw updateError;
    
    // Reload messages to show updated reactions
    loadMessages();
  } catch (error) {
    console.error('Error toggling reaction:', error);
  }
};

window.startDirectMessage = function(targetDeviceId, targetUsername) {
  console.log('startDirectMessage called:', targetDeviceId, targetUsername);
  
  // Don't allow DM to self
  if (targetDeviceId === deviceId) {
    alert('You cannot send a message to yourself!');
    return;
  }
  
  // Open the message modal first
  const messageModal = document.getElementById('messageModal');
  console.log('Message modal element:', messageModal);
  
  if (messageModal) {
    // Check if modal is already shown
    const existingModal = bootstrap.Modal.getInstance(messageModal);
    if (existingModal) {
      existingModal.show();
    } else {
      const modal = new bootstrap.Modal(messageModal);
      modal.show();
    }
    
    // Switch to direct messages tab after modal is shown
    setTimeout(() => {
      window.switchMessageTab('direct');
      
      // Wait for tab to load, then select the device
      setTimeout(() => {
        if (typeof window.selectDeviceForDM === 'function') {
          window.selectDeviceForDM(targetDeviceId, targetUsername);
        } else {
          console.error('selectDeviceForDM function not found');
        }
      }, 300);
    }, 100);
  } else {
    console.error('Message modal not found! Make sure the modal is created.');
    alert('Message modal is not ready. Please try clicking the message button first.');
  }
};

// Switch between message tabs
window.switchMessageTab = function(tabName) {
  const communityTab = document.getElementById('communityTab');
  const directTab = document.getElementById('directTab');
  const tabs = document.querySelectorAll('.message-tab');
  
  // Update tab buttons
  tabs.forEach(tab => {
    if (tab.textContent.toLowerCase().includes(tabName)) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });
  
  // Update tab content
  if (tabName === 'community') {
    communityTab.classList.add('active');
    directTab.classList.remove('active');
    loadMessages();
    // Subscribe to community messages
    subscribeToCommunityMessages();
  } else if (tabName === 'direct') {
    communityTab.classList.remove('active');
    directTab.classList.add('active');
    // Unsubscribe from community messages when switching away
    unsubscribeFromCommunityMessages();
    // Refresh device list when switching to direct messages tab
    if (typeof window.refreshDeviceList === 'function') {
      window.refreshDeviceList();
    }
  }
};

// Reply functions
window.replyToMessage = function(messageId, username, text) {
  replyingToMessageId = messageId;
  replyingToUsername = username;
  replyingToText = text;
  showReplyBar();
};

function showReplyBar() {
  let replyBar = document.getElementById('replyingToBar');
  
  if (!replyBar) {
    replyBar = document.createElement('div');
    replyBar.id = 'replyingToBar';
    replyBar.className = 'replying-to-bar';
    
    const messageArea = document.querySelector('#communityTab .message-input-area');
    if (messageArea) {
      messageArea.insertBefore(replyBar, messageArea.firstChild);
    }
  }
  
  replyBar.innerHTML = `
    <div>
      <i class="bi bi-reply"></i> Replying to <strong>${escapeHtml(replyingToUsername)}</strong>
      <br><small class="text-muted">${escapeHtml(replyingToText.substring(0, 50))}${replyingToText.length > 50 ? '...' : ''}</small>
    </div>
    <button class="cancel-reply" onclick="cancelReply()">
      <i class="bi bi-x-lg"></i>
    </button>
  `;
  
  replyBar.style.display = 'flex';
  document.getElementById('messageInput').focus();
}

window.cancelReply = function() {
  replyingToMessageId = null;
  replyingToUsername = null;
  replyingToText = null;
  
  const replyBar = document.getElementById('replyingToBar');
  if (replyBar) {
    replyBar.style.display = 'none';
  }
};

window.scrollToMessage = function(messageId) {
  const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
  if (messageEl) {
    messageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    messageEl.style.animation = 'highlight 1s';
    setTimeout(() => {
      messageEl.style.animation = '';
    }, 1000);
  }
};

// ============================================
// VOICE MESSAGE RECORDING
// ============================================

let mediaRecorder = null;
let audioChunks = [];
let recordingStartTime = null;
let recordingTimerInterval = null;

// Toggle voice recording
window.toggleVoiceRecording = async function() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    stopVoiceRecording();
  } else {
    await startVoiceRecording();
  }
}

// Start recording
async function startVoiceRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    
    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };
    
    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      await uploadVoiceMessage(audioBlob);
      
      // Stop all tracks
      stream.getTracks().forEach(track => track.stop());
      
      // Reset UI
      document.getElementById('voiceRecordingIndicator').style.display = 'none';
      document.getElementById('voiceBtn').querySelector('i').classList.remove('bi-stop-fill');
      document.getElementById('voiceBtn').querySelector('i').classList.add('bi-mic-fill');
      if (recordingTimerInterval) {
        clearInterval(recordingTimerInterval);
      }
    };
    
    mediaRecorder.start();
    recordingStartTime = Date.now();
    
    // Update UI
    document.getElementById('voiceRecordingIndicator').style.display = 'block';
    document.getElementById('voiceBtn').querySelector('i').classList.remove('bi-mic-fill');
    document.getElementById('voiceBtn').querySelector('i').classList.add('bi-stop-fill');
    
    // Start timer
    recordingTimerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      document.getElementById('recordingTimer').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
    
  } catch (error) {
    console.error('Error starting recording:', error);
    alert('Could not access microphone. Please check permissions.');
  }
}

// Stop recording
function stopVoiceRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }
}

// Cancel recording
window.cancelVoiceRecording = function() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    audioChunks = [];
  }
  document.getElementById('voiceRecordingIndicator').style.display = 'none';
  document.getElementById('voiceBtn').querySelector('i').classList.remove('bi-stop-fill');
  document.getElementById('voiceBtn').querySelector('i').classList.add('bi-mic-fill');
  if (recordingTimerInterval) {
    clearInterval(recordingTimerInterval);
  }
}

// Upload voice message
async function uploadVoiceMessage(audioBlob) {
  try {
    const filename = `voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.webm`;
    
    // Upload to Supabase storage
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('voice-messages')
      .upload(filename, audioBlob, {
        contentType: 'audio/webm',
        cacheControl: '3600'
      });
    
    if (uploadError) throw uploadError;
    
    // Get public URL
    const { data: urlData } = supabase
      .storage
      .from('voice-messages')
      .getPublicUrl(filename);
    
    const voiceUrl = urlData.publicUrl;
    
    // Send voice message
    await sendVoiceMessage(voiceUrl);
    
  } catch (error) {
    console.error('Error uploading voice message:', error);
    showError('Failed to send voice message. Please try again.');
  }
}

// Send voice message
async function sendVoiceMessage(voiceUrl) {
  try {
    const username = getAnonymousUsername();
    const devId = generateDeviceId();
    
    const { error } = await supabase
      .from('anonymous_messages')
      .insert([{
        device_id: devId,
        username: username,
        message: '[Voice Message]',
        voice_url: voiceUrl,
        reply_to: replyingToMessageId || null
      }]);
    
    if (error) throw error;
    
    // Clear reply if any
    if (replyingToMessageId) {
      window.cancelReply();
    }
    
    // Reload messages
    await loadMessages();
    
  } catch (error) {
    console.error('Error sending voice message:', error);
    showError('Failed to send voice message.');
  }
}
