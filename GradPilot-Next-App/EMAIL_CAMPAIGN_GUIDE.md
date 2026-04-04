 📧 Email Campaign Guide - Web Research → Email Agent

## 🎯 How It Works

### Step 1: Web Research Agent
1. Create a **Web Research** node in your campaign
2. Configure filters (checkboxes):
   - ✅ Student Leads (will receive emails)
   - ✅ LinkedIn Profiles
   - ✅ Communities
   - ✅ Competitors
   - ✅ Reddit Users
3. Run the agent
4. It generates a CSV with:
   - Name
   - Type (Student Lead, LinkedIn Profile, etc.)
   - Source URL
   - Relevance (0-100 score)
   - **Email** (extracted email addresses)
   - **Phone** (extracted phone numbers)
   - Contact Info (combined contact)
   - Notes (detailed insights)

### Step 2: Email Campaign Agent
1. Create an **Email** node
2. **Connect Web Research → Email** (drag an edge between them)
3. Write your email:
   - Subject: Your promotional message
   - Body: Use `{{name}}` for personalization
   - Example:
     ```
     Hi {{name}},

     Are you planning to study in the UK? 🇬🇧

     Fateh Education has helped 45,000+ students secure admissions to top UK universities.

     ✅ Free IELTS/PTE training
     ✅ Scholarship guidance
     ✅ 120+ university partnerships

     Book a free counseling session: www.fatheducation.com

     Best regards,
     Fateh Education Team
     ```
4. Click "Run Agent"

### Step 3: What Happens
- Email agent reads the CSV from Web Research
- Extracts all emails from **Student Leads only**
- Sends personalized emails to each student
- **Test copy sent to `jenithspam@gmail.com`** (check this inbox!)
- Results show: ✅ Sent / ❌ Failed

---

## 📊 CSV Format Generated

```csv
Name,Type,Source URL,Relevance,Email,Phone,Contact Info,Notes
"u/student123","Student Lead","https://reddit.com/...","95","student@gmail.com","","student@gmail.com","HOT LEAD - actively seeking scholarships for UK MSc programs"
"John Doe","LinkedIn Profile","https://linkedin.com/in/john-doe","85","","","+91-9876543210","Successful MSc graduate from Imperial College London"
"r/StudyAbroad","Community","https://reddit.com/r/studyabroad","70","","","See URL","Large community for study abroad discussions"
```

---

## 🔧 Email Configuration

**Gmail Account:** `jenithjain09@gmail.com`  
**App Password:** `hpew wnra hbin zvhz`  
**Test Email:** `jenithspam@gmail.com` (ALWAYS receives a copy)  

**Method:**
- Primary: Resend API (if configured)
- Fallback: Gmail/nodemailer (always available)

**Rate Limits:**
- Gmail: 500 emails/day (free account)
- Delay: 1 second between emails

---

## ✅ Filter Settings (Web Research Node)

When you edit the Web Research node, you'll see checkboxes:

- 🎓 **Student Leads** - HOT leads actively seeking help (emails sent to these)
- 💼 **LinkedIn Profiles** - Alumni for testimonials (no emails)
- 👥 **Communities** - Reddit/WhatsApp groups (no emails)
- 🏢 **Competitors** - Other consultancies (no emails)
- 📣 **Reddit Users** - General users (no emails)

**Only Student Leads receive emails!**

---

## 📧 Email Template Best Practices

### Good Subject Lines:
- "🎓 Scholarship Opportunities for UK Universities"
- "Free IELTS Training + Admission Support"
- "Your UK Education Journey Starts Here"

### Good Body Content:
```
Hi {{name}},

I noticed you're looking for guidance on studying in the UK. 

Fateh Education specializes in:
✅ UK & Ireland university placements
✅ Free IELTS/PTE training
✅ Scholarship guidance
✅ 45,000+ successful placements

Would you like a free consultation?

Book here: [link]

Best,
Fateh Education
```

### Use Personalization:
- `{{name}}` - Automatically replaced with student's name
- If no name found, defaults to "there" (e.g., "Hi there,")

---

## 🚀 Step-by-Step Campaign Example

1. **Create Campaign Brief:**
   - "Find Indian students interested in UK masters programs and send them scholarship information"

2. **Add Web Research Node:**
   - Check: ✅ Student Leads
   - Run agent
   - Get 50+ leads with emails

3. **Add Email Node:**
   - Connect Web Research → Email
   - Subject: "🎓 Scholarship Opportunities for UK Universities"
   - Body: Your promotional message with {{name}}
   - Run agent

4. **Check Results:**
   - ✅ 25 emails sent
   - ❌ 2 failed (invalid addresses)
   - 📧 Test copy in jenithspam@gmail.com

---

## ⚠️ Troubleshooting

### No emails extracted?
- Web Research might not have found emails in public sources
- Try different search queries
- LinkedIn profiles often don't have public emails

### Emails failing?
- Check Gmail App Password is correct
- Verify email addresses are valid
- Check Gmail sending limit (500/day)

### Not receiving test email?
- Check spam folder in jenithspam@gmail.com
- Email sending might have failed (check logs)

---

## 🔮 Coming Next: WhatsApp Integration

After email is working, we'll add:
- Extract phone numbers from Web Research CSV
- Send WhatsApp messages directly from the app
- WhatsApp template messages for compliance

---

## 📝 Example Email Template (Copy-Paste Ready)

**Subject:**
```
🎓 UK University Scholarship Opportunities - Fateh Education
```

**Body:**
```
Hi {{name}},

Are you planning to pursue your Masters in the UK? 🇬🇧

Fateh Education has helped 45,000+ students achieve their dream of studying abroad.

📚 What we offer:
✅ Free IELTS/PTE Training
✅ Scholarship Guidance (up to 100% tuition waiver)
✅ 120+ University Partnerships (Russell Group & more)
✅ UK Visa Support
✅ Post-study work guidance

💰 Special Offer for 2025 Intake:
- Free application fee waiver
- Priority scholarship consideration
- Dedicated counselor

📞 Book your FREE consultation:
👉 www.fatheducation.com/book

Don't miss the September 2025 intake deadline!

Best regards,
Team Fateh Education
India's #1 UK Education Consultant

---
📧 Reply to this email or call: +91-XXXXXXXXXX
🌐 www.fatheducation.com
```

---

## ✨ Tips for Better Results

1. **Run Web Research multiple times** with different search keywords
2. **Merge CSVs** to get more leads
3. **A/B test subject lines** to see what works
4. **Track opens/clicks** (upgrade to Resend for analytics)
5. **Follow up** after 3-5 days if no response
