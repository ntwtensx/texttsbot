// index.js
require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const express = require('express');

// 🚀 [1] ระบบ Web Server สำหรับ Keep-Alive บน Render
const app = express();
// ดึงค่า Port จาก Environment (เช่น 10000 บน Render) ถ้าไม่มีให้ใช้ 3000 (เครื่องเราเอง)
const PORT = process.env.PORT || 3000; 

app.get('/', (req, res) => res.send(`🚀 texttsbot is running securely on port ${PORT}!`));
app.listen(PORT, () => {
    console.log(`🌐 [Web Server] เริ่มทำงานเรียบร้อยแล้ว! รันอยู่ที่ Port: ${PORT}`);
    console.log(`💡 (หากอยู่บน Render การจับ Port ${PORT} ถือว่าระบบทำงานถูกต้อง 100%)`);
});

// 🚀 [2] ตั้งค่า Client และ Intent (สิทธิ์ที่บอทต้องใช้)
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates // จำเป็นสำหรับการเชื่อมต่อห้องเสียง
    ]
});

// 🚀 [3] สร้างตัวแปร Global สำหรับเก็บสถานะ TTS ของบอท
client.ttsConfig = {
    isActive: false,
    connection: null,
    player: null,
    queue: [],
    isPlaying: false,
    targetVoiceChannel: '995629374722297946',
    targetTextChannel: '995629374722297946'
};

// 🚀 [4] โหลด Events อัตโนมัติ (Ready, MessageCreate)
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