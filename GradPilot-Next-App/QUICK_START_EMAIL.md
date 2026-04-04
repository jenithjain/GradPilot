# 🚀 Quick Start: Email Node Feature

## What You Need to Do Externally

### 1. Get Resend API Key (5 minutes)

1. **Sign up:** Go to https://resend.com and create a free account
2. **Create API key:** 
   - Navigate to "API Keys" in dashboard
   - Click "Create API Key"
   - Name it "GradPilot" 
   - Copy the key (starts with `re_`)
3. **Add to .env.local:**
   ```env
   RESEND_API_KEY=re_paste_your_key_here
   EMAIL_FROM="Your Company <noreply@yourdomain.com>"
   ```

### 2. Restart Your Server
```bash
npm run dev
```

## How to Use the Email Node

### Step 1: Create Email Node in Workflow
- Add a new node to your campaign canvas
- Set type to "email"
- Configure the prompt (what should the email communicate)

### Step 2: Upload Your Email List
- Click "Upload Email List (CSV)" button on the email node
- Select your CSV file (must have `email` column)
- Optional: Include `name` column for personalization

### Step 3: Run the Node
- Click "Run Agent"
- AI generates professional email content
- Emails are sent to all recipients
- View statistics in node output

## CSV File Format

Your CSV must have at least an `email` column:

```csv
email,name
john@example.com,John Doe
jane@company.io,Jane Smith
alice@startup.com,Alice Johnson
```

**Use the provided `sample-email-list.csv` file for testing!**

## Free Tier Limits

- **100 emails per day**
- **3,000 emails per month**
- Perfect for testing and small campaigns

## For Production Use (Optional)

To send from your own domain instead of `onboarding@resend.dev`:

1. Add your domain in Resend dashboard
2. Configure DNS records (SPF, DKIM, DMARC)
3. Wait 24-48 hours for verification
4. Update `EMAIL_FROM` in `.env.local`

See **EMAIL_SETUP_GUIDE.md** for detailed instructions.

## Need Help?

- 📖 **Detailed Setup:** See `EMAIL_SETUP_GUIDE.md`
- 📝 **Technical Details:** See `EMAIL_FEATURE_SUMMARY.md`
- 🧪 **Sample CSV:** Use `sample-email-list.csv` for testing
- 🆘 **Resend Support:** https://resend.com/docs

---

**That's it! You're ready to send AI-powered email campaigns! 🎉**
