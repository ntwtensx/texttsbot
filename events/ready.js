const { ActivityType } = require('discord.js');

module.exports = {
    name: 'ready',
    once: true,
    execute(client) {
        const now = new Date();
        // ปรับเวลาให้เป็นโซนไทย (UTC+7)
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const bootTime = `${hours}:${minutes}`;

        // ตั้งค่าสเตตัสบอท
        client.user.setPresence({
            activities: [{ name: `อ่านแชท [${bootTime}]`, type: ActivityType.Listening }],
            status: 'online',
        });

        console.log(`[READY] บอท ${client.user.tag} ออนไลน์เรียบร้อยแล้ว! เวลาบูท: ${bootTime}`);
    },
};