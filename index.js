require('dotenv').config();

// 🚀 [System Engineering]: บังคับชี้เป้าหมาย FFmpeg สำหรับ Render
// แก้ปัญหา OS หาโปรแกรมแปลงเสียงไม่เจอ (ป้องกันบอทเข้าห้องแล้วเงียบ)
const ffmpegPath = require('ffmpeg-static');
process.env.FFMPEG_PATH = ffmpegPath;

const { Client, GatewayIntentBits, Partials } = require('discord.js');
const fs = require('fs');
const path = require('path');
const express = require('express');

// 🌐 [Web Service]: สร้าง Express Server ดัก Port ให้ Render มองเห็นว่าบอททำงานอยู่
const app = express();
app.get('/', (req, res) => res.send('🚀 ระบบบอทซูซี่กำลังทำงานและพร้อมอ่านเสียงแล้ว!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 [Server] Web Server ทำงานที่พอร์ต ${PORT}`));

// 🤖 [Discord Client]: ตั้งค่าสิทธิ์ (Intents) ให้ครอบคลุมการอ่านแชทและเสียง
// *** สำคัญ: ต้องไปเปิด Message Content Intent ใน Discord Developer Portal ด้วย ***
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, // หัวใจหลักในการอ่านข้อความ
        GatewayIntentBits.GuildVoiceStates,
    ],
    partials: [Partials.Message, Partials.Channel]
});

// 📂 [Dynamic Event Handler]: โหลดไฟล์ระบบแยกส่วน (Modular) อัตโนมัติ
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

// 🔑 เริ่มต้นการทำงานของบอท
client.login(process.env.TOKEN);