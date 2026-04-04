# Email Node Setup Guide

This guide walks you through setting up the email sending feature for workflow nodes in GradPilot.

## 📧 Overview

The email node allows you to:
- Generate AI-powered email content based on campaign strategy
- Upload CSV files with recipient lists
- Send bulk emails with personalization
- Track sending success/failure rates

## 🔧 Prerequisites

Before using the email node, you need to:

1. **Get a Resend API Key** (Required for sending emails)
2. **Configure environment variables**
3. **Prepare your email list CSV**
4. **(Optional) Verify your domain** for production use

---

## Step 1: Get Resend API Key

Resend is the email service provider used by GradPilot. Follow these steps:

### 1.1 Sign Up for Resend

1. Go to [https://resend.com](https://resend.com)
2. Click "Sign Up" and create an account
3. Verify your email address

### 1.2 Create an API Key

1. After logging in, go to **API Keys** in the dashboard
2. Click **"Create API Key"**
3. Give it a name (e.g., "GradPilot Production")
4. Select permissions: **"Sending access"**
5. Click **"Create"**
6. **Copy the API key immediately** (it won't be shown again!)

Your API key will look like: `re_123456789abcdefghijklmnop`

### 1.3 Free Tier Limits

Resend's free tier includes:
- **100 emails/day**
- **3,000 emails/month**
- Test domain: `onboarding@resend.dev`

For higher volumes, see [Resend Pricing](https://resend.com/pricing).

---

## Step 2: Configure Environment Variables

Add the following to your `.env.local` file:

```env
# Resend API Key (Required)
RESEND_API_KEY=re_your_actual_api_key_here

# Email From Address (Recommended)
# Format: "Display Name <email@yourdomain.com>"
EMAIL_FROM="GradPilot <noreply@yourdomain.com>"

# For testing without a verified domain, you can use:
# EMAIL_FROM="GradPilot <onboarding@resend.dev>"
```

### Environment Variable Details:

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `RESEND_API_KEY` | ✅ Yes | Your Resend API key | `re_123abc...` |
| `EMAIL_FROM` | ⚠️ Recommended | Sender email address | `"Your Name <you@domain.com>"` |

**Important Notes:**
- If `EMAIL_FROM` is not set, the system will default to `"GradPilot <onboarding@resend.dev>"`
- The `onboarding@resend.dev` address is for testing only
- For production, you should verify your own domain (see Step 4)

---

## Step 3: Prepare Your CSV Email List

### 3.1 CSV Format

Your CSV file should have at minimum an `email` column. Optionally include a `name` column for personalization.

**Example CSV:**

```csv
email,name
john.doe@example.com,John Doe
jane.smith@company.com,Jane Smith
contact@business.io,
support@startup.com,Support Team
```

### 3.2 Supported Column Names

The parser will automatically detect these column names (case-insensitive):

**For emails:**
- `email`
- `e_mail`
- `email address`
- `mail`

**For names:**
- `name`
- `full_name`
- `fullname`
- `first name`

### 3.3 CSV Guidelines

✅ **Do:**
- Use UTF-8 encoding
- Include headers in the first row
- Keep file size under 5MB
- Validate email addresses before uploading

❌ **Don't:**
- Include sensitive data beyond name/email
- Upload unvalidated email lists
- Use special characters in headers

### 3.4 Sample CSV Files

**Basic (email only):**
```csv
email
user1@example.com
user2@example.com
user3@example.com
```

**With personalization:**
```csv
email,name
alice@example.com,Alice Johnson
bob@company.io,Bob Smith
carol@startup.com,Carol Williams
```

---

## Step 4: (Optional) Verify Your Domain

For production use, verify your domain with Resend to:
- Send from your own domain
- Improve deliverability
- Build sender reputation
- Remove "via resend.dev" labels

### 4.1 Add Your Domain

1. In Resend dashboard, go to **Domains**
2. Click **"Add Domain"**
3. Enter your domain (e.g., `yourdomain.com`)
4. Click **"Add"**

### 4.2 Configure DNS Records

Resend will provide DNS records. Add these to your domain's DNS settings:

| Type | Name | Value |
|------|------|-------|
| TXT | `@ or root` | `resend-verification=xxx...` |
| MX | `@` | `feedback-smtp.resend.com` |
| TXT | `_dmarc` | `v=DMARC1; p=none;...` |
| TXT | `resend._domainkey` | `p=MIGfMA0GCS...` |

**Note:** DNS propagation can take 24-48 hours.

### 4.3 Verify Domain

1. Wait for DNS propagation
2. In Resend dashboard, click **"Verify"** next to your domain
3. Once verified, update `EMAIL_FROM` in `.env.local`:

```env
EMAIL_FROM="Your Company <noreply@yourdomain.com>"
```

---

## Step 5: Using the Email Node in Workflows

### 5.1 Create an Email Node

1. In the campaign canvas, add a new **Email** node
2. Configure the node's prompt context (what the email should communicate)
3. Connect it to previous workflow nodes for context

### 5.2 Upload Email List

1. Click the **"Upload Email List (CSV)"** button in the email node
2. Select your CSV file
3. Wait for validation
4. You'll see a confirmation: "✅ CSV uploaded successfully! Valid emails: X"

### 5.3 Run the Email Node

1. Click **"Run Agent"** on the email node
2. The AI will:
   - Generate email content (subject, HTML, plain text)
   - Personalize with recipient names (using `{{name}}` placeholder)
   - Send to all recipients in your CSV
3. View results in the node output:
   - ✅ Success count
   - ⚠️ Failed count (if any)
   - Email preview

### 5.4 Example Output

```
✅ Email campaign sent successfully!

Subject: Exclusive Launch Offer - 30% Off

📧 Sent: 48/50 emails

⚠️ Some emails failed (2/50):
- Failed to send to invalid@: Invalid email format
- Failed to send to blocked@spam.com: Recipient blocked

Recipients: john@example.com, jane@company.io, alice@startup.com and 45 more...
```

---

## 🔍 Troubleshooting

### Issue: "RESEND_API_KEY not configured"

**Solution:** 
- Add `RESEND_API_KEY=re_...` to `.env.local`
- Restart your development server: `npm run dev`

### Issue: "No valid emails found in CSV"

**Solution:**
- Check CSV format (must have `email` column header)
- Validate email addresses
- Ensure file is UTF-8 encoded

### Issue: Emails not being delivered

**Possible causes:**
1. **Using test domain:** Emails sent from `onboarding@resend.dev` may be filtered
2. **Domain not verified:** Verify your domain in Resend
3. **Rate limits:** Free tier is 100 emails/day
4. **Spam filters:** Recipients may have aggressive spam filters

**Solutions:**
- Check Resend dashboard logs
- Verify your domain
- Upgrade Resend plan if needed
- Ask recipients to whitelist your sender address

### Issue: High failure rate

**Solution:**
- Validate email list before uploading
- Check Resend dashboard for specific errors
- Ensure `EMAIL_FROM` is properly configured
- Remove bounced/invalid addresses

---

## 📊 Rate Limits & Best Practices

### Rate Limits

- **Development:** 100 emails/day, 3,000/month (free tier)
- **Production:** Upgrade to paid plan for higher limits
- **Batch size:** System sends in batches of 100
- **Delay:** 100ms between individual emails

### Best Practices

1. **Validate emails:** Clean your list before uploading
2. **Use personalization:** Include names for better engagement
3. **Test first:** Send to a small test list before bulk sending
4. **Monitor logs:** Check Resend dashboard for delivery issues
5. **Domain verification:** Always verify your domain for production
6. **Content quality:** Use AI-generated content as a starting point, review before sending
7. **Compliance:** Ensure you have permission to email recipients (GDPR, CAN-SPAM)

---

## 🔐 Security & Privacy

### Environment Variables

- ✅ **NEVER** commit `.env.local` to version control
- ✅ Add `.env.local` to `.gitignore`
- ✅ Use different API keys for dev/staging/production
- ✅ Rotate API keys periodically

### Email Lists

- ✅ Only upload email lists you have permission to contact
- ✅ Don't store CSV files in version control
- ✅ Delete CSV files after upload
- ✅ Comply with GDPR, CAN-SPAM, and other regulations

### API Key Security

```bash
# Check if .env.local is in .gitignore
git check-ignore .env.local
# Should output: .env.local

# If not, add it:
echo ".env.local" >> .gitignore
```

---

## 📚 Additional Resources

- [Resend Documentation](https://resend.com/docs)
- [Resend API Reference](https://resend.com/docs/api-reference)
- [Domain Verification Guide](https://resend.com/docs/dashboard/domains/introduction)
- [Email Best Practices](https://resend.com/docs/knowledge-base/best-practices)

---

## 🆘 Support

If you encounter issues:

1. Check this guide first
2. Review [Resend documentation](https://resend.com/docs)
3. Check Resend dashboard logs
4. Verify environment variables are set correctly
5. Contact Resend support: support@resend.com

---

## ✅ Quick Start Checklist

- [ ] Sign up for Resend account
- [ ] Create and copy API key
- [ ] Add `RESEND_API_KEY` to `.env.local`
- [ ] Add `EMAIL_FROM` to `.env.local`
- [ ] Restart development server
- [ ] Prepare CSV file with email list
- [ ] Create email node in workflow
- [ ] Upload CSV to email node
- [ ] Configure email content via prompt
- [ ] Test with small list first
- [ ] (Production) Verify domain with Resend
- [ ] Run email campaign!

---

**Last Updated:** November 2025
**Version:** 1.0.0
