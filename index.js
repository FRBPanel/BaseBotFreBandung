require('./config');
const {
  default: makeWafredev,
	connConnect,
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
  PHONENUMBER_MCC,
  jidDecode,
  proto,
  makeCacheableSignalKeyStore,
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const readline = require('readline');
const useMobile = process.argv.includes("--mobile")
const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) })
const NodeCache = require('node-cache');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const question = (text) => new Promise((resolve) => rl.question(text, resolve))

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState(`./session`)
    const msgRetryCounterCache = new NodeCache()
    const auth = {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino().child({ level: 'fatal', stream: 'store' })),
    }

    const { version, isLatest } = await fetchLatestBaileysVersion()
const frb = makeWafredev ({
version,
printQRInTerminal: !global.usePairingCode,
logger: pino({ level: 'silent' }),
mobile: useMobile, // mobile api (prone to bans)
auth,
browser: [ 'Mac OS', 'Safari', '10.15.7' ],
patchMessageBeforeSending: (message) => {
            const requiresPatch = !!(
                message.buttonsMessage ||
                message.templateMessage ||
                message.listMessage
            );
            if (requiresPatch) {
                message = {
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
auth: {
         creds: state.creds,
         keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }).child({ level: "fatal" })),
      },
connectTimeoutMs: 60000,
defaultQueryTimeoutMs: 0,
keepAliveIntervalMs: 10000,
emitOwnEvents: true,
fireInitQueries: true,
generateHighQualityLinkPreview: true,
syncFullHistory: true,
markOnlineOnConnect: true,
      getMessage: async (key) => {
            if (store) {
                const msg = await store.loadMessage(key.remoteJid, key.id)
                return msg.message || undefined
            }
            return {
                conversation: "FRBot by Fredev Online!!"
            }
        },
      msgRetryCounterCache, // Resolve waiting messages
      defaultQueryTimeoutMs: undefined, // for this issues https://github.com/Whiskeychanzxets/Baileys/issues/276
})

if (global.usePairingCode && !frb.authState.creds.registered) {
    console.log('Masukkan Nomor WhatsApp Kamu Diawali Oleh angka 62:')
		let phoneNumber = await question('Nomor Whatsapp Ter-Input: ')
		phoneNumber = phoneNumber.replace(/\D/g, '')
		let code = await chanzx.requestPairingCode(phoneNumber, "FREDEVEL")
		console.log(`┏━━  *「 Kode Pairing Kamu」*\n┃ ❖ ${code}\n┗━━━━━━━━━━━━━━━━━━┅`)
	}

    store.bind(frb.ev)

    frb.ev.on('creds.update', saveCreds);

    frb.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if(connection === 'close') {
            const shouldReconnect = (lastDisconnect.error = new Boom(lastDisconnect?.error))?.output?.statusCode !== DisconnectReason.loggedOut;
            if(shouldReconnect) {
                startBot();
            }
        } else if(connection === 'open') {
            console.log('Bot is connected');
        }
    });

    frb.ev.on('messages.upsert', async ({ messages, type }) => {
        let msg = messages[0];
                if (!msg.message) {
                    return;
                }
                msg.message = Object.keys(msg.message)[0] === 'ephemeralMessage' ? msg.message.ephemeralMessage.message : msg.message;
                // Abaikan pesan bot sendiri
        if (msg.key.fromMe) return; // Pesan ini berasal dari bot
                if (msg.key && msg.key.remoteJid === 'status@broadcast') {
                    return;
                }
                if (msg.key.id.startsWith('BAE5') && msg.key.id.length === 16) {
                    return;
                }
                require("./case")(frb, msg, messages, store);
                /*
        if(type === 'notify') {
            const msg = messages[0];
            if(!msg.key.fromMe && msg.message) {
                await chanzx.sendMessage(msg.key.remoteJid, { text: 'Halo, ini bot WhatsApp!' });
            }
        }*/
    });
}

startBot();
