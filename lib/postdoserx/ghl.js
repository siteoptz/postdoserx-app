// GoHighLevel contact management for PostDoseRX

const PLAN_TAG_PREFIX = 'postdoserx-plan-';

export function extractPostdoserxPlanFromTags(tags) {
  if (!tags?.length) return 'free';
  const tag = tags.find((t) => t.startsWith(PLAN_TAG_PREFIX));
  if (tag) return tag.replace(PLAN_TAG_PREFIX, '');
  return 'free';
}

/** True when GHL env vars are set (login can enforce CRM contact gate). */
export function isGHLConfigured() {
  return !!(process.env.GHL_API_KEY && process.env.GHL_LOCATION_ID);
}

/**
 * Looks up a contact by email. Distinguishes "no CRM", "API error", and "not found".
 * @returns {{ contact: object | null, skipped: boolean, failed: boolean }}
 * - skipped: env not configured — caller should not treat as "must sign up"
 * - failed: HTTP/network error — caller should not force signup (avoid lockout)
 */
export async function searchGHLContactDetailed(email) {
  if (!isGHLConfigured()) {
    console.log('⚠️ GHL API credentials not configured');
    return { contact: null, skipped: true, failed: false };
  }

  const url = new URL(
    'https://services.leadconnectorhq.com/contacts/search/duplicate'
  );
  url.searchParams.set('locationId', process.env.GHL_LOCATION_ID);
  url.searchParams.set('email', email);

  try {
    console.log(`🔍 Searching for GHL contact: ${email}`);

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${process.env.GHL_API_KEY}`,
        Version: '2021-07-28',
      },
    });

    if (!res.ok) {
      console.error(`❌ GHL search failed with status ${res.status}:`, await res.text());
      return { contact: null, skipped: false, failed: true };
    }

    const data = await res.json();
    const contact = data.contact || null;

    if (contact) {
      console.log(`✅ Found existing GHL contact for ${email}:`, contact.id);
    } else {
      console.log(`👤 No existing GHL contact found for ${email}`);
    }

    return { contact, skipped: false, failed: false };
  } catch (error) {
    console.error('❌ Error searching GHL contact:', error);
    return { contact: null, skipped: false, failed: true };
  }
}

export async function searchGHLContact(email) {
  const { contact } = await searchGHLContactDetailed(email);
  return contact;
}

export async function createPostdoserxGHLContact(
  email,
  name,
  plan,
  extra = {}
) {
  if (!process.env.GHL_API_KEY || !process.env.GHL_LOCATION_ID) {
    console.log('⚠️ GHL API credentials not configured');
    return null;
  }

  const tags = [
    `${PLAN_TAG_PREFIX}${plan}`,
    'postdoserx-oauth-signup',
    'postdoserx-stripe-checkout-first',
  ];

  const body = {
    locationId: process.env.GHL_LOCATION_ID,
    email,
    name,
    tags,
    source: 'PostDoseRx — Stripe then Google',
  };

  // Add custom fields for Stripe data if provided
  if (extra.stripeCustomerId) {
    body.customField = {
      stripe_customer_id: extra.stripeCustomerId,
      stripe_session_id: extra.stripeSessionId,
      stripe_subscription_id: extra.stripeSubscriptionId
    };
  }

  try {
    console.log(`👤 Creating GHL contact for ${email} with plan ${plan}`);
    
    const res = await fetch('https://services.leadconnectorhq.com/contacts/', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GHL_API_KEY}`,
        Version: '2021-07-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`❌ GHL contact creation failed with status ${res.status}:`, errorText);
      return null;
    }
    
    const result = await res.json();
    console.log(`✅ Created GHL contact for ${email}:`, result.contact?.id || result.id);
    return result;
  } catch (error) {
    console.error('❌ Error creating GHL contact:', error);
    return null;
  }
}

export async function updateGHLContactPlanTags(contactId, plan) {
  if (!process.env.GHL_API_KEY || !process.env.GHL_LOCATION_ID) {
    console.log('⚠️ GHL API credentials not configured');
    return false;
  }

  try {
    console.log(`🏷️ Updating GHL contact ${contactId} plan to ${plan}`);
    
    // First get current contact to preserve existing tags
    const getRes = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${process.env.GHL_API_KEY}`,
        Version: '2021-07-28',
      },
    });

    if (!getRes.ok) {
      console.error(`❌ Failed to get contact ${contactId}:`, await getRes.text());
      return false;
    }

    const contactData = await getRes.json();
    const currentTags = contactData.contact?.tags || [];
    
    // Remove any existing plan tags and add new one
    const updatedTags = currentTags
      .filter(tag => !tag.startsWith(PLAN_TAG_PREFIX))
      .concat([`${PLAN_TAG_PREFIX}${plan}`]);

    const updateRes = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${process.env.GHL_API_KEY}`,
        Version: '2021-07-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tags: updatedTags
      }),
    });

    if (!updateRes.ok) {
      console.error(`❌ Failed to update contact ${contactId} tags:`, await updateRes.text());
      return false;
    }

    console.log(`✅ Updated GHL contact ${contactId} plan tags to include ${plan}`);
    return true;
  } catch (error) {
    console.error('❌ Error updating GHL contact tags:', error);
    return false;
  }
}