import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

// Resolve paths for ESM / CJS dual-mode compatibility safely without runtime crashes
let currentDir = '';
try {
  if (typeof __dirname !== 'undefined' && __dirname) {
    currentDir = __dirname;
  } else {
    currentDir = path.dirname(fileURLToPath(import.meta.url));
  }
} catch (e) {
  currentDir = process.cwd();
}

// Allow larger uploads for base64 avatars (< 1.5MB requested, setting threshold to 10MB to be safe)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// MongoDB Helper & Safety Utilities
function sanitizeMongoUri(rawUri: string): string {
  if (!rawUri) return '';
  let uri = rawUri.trim();
  // Strip starting/ending quotes if any
  if ((uri.startsWith('"') && uri.endsWith('"')) || (uri.startsWith("'") && uri.endsWith("'"))) {
    uri = uri.substring(1, uri.length - 1).trim();
    console.log("[CARDNET] Automatically stripped quotes from your connection URI string.");
  }
  return uri;
}

function checkUnescapedSpecialChars(uri: string): string | null {
  try {
    const protoIndex = uri.indexOf('://');
    if (protoIndex === -1) return null;
    let mainPart = uri.substring(protoIndex + 3);
    
    // Remove query params and path to isolate credentials and host
    const queryIndex = mainPart.indexOf('?');
    if (queryIndex !== -1) {
      mainPart = mainPart.substring(0, queryIndex);
    }
    const pathIndex = mainPart.indexOf('/');
    if (pathIndex !== -1) {
      mainPart = mainPart.substring(0, pathIndex);
    }
    
    // isolatest credentials ("user:password" or similar before host)
    const lastAt = mainPart.lastIndexOf('@');
    if (lastAt === -1) return null;
    
    const authPart = mainPart.substring(0, lastAt);
    const colonIndex = authPart.indexOf(':');
    if (colonIndex === -1) return null;
    
    const password = authPart.substring(colonIndex + 1);
    
    // Special characters list
    const rawSpecialChars = ['@', ':', '/', '+', '?', '=', '#', ' '];
    const foundChars = rawSpecialChars.filter(char => password.includes(char));
    
    if (foundChars.length > 0) {
      return `Your password contains raw special characters: [${foundChars.map(c => `'${c}'`).join(', ')}]. In MongoDB connections, special characters in passwords must be URL-encoded (e.g. encode with encodeURIComponent or use %40 for @, %3A for :, %2F for /, %2B for +, %23 for #, etc.).`;
    }
  } catch (e) {
    // safety catch, fail-soft
  }
  return null;
}

function getMongoUri(): { uri: string; source: string } {
  const uri1 = sanitizeMongoUri(process.env.MONGODB_URI || '');
  const uri2 = sanitizeMongoUri(process.env.MANGODB_URI || '');
  
  const isUri1Valid = uri1.startsWith('mongodb://') || uri1.startsWith('mongodb+srv://');
  const isUri2Valid = uri2.startsWith('mongodb://') || uri2.startsWith('mongodb+srv://');
  
  if (isUri2Valid) {
    return { uri: uri2, source: 'MANGODB_URI' };
  }
  if (isUri1Valid) {
    return { uri: uri1, source: 'MONGODB_URI' };
  }
  if (uri2) {
    return { uri: uri2, source: 'MANGODB_URI' };
  }
  return { uri: uri1, source: 'MONGODB_URI' };
}

// Extract selected clean uri and its source identifier
const { uri: mongoUri, source: mongoUriSource } = getMongoUri();
let mongoClient: MongoClient | null = null;
let dbConnected = false;
let dbName = '';
let dbError: string | null = null;
let lastConnectAttempt = 0;
const CONNECT_COOLDOWN = 20000; // 20 seconds cooldown before retrying connection automatically

// Initial high-quality in-memory contacts
let memContacts: any[] = [
  {
    _id: "664ae0b8a07c4b001dafec01",
    firstName: "Alex",
    lastName: "Rivers",
    email: "alex@cardnet.io",
    phone: "+1 (555) 019-2834",
    title: "Lead Architect & Founder",
    organization: "CARDNET Labs",
    website: "https://cardnet.io",
    address: "100 Infinite Loop, Cupertino, CA 95014",
    avatar: "", // Empty will generate initials
    socials: {
      linkedin: "alex-rivers-design",
      twitter: "alexrivers",
      github: "alexrivers",
      instagram: "alex_rivers"
    },
    createdAt: new Date().toISOString()
  },
  {
    _id: "664ae0b8a07c4b001dafec02",
    firstName: "Sarah",
    lastName: "Chen",
    email: "sarah.chen@innovate.co",
    phone: "+44 20 7946 0958",
    title: "VP of Product Engineering",
    organization: "Innovate Labs",
    website: "https://innovatestudios.co",
    address: "88 Shoreditch High St, London E1 6JJ",
    avatar: "", // Initials fallback
    socials: {
      linkedin: "sarah-chen-innovate",
      twitter: "schen_tweets",
      github: "schen-dev",
      instagram: "sarah_p_chen"
    },
    createdAt: new Date().toISOString()
  }
];

