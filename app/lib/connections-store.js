import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import os from "os";
import path from "path";

const APP_DATA_DIR = path.join(os.homedir(), ".dockyard-s3-studio");
const STORE_FILE = path.join(APP_DATA_DIR, "connections.json");
const SECRETS_FILE = path.join(APP_DATA_DIR, "connection-secrets.json");
const LEGACY_STORE_FILE = path.join(process.cwd(), ".connections.json");

function makeDefaultLocalstackConnection() {
  return {
    id: randomUUID(),
    name: "LocalStack (default)",
    provider: "localstack",
    region: process.env.AWS_REGION || "us-east-1",
    endpoint: process.env.AWS_S3_CUSTOM_ENDPOINT_URL || "http://localhost:4566",
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "test",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "test",
    forcePathStyle: true,
    ...(process.env.AWS_SESSION_TOKEN
      ? { sessionToken: process.env.AWS_SESSION_TOKEN }
      : {}),
  };
}

function normalizeProvider(provider) {
  if (
    provider === "aws" ||
    provider === "localstack" ||
    provider === "backblaze" ||
    provider === "cloudflare-r2" ||
    provider === "wasabi" ||
    provider === "digitalocean-spaces" ||
    provider === "minio" ||
    provider === "linode-object-storage" ||
    provider === "oracle-object-storage" ||
    provider === "ibm-cos"
  ) {
    return provider;
  }

  return "localstack";
}

