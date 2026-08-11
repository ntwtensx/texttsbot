// index.js
require('dotenv').config();

// 🚀 [System Optimization] บังคับชี้เป้า FFmpeg Path ให้ระบบ Cloud (Render) หาเจอ 100%
const ffmpeg = require('ffmpeg-static');
process.env.FFMPEG_PATH = ffmpeg;

const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const express = require('express');

// 🚀 [1] ระบบ Web Server สำหรับ Keep-Alive บน Render
// (ช่วยให้บอทออนไลน์ตลอด 24/7 เมื่อใช้ร่วมกับ UptimeRobot)
const app = express();
const PORT = process.env.PORT || 3000; 

app.get('/', (req, res) => res.send(`🚀 Rocket TTS Bot is running securely on port ${PORT}! (FFmpeg path: ${process.env.FFMPEG_PATH})`));
app.listen(PORT, () => {
    console.log(`🌐 [Web Server] เริ่มทำงานเรียบร้อยแล้วที่ Port: ${PORT}`);
});

// 🚀 [2] ตั้งค่า Client และ Intent (ต้องให้ครอบคลุมการอ่านแชทและเสียง)
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// 🚀 [3] สร้าง Config สำหรับระบบ TTS (State Management)
client.ttsConfig = {
    isActive: false,
    connection: null,
    player: null,
    queue: [],
    isPlaying: false,
    targetVoiceChannel: '995629374722297946',
    targetTextChannel: '995629374722297946'
};

// 🚀 [4] โหลด Events แบบ Dynamic (ยืดหยุ่นและรองรับสเกลโปรเจกต์ในอนาคต)
const eventFiles = fs.readdirSync('./events').filter(file => file.endsWith('.js'));
for (const file of eventFiles) {
    const event = require(`./events/${file}`);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
    } else {
        client.on(event.name, (...args) => event.execute(...args, client));
    }
}

// 🚀 [5] Login เข้าสู่ระบบ Discord
client.login(process.env.TOKEN);