// Connection management and error handler
function handleDatabaseError(err: any) {
  dbConnected = false;
  let errMsg = err.message || String(err);
  
  if (errMsg.toLowerCase().includes('auth') || errMsg.toLowerCase().includes('password') || errMsg.toLowerCase().includes('credential') || errMsg.toLowerCase().includes('fail')) {
    const specialWarning = checkUnescapedSpecialChars(mongoUri);
    if (specialWarning) {
      errMsg += `. ${specialWarning}`;
    } else {
      errMsg += ". Hint: Please verify that your MongoDB username and password are correct, and that they correspond to an active Database User in your MongoDB Atlas Security settings. Also ensure that you have configured your Atlas IP Whitelist (Network Access) to allow connections from anywhere (0.0.0.0/0) so that your isolated App environment can access the cluster.";
    }
  }
  
  dbError = errMsg;
  console.error(`[CARDNET] MongoDB database error occurred. Falling back to memory mode.`, dbError);
  
  if (mongoClient) {
    try {
      mongoClient.close();
    } catch (e) {
      // ignore close errors
    }
    mongoClient = null;
  }
}

async function connectMongo() {
  if (!mongoUri) {
    dbError = "MONGODB_URI or MANGODB_URI environment variable is missing";
    console.log("Memory mode active: MONGODB_URI or MANGODB_URI is not set.");
    return;
  }
  
  lastConnectAttempt = Date.now();
  try {
    mongoClient = new MongoClient(mongoUri, {
      connectTimeoutMS: 3000,
      serverSelectionTimeoutMS: 3000
    });
    await mongoClient.connect();
    
    // CRITICAL: Force authentication and pool handshake verification immediately by executing a ping command
    await mongoClient.db().command({ ping: 1 });
    
    dbConnected = true;
    dbName = mongoClient.db().databaseName || 'cardnet';
    dbError = null;
    console.log(`Connected to MongoDB database: "${dbName}" using ${mongoUriSource}`);
  } catch (err: any) {
    handleDatabaseError(err);
  }
}

// Graceful collection resolver
function getContactsCollection() {
  if (dbConnected && mongoClient) {
    try {
      return mongoClient.db().collection('contacts');
    } catch (e) {
      console.error("Could not obtain database collection, handling error and falling back to memory.", e);
      handleDatabaseError(e);
      return null;
    }
  }
  return null;
}

// Middleware to guarantee MongoDB connection matching serverless lifecycles
app.use('/api', async (req, res, next) => {
  const wantsReconnect = req.query.reconnect === 'true';
  const isCooldownActive = (Date.now() - lastConnectAttempt) < CONNECT_COOLDOWN;

  if (!dbConnected && mongoUri) {
    if (wantsReconnect || !isCooldownActive) {
      console.log(`[CARDNET] Lazily connecting to MongoDB for incoming serverless request (wantsReconnect=${wantsReconnect}, cooldownActive=${isCooldownActive})...`);
      try {
        await connectMongo();
      } catch (e) {
        console.error("[CARDNET] Lazy connection during request failed:", e);
      }
    } else {
      // Quietly fall back, logging that we are skipping the connection overhead
      console.log(`[CARDNET] Skipping connection attempt: cooling down. Serving instantly from fallback InMemoryStore.`);
    }
  }
  next();
});

// 1. GET /api/config
app.get('/api/config', (req, res) => {
  res.json({
    configured: !!mongoUri,
    mode: dbConnected ? "database" : "memory",
    connected: dbConnected,
    dbName: dbConnected ? dbName : "InMemoryStore",
    error: dbError,
    uriSource: mongoUriSource
  });
});

// Helper check
function isValidObjectId(id: string): boolean {
  return ObjectId.isValid(id);
}

// 2. GET /api/contacts
app.get('/api/contacts', async (req, res) => {
  try {
    const col = getContactsCollection();
    if (col) {
      try {
        const contacts = await col.find({}).sort({ createdAt: -1 }).toArray();
        return res.json(contacts);
      } catch (queryErr: any) {
        handleDatabaseError(queryErr);
        // Fall through to memory store gracefully
      }
    }
    
    // Memory Store sorted by date desc
    const sorted = [...memContacts].sort((a, b) => 
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
    res.json(sorted);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to retrieve contacts" });
  }
});

// 3. GET /api/contacts/:id
app.get('/api/contacts/:id', async (req, res) => {
  const { id } = req.params;

  const col = getContactsCollection();
  if (col) {
    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid contact ID format to query Database" });
    }
    try {
      const contact = await col.findOne({ _id: new ObjectId(id) });
      if (!contact) {
        return res.status(404).json({ error: "Contact not found" });
      }
      return res.json(contact);
    } catch (err: any) {
      handleDatabaseError(err);
      // Fall through to memory lookup
    }
  }

  // Memory Store lookup
  const contact = memContacts.find(c => c._id === id);
  if (!contact) {
    return res.status(404).json({ error: "Contact not found" });
  }
  res.json(contact);
});

