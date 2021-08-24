import { ExecuteEvent } from "../../typings";
import { MessageActionRow, MessageButton, MessageEmbed } from "discord.js";
import GuildSchema from "../models/guilds";
import { VoiceChannelDocument } from "../models/voice_channels";
import { QueueDocument } from "../models/queues";
import { QueueEntry } from "../models/queue_entry";
import moment from "moment";
export const name = "voiceStateUpdate";

export const execute: ExecuteEvent<"voiceStateUpdate"> = async (client, oldState, newState) => {
    const oldUserChannel = oldState.channel;
    const newUserChannel = newState.channel;

    // New Channel/switch Channel
    if (newState.channel && newState.channel.guild && newUserChannel?.id != oldUserChannel?.id) {

        const guild = newState.channel.guild;

        // Get Channel from DB
        const guildData = (await GuildSchema.findById(guild.id));
        const channelData = (guildData!.voice_channels as VoiceChannelDocument[]).find(x => x._id == newState.channelId!);
        if (channelData) {

            // Check if Channel is Spawner
            if (channelData.spawner) {

                const spawner = channelData.spawner!;

                const createdVC = await client.utils.voice.createTempVC(newState.member!, spawner);

                // Move Member
                try {
                    await newState.member!.voice.setChannel(createdVC);
                } catch (error) {
                    throw new Error("USER_NOT_MOVABLE");
                }


                console.log(`Created TEMP VC: ${createdVC.name} on ${guild.name}`);
            } else if (channelData.queue) {
                const queueId = channelData.queue;
                const queue = (guildData?.queues as QueueDocument[]).find(x => x._id == queueId.toHexString());
                if (!queue) {
                    client.logger.error(`Referenced Queue was not found in Database: ${queueId.toHexString()}`);
                    return;
                }
                let queueEntry: QueueEntry;
                try {
                    queueEntry = await queue.join({
                        discord_id: newState.member!.id,
                        joinedAt: Date.now().toString(),
                        importance: 1,
                    });
                } catch (error) {
                    try {
                        await newState.member?.send({ embeds: [new MessageEmbed({ title: "Queue System", description: `An error occured: ${error}`, color: guild.me?.roles.highest.color || 0x7289da })] });
                        return;
                    } catch (error2) {
                        console.log(error);
                        return;
                    }
                }
                if (queue.join_message) {
                    const replacements = {
                        "limit": queue.limit,
                        "member_id": newState.member!.id,
                        "user": newState.member!.user,
                        "name": queue.name,
                        "description": queue.description,
                        "eta": "null",
                        "pos": queue.getPosition(queueEntry.discord_id) + 1,
                        "total": queue.entries.length,
                        "time_spent": "0s",
                    };
                    // Interpolate String
                    const join_message = client.utils.general.interpolateString(queue.join_message, replacements);
                    try {
                        await newState.member?.send({
                            embeds: [new MessageEmbed({ title: "Queue System", description: join_message, color: guild.me?.roles.highest.color || 0x7289da })],
                            components: [
                                new MessageActionRow(
                                    {
                                        components:
                                            [
                                                new MessageButton({ customId: "queue_refresh", label: "Refresh", style: "PRIMARY" }),
                                                new MessageButton({ customId: "queue_leave", label: "Leave queue", style: "DANGER" }),
                                            ],
                                    }),
                            ],
                        });
                    } catch (error) {
                        console.log(error);
                    }
                }
            }
        }

    }
    if (oldUserChannel && newUserChannel?.id != oldUserChannel?.id) {

        const guild = oldUserChannel.guild;

        // Get Channel from DB
        const guildData = (await GuildSchema.findById(guild.id));
        const channelData = (guildData!.voice_channels as VoiceChannelDocument[]).find(x => x._id == oldState.channelId!);

        if (channelData) {
            if (channelData.temporary && oldUserChannel.members.size == 0) {

                // remove vc
                if (oldUserChannel.deletable) {
                    await oldUserChannel.delete();
                } else {
                    client.logger.error("Temp VC Not deletable: " + oldUserChannel.id);
                }

                // get name for logging
                const cName = oldUserChannel.name;

                // if(!channelData.locked) {
                //     cName = cName.substring("🔓".length);
                // }

                // remove DB entry
                const updated = await GuildSchema.updateOne(
                    { _id: guild.id },
                    {
                        $pull: {
                            "voice_channels": { _id: oldUserChannel.id },
                        },
                    },
                    { upsert: true, setDefaultsOnInsert: true },
                );
                // console.log(updated);
                console.log(`deleted TEMP VC: ${cName} on ${guild.name}`);
            } else if (channelData.queue) {
                const queueId = channelData.queue;
                const queue = (guildData?.queues as QueueDocument[]).find(x => x._id == queueId.toHexString());
                if (!queue) {
                    client.logger.error(`Referenced Queue was not found in Database: ${queueId.toHexString()}`);
                    return;
                }
                const member_id = oldState.member!.id;
                // Leave queue
                if (queue.contains(member_id)) {
                    const entry = await queue.leave(member_id);
                    if (queue.leave_message) {
                        try {
                            const replacements = {
                                "limit": queue.limit,
                                "member_id": newState.member!.id,
                                "user": newState.member!.user,
                                "name": queue.name,
                                "description": queue.description,
                                "eta": "null",
                                "timeout": queue.disconnect_timeout,
                                "pos": queue.getPosition(entry.discord_id) + 1,
                                "total": queue.entries.length,
                                "time_spent": moment.duration(Date.now() - (+entry.joinedAt)).format("d[d ]h[h ]m[m ]s.S[s]"),
                            };
                            // Interpolate String
                            const leave_message = client.utils.general.interpolateString(queue.leave_message, replacements);
                            await newState.member?.send({ embeds: [new MessageEmbed({ title: "Queue System", description: leave_message, color: guild.me?.roles.highest.color || 0x7289da })] });
                        } catch (error) {
                            console.log(error);
                        }

                    }

                }
            }

        }
    }

    return;
};
