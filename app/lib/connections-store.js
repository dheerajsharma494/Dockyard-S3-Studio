import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import os from "os";
import path from "path";

const APP_DATA_DIR = path.join(os.homedir(), ".dockyard-s3-studio");
const STORE_FILE = path.join(APP_DATA_DIR, "connections.json");
const LEGACY_STORE_FILE = path.join(process.cwd(), ".connections.json");

function makeDefaultLocalstackConnection() {
  return {
    id: randomUUID(),
    name: "LocalStack (default)",
    provider: "localstack",
    region: "us-east-1",
    endpoint: process.env.AWS_S3_CUSTOM_ENDPOINT_URL || "http://localhost:4566",
    accessKeyId: "test",
    secretAccessKey: "test",
    forcePathStyle: true,
  };
}

async function readStoreFile() {
  try {
    const content = await fs.readFile(STORE_FILE, "utf8");
    return JSON.parse(content);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  try {
    const content = await fs.readFile(LEGACY_STORE_FILE, "utf8");
    return JSON.parse(content);
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function writeStoreFile(store) {
  await fs.mkdir(APP_DATA_DIR, { recursive: true });
  await fs.writeFile(STORE_FILE, JSON.stringify(store, null, 2), "utf8");
}

function sanitizeConnection(input, existingId) {
  const sanitized = {
    id: existingId || randomUUID(),
    name: (input.name || "Unnamed connection").trim(),
    provider: input.provider === "aws" ? "aws" : "localstack",
    region: (input.region || "us-east-1").trim(),
    endpoint: (input.endpoint || "").trim(),
    accessKeyId: (input.accessKeyId || "").trim(),
    secretAccessKey: (input.secretAccessKey || "").trim(),
    forcePathStyle: Boolean(input.forcePathStyle),
  };

  // Optional AWS fields
  if (input.sessionToken) {
    sanitized.sessionToken = input.sessionToken.trim();
  }
  if (input.roleArn) {
    sanitized.roleArn = input.roleArn.trim();
  }
  if (input.externalId) {
    sanitized.externalId = input.externalId.trim();
  }

  return sanitized;
}

export async function getConnectionStore() {
  const fromDisk = await readStoreFile();

  if (fromDisk && Array.isArray(fromDisk.connections)) {
    return fromDisk;
  }

  const initial = {
    connections: [makeDefaultLocalstackConnection()],
    activeConnectionId: null,
  };
  initial.activeConnectionId = initial.connections[0].id;
  await writeStoreFile(initial);
  return initial;
}

export async function listConnections() {
  return getConnectionStore();
}

export async function createConnection(input) {
  const store = await getConnectionStore();
  const connection = sanitizeConnection(input);
  store.connections.push(connection);

  if (!store.activeConnectionId) {
    store.activeConnectionId = connection.id;
  }

  await writeStoreFile(store);
  return { store, connection };
}

export async function updateConnection(id, input) {
  const store = await getConnectionStore();
  const index = store.connections.findIndex((item) => item.id === id);

  if (index === -1) {
    return null;
  }

  const updated = sanitizeConnection(input, id);
  store.connections[index] = updated;
  await writeStoreFile(store);
  return { store, connection: updated };
}

export async function deleteConnection(id) {
  const store = await getConnectionStore();
  const connection = store.connections.find((item) => item.id === id);

  if (!connection) {
    return null;
  }

  store.connections = store.connections.filter((item) => item.id !== id);

  if (store.connections.length === 0) {
    const fallback = makeDefaultLocalstackConnection();
    store.connections = [fallback];
    store.activeConnectionId = fallback.id;
  } else if (store.activeConnectionId === id) {
    store.activeConnectionId = store.connections[0].id;
  }

  await writeStoreFile(store);
  return store;
}

export async function setActiveConnection(id) {
  const store = await getConnectionStore();
  const exists = store.connections.some((item) => item.id === id);

  if (!exists) {
    return null;
  }

  store.activeConnectionId = id;
  await writeStoreFile(store);
  return store;
}

export async function getActiveConnection() {
  const store = await getConnectionStore();
  const active = store.connections.find(
    (item) => item.id === store.activeConnectionId,
  );
  return active || store.connections[0] || null;
}
