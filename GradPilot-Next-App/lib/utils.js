import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Post to LinkedIn
export async function postToLinkedIn(access_token, text) {
  // Get user URN
  const profileRes = await fetch('https://api.linkedin.com/v2/me', {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  const profile = await profileRes.json();
  if (!profile.id) throw new Error('Failed to get LinkedIn profile');
  const author = `urn:li:person:${profile.id}`;
  // Post content
  const postRes = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      author,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    }),
  });
  if (!postRes.ok) throw new Error('Failed to post to LinkedIn');
  return await postRes.json();
}

// Post to Twitter
export async function postToTwitter(access_token, text) {
  const postRes = await fetch('https://api.twitter.com/2/tweets', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });
  if (!postRes.ok) throw new Error('Failed to post to Twitter');
  return await postRes.json();
}
