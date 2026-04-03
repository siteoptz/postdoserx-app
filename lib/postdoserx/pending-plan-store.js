// In-memory storage for pending plans during OAuth flow
// For production, this should be replaced with a database

const store = new Map();
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

export function setPendingPlanFromCheckout(email, data) {
  const entry = {
    plan: data.plan,
    stripeSessionId: data.stripeSessionId,
    stripeCustomerId: data.stripeCustomerId,
    stripeSubscriptionId: data.stripeSubscriptionId,
    createdAt: Date.now()
  };
  
  store.set(normalizeEmail(email), entry);
  console.log(`📝 Stored pending plan for ${email}:`, entry);
}

export function consumePendingPlan(email) {
  const key = normalizeEmail(email);
  const entry = store.get(key);
  
  if (!entry) {
    console.log(`❌ No pending plan found for ${email}`);
    return null;
  }
  
  if (Date.now() - entry.createdAt > TTL_MS) {
    store.delete(key);
    console.log(`⏰ Pending plan expired for ${email}`);
    return null;
  }
  
  store.delete(key);
  console.log(`✅ Consumed pending plan for ${email}:`, entry);
  return entry;
}

export function peekPendingPlan(email) {
  const key = normalizeEmail(email);
  const entry = store.get(key);
  
  if (!entry) {
    return null;
  }
  
  if (Date.now() - entry.createdAt > TTL_MS) {
    store.delete(key);
    return null;
  }
  
  return entry;
}

// Cleanup expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [email, entry] of store.entries()) {
    if (now - entry.createdAt > TTL_MS) {
      store.delete(email);
      console.log(`🧹 Cleaned up expired pending plan for ${email}`);
    }
  }
}, 60 * 60 * 1000); // Clean up every hour