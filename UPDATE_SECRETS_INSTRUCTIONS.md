# URGENT: Update Your Secrets

Your app is still connected to the OLD Supabase database!

## How to Update Secrets in Replit:

1. Click the **Lock icon** (🔒) in the left sidebar (Secrets/Tools)
2. Find these two secrets and UPDATE them:

### VITE_SUPABASE_URL
**DELETE the old value and replace with:**
```
https://axbeubyswojrahcbsuau.supabase.co
```

### VITE_SUPABASE_PUBLISHABLE_KEY
**DELETE the old value and replace with:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4YmV1Ynlzd29qcmFoY2JzdWF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2NjYzNTMsImV4cCI6MjA3ODI0MjM1M30.a3Zx_v0-8YqE2y9DXvHoYQMVWmBSjp8tPJN7KcZkeAE
```

3. Click **Save** or press Enter after each one
4. The workflow will automatically restart

## Then Clear Your Browser:
1. Open your app preview
2. Press F12 (Developer Tools)
3. Application tab → Local Storage → Clear All
4. Refresh the page

Your app will now connect to the NEW empty database!
