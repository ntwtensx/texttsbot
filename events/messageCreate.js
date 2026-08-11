// events/messageCreate.js
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, StreamType } = require('@discordjs/voice');
const googleTTS = require('google-tts-api');
const { Readable } = require('stream');
// 🚀 [Audio Engineering] โหลดโมดูลสำหรับจัดการกระบวนการของ FFmpeg
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
                config.connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: message.guild.id,
                    adapterCreator: message.guild.voiceAdapterCreator,
                    selfDeaf: true,
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

                return message.reply('<:white_heart:1536417255024492654> ซูซี่ปรับจูนเสียงใหม่ พร้อมอ่านแชทแล้วค่ะ');
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
        // สร้าง Pipeline ดัดแปลงคลื่นเสียงแบบ Real-time
        const ffmpegArgs = [
            '-i', 'pipe:0', // รับ Input จาก Stream (Google TTS)
            '-af', 'asetrate=24000*1.15,aresample=48000,atempo=1/1.15,highpass=f=150,treble=g=4',
            /* คำอธิบาย Audio Filters (Design):
               - asetrate=24000*1.15 : ดัน Pitch เสียงให้สูงขึ้น 15% (เป็นสาวขึ้น)
               - aresample=48000     : ปรับสเกลเสียงให้เข้ากับมาตรฐาน Discord
               - atempo=1/1.15       : ดึงความเร็วกลับมาให้เท่าเดิม (จะได้ไม่พูดเร็วไป)
               - highpass=f=150      : ตัดเสียงทุ้ม/เสียงอู้อี้ที่ต่ำกว่า 150Hz ทิ้ง (ให้เสียงใส)
               - treble=g=4          : ดันปลายเสียงแหลมเพิ่มขึ้น 4 เดซิเบล (เพิ่มประกายเสียง)
            */
            '-f', 's16le',  // แปลงฟอร์แมตเป็น Raw PCM 16-bit
            '-ar', '48000', // อัตราสุ่มสัญญาณ (Sample Rate)
            '-ac', '2',     // ระบบเสียงสเตอริโอ 2 แชนเนล
            'pipe:1'        // ปล่อย Output ออกไปยัง Discord Player
        ];

        // สร้าง Process ประมวลผลคลื่นเสียง
        const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);
        
        // สูบเสียงจาก Google TTS เข้าไปใน FFmpeg
        stream.pipe(ffmpegProcess.stdin);

        // 3. นำเสียงที่ดัดแปลงเสร็จแล้วป้อนให้บอท Discord ในรูปแบบ Raw Stream
        const resource = createAudioResource(ffmpegProcess.stdout, {
            inputType: StreamType.Raw,
        });

        // ดักจับ Error จาก FFmpeg ป้องกันบอทแครช
        ffmpegProcess.on('error', (err) => {
            console.error('❌ [FFmpeg Error]:', err);
        });

        // 4. สั่งเล่นเสียงที่ผ่านการจูนแล้ว
        config.player.play(resource);
        console.log(`✨ [Audio Engineering Success]: กำลังเล่นเสียงสาวน้อยใสๆ...`);

    } catch (error) {
        console.error('❌ [TTS Generation/Play Error]:', error.message);
        config.isPlaying = false;
        playNextInQueue(client);
    }
}