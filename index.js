require('dotenv').config();

// 🚀 [System Architecture Fix] 
// บังคับให้ Node.js และระบบของ Render ชี้เป้าหมายไปหา FFmpeg ที่เราโหลดมา
// ป้องกันปัญหา "เชื่อมต่อห้องได้แต่บอทไม่มีเสียง" (Audio Player Error)
const ffmpegPath = require('ffmpeg-static');
process.env.FFMPEG_PATH = ffmpegPath;

const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const express = require('express');

// สร้าง Express Server เล็กๆ เพื่อให้ Render สามารถ Bind Port ได้ (ป้องกันบอทดับ)
const app = express();
app.get('/', (req, res) => res.send('🚀 บอทซูซี่กำลังทำงานอยู่ และพร้อมอ่านเสียงแล้ว!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Web Server ทำงานที่พอร์ต ${PORT}`));

// กำหนดสิทธิ์ (Intents) ให้บอทมองเห็นแชทและห้องเสียง
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
    ]
});

// ระบบโหลด Events อัตโนมัติ (Dynamic Event Handler)
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

// ล็อกอินเข้าสู่ระบบ Discord
client.login(process.env.TOKEN);