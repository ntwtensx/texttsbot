const { Events, ActivityType } = require('discord.js');

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        // ดึงเวลาปัจจุบันในโซนประเทศไทย
        const now = new Date();
        const timeString = now.toLocaleTimeString('th-TH', { 
            hour: '2-digit', 
            minute: '2-digit', 
            timeZone: 'Asia/Bangkok' 
        });

        // ตั้งค่า Status "อ่านแชท [00:00]"
        client.user.setActivity(`อ่านแชท [${timeString}]`, { type: ActivityType.Playing });
        
        console.log(`🚀 [System] บอทออนไลน์แล้วในชื่อ ${client.user.tag}`);
        console.log(`🕒 [Status] อัพเดทเวลา: ${timeString}`);
    },
};