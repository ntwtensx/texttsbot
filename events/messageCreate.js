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

// ตัวแปรควบคุมระบบ
let isReadingMode = false;
const TARGET_CHANNEL_ID = '995629374722297946';

// สร้าง Audio Player แบบมีประสิทธิภาพ
const player = createAudioPlayer({
    behaviors: {
        noSubscriber: NoSubscriberBehavior.Play, // เล่นเสียงแม้จะยังไม่มีคนฟังเพื่อกันบัค
    },
});

// ระบบคิวเสียง
const audioQueue = [];
let isPlaying = false;

// ----------------------------------------------------
// ระบบ Debug และการจัดการสถานะ Player
// ----------------------------------------------------
player.on(AudioPlayerStatus.Playing, () => {
    console.log('🔊 [Audio Player] กำลังเล่นเสียง...');
});

player.on(AudioPlayerStatus.Idle, () => {
    console.log('✅ [Audio Player] เล่นเสียงจบแล้ว กำลังตรวจสอบคิวถัดไป');
    isPlaying = false;
    playNext();
});

player.on('error', error => {
    console.error(`❌ [Audio Player Error]: ${error.message}`);
    isPlaying = false;
    playNext(); // ข้ามไปเล่นคิวต่อไปเพื่อไม่ให้ระบบค้าง
});

// ----------------------------------------------------
// ฟังก์ชันเล่นเสียง (อัปเกรดความเสถียร)
// ----------------------------------------------------
async function playNext(connection = null) {
    if (audioQueue.length === 0) {
        isPlaying = false;
        return;
    }
    if (isPlaying) return;

    isPlaying = true;
    const text = audioQueue.shift();
    
    try {
        console.log(`⏳ [TTS] กำลังประมวลผลข้อความ: "${text}"`);
        
        // สร้าง URL จาก Google TTS API
        const url = googleTTS.getAudioUrl(text, { 
            lang: 'th', 
            slow: false, 
            host: 'https://translate.google.com' 
        });
        
        // สร้าง Audio Resource
        const resource = createAudioResource(url);
        
        // เล่นเสียง
        player.play(resource);
        
    } catch (error) {
        console.error("❌ [TTS API Error]:", error);
        isPlaying = false;
        playNext();
    }
}

// ----------------------------------------------------
// ระบบ Event Message Create
// ----------------------------------------------------
module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {
        if (message.author.bot) return;

        // คำสั่ง "เปิดอ่านระบบแชท"
        if (message.content === 'เปิดอ่านระบบแชท') {
            const channel = client.channels.cache.get(TARGET_CHANNEL_ID);
            
            if (!channel || !channel.isVoiceBased()) {
                return message.reply("❌ ไม่พบห้องเสียงที่กำหนด หรือ ID ไม่ใช่ห้องเสียงครับ");
            }

            try {
                const connection = joinVoiceChannel({
                    channelId: channel.id,
                    guildId: channel.guild.id,
                    adapterCreator: channel.guild.voiceAdapterCreator,
                });

                // ติดตามสถานะการเชื่อมต่อห้องเสียง
                connection.on(VoiceConnectionStatus.Ready, () => {
                    console.log('✅ [Voice] บอทเชื่อมต่อห้องเสียงพร้อมใช้งานแล้ว!');
                });

                connection.subscribe(player);
                isReadingMode = true;

                return message.reply("<:white_heart:1536417255024492654>ซูซี่พร้อมที่จะอ่านแชทข้อความแล้วค่ะ");
            } catch (error) {
                console.error("❌ [Voice Join Error]:", error);
                return message.reply("❌ เกิดข้อผิดพลาดในการเข้าห้องเสียง ตรวจสอบสิทธิ์ของบอทด้วยครับ");
            }
        }

        // คำสั่ง "ปิดอ่านระบบแชท"
        if (message.content === 'ปิดอ่านระบบแชท') {
            const connection = getVoiceConnection(message.guild.id);
            if (connection) {
                connection.destroy();
            }
            
            isReadingMode = false;
            audioQueue.length = 0;
            isPlaying = false;

            return message.reply("<:white_heart:1536417255024492654>ซูซี่ยกเลิกที่จะอ่านแชทข้อความแล้วค่ะ");
        }

        // ระบบอ่านแชทอัตโนมัติ
        if (isReadingMode && message.channel.id === TARGET_CHANNEL_ID) {
            let textToRead = message.content;

            if (message.attachments.size > 0) {
                textToRead += " ส่งไฟล์";
            }

            textToRead = textToRead.replace(/<:[a-zA-Z0-9_]+:[0-9]+>/g, (match) => match.split(':')[1]);
            textToRead = textToRead.replace(/<a:[a-zA-Z0-9_]+:[0-9]+>/g, (match) => match.split(':')[1]);
            textToRead = textToRead.replace(/https?:\/\/\S+/g, "ส่งลิงก์");

            textToRead = textToRead.trim();

            if (textToRead.length > 0) {
                if (textToRead.length > 195) {
                    textToRead = textToRead.substring(0, 195) + " และอีกมากมาย";
                }

                audioQueue.push(textToRead);
                
                const connection = getVoiceConnection(message.guild.id);
                if (connection && connection.state.status === VoiceConnectionStatus.Ready) {
                    playNext(connection);
                } else if (connection) {
                    // หากบอทยังเชื่อมต่อไม่เสร็จสมบูรณ์ ให้รอจนกว่าจะ Ready
                    connection.once(VoiceConnectionStatus.Ready, () => {
                        playNext(connection);
                    });
                }
            }
        }
    }
};