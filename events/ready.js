const { ActivityType } = require('discord.js');

module.exports = {
    name: 'ready',
    once: true,
    execute(client) {
        console.log(`✅ บอทออนไลน์แล้วในชื่อ: ${client.user.tag}`);

        // ดึงเวลาปัจจุบันและปรับเป็นเวลาไทย (UTC+7)
        const date = new Date();
        date.setUTCHours(date.getUTCHours() + 7); 
        
        // จัดฟอร์แมตเวลา 00:00
        const hours = String(date.getUTCHours()).padStart(2, '0');
        const minutes = String(date.getUTCMinutes()).padStart(2, '0');
        const timeString = `${hours}:${minutes}`;

        // ตั้งค่า Status ของบอท
        client.user.setPresence({
            activities: [{
                name: 'customstatus',
                type: ActivityType.Custom,
                state: `อ่านแชท [${timeString}]`
            }],
            status: 'online',
        });
        
        console.log(`อัปเดตสเตตัสเป็น: อ่านแชท [${timeString}]`);
    },
};