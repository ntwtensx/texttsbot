// events/ready.js
const { ActivityType } = require('discord.js');

module.exports = {
    name: 'ready',
    once: true,
    execute(client) {
        // ดึงเวลาปัจจุบัน รูปแบบ HH:MM (โซนเวลาประเทศไทย)
        const now = new Date();
        const timeString = now.toLocaleTimeString('th-TH', { 
            hour: '2-digit', 
            minute: '2-digit',
            timeZone: 'Asia/Bangkok'
        });

        const statusMessage = `อ่านแชท [${timeString}]`;

        // ตั้งค่าสถานะบอท (Presence)
        client.user.setPresence({
            activities: [{ name: statusMessage, type: ActivityType.Playing }],
            status: 'online',
        });

        console.log(`🚀 บอทออนไลน์แล้ว! เข้าสู่ระบบในชื่อ: ${client.user.tag}`);
        console.log(`✨ สถานะปัจจุบัน: ${statusMessage}`);
    },
};