import { ClientEventListener, ExecuteEvent } from "../../typings";
import { ApplicationCommandData, ApplicationCommandOptionChoice, Client, ClientEvents } from "discord.js";
import * as colors from "colors";
import GuildSchema, { Guild } from "../models/guilds";

export const execute: ExecuteEvent<"ready"> = async (client) => {
    // -- Setup Databases -- //

    // Global Slash Commands
    const data: ApplicationCommandData[] = [];

    // for(const c of [...client.commands.values()]){
    //     if(!c.guildOnly){
    //         data.push({
    //             name: c.name,
    //             description: c.description,
    //         })
    //     }
    // }
    // data.push({
    //     name: 'lel',
    //     description: 'kek',
    // });

    // const command = await client.application?.commands.set(data);
    // console.log(command);

    // Guilds
    client.logger.info(`Processing Guilds`);
    for (const g of [...client.guilds.cache.values()]) {
        await GuildSchema.prepareGuild(client,g);
    }

    await client.user?.setPresence({ status: 'online', activities: [{ name: 'The name is Bot, Rubot.', type: "PLAYING" }], afk: false });
    // Bot is ready
    client.logger.ready({
        message: `"${client.user?.username}" is Ready! (${(Date.now() - client.initTimestamp) / 1000}s)`,
        badge: true
    })
    console.log("-".repeat(26));
    console.log(`Bot Stats:`);
    console.log(`${client.users.cache.size} user(s)`);
    console.log(`${client.channels.cache.size} channel(s)`);
    console.log(`${client.guilds.cache.size} guild(s)`);
    console.log("=".repeat(26));
    return;
}

export const name = "ready";