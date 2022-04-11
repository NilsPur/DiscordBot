import { DBRoleDocument, InternalRoles, RoleScopes } from "./../models/bot_roles";
import ChannelType, { CommandInteraction, Guild, GuildMember, GuildMemberResolvable, GuildResolvable, Interaction, Message, Role, RoleResolvable, User, UserResolvable } from "discord.js";
import moment from "moment";
import { Command, StringReplacements } from "../../typings";
import { promisify } from "util";
import GuildSchema from "../models/guilds";
import glob from "glob";
import guilds from "../models/guilds";
import { Bot } from "../bot";
const globPromise = promisify(glob);
import * as crypto from "crypto";
import { dm_only_verify, dm_verify_guild, verify_secret } from "../../config.json";
import UserSchema from "../models/users";
import * as cryptojs from "crypto-js";

/**
 * Checks if a given Variable is an array[] with at least a length of one or not
 *
 * @param variable the Variable to check
 * @returns
 */
export const isArraywithContent = (variable: any) => Array.isArray(variable) && (!!variable.length) && (variable.length > 0);

/**
 * Generates a random integer between the given min and max
 *
 * @param min the minimum int
 * @param max the maximum int
 * @returns the random integer
 */
export const getRandomInt = (min: number, max: number) => {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

/**
 * Counts the Amount of Digits after the Comma of a Number
 *
 * @param {Number} number the number to count the digits of
 */
export const countDigits = (number: number) => (Math.floor(number) === number) ? 0 : number.toString().split(".")[1].length;

/**
 * Chooses Random Element off an Array
 * @param array The Non-empty Array to choose a random Entry off
 * @returns the Chosen Entry
 */
export const getRandomEntry: <T>(array: T[]) => T = (array) => {
    if (!isArraywithContent(array)) {
        throw new TypeError("The given Argument is not an array or is empty");
    }
    return array[getRandomInt(0, array.length - 1)];
};

/**
 * Chooses Random Element off an Array and considers weights
 * @param array The Weighted Array (Entries are Arrays with The actual entry and a weight > 0)
 * @returns The chosen Entry
 */
export const getRandomEntryWithWeights: <T>(array: [T, number][]) => T = (array) => {
    if (!isArraywithContent(array)) {
        throw new TypeError("The given Argument is not a weighted array or is empty");
    }
    //Gewichte Abspeichern, und dabei
    const maxdigits = Math.max(...array.map(x => countDigits(x[1])));
    const weights = array.map(x => x[1] * Math.pow(10, maxdigits));
    //Maximalgewicht
    const chosenNumber = getRandomInt(1, weights.reduce((x, y) => x + y));
    for (let i = 0, currentWeight = 0; i < weights.length; currentWeight += weights[i], i++) {
        if (chosenNumber > currentWeight && chosenNumber <= currentWeight + weights[i]) {
            return array[i][0];
        }
    }
    return array[0][0];
};

/**
 * Creates a clean User object from an Interaction
 * @param interaction the Interaction to get the User from
 * @returns the User
 */
export function getUser(interaction: Message | Interaction): ChannelType.User;
/**
 * Creates a clean User object from an Interaction
 * @param interaction  the Interaction to get the User from
 * @returns the User or null
 */
export function getUser(interaction: Message | Interaction | undefined): ChannelType.User | null;

export function getUser(interaction: Message | Interaction | undefined) {
    // Check if user is in VC
    if (!interaction) {
        return null;
    }
    if (interaction instanceof Message) {
        return interaction.author;
    } else {
        return interaction.user;
    }
}
/**
 * Creates a clean Member object from an Interaction
 * @param interaction  the Interaction to get the Member from
 * @returns the Member or null
 */
export const getMember = (interaction: Message | Interaction | undefined) => {
    // Check if user is in VC
    if (!interaction || !interaction.guild) {
        return null;
    }
    if (interaction instanceof Message) {
        return interaction.member;
    } else if (interaction instanceof Interaction) {
        const memberId = interaction.user.id;
        const member = interaction.guild.members.cache.find(x => x.id === memberId);
        if (member) {
            return member;
        }
    }
    return null;
};

/**
 * Replaces placeholders in a String with dynamic values
 * 
 * Default variables:
 * 
 *     'now':       System Time
 *     'mem_usage': Memory Usage
 * @param str The String to interpolate
 * @param replacements Additional Replace values, you can also overwrite the default ones by using the same name.
 */
export const interpolateString = (str: string, replacements?: StringReplacements) => {
    // Interpolate String
    const default_replacements: StringReplacements = {
        "now": moment().format("DD.MMMM YYYY hh:mm:ss"),
        "mem_usage": `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
    };
    for (const [key, value] of Object.entries({ ...default_replacements, ...replacements })) {
        str = str.replace(`\${${key}}`, value as string);
    }
    return str;
};

/**
 * Sleeps for given amount of Time
 * @param msec the Sleep Duration in milliseconds
 * @returns Nothing
 */
export const sleep = async (msec: number) => {
    return new Promise(resolve => setTimeout(resolve, msec));
};


export async function hasPermission(client: Bot, mentionable: UserResolvable, command: Command): Promise<boolean>;
export async function hasPermission(client: Bot, mentionable: GuildMemberResolvable | RoleResolvable, command: Command, guild: GuildResolvable): Promise<boolean>;
export async function hasPermission(client: Bot, mentionable: UserResolvable | RoleResolvable, command: Command, guild?: GuildResolvable | null): Promise<boolean>;
export async function hasPermission(client: Bot, mentionable: UserResolvable | RoleResolvable, command: Command, guild?: GuildResolvable | null): Promise<boolean> {
    const g = guild ? client.guilds.resolve(guild) : null;
    const roleoruser = g?.roles.resolve(mentionable as RoleResolvable) ?? g?.members.resolve(mentionable as GuildMemberResolvable) ?? client.users.resolve(mentionable as UserResolvable);
    if (!g) {
        // TODO: Permissions for Global Commands
        return command.defaultPermission || roleoruser?.id === client.ownerID;
    }
    const guildData = (await GuildSchema.findById(g.id))!;
    const commandSettings = await guildData.guild_settings.getCommandByInternalName(command.name);
    const permission_overwrite = commandSettings?.permissions.some(x => x.id === roleoruser?.id && x.permission) ?? false;
    const role_permission_overwrite = (roleoruser instanceof GuildMember) && [...roleoruser.roles.cache.values()].some(r => commandSettings?.permissions.some(x => x.id === r.id && x.permission));
    return (commandSettings?.defaultPermission ?? command.defaultPermission ?? true) || permission_overwrite || role_permission_overwrite || roleoruser?.id === client.ownerID;
}

/**
 * Encrypts a given Text
 * @param text The Text to encrypt
 * @returns the encrypted Text
 */
export function encryptText(text: string) {
    return cryptojs.AES.encrypt(text, verify_secret).toString();
}

/**
 * Decrypts a given Text
 * @param text the Text to decrypt
 * @returns the decrypted Text
 */
export function decryptText(text: string) {
    return cryptojs.AES.decrypt(text, verify_secret).toString(cryptojs.enc.Utf8);
}

/**
 * Generates an encrypted Token-String with the given parameters
 * @param server_id The ID of the Server
 * @param version_id The Token Version
 * @param tu_id The TU ID
 * @param moodle_id The Moodle ID
 * @param internal_role_names The internal role names
 * @returns The generated Token
 */
export function encryptTokenString(server_id: string, version_id: string, tu_id: string, moodle_id: string, internal_role_names: InternalRoles[]): string {
    const token = `${server_id}|${version_id}|${tu_id}|${moodle_id}|${internal_role_names.join(",")}`;
    const crypted_token_string = encryptText(token);
    return crypted_token_string;
}

encryptTokenString("940632262272237568", "01", "rd61fymu", "69420", ["verified" as InternalRoles, "server_admin" as InternalRoles]);

/**
 * Handles User Verification
 * @param replyable A Replyable message
 * @param tokenstring the Tokenstring used
 * @returns void
 */
export async function verifyUser(replyable: Message | CommandInteraction, tokenstring: string) {
    const author = (replyable instanceof Message) ? replyable.author : replyable.user;
    const client = replyable.client as Bot;
    // let content = (replyable instanceof Message) ? replyable.cleanContent : replyable.options.;
    console.log(`Verifying User ${author.tag} with token: ${tokenstring}`);
    const token = tokenstring.trim();
    const decrypted = decryptText(token);

    // Token-Format: <server_id>|<version_id>|<tu_id>|<moodle_id>|<internal_role_names>
    // get token parts using name capturing regex groups
    const regex = /^(?<server_id>\d+?)\|(?<version_id>\d+?)\|(?<tu_id>\w{8})\|(?<moodle_id>\d+)\|(?<internal_role_names_string>.*)$/;
    const match = regex.exec(decrypted);
    if (!match) {
        console.log(`Failed Verifying User ${author.tag} with message: Token is not valid.`);
        return await client.utils.embeds.SimpleEmbed(replyable, { title: "Verification System Error", text: "Token is not valid.", empheral: true });
    }
    console.log(`matches: ${JSON.stringify(match.groups)}`);
    const { server_id, version_id, tu_id, moodle_id, internal_role_names_string } = match.groups!;
    const internal_role_names = internal_role_names_string?.split(",") ?? [];


    const user = author;

    const guild = await client.guilds.cache.get(server_id);
    if (!(guild instanceof Guild)) {
        console.log(`Failed Verifying User ${author.tag} with message: This should not happen... Please Contact the owner of the Bot. (Guild not found)`);
        return await client.utils.embeds.SimpleEmbed(replyable, { title: "Server Not Found", text: "This should not happen... Please Contact the owner of the Bot.", empheral: true });
    }
    const dbGuild = await GuildSchema.findById(guild.id);
    if (!dbGuild) {
        console.log(`Failed Verifying User ${author.tag} with message: This should not happen... Please Contact the owner of the Bot.`);
        return await client.utils.embeds.SimpleEmbed(replyable, { title: "Server Not Found", text: "This should not happen... Please Contact the owner of the Bot. (Database Server not found)", empheral: true });
    }

    const member = await guild.members.fetch({ user, force: true });
    if (!(member instanceof GuildMember)) {
        console.log(`Failed Verifying User ${author.tag} with message: You are not a Member of the Guild.`);

        return await client.utils.embeds.SimpleEmbed(replyable, { title: "Verification System Error", text: "You are not a Member of the Guild.", empheral: true });
    }

    let databaseUser = await UserSchema.findById(member.id);
    if (!databaseUser) {
        databaseUser = new UserSchema({ _id: member.id });
        await databaseUser.save();
    }
    databaseUser.tu_id = tu_id;
    databaseUser.moodle_id = moodle_id;
    const dbTokenRoles = [] as DBRoleDocument[];
    // find roles
    internal_role_names.forEach(async x => {
        const token_role = dbGuild.guild_settings.roles.find(r => r.internal_name.toLowerCase() === x.toLowerCase());
        if (!token_role) {
            console.log(`Failed Verifying User ${author.tag} with message: Role ${x} not found.`);
            return await client.utils.embeds.SimpleEmbed(replyable, { title: "Verification System Error", text: `Role ${x} not found.`, empheral: true });
        }
        dbTokenRoles.push(token_role);
        databaseUser!.token_roles.push(token_role._id);
    });
    // Check Duplicate Entry
    try {
        await databaseUser.save();
    } catch (error) {
        if ((error as any).message?.includes("duplicate key")) {
            console.log(`User ${member.displayName} tried to valid but already used token with TU-ID: "${tu_id}", Moodle-ID: "${moodle_id}"`);
            return await client.utils.embeds.SimpleEmbed(replyable, { title: "Verification System Error", text: "You can only Link one Discord Account.", empheral: true });
        } else {
            console.log(error);
            return await client.utils.embeds.SimpleEmbed(replyable, { title: "Verification System Error", text: "An Internal Error Occurred.", empheral: true });
        }
    }
    console.log(`Linked ${member.displayName} to TU-ID: "${tu_id}", Moodle-ID: "${moodle_id}"`);

    // faulty roles
    const faulty_roles: DBRoleDocument[] = [];
    // existing roles
    const existing_roles: DBRoleDocument[] = [];
    // new roles
    const new_roles: DBRoleDocument[] = [];
    // Give Roles
    const guildRoles = await member.guild.roles.fetch();
    for (const role of dbTokenRoles) {
        if (role.scope !== RoleScopes.SERVER) continue;
        if (!role.role_id) continue;
        const guildRole = guildRoles.get(role.role_id);
        if (!guildRole) {
            faulty_roles.push(role);
            continue;
        }
        if (member.roles.cache.has(guildRole.id)) {
            existing_roles.push(role);
            continue;
        }
        console.log(`member ${member.displayName} has not role ${role.internal_name}`);
        await member.roles.add(guildRole);
        console.log(`role ${role.internal_name} added to member ${member.displayName}`);
        new_roles.push(role);
    }

    const fields = [
        { name: "❯ New Roles that were given:", value: new_roles.map(x => `\`${x.server_role_name ?? x.internal_name}\``).join(", ") || "none", inline: false },
    ];
    if (existing_roles.length > 0) {
        fields.push({ name: "❯ Existing Roles (untouched):", value: existing_roles.map(x => `\`${x.server_role_name ?? x.internal_name}\``).join(", ") || "none", inline: false });
    }
    if (faulty_roles.length > 0) {
        fields.push({ name: "❯ Faulty Roles (were not given):", value: faulty_roles.map(x => `\`${x.server_role_name ?? x.internal_name}\``).join(", ") || "none", inline: false });
    }

    let text = "Your Discord-Account has been verified.";
    if (new_roles.length == 0 && faulty_roles.length == 0) {
        text = "Your Discord-Account has already been verified.";
    }
    return await client.utils.embeds.SimpleEmbed(
        replyable,
        {
            title: "Verification System",
            text,
            fields,
            empheral: true,
        },
    );

}

