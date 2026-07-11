const subscribers = new Map();

function userKey(userId) {
  return String(userId);
}

export function subscribeNotifications(userId, res) {
  const key = userKey(userId);
  if (!subscribers.has(key)) subscribers.set(key, new Set());
  subscribers.get(key).add(res);

  const cleanup = () => {
    subscribers.get(key)?.delete(res);
    if (subscribers.get(key)?.size === 0) subscribers.delete(key);
  };

  res.on('close', cleanup);
  return cleanup;
}

export function publishNotification(userId, payload) {
  const set = subscribers.get(userKey(userId));
  if (!set?.size) return;

  const data = JSON.stringify(payload);
  for (const res of set) {
    try {
      res.write(`data: ${data}\n\n`);
    } catch {
      set.delete(res);
    }
  }
}
