const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const fs = require('fs');
require('dotenv').config();

// 1. สร้าง Web Server ปลอมๆ ให้ Render แผนฟรีทำงานได้
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('texttsbot is online!'));
app.listen(PORT, () => console.log(`Web server listening on port ${PORT}`));

// 2. ตั้งค่าบอท Discord พร้อมสิทธิ์ (Intents)
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates, // สิทธิ์เข้าห้องเสียง
        GatewayIntentBits.GuildMessages,    // สิทธิ์มองเห็นข้อความ
        GatewayIntentBits.MessageContent    // สิทธิ์อ่านเนื้อหาในแชท
    ]
});

// 3. โหลดไฟล์ Event ต่างๆ จากโฟลเดอร์ events อัตโนมัติ
const eventFiles = fs.readdirSync('./events').filter(file => file.endsWith('.js'));
for (const file of eventFiles) {
    const event = require(`./events/${file}`);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
    } else {
        client.on(event.name, (...args) => event.execute(...args, client));
    }
}

// 4. ล็อกอินบอท
client.login(process.env.TOKEN);