/**
 * Asynchronously filters a given array by a given filter function
 * @param array the array to be filtered asynchronously
 * @param callback the asynchronous filter callback
 * @returns the filtered array
 */
export async function filterAsync<T>(array: readonly T[], callback: (value: T, index: number) => Promise<boolean>): Promise<T[]> {
    checkArgument(array, "array");
    checkArgument(callback, "callback");
    const results = await Promise.all(array.map((value, index) => callback(value, index)));
    return array.filter((_, i) => results[i]);
}

/**
 * Checks whether the given value is empty and Throws an Error with the given name if it is.  
 * A value is considered empty if it is `null`, `undefined`, `0`, `""`, `false`, or an empty array or object.
 * 
 * @param value the value to check
 * @param name the name of the value
 */
function checkArgument(value: unknown, name: string) {
    if (!value) {
        throw new Error(`The argument "${name}" cannot be empty`);
    }
}


/**
 * The Possible Annotations for queue Stayings
 */
export enum QueueStayOptions {
    /**
     * Annotates that a queue State Decision is Pending
     */
    PENDING,
    /**
     * Annotates a stay
     */
    STAY,
    /**
     * Annotates user already left
     */
    LEFT,
}

export enum Weekday {
    /**
     * Sonntag
     */
    SUNDAY = 0,
    /**
     * Montag
     */
    MONDAY = 1,
    /**
     * Dienstag
     */
    TUESDAY = 2,
    /**
     * Mittwoch
     */
    WEDNESDAY = 3,
    /**
     * Donnerstag
     */
    THURSDAY = 4,
    /**
     * Freitag
     */
    FRIDAY = 5,
    /**
     * Samstag
     */
    SATURDAY = 6,
}

