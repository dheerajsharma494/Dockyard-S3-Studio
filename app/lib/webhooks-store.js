import { promises as fs } from "fs";
import os from "os";
import path from "path";

const APP_DATA_DIR = path.join(os.homedir(), ".dockyard-s3-studio");
const WEBHOOKS_FILE = path.join(APP_DATA_DIR, "webhooks.json");
const LEGACY_WEBHOOKS_FILE = path.join(process.cwd(), ".webhooks.json");

async function ensurePrivateAppDataDir() {
  await fs.mkdir(APP_DATA_DIR, { recursive: true, mode: 0o700 });
  await fs.chmod(APP_DATA_DIR, 0o700).catch(() => {});
}

async function readStore() {
  try {
    const raw = await fs.readFile(WEBHOOKS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.webhooks)) {
      return { webhooks: [] };
    }
    return parsed;
  } catch {
    try {
      const raw = await fs.readFile(LEGACY_WEBHOOKS_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed.webhooks) ? parsed : { webhooks: [] };
    } catch {
      return { webhooks: [] };
    }
  }
}

async function writeStore(store) {
  await ensurePrivateAppDataDir();
  await fs.writeFile(WEBHOOKS_FILE, JSON.stringify(store, null, 2), {
    encoding: "utf-8",
    mode: 0o600,
  });
  await fs.chmod(WEBHOOKS_FILE, 0o600).catch(() => {});
}

export async function listWebhooks() {
  const store = await readStore();
  return store.webhooks;
}

export async function getWebhookById(id) {
  if (!id) return null;
  const webhooks = await listWebhooks();
  return webhooks.find((item) => item.id === id) || null;
}

export async function addWebhook(webhook) {
  const store = await readStore();
  const next = {
    id: crypto.randomUUID(),
    event: webhook.event || "*",
    url: webhook.url,
    enabled: webhook.enabled !== false,
    createdAt: new Date().toISOString(),
  };
  store.webhooks.push(next);
  await writeStore(store);
  return next;
}

export async function removeWebhook(id) {
  const store = await readStore();
  const originalLength = store.webhooks.length;
  store.webhooks = store.webhooks.filter((w) => w.id !== id);
  if (store.webhooks.length === originalLength) {
    return false;
  }
  await writeStore(store);
  return true;
}
