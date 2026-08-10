// index.js
require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const express = require('express');

// 🚀 [1] สร้าง Express Server เล็กๆ เพื่อให้ Render ตรวจจับ Port และทำงานตลอด 24 ชม.
const app = express();
app.get('/', (req, res) => res.send('🚀 texttsbot is running!'));
app.listen(process.env.PORT || 3000, () => console.log('🌐 Web server is up on port ' + (process.env.PORT || 3000)));

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