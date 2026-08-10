// events/messageCreate.js
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, getVoiceConnection } = require('@discordjs/voice');
const googleTTS = require('google-tts-api');

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        // ข้ามข้อความที่บอทพิมพ์เอง หรือมาจาก DM
        if (message.author.bot || !message.guild) return;

        const config = client.ttsConfig;

        // 🟢 คำสั่ง: "เปิดอ่านแชท"
        if (message.content === 'เปิดอ่านแชท') {
            const voiceChannel = message.guild.channels.cache.get(config.targetVoiceChannel);
            
            if (!voiceChannel) {
                return message.reply('❌ ไม่พบห้องเสียงที่กำหนดในระบบครับ');
            }

            try {
                // เชื่อมต่อห้องเสียง
                config.connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: message.guild.id,
                    adapterCreator: message.guild.voiceAdapterCreator,
                });

                // สร้าง Audio Player และผูกกับ Connection
                config.player = createAudioPlayer();
                config.connection.subscribe(config.player);
                config.isActive = true;

                // เมื่ออ่านจบ 1 ข้อความ ให้ไปอ่านข้อความถัดไปในคิว
                config.player.on(AudioPlayerStatus.Idle, () => {
                    config.isPlaying = false;
                    playNextInQueue(client);
                });

                return message.reply('<:white_heart:1536417255024492654> ซูซี่พร้อมที่จะอ่านแชทข้อความแล้วค่ะ');
            } catch (error) {
                console.error(error);
                return message.reply('❌ เกิดข้อผิดพลาดในการเชื่อมต่อห้องเสียง');
            }
        }

        // 🔴 คำสั่ง: "ปิดอ่านแชท"
        if (message.content === 'ปิดอ่านแชท') {
            if (config.connection) {
                config.connection.destroy(); // ตัดการเชื่อมต่อ
            }
            // รีเซ็ตสถานะ
            config.isActive = false;
            config.connection = null;
            if (config.player) config.player.stop();
            config.queue = [];
            config.isPlaying = false;

            return message.reply('<:white_heart:1536417255024492654> ซูซี่ยกเลิกที่จะอ่านแชทข้อความแล้วค่ะ');
        }

        // 🔊 ระบบดักจับข้อความเพื่อนำไปอ่าน (เมื่อเปิดใช้งานและพิมพ์ในช่องที่กำหนด)
        if (config.isActive && message.channel.id === config.targetTextChannel) {
            let textToRead = message.content;

            // 1. ตรวจสอบว่ามีการส่งไฟล์/รูปภาพหรือไม่
            if (message.attachments.size > 0) {
                textToRead += textToRead ? " และส่งไฟล์" : "ส่งไฟล์";
            }

            // 2. แปลง Custom Emoji ของ Discord (<:name:id>) ให้เหลือแค่ชื่อ
            textToRead = textToRead.replace(/<a?:([a-zA-Z0-9_]+):\d+>/g, "อิโมจิ $1 ");

            // 3. แปลง URL ให้บอทอ่านว่า "ส่งลิงก์" (เพื่อป้องกันบอทอ่าน URL ยาวๆ)
            textToRead = textToRead.replace(/https?:\/\/\S+/g, "ส่งลิงก์");

            // ลบช่องว่างส่วนเกิน
            textToRead = textToRead.trim();

            if (textToRead.length > 0) {
                // Google TTS จำกัดที่ 200 ตัวอักษรต่อ 1 Request
                const safeText = textToRead.substring(0, 200);
                
                // นำข้อความเข้าคิว
                config.queue.push(safeText);
                
                // ถ้าบอทไม่ได้กำลังพูดอยู่ ให้เริ่มเล่นคิวเลย
                if (!config.isPlaying) {
                    playNextInQueue(client);
                }
            }
        }
    },
};

// 🛠️ ฟังก์ชันสำหรับเล่นเสียงตามคิว (Queue System)
async function playNextInQueue(client) {
    const config = client.ttsConfig;

    // ถ้าคิวว่างเปล่า ให้หยุดทำงาน
    if (config.queue.length === 0) {
        config.isPlaying = false;
        return;
    }

    config.isPlaying = true;
    const text = config.queue.shift(); // ดึงข้อความแรกออกจากคิว

    try {
        // ขอ URL เสียงจาก Google TTS (รองรับภาษาไทย)
        const audioUrl = googleTTS.getAudioUrl(text, {
            lang: 'th',
            slow: false,
            host: 'https://translate.google.com',
        });

        // สร้าง Resource เสียงและสั่งให้ Player เล่น
        const resource = createAudioResource(audioUrl);
        config.player.play(resource);

    } catch (error) {
        console.error('❌ TTS Error:', error);
        config.isPlaying = false;
        playNextInQueue(client); // ข้ามไปเล่นข้อความถัดไปถ้า Error
    }
}