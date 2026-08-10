// events/messageCreate.js
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, StreamType } = require('@discordjs/voice');
const googleTTS = require('google-tts-api');
const { Readable } = require('stream');

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        if (message.author.bot || !message.guild) return;

        // ==========================================
        // 🧹 1. ระบบจัดการแชท (Moderation: !dems)
        // ==========================================
        if (message.content.startsWith('!dems')) {
            if (!message.member.permissions.has('ManageMessages')) {
                return message.reply('❌ คุณไม่มีสิทธิ์ในการลบข้อความครับ!');
            }
            const args = message.content.split(' ');
            const amount = parseInt(args[1]);

            if (isNaN(amount) || amount < 1 || amount > 100) {
                return message.reply('❌ กรุณาระบุจำนวนระหว่าง 1 ถึง 100 ข้อความครับ');
            }
            try {
                const deletedMessages = await message.channel.bulkDelete(amount + 1, true);
                const replyMsg = await message.channel.send(`🚀 <@${message.author.id}> ทำการลบข้อความจำนวน **${deletedMessages.size - 1}** ข้อความเรียบร้อยแล้ว!`);
                setTimeout(() => replyMsg.delete().catch(() => {}), 5000);
            } catch (error) {
                console.error('❌ [Bulk Delete Error]:', error);
            }
            return;
        }

        // ==========================================
        // 🔊 2. ระบบ Text-to-Speech (น้องซูซี่)
        // ==========================================
        const config = client.ttsConfig;

        // 🟢 เปิดอ่านแชท
        if (message.content === 'เปิดอ่านแชท') {
            const voiceChannel = message.guild.channels.cache.get(config.targetVoiceChannel);
            if (!voiceChannel) return message.reply('❌ ไม่พบห้องเสียงที่กำหนด');

            try {
                config.connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: message.guild.id,
                    adapterCreator: message.guild.voiceAdapterCreator,
                    selfDeaf: true, // แนะนำให้ปิดหูบอทไว้ เพื่อประหยัดแบนด์วิธเซิร์ฟเวอร์
                    selfMute: false
                });

                config.player = createAudioPlayer();
                config.connection.subscribe(config.player);
                config.isActive = true;

                config.player.on(AudioPlayerStatus.Idle, () => {
                    config.isPlaying = false;
                    playNextInQueue(client);
                });

                config.player.on('error', error => {
                    console.error('❌ [Audio Player Error]:', error.message, error);
                    config.isPlaying = false;
                    playNextInQueue(client);
                });

                config.connection.on(VoiceConnectionStatus.Disconnected, () => {
                    config.isActive = false;
                });

                return message.reply('<:white_heart:1536417255024492654> ซูซี่พร้อมที่จะอ่านแชทข้อความแล้วค่ะ');
            } catch (error) {
                console.error('❌ [Connection Error]:', error);
                return message.reply('❌ เกิดข้อผิดพลาดในการเชื่อมต่อห้องเสียง');
            }
        }

        // 🔴 ปิดอ่านแชท
        if (message.content === 'ปิดอ่านแชท') {
            if (config.connection) config.connection.destroy();
            config.isActive = false;
            config.connection = null;
            if (config.player) config.player.stop();
            config.queue = [];
            config.isPlaying = false;
            return message.reply('<:white_heart:1536417255024492654> ซูซี่ยกเลิกที่จะอ่านแชทข้อความแล้วค่ะ');
        }

        // 🔊 ดักจับข้อความเข้าคิวอ่าน
        if (config.isActive && message.channel.id === config.targetTextChannel) {
            let textToRead = message.content;
            if (message.attachments.size > 0) textToRead += textToRead ? " และส่งไฟล์" : "ส่งไฟล์";
            textToRead = textToRead.replace(/<a?:([a-zA-Z0-9_]+):\d+>/g, "อิโมจิ $1 ");
            textToRead = textToRead.replace(/https?:\/\/\S+/g, "ส่งลิงก์");
            textToRead = textToRead.trim();

            if (textToRead.length > 0) {
                config.queue.push(textToRead.substring(0, 200));
                if (!config.isPlaying) playNextInQueue(client);
            }
        }
    },
};

// 🛠️ ฟังก์ชันเล่นเสียงที่ได้รับการปรับแต่งสถาปัตยกรรมแล้ว (Robust Audio Pipeline)
async function playNextInQueue(client) {
    const config = client.ttsConfig;

    if (config.queue.length === 0) {
        config.isPlaying = false;
        return;
    }

    config.isPlaying = true;
    const text = config.queue.shift();

    try {
        console.log(`🔊 [TTS Process]: กำลังสร้างเสียงสำหรับ -> "${text}"`);

        // 1. ดึง Base64 จาก Google TTS
        const base64Audio = await googleTTS.getAudioBase64(text, {
            lang: 'th',
            slow: false,
            host: 'https://translate.google.com',
            timeout: 10000,
        });

        // 2. แปลงเป็น Buffer และ Readable Stream
        const buffer = Buffer.from(base64Audio, 'base64');
        const stream = Readable.from(buffer);

        // 3. 🚀 สร้าง Audio Resource พร้อมระบุ StreamType.Arbitrary ให้ FFmpeg ประมวลผล
        const resource = createAudioResource(stream, {
            inputType: StreamType.Arbitrary, // สำคัญมาก! บอกให้บอทรู้ว่านี่คือไฟล์ที่ต้องถูกแปลง
        });

        // 4. เล่นเสียง
        config.player.play(resource);
        console.log(`✅ [TTS Success]: กำลังเล่นเสียง...`);

    } catch (error) {
        console.error('❌ [TTS Generation/Play Error]:', error.message);
        config.isPlaying = false;
        playNextInQueue(client);
    }
}