function normalizeEndpoint(endpoint) {
  const value = (endpoint || "").trim();

  if (!value) {
    return "";
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return `https://${value}`;
}

async function ensurePrivateAppDataDir() {
  await fs.mkdir(APP_DATA_DIR, { recursive: true, mode: 0o700 });
  await fs.chmod(APP_DATA_DIR, 0o700).catch(() => {});
}

async function writeJsonFile(filePath, value) {
  await ensurePrivateAppDataDir();
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
  await fs.chmod(filePath, 0o600).catch(() => {});
}

function sanitizeSecretValue(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function getSecretsFromInput(input = {}, existingSecrets = {}) {
  const accessKeyId = sanitizeSecretValue(input.accessKeyId);
  const secretAccessKey = sanitizeSecretValue(input.secretAccessKey);
  const sessionToken = sanitizeSecretValue(input.sessionToken);

  return {
    accessKeyId: accessKeyId || existingSecrets.accessKeyId || "",
    secretAccessKey: secretAccessKey || existingSecrets.secretAccessKey || "",
    ...(sessionToken || existingSecrets.sessionToken
      ? { sessionToken: sessionToken || existingSecrets.sessionToken || "" }
      : {}),
  };
}

function toPublicConnection(connection, secrets = {}) {
  const { accessKeyId, secretAccessKey, sessionToken, ...rest } = connection;

  return {
    ...rest,
    hasAccessKeyId: Boolean(accessKeyId || secrets.accessKeyId),
    hasSecretAccessKey: Boolean(secretAccessKey || secrets.secretAccessKey),
    hasSessionToken: Boolean(sessionToken || secrets.sessionToken),
  };
}

function withSecrets(connection, secrets = {}) {
  return {
    ...connection,
    accessKeyId: secrets.accessKeyId || "",
    secretAccessKey: secrets.secretAccessKey || "",
    ...(secrets.sessionToken ? { sessionToken: secrets.sessionToken } : {}),
  };
}

async function readSecretsFile() {
  try {
    const content = await fs.readFile(SECRETS_FILE, "utf8");
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    if (error.code === "ENOENT") {
      return {};
    }

    throw error;
  }
}

async function writeSecretsFile(secrets) {
  await writeJsonFile(SECRETS_FILE, secrets);
}

function splitLegacyStore(store) {
  const secrets = {};
  const connections = (store.connections || []).map((connection) => {
    const { accessKeyId, secretAccessKey, sessionToken, ...publicConnection } =
      connection;

    secrets[publicConnection.id] = getSecretsFromInput(
      {
        accessKeyId,
        secretAccessKey,
        sessionToken,
      },
      {},
    );

    return toPublicConnection(publicConnection, secrets[publicConnection.id]);
  });

  return {
    store: {
      ...store,
      connections,
    },
    secrets,
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
  await writeJsonFile(STORE_FILE, store);
}

function sanitizeConnection(input, existingId) {
  const provider = normalizeProvider(input.provider);

  return {
    id: existingId || randomUUID(),
    name: (input.name || "Unnamed connection").trim(),
    provider,
    region: (input.region || "us-east-1").trim(),
    endpoint: provider === "aws" ? "" : normalizeEndpoint(input.endpoint),
    forcePathStyle:
      provider === "localstack" ? true : Boolean(input.forcePathStyle),
    ...(input.roleArn ? { roleArn: input.roleArn.trim() } : {}),
    ...(input.externalId ? { externalId: input.externalId.trim() } : {}),
  };
}

export async function getConnectionStore() {
  const fromDisk = await readStoreFile();
  const secrets = await readSecretsFile();

  if (fromDisk && Array.isArray(fromDisk.connections)) {
    const hasInlineSecrets = fromDisk.connections.some(
      (connection) =>
        connection.accessKeyId ||
        connection.secretAccessKey ||
        connection.sessionToken,
    );

    if (hasInlineSecrets) {
      const migrated = splitLegacyStore(fromDisk);
      await writeStoreFile(migrated.store);
      await writeSecretsFile({ ...secrets, ...migrated.secrets });
      return migrated.store;
    }

    return {
      ...fromDisk,
      connections: fromDisk.connections.map((connection) =>
        toPublicConnection(connection, secrets[connection.id]),
      ),
    };
  }

  const initial = {
    connections: [],
    activeConnectionId: null,
  };
  const defaultConnection = makeDefaultLocalstackConnection();
  const { accessKeyId, secretAccessKey, sessionToken, ...publicConnection } =
    defaultConnection;
  const publicStore = {
    ...initial,
    connections: [
      toPublicConnection(publicConnection, {
        accessKeyId,
        secretAccessKey,
        sessionToken,
      }),
    ],
  };
  initial.activeConnectionId = publicConnection.id;
  publicStore.activeConnectionId = publicConnection.id;
  await writeStoreFile(initial);
  await writeSecretsFile({
    [publicConnection.id]: {
      accessKeyId,
      secretAccessKey,
      ...(sessionToken ? { sessionToken } : {}),
    },
  });
  return publicStore;
}

export async function listConnections() {
  return getConnectionStore();
}

export async function createConnection(input) {
  const store = await getConnectionStore();
  const secrets = await readSecretsFile();
  const connection = sanitizeConnection(input);
  const connectionSecrets = getSecretsFromInput(input);
  store.connections.push(toPublicConnection(connection, connectionSecrets));
  secrets[connection.id] = connectionSecrets;

  if (!store.activeConnectionId) {
    store.activeConnectionId = connection.id;
  }

  await writeStoreFile(store);
  await writeSecretsFile(secrets);
  return {
    store,
    connection: toPublicConnection(connection, connectionSecrets),
  };
}

export async function updateConnection(id, input) {
  const store = await getConnectionStore();
  const secrets = await readSecretsFile();
  const index = store.connections.findIndex((item) => item.id === id);

  if (index === -1) {
    return null;
  }

  const updated = sanitizeConnection(input, id);
  const updatedSecrets = getSecretsFromInput(input, secrets[id]);
  store.connections[index] = toPublicConnection(updated, updatedSecrets);
  secrets[id] = updatedSecrets;
  await writeStoreFile(store);
  await writeSecretsFile(secrets);
  return {
    store,
    connection: toPublicConnection(updated, updatedSecrets),
  };
}

export async function deleteConnection(id) {
  const store = await getConnectionStore();
  const secrets = await readSecretsFile();
  const connection = store.connections.find((item) => item.id === id);

  if (!connection) {
    return null;
  }

  store.connections = store.connections.filter((item) => item.id !== id);
  delete secrets[id];

  if (store.connections.length === 0) {
    const fallback = makeDefaultLocalstackConnection();
    const { accessKeyId, secretAccessKey, sessionToken, ...publicConnection } =
      fallback;
    store.connections = [
      toPublicConnection(publicConnection, {
        accessKeyId,
        secretAccessKey,
        sessionToken,
      }),
    ];
    secrets[publicConnection.id] = {
      accessKeyId,
      secretAccessKey,
      ...(sessionToken ? { sessionToken } : {}),
    };
    store.activeConnectionId = publicConnection.id;
  } else if (store.activeConnectionId === id) {
    store.activeConnectionId = store.connections[0].id;
  }

  await writeStoreFile(store);
  await writeSecretsFile(secrets);
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
  const secrets = await readSecretsFile();
  const active = store.connections.find(
    (item) => item.id === store.activeConnectionId,
  );

  if (active) {
    return withSecrets(active, secrets[active.id]);
  }

  const fallback = store.connections[0] || null;
  return fallback ? withSecrets(fallback, secrets[fallback.id]) : null;
}

export async function getConnectionById(id) {
  const store = await getConnectionStore();
  const secrets = await readSecretsFile();
  const connection = store.connections.find((item) => item.id === id);

  return connection ? withSecrets(connection, secrets[connection.id]) : null;
}
