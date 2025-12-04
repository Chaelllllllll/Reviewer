# Notification System Setup

## Overview
The notification system alerts users about:
- 📬 New anonymous messages
- 📚 New subjects added
- 🎓 New courses available
- 📝 New reviewers uploaded

## Features

### Smart Permission Request
- Custom notification prompt appears 3 seconds after page load
- Only shows once (stored in localStorage)
- Beautiful, professional UI with animation
- Option to "Enable Notifications" or "Maybe Later"

### Browser Notifications
- Native browser notifications with custom icons
- Clickable notifications that navigate to relevant pages:
  - Messages → Opens message modal
  - Subjects → `/subject.html`
  - Courses → `/index.html`
  - Reviewers → `/reviewer.html?subject={id}`

### Real-time Monitoring
- Checks for updates every 2 minutes
- Tracks counts for each category
- Only notifies when new items are detected
- Shows count of new items in notification

## Files Created

1. **`public/js/notifications.js`** (370 lines)
   - Main notification logic
   - Permission handling
   - Update checking functions
   - Custom prompt UI

2. **`public/css/notifications.css`** (260 lines)
   - Notification prompt styles
   - Toast notification fallback styles
   - Responsive design
   - Smooth animations

## Integration

Already integrated into:
- ✅ `index.html`
- ✅ `quiz.html`
- ✅ `reviewer.html`
- ✅ `subject.html`

### HTML Structure
```html
<!-- In <head> -->
<link rel="stylesheet" href="/css/notifications.css">

<!-- Before </body> -->
<script src="/js/notifications.js"></script>
```

## User Experience Flow

1. **First Visit**
   - User visits any page
   - After 3 seconds, custom prompt appears bottom-right
   - Animated bell icon catches attention
   - Clear explanation of benefits

2. **Enable Notifications**
   - User clicks "Enable Notifications"
   - Browser native permission dialog appears
   - If granted: confirmation notification sent
   - Starts monitoring for updates every 2 minutes

3. **Receiving Notifications**
   - When new content detected:
     - Browser notification appears (top-right)
     - Shows item count and details
     - Clicking navigates to relevant page
   - For messages: also updates badge counter

4. **Maybe Later**
   - User clicks "Maybe Later"
   - Prompt dismisses with animation
   - Won't show again (stored in localStorage)
   - Can manually enable in settings later

## Database Requirements

Make sure these tables exist in Supabase:
- `anonymous_messages` (with `created_at`)
- `subjects` (with `name`, `created_at`)
- `courses` (with `name`, `created_at`)
- `reviewers` (with `title`, `subject_id`, `created_at`)

## Customization

### Change Check Interval
```javascript
// In notifications.js, line ~360
// Default: 2 minutes (2 * 60 * 1000)
setInterval(checkAllUpdates, 5 * 60 * 1000); // 5 minutes
```

### Change Prompt Delay
```javascript
// In notifications.js, line ~264
setTimeout(() => {
  // Show prompt
}, 5000); // Change from 3000 to 5000 for 5 seconds
```

### Custom Icons
Replace these image paths in `notifications.js`:
- `icon: '/images/icon.png'` - Large icon (192x192 or larger)
- `badge: '/images/badge.png'` - Small badge icon (96x96)

### Notification Sounds
Add sound to notifications:
```javascript
// In showNotification function, add:
const audio = new Audio('/sounds/notification.mp3');
audio.play();
```

## Testing

1. **Test Permission Request**
   - Open page in incognito mode
   - Wait 3 seconds
   - Verify prompt appears

2. **Test Notifications**
   - Grant permission
   - Add new message/subject/course/reviewer in database
   - Wait up to 2 minutes
   - Verify notification appears

3. **Test Navigation**
   - Click on notification
   - Verify correct page opens

## Browser Compatibility

- ✅ Chrome 50+
- ✅ Firefox 44+
- ✅ Safari 16+
- ✅ Edge 79+
- ❌ IE (not supported)

## Privacy & Security

- No personal data collected
- Permission stored in browser only
- Uses browser's native Notification API
- Complies with GDPR (user consent required)
- Can be revoked in browser settings anytime

## Troubleshooting

### Notifications not appearing
1. Check browser notification permissions
2. Verify tables exist in database
3. Check browser console for errors
4. Ensure `supabase` client is initialized

### Prompt not showing
1. Clear localStorage: `localStorage.removeItem('notificationPromptShown')`
2. Refresh page
3. Wait 3 seconds

### Wrong navigation on click
- Verify URL paths match your routing
- Check `data` attributes in notification options

## API Reference

### Global Functions

```javascript
// Request notification permission
await requestNotificationPermission();

// Enable notifications (with UI feedback)
await enableNotifications();

// Dismiss prompt
dismissNotificationPrompt();

// Show custom notification
showNotification('Title', {
  body: 'Message text',
  icon: '/path/to/icon.png',
  tag: 'notification-tag',
  data: { custom: 'data' }
});
```

## Next Steps

The system is ready to use! Users will automatically see the notification prompt on their next visit. No additional configuration needed.

To test immediately:
1. Open any public page
2. Wait 3 seconds
3. Click "Enable Notifications"
4. Add new content to database
5. Wait 2 minutes for notification
