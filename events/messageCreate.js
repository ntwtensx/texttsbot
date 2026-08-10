const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const googleTTS = require('google-tts-api');

module.exports = {
    name: 'messageCreate',
    async execute(message) {
        // ป้องกันบอทตอบโต้กันเอง และกรองเฉพาะคำสั่งที่ขึ้นต้นด้วย !tts 
        if (message.author.bot) return;
        if (!message.content.startsWith('!tts ')) return;

        // ดึงข้อความด้านหลัง !tts ออกมา
        const text = message.content.replace('!tts ', '').trim();
        if (!text) {
            return message.reply('กรุณาพิมพ์ข้อความที่ต้องการให้บอทอ่านด้วยครับ เช่น `!tts สวัสดี`');
        }

        // ตรวจสอบว่าผู้สั่งอยู่ในห้องเสียงหรือไม่
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) {
            return message.reply('คุณต้องเข้าไปอยู่ในห้องเสียง (Voice Channel) ก่อนครับ!');
        }

        try {
            // สร้าง URL เสียงอ่านภาษาไทยด้วย Google TTS
            const url = googleTTS.getAudioUrl(text, {
                lang: 'th',
                slow: false,
                host: 'https://translate.google.com',
            });

            // เชื่อมต่อเข้าห้องเสียง
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator,
            });

            // สร้างตัวเล่นเสียง
            const player = createAudioPlayer();
            const resource = createAudioResource(url);

            // สั่งเล่นเสียงและส่งเข้าไปในห้อง
            player.play(resource);
            connection.subscribe(player);

            message.reply(`🗣️ กำลังอ่านข้อความ: "${text}"`);

            // สั่งให้บอทออกจากห้องเสียงอัตโนมัติเมื่อพูดจบ
            player.on(AudioPlayerStatus.Idle, () => {
                connection.destroy();
            });

        } catch (error) {
            console.error(error);
            message.reply('เกิดข้อผิดพลาดในการสร้างเสียงอ่านครับ');
        }
    },
};