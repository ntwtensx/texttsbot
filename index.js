const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const fs = require('fs');
require('dotenv').config();

// ส่วนที่ 1: สร้าง Web Server ปลอมๆ ให้ Render แผนฟรีทำงานได้
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('texttsbot is online!'));
app.listen(PORT, () => console.log(`Web server listening on port ${PORT}`));

// ส่วนที่ 2: ตั้งค่าบอท Discord
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// โหลดไฟล์ Event ต่างๆ จากโฟลเดอร์ events
const eventFiles = fs.readdirSync('./events').filter(file => file.endsWith('.js'));
for (const file of eventFiles) {
    const event = require(`./events/${file}`);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
    } else {
        client.on(event.name, (...args) => event.execute(...args, client));
    }
}

client.login(process.env.TOKEN);