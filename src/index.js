import { config } from 'dotenv';
import * as cron from 'node-cron';
import pkg, { GatewayCloseCodes } from 'discord.js';
const { Client, GatewayIntentBits, Options, Routes, spoiler, EmbedBuilder } = pkg;
import { REST } from '@discordjs/rest';
import fs from 'node:fs'

config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ]
});

const TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const api_url = "https://bar.telecomnancy.net/api/categories/117daa88-17fc-4488-8520-66d72317695c/items?page=0&limit=24&state=buyable"

const rest = new REST({ version: '10' }).setToken(TOKEN);
const guild = client.guilds.cache.get(GUILD_ID);

let cookies_valides = true;
let restocked = false;

client.on('clientReady', async () => {
    console.log(`${client.user.username} est connecté :)`);
    cron.schedule('1 0 * * *', () => {
        restocked = false;
        fetch(api_url, {
            method: 'GET',
            headers: {
                "Cookie": `BAR_SESS=${get_cookies()}`
            }
        }).then((resp) => {
            if (resp.status === 401) {
                cookies_valides = false;
                const channel = guild.channels.cache.get('1416167143208124566');
                if (channel) {
                    channel.send('Cookies expirés, veuillez les renouveler');
                }
            }
        })
    })

    setInterval(async () => {
        const today = new Date();
        const day = today.getDay() // 0 = dimanche, 4 = jeudi, 6 = samedi
        if (!restocked && ![0, 4, 6].includes(day) && cookies_valides) {
            const resp = await fetch(api_url, {
                method: 'GET',
                headers: {
                    "Cookie": `BAR_SESS=${get_cookies()}`
                }
            })

            const data = await resp.json();

            if (!stock_empty(data)) {
                const previous_sandwich = fs.readFileSync('stock.txt', 'utf8');
                const new_sandwiches = sandwich_to_str(data);

                if (previous_sandwich !== new_sandwiches) {
                    restocked = true;
                    fs.writeFileSync('./stock.txt', new_sandwiches)
                    const laGuilde = await client.guilds.fetch(GUILD_ID);
                    const channel = laGuilde.channels.cache.get('1416167143208124566');
                    if (channel) {
                        channel.send('<@269930271522947073> LES SANDWICHES SONT EN STOCK DEPECHE TOI');
                    }
                }


            }
        }
    }, 60000) //Chaque minute
})

client.on('messageCreate', async (message) => {
    if (message.content === 'test test') {
        const laGuilde = await client.guilds.fetch(GUILD_ID);
        const channel = laGuilde.channels.cache.get('1416167143208124566');
        channel.send('test');
    }
})

client.on('interactionCreate', (interaction) => {
    if (interaction.isChatInputCommand()) {
        switch (interaction.commandName) {
            case 'stock':
                if (cookies_valides) {
                    fetch(api_url, {
                        method: 'GET',
                        headers: {
                            "Cookie": `BAR_SESS=${get_cookies()}`
                        }
                    }).then((resp) => {
                        resp.json().then((data) => {
                            if(stock_empty(data)){
                                interaction.reply("Stock vide.")
                            } else {
                                interaction.reply(stock_to_str(data))
                            } 
                        })
                    })
                } else {
                    interaction.reply('Cookies invalides.');
                }
                break;
            case 'setcookies':
                const cookie = interaction.options.getString("cookie");
                set_cookies(cookie)
                interaction.reply('Cookies mis à jour avec succès.');
                break;
            case 'reset':
                if (cookies_valides) {
                    fetch(api_url, {
                        method: 'GET',
                        headers: {
                            "Cookie": `BAR_SESS=${get_cookies()}`
                        }
                    }).then((resp) => {
                        resp.json().then((data) => {
                            fs.writeFileSync('./stock.txt', sandwich_to_str(data))
                            interaction.reply('Stock reset avec succès.')
                        })
                    })
                } else {
                    interaction.reply('Cookies invalides.');
                }
                break;
        }
    }
})

async function main() {
    const commands = [
        {
            name: 'stock',
            description: 'Stock actuel de sandwiches',
        },
        {
            name: 'setcookies',
            description: 'change les cookies',
            options: [
                {
                    name: 'cookie',
                    description: 'le cookie',
                    type: 3,
                    required: true,
                }
            ]
        },
        {
            name: 'reset',
            description: 'reset le fichier stock'
        }
    ];
    try {
        console.log('Raffraichissement des commandes /')
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
            body: commands,
        });
        client.login(TOKEN);
    } catch (err) {
        console.log(err);
    }
}

function stock_to_str(data) {
    let str = data.items[0].name + ' : ' + data.items[0].amount_left + '\n'
    str += data.items[1].name + ' : ' + data.items[1].amount_left + '\n'
    return str
}

function sandwich_to_str(data) {
    let str = data.items[0].name + '\n'
    if(data.items.length > 1)
        str += data.items[1].name + '\n'
    return str
}

function get_cookies() {
    return fs.readFileSync('./cookie.txt', 'utf8');
}

function set_cookies(cookies) {
    fs.writeFileSync('./cookies.txt', cookies)
    cookies_valides = true;
}


function stock_empty(data) {
    return data.items === null
}

main();