// 4. POST /api/contacts
app.post('/api/contacts', async (req, res) => {
  try {
    const { firstName, lastName, email, phone, title, organization, website, address, avatar, socials } = req.body;
    
    if (!firstName || !lastName) {
      return res.status(400).json({ error: "First Name and Last Name are required" });
    }

    const payload = {
      firstName,
      lastName,
      email: email || '',
      phone: phone || '',
      title: title || '',
      organization: organization || '',
      website: website || '',
      address: address || '',
      avatar: avatar || '',
      socials: {
        linkedin: socials?.linkedin || '',
        twitter: socials?.twitter || '',
        github: socials?.github || '',
        instagram: socials?.instagram || ''
      },
      createdAt: new Date().toISOString()
    };

    const col = getContactsCollection();
    if (col) {
      try {
        const result = await col.insertOne(payload);
        return res.status(201).json({ ...payload, _id: result.insertedId.toString() });
      } catch (err: any) {
        handleDatabaseError(err);
        // Fall through to memory
      }
    }

    // Memory allocation
    const mockId = new ObjectId().toString();
    const newContact = { ...payload, _id: mockId };
    memContacts.push(newContact);
    res.status(201).json(newContact);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to create contact" });
  }
});

// 5. PUT /api/contacts/:id
app.put('/api/contacts/:id', async (req, res) => {
  const { id } = req.params;
  const col = getContactsCollection();

  try {
    const { firstName, lastName, email, phone, title, organization, website, address, avatar, socials } = req.body;
    
    if (!firstName || !lastName) {
      return res.status(400).json({ error: "First Name and Last Name are required" });
    }

    const updatedData = {
      firstName,
      lastName,
      email: email || '',
      phone: phone || '',
      title: title || '',
      organization: organization || '',
      website: website || '',
      address: address || '',
      avatar: avatar || '',
      socials: {
        linkedin: socials?.linkedin || '',
        twitter: socials?.twitter || '',
        github: socials?.github || '',
        instagram: socials?.instagram || ''
      },
      updatedAt: new Date().toISOString()
    };

    if (col) {
      if (!isValidObjectId(id)) {
        return res.status(400).json({ error: "Invalid contact ID format to update Database" });
      }
      try {
        const result = await col.findOneAndUpdate(
          { _id: new ObjectId(id) },
          { $set: updatedData },
          { returnDocument: 'after' }
        );
        if (!result) {
          return res.status(404).json({ error: "Contact not found" });
        }
        return res.json(result);
      } catch (err: any) {
        handleDatabaseError(err);
        // Fall through to memory
      }
    }

    const index = memContacts.findIndex(c => c._id === id);
    if (index === -1) {
      return res.status(404).json({ error: "Contact not found" });
    }
    const existing = memContacts[index];
    const updatedContact = {
      ...existing,
      ...updatedData,
      _id: id // preserve ID
    };
    memContacts[index] = updatedContact;
    res.json(updatedContact);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to update contact" });
  }
});

// 6. DELETE /api/contacts/:id
app.delete('/api/contacts/:id', async (req, res) => {
  const { id } = req.params;
  const col = getContactsCollection();

  try {
    if (col) {
      if (!isValidObjectId(id)) {
        return res.status(400).json({ error: "Invalid contact ID format to delete from Database" });
      }
      try {
        const result = await col.deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) {
          return res.status(404).json({ error: "Contact not found" });
        }
        return res.json({ success: true });
      } catch (err: any) {
        handleDatabaseError(err);
        // Fall through to memory
      }
    }

    const index = memContacts.findIndex(c => c._id === id);
    if (index === -1) {
      return res.status(404).json({ error: "Contact not found" });
    }
    memContacts.splice(index, 1);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to delete contact" });
  }
});

// Async wrapper to avoid Top-Level Await inside CJS compiled target
async function startServer() {
  // Connect asynchronously in standalone mode without blocking boot. 
  // On Vercel, lazy middleware will connect on the first incoming request.
  if (!process.env.VERCEL) {
    connectMongo().catch((err) => {
      console.error("[CARDNET] Standalone server background connection failed:", err);
    });
  }

  // Vite middleware integration
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Bypasses executing app.listen() when the process.env.VERCEL environment variable is present.
  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`[CARDNET] Server running on port ${PORT}`);
    });
  }
}

// Call start function catching any potential startup failures
startServer().catch((err) => {
  console.error("Fatal exception during server boot:", err);
});

export default app;