/**
 * A Timestamp of the queue
 */
export class WeekTimestamp {

    /**
     * Creates a new WeekTimestamp
     * @param weekday The current day of the week
     * @param hour The current hour of the day
     * @param minute The current minute of the hour
     */
    constructor(
        /**
         * The Day of the Week
         */
        public weekday: Weekday,
        /**
         * The Hour of the Day
         */
        public hour: number,
        /**
         * The Minute of the Hour
         */
        public minute: number,
    ) {

    }
    /**
     * returns the weektime in ms
     * @returns The WeekTime in ms
     */
    public getTime(): number {
        return this.minute * 1000 * 60 + this.hour * 1000 * 60 * 60 + this.weekday * 1000 * 60 * 60 * 24;
    }

    /**
     * Returns a Relative Weekdate
     * @param date The Date to convert
     * @returns The created WeekTimestamp
     */
    public static fromDate(date: Date) {
        return new WeekTimestamp(date.getDay(), date.getHours(), date.getMinutes());
    }
}

/**
 * A Queue Span - A Weekly Timespan with a start- and End Date that can be used to automate Events every week
 */
export class QueueSpan {
    /**
     * Creates a Queue Span (begin.getTime() must be smaller than end.getTime())
     * @param begin The Begin Timestamp
     * @param end The End Timestamp
     * @param openShift Shift the Opening by X millixeconds
     * @param closeShift Shift the Closing by X milliseconds
     * @param startDate limit the span to after this date
     * @param endDate limit the span to before this date
     */
    constructor(public begin: WeekTimestamp, public end: WeekTimestamp, public openShift = 0, public closeShift = 0, public startDate?: Date, public endDate?: Date) {

    }

