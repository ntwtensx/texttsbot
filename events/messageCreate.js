const { Events } = require('discord.js');
const { 
    joinVoiceChannel, 
    createAudioPlayer, 
    createAudioResource, 
    AudioPlayerStatus, 
    getVoiceConnection,
    VoiceConnectionStatus,
    NoSubscriberBehavior
} = require('@discordjs/voice');
const googleTTS = require('google-tts-api');

// ⚙️ [Config]: ตั้งค่าเป้าหมายและตัวแปรสถานะ
let isReadingMode = false;
const TARGET_CHANNEL_ID = '995629374722297946';

// 🎛️ [Audio Player]: สร้างเครื่องเล่นเสียงที่มีความทนทานต่อข้อผิดพลาด (Fault Tolerance)
const player = createAudioPlayer({
    behaviors: {
        noSubscriber: NoSubscriberBehavior.Play,
    },
});

// 📚 [Queue System]: ระบบจัดคิวเสียงเพื่อไม่ให้บอทพูดแทรกกัน
const audioQueue = [];
let isPlaying = false;

// จัดการสถานะเครื่องเล่นเสียง
player.on(AudioPlayerStatus.Idle, () => {
    isPlaying = false;
    playNext();
});

player.on('error', error => {
    console.error(`❌ [Audio Player Error]: ${error.message}`);
    isPlaying = false;
    playNext();
});

// 🗣️ [TTS Function]: ฟังก์ชันดึงเสียงและเล่น
async function playNext(connection = null) {
    if (audioQueue.length === 0) {
        isPlaying = false;
        return;
    }
    if (isPlaying) return;

    isPlaying = true;
    const text = audioQueue.shift();
    
    try {
        console.log(`⏳ [TTS] ประมวลผล: "${text}"`);
        // ดึง URL เสียงจาก Google Translate API
        const url = googleTTS.getAudioUrl(text, { 
            lang: 'th', 
            slow: false, 
            host: 'https://translate.google.com' 
        });
        
        const resource = createAudioResource(url);
        player.play(resource);
    } catch (error) {
        console.error("❌ [TTS API Error]:", error);
        isPlaying = false;
        playNext();
    }
}

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {
        // 🐛 [Debug]: เช็คว่าบอทได้รับข้อความจริงๆ (ช่วยตรวจสอบเรื่อง Intents)
        // console.log(`💬 [Chat] ${message.author.tag}: ${message.content}`);

        if (message.author.bot) return; // ข้ามข้อความจากบอทด้วยกัน

        // 🟢 [Command]: เปิดระบบ
        if (message.content === 'เปิดอ่านระบบแชท') {
            const channel = client.channels.cache.get(TARGET_CHANNEL_ID);
            
            if (!channel || !channel.isVoiceBased()) {
                return message.reply("❌ ไม่พบห้องเสียงที่กำหนดครับ");
            }

            try {
                const connection = joinVoiceChannel({
                    channelId: channel.id,
                    guildId: channel.guild.id,
                    adapterCreator: channel.guild.voiceAdapterCreator,
                });

                connection.subscribe(player);
                isReadingMode = true;

                return message.reply("<:white_heart:1536417255024492654>ซูซี่พร้อมที่จะอ่านแชทข้อความแล้วค่ะ");
            } catch (error) {
                console.error("❌ [Voice Error]:", error);
                return message.reply("❌ เกิดข้อผิดพลาดในการเข้าห้องเสียง ตรวจสอบสิทธิ์ด้วยครับ");
            }
        }

        // 🔴 [Command]: ปิดระบบ
        if (message.content === 'ปิดอ่านระบบแชท') {
            const connection = getVoiceConnection(message.guild.id);
            if (connection) connection.destroy();
            
            isReadingMode = false;
            audioQueue.length = 0; // ล้างคิวทิ้ง
            isPlaying = false;

            return message.reply("<:white_heart:1536417255024492654>ซูซี่ยกเลิกที่จะอ่านแชทข้อความแล้วค่ะ");
        }

        // 🎙️ [Auto Reading Logic]: ประมวลผลและอ่านข้อความ
        if (isReadingMode && message.channel.id === TARGET_CHANNEL_ID) {
            let textToRead = message.content;

            // 1. กรองไฟล์แนบ
            if (message.attachments.size > 0) textToRead += " ส่งไฟล์";

            // 2. กรอง Emoji พิเศษ (ดึงเฉพาะชื่อมาอ่าน)
            textToRead = textToRead.replace(/<:[a-zA-Z0-9_]+:[0-9]+>/g, match => match.split(':')[1]);
            textToRead = textToRead.replace(/<a:[a-zA-Z0-9_]+:[0-9]+>/g, match => match.split(':')[1]);
            
            // 3. กรอง Links
            textToRead = textToRead.replace(/https?:\/\/\S+/g, "ส่งลิงก์");

            textToRead = textToRead.trim();

            if (textToRead.length > 0) {
                // กันข้อความยาวเกินลิมิต Google TTS (200 ตัวอักษร)
                if (textToRead.length > 195) {
                    textToRead = textToRead.substring(0, 195) + " และอีกมากมาย";
                }

                audioQueue.push(textToRead);
                
                const connection = getVoiceConnection(message.guild.id);
                if (connection && connection.state.status === VoiceConnectionStatus.Ready) {
                    playNext(connection);
                } else if (connection) {
                    connection.once(VoiceConnectionStatus.Ready, () => playNext(connection));
                }
            }
        }
    }
};