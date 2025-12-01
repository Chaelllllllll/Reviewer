# Deploy Edge Function for Secure Quiz Grading

## Overview
The `grade-quiz` Edge Function enables server-side quiz grading, preventing users from seeing correct answers in the browser.

**Current Status**: The quiz works with client-side grading (answers are exposed). Deploy the Edge Function to enable secure grading.

## Prerequisites
1. Install Supabase CLI:
   ```powershell
   npm install -g supabase
   ```

2. Login to Supabase:
   ```powershell
   supabase login
   ```

## Deployment Steps

### 1. Link Your Supabase Project
```powershell
cd C:\Users\johnm\Desktop\Reviewer
supabase link --project-ref mhcbvuwegwcugsytphrx
```

### 2. Deploy the Edge Function
```powershell
supabase functions deploy grade-quiz
```

### 3. Verify Deployment
After deployment, test the function:
```powershell
supabase functions invoke grade-quiz --body '{"reviewerId":"test-id","answers":{}}'
```

## How It Works

### Before Deployment (Current State)
- ❌ Quiz answers are visible in browser DevTools
- ❌ Users can cheat by inspecting `quizData` in console
- ✅ Quiz still works (uses fallback client-side grading)

### After Deployment
- ✅ Quiz answers stay on the server
- ✅ Only scores are returned to the client
- ✅ Users cannot see correct answers
- ✅ More secure for assessments

## Testing

1. **Before deploying**: Quiz uses client-side grading automatically
   - Check browser console: "Edge Function not deployed, using client-side grading (answers exposed)"

2. **After deploying**: Quiz uses server-side grading
   - No warning in console
   - Answers are hidden from client

## Troubleshooting

### Error: "Failed to send a request to the Edge Function"
- **Cause**: Edge Function not deployed yet
- **Solution**: Deploy using steps above, or continue using client-side grading

### CORS Errors
- **Cause**: Edge Function CORS headers misconfigured
- **Solution**: The function includes CORS headers; redeploy if needed

### Authentication Errors
- **Cause**: Supabase client not authenticated
- **Solution**: Ensure `supabase-config.js` has correct SUPABASE_URL and SUPABASE_ANON_KEY

## File Structure
```
supabase/
  functions/
    grade-quiz/
      index.ts        # Edge Function code (Deno)
```

## Cost
Supabase Edge Functions:
- Free tier: 500,000 invocations/month
- Each quiz submission = 1 invocation
- Should be sufficient for most use cases

## Rollback
To disable server-side grading and revert to client-side:
```powershell
supabase functions delete grade-quiz
```
The app will automatically fall back to client-side grading.

## Next Steps
1. Deploy the Edge Function using the steps above
2. Test a quiz submission to verify server-side grading works
3. Check browser DevTools - correct answers should no longer be visible