    /**
     * Checks whether the cycle has started at a given Date (or now if no date was given)
     * @param date The Date to check
     * @returns `true`, if the cycle has started at the given date
     */
    public cycleHasStarted(date = new Date()) {
        return !this.startDate || date >= this.startDate;
    }

    /**
     * Checks whether the cycle has ended at a given Date (or now if no date was given)
     * @param date The Date to check
     * @returns `true`, if the cycle has ended at the given date
     */
    public cycleHasEnded(date = new Date()) {
        return this.endDate && date >= this.endDate;
    }

    /**
     * Checks whether the cycle is active at a given Date (or now if no date was given)
     * 
     * @param date The Date to check
     * @returns `true`, if the cycle is active at the given date
     */
    public cycleIsActive(date = new Date()) {
        return this.cycleHasStarted(date) && !this.cycleHasEnded(date);
    }

    /**
     * Returns the WeekTime of a given Date (or now if no date was given)
     * 
     * @param date The Date to check
     * @returns the WeekTime of the given Date
     */
    private getWeekTime(date = new Date()) {
        return WeekTimestamp.fromDate(date).getTime();
    }

    /**
     * returns The Shifted begin Timestamp
     * 
     * @returns The Shifted begin Timestamp
     */
    private actualBeginTime() {
        return this.begin.getTime() + this.openShift;
    }

