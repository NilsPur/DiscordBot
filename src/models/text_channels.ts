import mongoose from "mongoose";

const TextChannelSchema = new mongoose.Schema<TextChannelDocument, TextChannelModel>({
    channel_type: {
        type: Number,
        enum: [0, 1,2,3,4,5,6,7],
        required: true
    },
    whitelist_user_groups: [{
        type: String,
        required: true
    }],
    blacklist_user_groups: [{
        type: String,
        required: true
    }],
    managed: {
        type: Boolean,
        required: true,
    },
    owner: {
        type: String,
        required: false,
    },
    prefix: {
        type: String,
        required: false,
    },
    listen_for_commands: {
        type: String,
        required: true,
    },
    rage_channel: {
        type: String,
        required: false,
    },
})

/**
 * Database Representation of a Discord Channel
 */
export interface Channel {
    channel_type: ChannelType,
    whitelist_user_groups: string[],
    blacklist_user_groups: string[],
    managed: boolean,
    owner?: String
}

export interface TextChannel extends Channel {
    /**
     * Channel Specific Prefix, cuz why not? :D
     */
    prefix?: string,
    listen_for_commands: boolean,
    rage_channel?: boolean,
}

// export interface VoiceChannel extends Channel {
//     channel_type: ChannelType,
//     whitelist_user_groups: string[],
//     blacklist_user_groups: string[],
//     managed: boolean,
//     owner?: String,
//     afkhell?: boolean,
//     song_link?: String,
// }

export interface TextChannelDocument extends TextChannel, mongoose.Document {

}

export interface TextChannelModel extends mongoose.Model<TextChannelDocument> {

}

// Default export
export default TextChannelSchema;