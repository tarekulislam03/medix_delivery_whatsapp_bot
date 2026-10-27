const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const STATES = require('../flow/states');

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const PERSIST_INTERVAL_MS = 30 * 1000; // 30 seconds
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_MESSAGES_PER_MINUTE = 20;

const DEFAULT_SESSIONS_FILE = path.join(process.cwd(), 'sessions.json');

class SessionStorage {
  constructor(filePath = DEFAULT_SESSIONS_FILE) {
    this.filePath = filePath;
    this.sessions = new Map();
    this.userQueues = new Map(); // phone -> Promise chain for sequential processing

    // Load persisted sessions on startup
    this.loadFromFile();

    // Persist periodically every 30s
    this.persistInterval = setInterval(() => {
      this.saveToFile();
    }, PERSIST_INTERVAL_MS);
    if (this.persistInterval.unref) {
      this.persistInterval.unref();
    }

    // TTL cleanup every 10 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, 10 * 60 * 1000);
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Initializes or returns a clean session object
   * @param {string} phone
   * @returns {object}
   */
  createDefaultSession(phone) {
    return {
      phone,
      lang: null, // null until chosen or default 'en'
      state: STATES.START,
      order: {
        orderId: null,
        orderType: '',
        medicines: '',
        fileLinks: [],
        customerName: '',
        address: '',
        mapLink: '',
        phone: '',
        notes: ''
      },
      editingField: null,
      lastActivity: Date.now(),
      rateLimitWindowStart: Date.now(),
      rateLimitCount: 0
    };
  }

  /**
   * Get session for a phone number
   * @param {string} phone
   * @returns {object}
   */
  get(phone) {
    let session = this.sessions.get(phone);
    const now = Date.now();

    if (!session) {
      session = this.createDefaultSession(phone);
      this.sessions.set(phone, session);
    } else {
      // Check 24-hour expiration
      if (now - session.lastActivity > SESSION_TTL_MS) {
        logger.info({ phone }, 'Session expired due to 24h inactivity; restarting session');
        const lang = session.lang; // preserve preferred language if chosen
        session = this.createDefaultSession(phone);
        session.lang = lang;
        this.sessions.set(phone, session);
      } else {
        session.lastActivity = now;
      }
    }

    return session;
  }

  /**
   * Set or update session
   * @param {string} phone
   * @param {object} sessionData
   */
  set(phone, sessionData) {
    sessionData.lastActivity = Date.now();
    this.sessions.set(phone, sessionData);
  }

  /**
   * Delete session
   * @param {string} phone
   */
  delete(phone) {
    this.sessions.delete(phone);
  }

  /**
   * Resets active order details while preserving language and rate limit
   * @param {string} phone
   */
  resetOrder(phone) {
    const session = this.get(phone);
    session.state = STATES.MAIN_MENU;
    session.editingField = null;
    session.order = {
      orderId: null,
      orderType: '',
      medicines: '',
      fileLinks: [],
      customerName: '',
      address: '',
      mapLink: '',
      phone: '',
      notes: ''
    };
    this.set(phone, session);
  }

  /**
   * Checks rate limiting (20 messages/minute)
   * @param {string} phone
   * @returns {boolean}
   */
  checkRateLimit(phone) {
    const session = this.get(phone);
    const now = Date.now();

    if (now - session.rateLimitWindowStart > RATE_LIMIT_WINDOW_MS) {
      session.rateLimitWindowStart = now;
      session.rateLimitCount = 1;
      return true;
    }

    session.rateLimitCount += 1;
    if (session.rateLimitCount > MAX_MESSAGES_PER_MINUTE) {
      logger.warn({ phone, count: session.rateLimitCount }, 'Rate limit exceeded');
      return false;
    }

    return true;
  }

  /**
   * Enqueues task sequentially per user to prevent race conditions
   * @param {string} phone
   * @param {Function} task - async () => Promise<void>
   * @returns {Promise<any>}
   */
  enqueue(phone, task) {
    const currentQueue = this.userQueues.get(phone) || Promise.resolve();
    const nextQueue = currentQueue.then(task).catch((err) => {
      logger.error({ phone, error: err.message, stack: err.stack }, 'Error in user message queue');
    });

    this.userQueues.set(phone, nextQueue);

    // Clean up queue reference once complete
    nextQueue.finally(() => {
      if (this.userQueues.get(phone) === nextQueue) {
        this.userQueues.delete(phone);
      }
    });

    return nextQueue;
  }

  /**
   * Loads persisted sessions from local JSON file
   */
  loadFromFile() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const data = JSON.parse(raw);
        if (data && typeof data === 'object') {
          for (const [phone, session] of Object.entries(data)) {
            // Check expiry
            if (Date.now() - (session.lastActivity || 0) < SESSION_TTL_MS) {
              this.sessions.set(phone, session);
            }
          }
          logger.info({ count: this.sessions.size }, 'Restored sessions from disk');
        }
      }
    } catch (err) {
      logger.warn({ error: err.message }, 'Failed to restore sessions from file, starting fresh');
    }
  }

  /**
   * Persists sessions to local JSON file atomically
   */
  saveToFile() {
    try {
      const obj = {};
      for (const [phone, session] of this.sessions.entries()) {
        obj[phone] = session;
      }
      const tmpPath = `${this.filePath}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(obj, null, 2), 'utf8');
      fs.renameSync(tmpPath, this.filePath);
    } catch (err) {
      logger.error({ error: err.message }, 'Failed to persist sessions to disk');
    }
  }

  /**
   * Removes sessions older than 24 hours
   */
  cleanupExpired() {
    const now = Date.now();
    let count = 0;
    for (const [phone, session] of this.sessions.entries()) {
      if (now - session.lastActivity > SESSION_TTL_MS) {
        this.sessions.delete(phone);
        count++;
      }
    }
    if (count > 0) {
      logger.info({ count }, 'Pruned expired sessions');
      this.saveToFile();
    }
  }

  destroy() {
    if (this.persistInterval) clearInterval(this.persistInterval);
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    this.saveToFile();
    this.sessions.clear();
    this.userQueues.clear();
  }
}

const sessionManager = new SessionStorage();
module.exports = sessionManager;
module.exports.SessionStorage = SessionStorage;
