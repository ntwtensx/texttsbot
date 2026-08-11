// events/messageCreate.js
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, StreamType } = require('@discordjs/voice');
const https = require('https'); // 🚀 เปลี่ยนมาใช้ Native HTTPS แทน google-tts-api

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        if (message.author.bot || !message.guild) return;

        // ==========================================
        // 🧹 1. ระบบจัดการแชท (Moderation: !dems)
        // ==========================================
        if (message.content.startsWith('!dems')) {
            if (!message.member.permissions.has('ManageMessages')) {
                return message.reply('❌ คุณไม่มีสิทธิ์ในการลบข้อความครับ!');
            }
            const args = message.content.split(' ');
            const amount = parseInt(args[1]);

            if (isNaN(amount) || amount < 1 || amount > 100) {
                return message.reply('❌ กรุณาระบุจำนวนระหว่าง 1 ถึง 100 ข้อความครับ');
            }
            try {
                const deletedMessages = await message.channel.bulkDelete(amount + 1, true);
                const replyMsg = await message.channel.send(`🚀 <@${message.author.id}> ทำการลบข้อความจำนวน **${deletedMessages.size - 1}** ข้อความเรียบร้อยแล้ว!`);
                setTimeout(() => replyMsg.delete().catch(() => {}), 5000);
            } catch (error) {
                console.error('❌ [Bulk Delete Error]:', error);
            }
            return;
        }

        // ==========================================
        // 🔊 2. ระบบ Text-to-Speech (น้องซูซี่ - อัปเกรด Neural TTS)
        // ==========================================
        const config = client.ttsConfig;

        // 🟢 เปิดอ่านแชท
        if (message.content === 'เปิดอ่านแชท') {
            const voiceChannel = message.guild.channels.cache.get(config.targetVoiceChannel);
            if (!voiceChannel) return message.reply('❌ ไม่พบห้องเสียงที่กำหนด');

            try {
                config.connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: message.guild.id,
                    adapterCreator: message.guild.voiceAdapterCreator,
                    selfDeaf: true,
                    selfMute: false
                });

                config.player = createAudioPlayer();
                config.connection.subscribe(config.player);
                config.isActive = true;

                config.player.on(AudioPlayerStatus.Idle, () => {
                    config.isPlaying = false;
                    playNextInQueue(client);
                });

                config.player.on('error', error => {
                    console.error('❌ [Audio Player Error]:', error.message);
                    config.isPlaying = false;
                    playNextInQueue(client);
                });

                config.connection.on(VoiceConnectionStatus.Disconnected, () => {
                    config.isActive = false;
                });

                return message.reply('<:white_heart:1536417255024492654> ซูซี่พร้อมที่จะอ่านแชทข้อความด้วยเสียง Neural ใหม่แล้วค่ะ');
            } catch (error) {
                console.error('❌ [Connection Error]:', error);
                return message.reply('❌ เกิดข้อผิดพลาดในการเชื่อมต่อห้องเสียง');
            }
        }

        // 🔴 ปิดอ่านแชท
        if (message.content === 'ปิดอ่านแชท') {
            if (config.connection) config.connection.destroy();
            config.isActive = false;
            config.connection = null;
            if (config.player) config.player.stop();
            config.queue = [];
            config.isPlaying = false;
            return message.reply('<:white_heart:1536417255024492654> ซูซี่ยกเลิกที่จะอ่านแชทข้อความแล้วค่ะ');
        }

        // 🔊 ดักจับข้อความเข้าคิวอ่าน
        if (config.isActive && message.channel.id === config.targetTextChannel) {
            let textToRead = message.content;
            if (message.attachments.size > 0) textToRead += textToRead ? " และส่งไฟล์" : "ส่งไฟล์";
            textToRead = textToRead.replace(/<a?:([a-zA-Z0-9_]+):\d+>/g, "อิโมจิ $1 ");
            textToRead = textToRead.replace(/https?:\/\/\S+/g, "ส่งลิงก์");
            textToRead = textToRead.trim();

            if (textToRead.length > 0) {
                config.queue.push(textToRead.substring(0, 200));
                if (!config.isPlaying) playNextInQueue(client);
            }
        }
    },
};

// ==========================================
// 🧠 วิศวกรรมเสียงใหม่: Microsoft Azure Neural TTS (freetts.org)
// ==========================================

function requestSpeechGeneration(text, voice = 'th-TH-PremwadeeNeural') {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ text, voice, rate: '+0%', pitch: '+0Hz' });
        const req = https.request({
            hostname: 'freetts.org',
            path: '/api/tts',
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Content-Length': Buffer.byteLength(body) 
            }
        }, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (!parsed.file_id) throw new Error('API ไม่ส่ง file_id กลับมา');
                    resolve(parsed.file_id);
                } catch (err) {
                    reject(err);
                }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

function fetchAudioStream(fileId) {
    return new Promise((resolve, reject) => {
        https.get(`https://freetts.org/api/audio/${fileId}`, res => {
            if (res.statusCode !== 200) return reject(new Error('ดึงข้อมูลเสียงล้มเหลว'));
            resolve(res); 
        }).on('error', reject);
    });
}

// 🛠️ ฟังก์ชันเล่นเสียงที่ได้รับการปรับแต่งสถาปัตยกรรมแล้ว (Robust Audio Pipeline)
async function playNextInQueue(client) {
    const config = client.ttsConfig;

    if (config.queue.length === 0) {
        config.isPlaying = false;
        return;
    }

    config.isPlaying = true;
    const text = config.queue.shift();

    try {
        console.log(`🔊 [TTS Process]: กำลังสร้างเสียง Neural สำหรับ -> "${text}"`);

        // 🚀 1. ยิง Request ขอไฟล์เสียง (แทนที่ Google TTS ตัวเดิม)
        const fileId = await requestSpeechGeneration(text);
        
        // 🚀 2. ดึง Stream เสียงมาตรงๆ โดยไม่เซฟลงเครื่อง
        const audioStream = await fetchAudioStream(fileId);

        // 🚀 3. สร้าง Audio Resource (ข้อมูลที่ส่งกลับมาเป็น MP3 Stream สามารถให้ FFmpeg จัดการได้เลย)
        const resource = createAudioResource(audioStream, {
            inputType: StreamType.Arbitrary, // ชี้ให้ FFmpeg รู้ว่าต้องแปลง Stream นี้
        });

        // 4. เล่นเสียง
        config.player.play(resource);
        console.log(`✅ [TTS Success]: กำลังเล่นเสียง...`);

    } catch (error) {
        console.error('❌ [TTS Generation/Play Error]:', error.message);
        config.isPlaying = false;
        // 🛡️ หากเกิด Error (เช่น API ล่มชั่วคราว) ให้ข้ามไปอ่านคิวต่อไปทันที บอทจะได้ไม่ค้าง
        playNextInQueue(client);
    }
}