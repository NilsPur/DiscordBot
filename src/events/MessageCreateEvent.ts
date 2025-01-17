import { ExecuteEvent } from "../../typings";
import { Collection, Guild, GuildMember, Message } from "discord.js";
export const name = "messageCreate";
import { dm_only_verify, disable_dm, dm_verify_guild, verify_secret } from "../../config.json";
import * as crypto from "crypto";
import UserSchema from "../models/users";

export const execute: ExecuteEvent<"messageCreate"> = async (client, message) => {
    if (message.partial) {
        message = await message.fetch();
    }
    if (message.author.id === client.user?.id) {
        return;
    }
    if (!message.guild) {
        if (disable_dm) {
            return;
        }
        if (dm_only_verify) {
            return await client.utils.general.verifyUser(message, message.content);
        }
    } else {

        /**
         * The cooldowns will be stored on a per User level
         */
        const cooldowns = client.cooldowns;

        const prefix = client.prefix;

        if (message.content.toLowerCase() == `<@!${client.user!.id}> prefix`) {
            // message.reply(`The Bot Prefix is:\n\`${client.prefix}\``);
            client.utils.embeds.SimpleEmbed(message, "The Prefix for this Channel is:", client.prefix);
        }

        // no need to continue if message does not start with a Prefix
        if (!message.content.startsWith(prefix) || message.author.bot) return;

        // Prepare command for execution
        const args = message.content.slice(prefix.length).split(/ +/);
        // const flags = client.parser(message.content.slice(prefix.length));
        // const args = flags._;
        // console.log(flags);
        const commandName = (args.shift() as string).toLowerCase();
        const command = client.commands.get(commandName) || client.commands.find(cmd => (cmd.aliases != undefined) && cmd.aliases.includes(commandName));
        // if command was not found, just return to not interfere with other bots
        if (!command) return;

        if (!(await client.utils.general.hasPermission(client, message.author, command, message.guild))) {
            await client.utils.errors.errorMessage(message, `You don't have permission to execute this command, ${message.author}!`);
            return;
        }

        if (command.guildOnly && !message.guild) {
            await client.utils.errors.errorMessage(message, "I can't execute that command inside DMs!");
            return;
        }

        if (command.args && !args.length) {
            let reply = `You didn't provide any arguments, ${message.author}!`;

            if (command.usage) {
                reply += `\nThe proper usage would be: \`${prefix}${command.name} ${command.usage}\``;
            }
            await client.utils.errors.errorMessage(message, reply);
            return;
        }

        // Check cooldowns
        if (!cooldowns.has(command.name)) {
            cooldowns.set(command.name, new Collection());
        }

        const now = Date.now();
        const timestamps = cooldowns.get(command.name)!;
        const cooldownAmount = (command.cooldown || 3) * 1000;

        if (timestamps.has(message.author.id)) {
            const expirationTime = timestamps.get(message.author.id)! + cooldownAmount;

            if (now < expirationTime && message.author.id != client.ownerID) {
                const timeLeft = (expirationTime - now) / 1000;
                await client.utils.errors.errorMessage(message, `please wait ${timeLeft.toFixed(1)} more second(s) before reusing the \`${command.name}\` command again.`);
                return;
            }
        }

        // Execute Command
        timestamps.set(message.author.id, now);
        setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);
        try {
            // let commandPromise = command.execute(client, message, args);
            // while(commandPromise instanceof Promise){
            //     commandPromise = await commandPromise
            // }
            command.execute(client, message, args);
        } catch (error) {
            console.error(error);
            message.reply(`Oh no, command ${commandName} had an error while executing :(\nI will look into this as soon as possible!`);
        }


        // if (commandName == "ping") {
        //     message.reply("Pong!");
        // }

        return;
    }
};