    /**
     * returns The Shifted end Timestamp
     * 
     * @returns The Shifted end Timestamp
     */
    private actualEndTime() {
        return this.end.getTime() + this.closeShift;
    }

    /**
     * Checks whether the span is active at a given Date (or now if no date was given)
     * 
     * @param date The Date to check
     * @returns `true`, if the span is active at the given date
     */
    public isActive(date = new Date()) {
        const cur = this.getWeekTime(date);
        return this.cycleIsActive(date) && cur >= this.actualBeginTime() && cur <= this.actualEndTime();
    }

    /**
     * A String representation of the span
     * @returns A String representation of the current span
     */
    public toString() {
        return `${this.begin.weekday} ${this.begin.hour}:${this.begin.minute} - ${this.end.weekday} ${this.end.hour}:${this.end.minute}`;
    }

    /**
     * Creates a Queue Span from a String
     * @param str the String to parse
     * @returns The created Queue Span
     * @throws An Error if the String could not be parsed
     * @example
     * ```
     * const span = QueueSpan.fromString("MONDAY 08:00 - WEDNESDAY 16:00");
     * ```
     */
    public static fromString(str: string) {
        // Name capturing group 1: weekday
        // Name capturing group 2: hour
        // Name capturing group 3: minute
        // Name capturing group 4: weekday 2
        // Name capturing group 5: hour 2
        // Name capturing group 6: minute 2
        const regex = /^(?<weekday>\w+) (?<hour>\d+):(?<minute>\d+) - (?<weekday2>\w+) (?<hour2>\d+):(?<minute2>\d+)$/;
        const match = regex.exec(str);
        if (!match) {
            throw new Error(`Invalid Queue Span String: ${str}`);
        }

        return new QueueSpan(
            new WeekTimestamp(
                Weekday[match.groups!.weekday.toUpperCase() as keyof typeof Weekday],
                +match.groups!.hour,
                +match.groups!.minute,
            ),
            new WeekTimestamp(
                Weekday[match.groups!.weekday2.toUpperCase() as keyof typeof Weekday],
                +match.groups!.hour2,
                +match.groups!.minute2,
            ),
        );
    }
}