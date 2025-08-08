require('./config');
const {
  default: makeWASocket, // Changed from makeWafredev to makeWASocket
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  generateForwardMessageContent,
  generateWAMessage,
  prepareWAMessageMedia,
  generateWAMessageFromContent,
  generateMessageID,
  downloadContentFromMessage,
  makeInMemoryStore,
  jidDecode,
  proto,
  makeCacheableSignalKeyStore,
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const readline = require('readline');
const NodeCache = require('node-cache');

// Configuration
const useMobile = process.argv.includes("--mobile");
const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) });
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function startBot() {
  try {
    // Authentication setup
    const { state, saveCreds } = await useMultiFileAuthState('./session');
    const msgRetryCounterCache = new NodeCache();
    
    const auth = {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino().child({ level: 'fatal', stream: 'store' })),
    };

    // Fetch latest Baileys version
    const { version } = await fetchLatestBaileysVersion();

    // Create WhatsApp connection
    const frb = makeWASocket({
      version,
      printQRInTerminal: !global.usePairingCode,
      logger: pino({ level: 'silent' }),
      mobile: useMobile,
      auth,
      browser: ['Mac OS', 'Safari', '10.15.7'],
      
      // Message patching for buttons/templates
      patchMessageBeforeSending: (message) => {
        const requiresPatch = !!(
          message.buttonsMessage ||
          message.templateMessage ||
          message.listMessage
        );
        
        if (requiresPatch) {
          return {
            viewOnceMessage: {
              message: {
                messageContextInfo: {
                  deviceListMetadataVersion: 2,
                  deviceListMetadata: {},
                },
                ...message,
              },
            },
          };
        }
        return message;
      },
      
      // Connection settings
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 0,
      keepAliveIntervalMs: 10000,
      emitOwnEvents: true,
      fireInitQueries: true,
      generateHighQualityLinkPreview: true,
      syncFullHistory: false, // Changed from true to false for better performance
      markOnlineOnConnect: true,
      
      // Message handling
      getMessage: async (key) => {
        if (store) {
          const msg = await store.loadMessage(key.remoteJid, key.id);
          return msg?.message || undefined;
        }
        return {
          conversation: "FRBot by Fredev Online!!"
        };
      },
      
      msgRetryCounterCache,
    });

    // Pairing code handling
    if (global.usePairingCode && !frb.authState.creds.registered) {
      console.log('Masukkan Nomor WhatsApp Kamu Diawali Oleh angka 62:');
      let phoneNumber = await question('Nomor Whatsapp Ter-Input: ');
      phoneNumber = phoneNumber.replace(/\D/g, '');
      
      if (!phoneNumber.startsWith('62')) {
        console.log('Nomor harus diawali dengan 62');
        process.exit(1);
      }
      
      const code = await frb.requestPairingCode(phoneNumber, "FREDEVEL");
      console.log(`┏━━  *「 Kode Pairing Kamu」*\n┃ ❖ ${code}\n┗━━━━━━━━━━━━━━━━━━┅`);
    }

    // Bind store to events
    store.bind(frb.ev);

    // Credentials update handler
    frb.ev.on('creds.update', saveCreds);

    // Connection update handler
    frb.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect } = update;
      
      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect.error = new Boom(lastDisconnect?.error))?.output?.statusCode !== DisconnectReason.loggedOut;
        
        if (shouldReconnect) {
          console.log('Connection lost, reconnecting...');
          setTimeout(startBot, 5000); // Added delay before reconnecting
        } else {
          console.log('Logged out, please restart the bot');
        }
      } else if (connection === 'open') {
        console.log('Bot is connected and ready');
      }
    });

    // Message handler
    frb.ev.on('messages.upsert', async ({ messages, type }) => {
      try {
        if (type !== 'notify') return;
        
        const msg = messages[0];
        if (!msg?.message) return;
        
        // Handle ephemeral messages
        if (msg.message.ephemeralMessage) {
          msg.message = msg.message.ephemeralMessage.message;
        }
        
        // Ignore certain messages
        if (msg.key.fromMe) return; // Ignore self messages
        if (msg.key.remoteJid === 'status@broadcast') return; // Ignore status updates
        if (msg.key.id.startsWith('BAE5') && msg.key.id.length === 16) return; // Ignore specific message IDs
        
        // Process the message
        require("./case")(frb, msg, messages, store);
      } catch (error) {
        console.error('Error processing message:', error);
      }
    });

    // Clean exit handler
    process.on('SIGINT', () => {
      console.log('Shutting down gracefully...');
      rl.close();
      process.exit();
    });

  } catch (error) {
    console.error('Bot startup error:', error);
    setTimeout(startBot, 10000); // Restart after error with delay
  }
}

// Start the bot
startBot();