const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, getVoiceConnection } = require('@discordjs/voice');
const googleTTS = require('google-tts-api');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

// โหลด Event จากโฟลเดอร์ events อัตโนมัติ
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
    } else {
        client.on(event.name, (...args) => event.execute(...args, client));
    }
}

// ตัวแปรควบคุมระบบ TTS
let isReadingActive = false;
const TARGET_CHANNEL_ID = '995629374722297946';
const audioPlayer = createAudioPlayer();

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // คำสั่งเปิดระบบอ่านแชท
    if (message.content === 'เปิดอ่านระบบแชท') {
        if (isReadingActive) {
            return message.reply('<:white_heart:1536417255024492654> ระบบอ่านแชทเปิดอยู่แล้วค่ะ');
        }

        try {
            const connection = joinVoiceChannel({
                channelId: TARGET_CHANNEL_ID,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator,
            });

            connection.subscribe(audioPlayer);
            isReadingActive = true;
            return message.reply('<:white_heart:1536417255024492654>ซูซี่พร้อมที่จะอ่านแชทข้อความแล้วค่ะ');
        } catch (error) {
            console.error('Voice Connection Error:', error);
            return message.reply('❌ ไม่สามารถเชื่อมต่อห้องเสียงได้ กรุณาตรวจสอบ ID ช่องเสียงอีกครั้งค่ะ');
        }
    }

    // คำสั่งปิดระบบอ่านแชท
    if (message.content === 'ปิดอ่านระบบแชท') {
        if (!isReadingActive) {
            return message.reply('<:white_heart:1536417255024492654> ระบบอ่านแชทยังไม่ได้เปิดค่ะ');
        }

        const connection = getVoiceConnection(message.guild.id);
        if (connection) {
            connection.destroy();
        }
        isReadingActive = false;
        return message.reply('<:white_heart:1536417255024492654>ซูซี่ยกเลิกที่จะอ่านแชทข้อความแล้วค่ะ');
    }

    // ระบบอ่านข้อความในช่องที่กำหนด
    if (isReadingActive && message.channel.id === TARGET_CHANNEL_ID) {
        let textToRead = '';

        // ตรวจสอบว่าเป็นไฟล์ภาพหรือไฟล์แนบหรือไม่
        if (message.attachments.size > 0) {
            textToRead = 'ส่งไฟล์';
        } else if (message.content) {
            // ตัดลิงก์ออกเพื่อให้อ่านง่ายขึ้น หรืออ่านข้อความปกติ
            textToRead = message.content.replace(/https?:\/\/[^\s]+/g, 'ลิงก์');
        }

        if (textToRead) {
            try {
                // สร้างลิงก์เสียงจาก Google TTS ภาษาไทย
                const ttsUrl = googleTTS.getAudioUrl(textToRead, {
                    lang: 'th',
                    slow: false,
                    host: 'https://translate.google.com',
                    timeout: 10000,
                });

                const resource = createAudioResource(ttsUrl);
                audioPlayer.play(resource);
            } catch (error) {
                console.error('TTS Error:', error);
            }
        }
    }
});

// ล็อกอินเข้าสู่ระบบด้วย Token
client.login(process.env.TOKEN);