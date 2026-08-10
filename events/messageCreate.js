// events/messageCreate.js
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus } = require('@discordjs/voice');
const googleTTS = require('google-tts-api');
const { Readable } = require('stream');

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        // ข้ามข้อความที่บอทพิมพ์เอง หรือมาจาก DM เพื่อป้องกันลูปอินฟินิตี้
        if (message.author.bot || !message.guild) return;

        // ==========================================
        // 🧹 1. ระบบจัดการแชท (Moderation: ลบข้อความ)
        // ==========================================
        if (message.content.startsWith('!dems')) {
            // เช็คสิทธิ์ความปลอดภัย: ต้องมีสิทธิ์ลบข้อความ ถึงจะใช้คำสั่งนี้ได้
            if (!message.member.permissions.has('ManageMessages')) {
                return message.reply('❌ คุณไม่มีสิทธิ์ในการลบข้อความครับ!');
            }

            // แยกข้อความเพื่อหาจำนวนที่ต้องการลบ (เช่น "!dems 10" -> args[1] คือ "10")
            const args = message.content.split(' ');
            const amount = parseInt(args[1]);

            // ตรวจสอบความถูกต้องของตัวเลข (Validation)
            if (isNaN(amount)) {
                return message.reply('❌ กรุณาระบุจำนวนข้อความที่ต้องการลบ เช่น `!dems 10`');
            } else if (amount < 1 || amount > 100) {
                return message.reply('❌ กรุณาระบุจำนวนระหว่าง 1 ถึง 100 ข้อความครับ (ข้อจำกัดของ Discord API)');
            }

            try {
                // บวก 1 เข้าไปใน amount เพื่อให้ลบตัวคำสั่ง '!dems' ของผู้ใช้ทิ้งไปด้วย
                // พารามิเตอร์ true ตัวหลังคือ filterOld ป้องกัน Error จากการลบข้อความที่เก่าเกิน 14 วัน
                const deletedMessages = await message.channel.bulkDelete(amount + 1, true);
                
                // แจ้งผลการทำงานให้ผู้ใช้ทราบ (ลบออก 1 จาก length เพื่อไม่นับคำสั่งตัวเอง)
                const replyMsg = await message.channel.send(`🚀 <@${message.author.id}> ทำการลบข้อความจำนวน **${deletedMessages.size - 1}** ข้อความเรียบร้อยแล้ว!`);
                
                // UX Design: ลบข้อความแจ้งเตือนตัวเองทิ้งหลังจากผ่านไป 5 วินาที เพื่อให้ห้องแชทสะอาด
                setTimeout(() => {
                    replyMsg.delete().catch(() => {}); // ใช้ catch ป้องกัน Error กรณีมีคนมือไวลบข้อความนี้ไปก่อน
                }, 5000);

            } catch (error) {
                console.error('❌ [Bulk Delete Error]:', error);
                return message.channel.send('❌ เกิดข้อผิดพลาด! ไม่สามารถลบได้ (อาจมีแต่ข้อความที่เก่าเกิน 14 วัน)');
            }
            
            return; // จบการทำงานในบล็อกนี้ ไม่ส่งข้อความคำสั่งลบไปให้บอทอ่านออกเสียง
        }


        // ==========================================
        // 🔊 2. ระบบ Text-to-Speech (น้องซูซี่)
        // ==========================================
        const config = client.ttsConfig;

        // 🟢 คำสั่ง: "เปิดอ่านแชท"
        if (message.content === 'เปิดอ่านแชท') {
            const voiceChannel = message.guild.channels.cache.get(config.targetVoiceChannel);
            
            if (!voiceChannel) {
                return message.reply('❌ ไม่พบห้องเสียงที่กำหนดในระบบครับ');
            }

            try {
                config.connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: message.guild.id,
                    adapterCreator: message.guild.voiceAdapterCreator,
                    selfDeaf: false,
                    selfMute: false
                });

                config.player = createAudioPlayer();
                config.connection.subscribe(config.player);
                config.isActive = true;

                // Event Listeners สำหรับ Player
                config.player.on(AudioPlayerStatus.Idle, () => {
                    config.isPlaying = false;
                    playNextInQueue(client);
                });

                config.player.on('error', error => {
                    console.error('❌ [Audio Player Error]:', error.message);
                    config.isPlaying = false;
                    playNextInQueue(client);
                });

                config.connection.on(VoiceConnectionStatus.Disconnected, () => {
                    console.log('⚠️ บอทถูกตัดเชื่อมต่อออกจากห้องเสียง');
                    config.isActive = false;
                });

                return message.reply('<:white_heart:1536417255024492654> ซูซี่พร้อมที่จะอ่านแชทข้อความแล้วค่ะ');
            } catch (error) {
                console.error('❌ [Connection Error]:', error);
                return message.reply('❌ เกิดข้อผิดพลาดในการเชื่อมต่อห้องเสียง');
            }
        }

        // 🔴 คำสั่ง: "ปิดอ่านแชท"
        if (message.content === 'ปิดอ่านแชท') {
            if (config.connection) {
                config.connection.destroy();
            }
            config.isActive = false;
            config.connection = null;
            if (config.player) config.player.stop();
            config.queue = [];
            config.isPlaying = false;

            return message.reply('<:white_heart:1536417255024492654> ซูซี่ยกเลิกที่จะอ่านแชทข้อความแล้วค่ะ');
        }

        // 🔊 ระบบดักจับข้อความเพื่อส่งเข้าคิวอ่าน
        if (config.isActive && message.channel.id === config.targetTextChannel) {
            let textToRead = message.content;

            if (message.attachments.size > 0) {
                textToRead += textToRead ? " และส่งไฟล์" : "ส่งไฟล์";
            }

            textToRead = textToRead.replace(/<a?:([a-zA-Z0-9_]+):\d+>/g, "อิโมจิ $1 ");
            textToRead = textToRead.replace(/https?:\/\/\S+/g, "ส่งลิงก์");
            textToRead = textToRead.trim();

            if (textToRead.length > 0) {
                const safeText = textToRead.substring(0, 200);
                config.queue.push(safeText);
                
                if (!config.isPlaying) {
                    playNextInQueue(client);
                }
            }
        }
    },
};

// 🛠️ ฟังก์ชันเล่นเสียงจาก Queue ด้วย Base64 Stream (ป้องกัน Google Block IP)
async function playNextInQueue(client) {
    const config = client.ttsConfig;

    if (config.queue.length === 0) {
        config.isPlaying = false;
        return;
    }

    config.isPlaying = true;
    const text = config.queue.shift();

    try {
        console.log(`🔊 [TTS Speaking]: "${text}"`);

        const base64Audio = await googleTTS.getAudioBase64(text, {
            lang: 'th',
            slow: false,
            host: 'https://translate.google.com',
            timeout: 10000,
        });

        const buffer = Buffer.from(base64Audio, 'base64');
        const stream = Readable.from(buffer);

        const resource = createAudioResource(stream);
        config.player.play(resource);

    } catch (error) {
        console.error('❌ [TTS Generation Error]:', error.message);
        config.isPlaying = false;
        playNextInQueue(client); // ล้มเหลวก็ข้ามไปอ่านคิวถัดไปเลย
    }
}