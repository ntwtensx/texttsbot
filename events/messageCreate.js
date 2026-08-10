const { Events } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, getVoiceConnection } = require('@discordjs/voice');
const googleTTS = require('google-tts-api');

// ตัวแปรควบคุมระบบ
let isReadingMode = false;
const TARGET_CHANNEL_ID = '995629374722297946'; // ID สำหรับห้องเสียงและห้องแชท (Voice Chat)

// ระบบคิวเสียง (Audio Queue)
const audioQueue = [];
let isPlaying = false;
const player = createAudioPlayer();

// เมื่อเล่นเสียงจบ ให้เล่นคิวต่อไปอัตโนมัติ
player.on(AudioPlayerStatus.Idle, () => {
    isPlaying = false;
    playNext();
});

// ฟังก์ชันเล่นเสียงทีละคิว
async function playNext(connection) {
    if (audioQueue.length === 0 || isPlaying) return;
    isPlaying = true;
    
    const text = audioQueue.shift(); // ดึงข้อความคิวแรกออกมา
    
    try {
        // สร้าง URL เสียงจาก Google TTS (จำกัด 200 ตัวอักษรต่อ 1 Request สำหรับ API ฟรี)
        const url = googleTTS.getAudioUrl(text, { lang: 'th', slow: false, host: 'https://translate.google.com' });
        const resource = createAudioResource(url);
        
        player.play(resource);
        if (connection) connection.subscribe(player);
    } catch (error) {
        console.error("❌ [TTS Error]:", error);
        isPlaying = false;
        playNext(connection); // ข้ามไปเล่นคิวถัดไปถ้าพัง
    }
}

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {
        // ไม่ตอบสนองถ้าเป็นบอทพิมพ์เอง
        if (message.author.bot) return;

        // ----------------------------------------------------
        // 1. คำสั่ง "เปิดอ่านระบบแชท"
        // ----------------------------------------------------
        if (message.content === 'เปิดอ่านแชท') {
            const channel = client.channels.cache.get(TARGET_CHANNEL_ID);
            
            if (!channel || !channel.isVoiceBased()) {
                return message.reply("❌ ไม่พบห้องเสียงที่กำหนด หรือ ID ไม่ใช่ห้องเสียงครับ");
            }

            // เชื่อมต่อห้องเสียง
            const connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: channel.guild.id,
                adapterCreator: channel.guild.voiceAdapterCreator,
            });

            connection.subscribe(player);
            isReadingMode = true; // เปิดโหมดอ่าน

            return message.reply("<:white_heart:1536417255024492654>ซูซี่พร้อมที่จะอ่านแชทข้อความแล้วค่ะ");
        }

        // ----------------------------------------------------
        // 2. คำสั่ง "ปิดอ่านระบบแชท"
        // ----------------------------------------------------
        if (message.content === 'ปิดอ่านแชท') {
            const connection = getVoiceConnection(message.guild.id);
            if (connection) {
                connection.destroy(); // ตัดการเชื่อมต่อ
            }
            
            isReadingMode = false; // ปิดโหมดอ่าน
            audioQueue.length = 0; // ล้างคิวเสียงทั้งหมด
            isPlaying = false;

            return message.reply("<:white_heart:1536417255024492654>ซูซี่ยกเลิกที่จะอ่านแชทข้อความแล้วค่ะ");
        }

        // ----------------------------------------------------
        // 3. ระบบอ่านแชทอัตโนมัติ
        // ----------------------------------------------------
        if (isReadingMode && message.channel.id === TARGET_CHANNEL_ID) {
            let textToRead = message.content;

            // กรอง 1: หากมีการแนบไฟล์/รูปภาพ
            if (message.attachments.size > 0) {
                textToRead += " ส่งไฟล์";
            }

            // กรอง 2: แปลง Custom Emojis ของ Discord (<:name:id> ให้เหลือแค่ชื่อ)
            textToRead = textToRead.replace(/<:[a-zA-Z0-9_]+:[0-9]+>/g, (match) => {
                return match.split(':')[1]; // ดึงเฉพาะชื่ออิโมจิมาอ่าน
            });
            textToRead = textToRead.replace(/<a:[a-zA-Z0-9_]+:[0-9]+>/g, (match) => {
                return match.split(':')[1]; // ดึงเฉพาะชื่ออิโมจิขยับได้มาอ่าน
            });

            // กรอง 3: เปลี่ยน Link เป็นคำว่า "ส่งลิงก์" เพื่อกันบอทอ่าน URL ยาวๆ
            textToRead = textToRead.replace(/https?:\/\/\S+/g, "ส่งลิงก์");

            textToRead = textToRead.trim();

            if (textToRead.length > 0) {
                // กันข้อความยาวเกิน 200 ตัวอักษร (ข้อจำกัดของ Google TTS ฟรี)
                if (textToRead.length > 195) {
                    textToRead = textToRead.substring(0, 195) + " และอีกมากมาย";
                }

                // นำข้อความเข้าคิว
                audioQueue.push(textToRead);
                
                // เริ่มเล่นเสียง
                const connection = getVoiceConnection(message.guild.id);
                if (connection) playNext(connection);
            }
        }
    }
};