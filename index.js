require('dotenv').config();

// 🚀 [System Architecture] บังคับชี้เป้าหมาย FFmpeg สำหรับ Render
// แก้ปัญหาบอทเข้าห้องเสียงได้แต่ไม่มีเสียงพูด
const ffmpegPath = require('ffmpeg-static');
process.env.FFMPEG_PATH = ffmpegPath;

const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const express = require('express');

// 🌐 [Web Service] สร้าง Express Server เพื่อให้ Render ตรวจสอบ Port ได้
const app = express();
app.get('/', (req, res) => res.send('🚀 ระบบบอทซูซี่กำลังทำงานและพร้อมอ่านเสียงแล้ว!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 [Server] Web Server ทำงานที่พอร์ต ${PORT}`));

// 🤖 [Discord Client] กำหนดสิทธิ์ให้บอทมองเห็นข้อความและเข้าห้องเสียงได้
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
    ]
});

// 📂 [Event Handler] ระบบโหลดไฟล์ Event อัตโนมัติแบบไดนามิก
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

// 🔑 เข้าสู่ระบบ Discord ด้วย Token จากไฟล์ .env
client.login(process.env.TOKEN);