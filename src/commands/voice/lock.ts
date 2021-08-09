import ChannelType, { EmojiIdentifierResolvable, MessageEmbed } from "discord.js";
import { OverwriteData } from "discord.js";
import { Command, RunCommand } from "../../../typings";
import GuildSchema, { Guild } from "../../models/guilds";
import { VoiceChannel, VoiceChannelDocument } from "../../models/voice_channels";
import { VoiceChannelSpawner } from "../../models/voice_channel_spawner";

const command: Command = {
    name: 'lock',
    description: 'locks the current voice Channel',
    aliases: ['l', 'lck', 'lockchannel', 'lc'],
    usage: '[channel resolvable]',
    cooldown: 5,
    category: "Miscellaneous",
    guildOnly: true,
    execute: async (client, message, args) => {
        //let owner = client.users.cache.find(m => m.id == client.ownerID);
        // if (message?.author.id !== client.ownerID as String) {
        //     return await message?.reply(`You do not have permission to execute this command.`);
        // }

        const g = message!.guild!;

        // Check if user is in VC
        const channel = message?.member?.voice.channel;
        if (!channel) {
            return await client.utils.embeds.SimpleEmbed(message!, `Temporary Voice Channel System`, `You are currently not in a Voice Channel on this Server.`);
        }

        // Get Channel from DB
        const guildData = (await GuildSchema.findById(g.id));
        const channelData = guildData!.voice_channels.find(x => x._id == channel.id);

        if (!channelData?.temporary) {
            return await client.utils.embeds.SimpleEmbed(message!, `Temporary Voice Channel System`, `The Voice Channel you are in is not a Temporary Voice Channel.`);
        }

        // Check if User has Permission to lock/Unlock Channel
        if (!(channelData.owner === message?.author.id || (channelData.supervisors && channelData.supervisors.includes(message!.author.id)))) {
            return await client.utils.embeds.SimpleEmbed(message!, `Temporary Voice Channel System`, `You have no Permission to Lock the current Voice Channel.`);
        }

        if (channelData.locked) {
            return await client.utils.embeds.SimpleEmbed(message!, `Error`, `The Channel is already locked.`);
        }

        // get name for logging
        var cName = channel.name;

        // Channel Renaming got locked Down to 2 Renames every 10 Minutes, so we disable it (for now)

        // if (!channelData.locked) {
        //     cName = cName.substring("🔓".length);
        // }

        // Cange Locked State in DB
        channelData.set('locked', true);
        await guildData!.save();

        // Change permissions for everyone
        var overwrites: OverwriteData[] = [...channel.permissionOverwrites.cache.values()];
        overwrites.push({
            id: g.roles.everyone.id,
            deny: ['VIEW_CHANNEL', 'CONNECT', 'SPEAK'],
        })
        await channel.permissionOverwrites.set(overwrites);

        await client.utils.embeds.SimpleEmbed(message!, `Temporary Voice Channel System`, `Your Channel was **locked**.`);
    }
}

async function sleep(msec: number) {
    return new Promise(resolve => setTimeout(resolve, msec));
}

/**
 * Exporting the Command using CommonJS
 */
module.exports = command;