const { ActivityType } = require('discord.js');

module.exports = {
    name: 'ready',
    once: true,
    execute(client) {
        console.log(`✅ บอทออนไลน์แล้วในชื่อ: ${client.user.tag}`);

        // ดึงเวลาปัจจุบันและปรับเป็นเวลาไทย (UTC+7) เผื่อเซิร์ฟเวอร์ Render อยู่ต่างประเทศ
        const date = new Date();
        date.setUTCHours(date.getUTCHours() + 7);
        
        // จัดฟอร์แมตเวลาให้อยู่ในรูป 00:00
        const hours = String(date.getUTCHours()).padStart(2, '0');
        const minutes = String(date.getUTCMinutes()).padStart(2, '0');
        const timeString = `${hours}:${minutes}`;

        // ตั้งค่า Status
        client.user.setPresence({
            activities: [{
                name: 'customstatus',
                type: ActivityType.Custom, // ใช้ Custom Status
                state: `อ่านแชท [${timeString}]`
            }],
            status: 'online',
        });
        
        console.log(`อัปเดตสเตตัสเป็น: อ่านแชท [${timeString}]`);
    },
};