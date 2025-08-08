const fs = require('fs');
const chalk = require('chalk');
const {
  default: makeWASocket,
  makeWALegacySocket,
  extractMessageContent,
  makeInMemoryStore,
  proto,
  downloadMediaMessage,
  prepareWAMessageMedia,
  downloadContentFromMessage,
  getBinaryNodeChild,
  jidDecode,
  areJidsSameUser,
  generateWAMessage,
  generateWAMessageContent,
  generateForwardMessageContent,
  generateWAMessageFromContent,
  WAMessageStubType,
  getContentType,
  relayMessage,
  WA_DEFAULT_EPHEMERAL
} = require('@whiskeysockets/baileys');
const moment = require('moment-timezone');

module.exports = frb = (frb, msg, messages, store) => {
  try {
    // Skip processing if message ID starts with BAE5 and is 16 characters long
    if (msg.key.id.startsWith('BAE5') && msg.key.id.length === 16) {
      return;
    }

    const type = getContentType(msg.message);
    const content = JSON.stringify(msg.message);
    const from = msg.key.remoteJid;
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;
    
    // Extract message body based on content type
    var body = (type === 'conversation' && msg.message.conversation) ? msg.message.conversation : 
               (type === 'extendedTextMessage' && msg.message.extendedTextMessage?.text) ? msg.message.extendedTextMessage.text : 
               (type === 'imageMessage' && msg.message.imageMessage?.caption) ? msg.message.imageMessage.caption : 
               (type === 'videoMessage' && msg.message.videoMessage?.caption) ? msg.message.videoMessage.caption : 
               (type === 'documentMessage' && msg.message.documentMessage?.caption) ? msg.message.documentMessage.caption : 
               '';
    
    // Define prefix handling (fixed undefined prefa issue)
    const prefix = typeof prefa !== 'undefined' ? prefa : global.prefix || '.';
    const isCmd = body.startsWith(prefix);
    const command = isCmd ? body.slice(prefix.length).trim().split(' ').shift().toLowerCase() : '';
    const args = body.trim().split(/ +/).slice(1);
    
    const isGroup = from.endsWith('@g.us');
    const sender = isGroup ? msg.participant : msg.key.remoteJid;
    const senderJid = jidDecode(sender) || {};
    const senderNumber = senderJid.user || senderJid.id || sender;
    const senderName = msg.pushName || senderJid.user || senderJid.id || sender;
    const isMe = areJidsSameUser(sender, frb.user.id);
    const isBot = areJidsSameUser(sender, frb.user.id);

    // Handle incoming messages
    if (msg.message) {
      const time = moment().tz('Asia/Jakarta').format('YYYY-MM-DD HH:mm:ss');
      const bgColor = chalk.bgHex('#222831');
      const txtColor = chalk.hex('#00adb5');
      const cmdColor = chalk.hex('#f8b400');
      const senderColor = chalk.hex('#ff2e63');
      const nameColor = chalk.hex('#08d9d6');
      const statusColor = chalk.hex('#393e46');

      const status = isGroup ? 'Group' : 'Private';
      const statusStyled = isGroup
          ? statusColor.bgHex('#f8b400').bold(' [GROUP] ')
          : statusColor.bgHex('#00adb5').bold(' [PRIVATE] ');

      console.log(
        chalk.white.bold('[') +
        chalk.white.bgHex('#ffffff').bold(' NEW UPDATE MESSAGE ') + 
        chalk.white.bold(']  ') + 
        chalk.hex('#ffffff').bgHex('#bb16f7').bold(` ${global.botName || 'Bot'} `) + '\n' +
        bgColor(' ') +
        txtColor(` [${time}] `) +
        statusStyled +
        cmdColor(` CMD: ${isCmd ? command : '-'} `) +
        senderColor(` FROM: ${String(senderNumber).replace(/^(\d{4})\d+(\d{4})$/, '$1*****$2')} `) +
        nameColor(` NAME: ${senderName} `) +
        txtColor(` MSG: ${body.slice(0, 60)}${body.length > 60 ? '...' : ''} `)
      );
    }

    // Example: Send a response back
    if (isCmd) {
      // Handle commands here
      switch (command) {
        case 'ping':
          frb.sendMessage(from, { text: 'Pong!' }, { quoted: msg });
          break;
        case 'time':
          frb.sendMessage(from, { 
            text: `Current time: ${moment().tz('Asia/Jakarta').format('HH:mm:ss')}` 
          }, { quoted: msg });
          break;
        default:
          frb.sendMessage(from, { 
            text: `Unknown command: ${command}\nUse ${prefix}help for available commands` 
          }, { quoted: msg });
      }
    }
  } catch (error) {
    console.error("Error in frb module:", error);
    // Optionally send error notification
    // frb.sendMessage(from, { text: 'An error occurred while processing your request' });
  }
}

let file = require.resolve(__filename);
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  console.log(chalk.redBright(`Update ${__filename}`));
  delete require.cache[file];
  require(file);
});