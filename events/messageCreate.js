// events/messageCreate.js
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, StreamType } = require('@discordjs/voice');
const googleTTS = require('google-tts-api');
const { Readable } = require('stream');
// 🚀 โหลดโมดูลสำหรับจัดการกระบวนการของ FFmpeg
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

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
        // 🔊 2. ระบบ Text-to-Speech (น้องซูซี่ - สาวเสียงใส)
        // ==========================================
        const config = client.ttsConfig;

        // 🟢 เปิดอ่านแชท
        if (message.content === 'เปิดอ่านแชท') {
            const voiceChannel = message.guild.channels.cache.get(config.targetVoiceChannel);
            if (!voiceChannel) return message.reply('❌ ไม่พบห้องเสียงที่กำหนด');

            try {
                // เชื่อมต่อห้องเสียง (ต้องมี libsodium-wrappers และ opusscript ถึงจะทำงานได้สมบูรณ์)
                config.connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: message.guild.id,
                    adapterCreator: message.guild.voiceAdapterCreator,
                    selfDeaf: true,  // ปิดหูบอท ลดภาระเซิร์ฟเวอร์
                    selfMute: false
                });

                config.player = createAudioPlayer();
                config.connection.subscribe(config.player);
                config.isActive = true;

                config.player.on(AudioPlayerStatus.Idle, () => {
                    config.isPlaying = false;
                    playNextInQueue(client); // เมื่อพูดจบ ให้เรียกคิวต่อไป
                });

                config.player.on('error', error => {
                    console.error('❌ [Audio Player Error]:', error.message, error);
                    config.isPlaying = false;
                    playNextInQueue(client);
                });

                config.connection.on(VoiceConnectionStatus.Disconnected, () => {
                    config.isActive = false; // ปิดระบบหากถูกเตะออกจากห้อง
                });

                return message.reply('<:white_heart:1536417255024492654> ซูซี่พร้อมใช้งานระบบเสียงสาวใส แล้วค่ะ');
            } catch (error) {
                console.error('❌ [Connection Error]:', error);
                return message.reply('❌ เกิดข้อผิดพลาดในการเชื่อมต่อห้องเสียง ตรวจสอบสิทธิ์ของบอทด้วยครับ');
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
            return message.reply('<:white_heart:1536417255024492654> ซูซี่ยกเลิกการอ่านแชทแล้วค่ะ');
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

// 🛠️ ฟังก์ชันจัดการคิวและ [Audio Signal Processing]
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

        // 1. ดึง Base64 จาก Google TTS (เสียง Original 24000Hz)
        const base64Audio = await googleTTS.getAudioBase64(text, {
            lang: 'th',
            slow: false,
            host: 'https://translate.google.com',
            timeout: 10000,
        });

        const buffer = Buffer.from(base64Audio, 'base64');
        const stream = Readable.from(buffer);

        // 2. 🚀 [Audio Signal Processing by FFmpeg] 
        const ffmpegArgs = [
            '-i', 'pipe:0', 
            '-af', 'asetrate=24000*1.15,aresample=48000,atempo=1/1.15,highpass=f=150,treble=g=4',
            '-f', 's16le',  // แปลงฟอร์แมตเป็น Raw PCM 16-bit เพื่อส่งให้ @discordjs/voice นำไปเข้ารหัส Opus ต่อ
            '-ar', '48000', 
            '-ac', '2',     
            'pipe:1'        
        ];

        // สร้าง Process ประมวลผลคลื่นเสียง
        const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);
        
        // สูบเสียงจาก Google TTS เข้าไปใน FFmpeg
        stream.pipe(ffmpegProcess.stdin);

        // 3. นำเสียงที่ดัดแปลงเสร็จแล้วป้อนให้บอท Discord (ตัว @discordjs/voice จะใช้ opusscript แปลง Raw -> Opus ให้เราอัตโนมัติ)
        const resource = createAudioResource(ffmpegProcess.stdout, {
            inputType: StreamType.Raw,
        });

        // ดักจับ Error จาก FFmpeg
        ffmpegProcess.stderr.on('data', (data) => {
            // Uncomment บรรทัดล่างนี้หากต้องการดู Log การทำงานลึกๆ ของ FFmpeg
            // console.log(`[FFmpeg Log]: ${data}`);
        });

        ffmpegProcess.on('error', (err) => {
            console.error('❌ [FFmpeg Process Error]:', err);
        });

        // 4. สั่งเล่นเสียงที่ผ่านการจูนแล้ว
        config.player.play(resource);
        console.log(`✨ [Audio Engineering Success]: เริ่มเล่นเสียงที่ผ่านการจูนแล้ว`);

    } catch (error) {
        console.error('❌ [TTS Generation/Play Error]:', error.message);
        config.isPlaying = false;
        playNextInQueue(client);
    }
}