import { WOMClient } from "@wise-old-man/utils";
import axios from "axios";
import { Bosses, Skills } from "../constants/enums.js";
import {
    allCatcher,
    incorrectId,
    playerError,
    topTenError,
} from "./errors/handling.js";
import {
    buildMessage,
    jsonToOutput,
    sortMembershipsByMetric,
    top5members,
    numberWithCommas,
    toCapitalCase,
} from "./utils/utils.js";
import { AttachmentBuilder } from "discord.js";
import { COMMAND_MESSAGES } from "../constants/messages.js";

const womClient = new WOMClient();

export async function getAllDisplayNames(groupId) {
    try {
        const memberships = (await womClient.groups.getGroupDetails(groupId))
            .memberships;
        return memberships.map((p) => {
            return p.player.displayName;
        });
    } catch (e) {
        allCatcher(e);
    }
}

export async function getResults(msg, id, type) {
    try {
        let winner;
        let secondPlace;
        return await womClient.competitions
            .getCompetitionDetails(id)
            .then((json) => {
                const output = top5members(json);
                winner = output[0].player.displayName;
                secondPlace = output[1].player.displayName;
                return output;
            })
            .then((json) => jsonToOutput(json, type))
            .then((res) => {
                let message = `Here are the results for the ${
                    type === "sotw" ? "Skill of the Week" : "Boss of the Week"
                } competition:\n`;
                message += `\`\`\`${res.join("\n")}\`\`\``;
                message += `\nThank you to everyone who took part!\n${winner} gets 2 bonds for winning, ${secondPlace} gets 1 for coming in second place. Please contact any admin or leader for the payout.\n\nHappy scaping and we hope to see you all compete in the next event!`;
                msg.reply(message);
            });
    } catch (e) {
        incorrectId(e, msg);
    }
}

export async function getGroupCompetitions(msg, groupId) {
    try {
        const competitions = await womClient.groups.getGroupCompetitions(
            groupId
        );
        console.log(competitions);
    } catch (e) {
        allCatcher(e, msg);
    }
}

export async function getTopTen(msg, groupId, metric) {
    try {
        if (metric === "pets" || metric === "log") {
            const usernames = await getAllDisplayNames(groupId);
            msg.reply(
                `Please wait while I fetch the top 10 for the metric "${metric}". (approx. ${(
                    (usernames.length / 30 + 1) *
                    5
                ).toFixed(0)} secs.)`
            );
            const resArray = await getColTopTen(metric, usernames);
            const arrayOfObjects = await Promise.all(resArray);
            const sortedResArray =
                metric === "pets"
                    ? arrayOfObjects.sort((a, b) => b.pets - a.pets)
                    : arrayOfObjects.sort(
                          (a, b) => b.uniqueObtained - a.uniqueObtained
                      );
            await Promise.all(sortedResArray);
            msg.reply(buildMessage(sortedResArray, metric));
        } else {
            const memberships = (
                await womClient.groups.getGroupDetails(groupId)
            ).memberships;
            const sortedMemberships = sortMembershipsByMetric(
                memberships,
                metric
            ).slice(0, 10);
            msg.reply(buildMessage(sortedMemberships, metric));
        }
    } catch (e) {
        topTenError(e, msg);
    }
}

export async function getPlayerStats(msg, playerName) {
    try {
        const displayName = (
            await womClient.players.getPlayerDetails(playerName)
        ).displayName;
        const playerDetails = await womClient.players
            .getPlayerDetails(playerName)
            .then((json) => {
                let output = `Here are the stats for ${displayName}:\n`;
                const array = Object.values(json.latestSnapshot.data.skills);
                output += "```";
                array.forEach((skill) => {
                    output += `${(toCapitalCase(skill.metric) + ": ").padEnd(
                        14
                    )}${skill.level.toString().padStart(4)} ${numberWithCommas(
                        skill.experience
                    ).padStart(12)} Exp   Rank ${numberWithCommas(
                        skill.rank
                    ).padStart(11)}   ${skill.ehp
                        .toFixed(2)
                        .padStart(8)} EHP\n`;
                });
                output += "```";
                msg.reply(output);
            });
    } catch (e) {
        playerError(e, msg);
    }
}

export async function getPlayerBossStats(msg, playerName) {
    try {
        const displayName = (
            await womClient.players.getPlayerDetails(playerName)
        ).displayName;
        let output = `Here are the boss stats for ${displayName}:\n\`\`\``;
        const playerDetails = await womClient.players
            .getPlayerDetails(playerName)
            .then((json) => {
                const array = Object.values(json.latestSnapshot.data.bosses);
                array.forEach((boss) => {
                    output += `${(Bosses[boss.metric] + ": ").padEnd(
                        23
                    )}${boss.kills
                        .toString()
                        .padStart(6)}  Rank ${numberWithCommas(
                        boss.rank
                    ).padStart(11)}   ${boss.ehb.toFixed(2).padStart(8)} EHB\n`;
                });
            });
        output += "```";
        msg.reply(output);
    } catch (e) {
        playerError(e, msg);
    }
}

export async function getPlayerSkillStat(msg, metric, playerName) {
    try {
        const displayName = (
            await womClient.players.getPlayerDetails(playerName)
        ).displayName;
        const playerStat = await womClient.players
            .getPlayerDetails(playerName)
            .then((json) => {
                const array = Object.values(json.latestSnapshot.data.skills);
                const skillStats = array.filter((skill) => {
                    return skill.metric === metric;
                })[0];
                let message = `Here are the ${
                    Skills[toCapitalCase(skillStats.metric)]
                } stats for ${displayName}:\n\`\`\`Level: ${
                    skillStats.level
                }\nExp: ${numberWithCommas(
                    skillStats.experience
                )} Exp\nRank: ${numberWithCommas(
                    skillStats.rank
                )}\nEHP: ${skillStats.ehp.toFixed(2)} hours\`\`\``;
                msg.reply(message);
            });
    } catch (e) {
        playerError(e, msg);
    }
}

export async function getPlayerBossStat(msg, metric, playerName) {
    try {
        const displayName = (
            await womClient.players.getPlayerDetails(playerName)
        ).displayName;
        const playerStat = await womClient.players
            .getPlayerDetails(playerName)
            .then((json) => {
                const array = Object.values(json.latestSnapshot.data.bosses);
                const bossStats = array.filter((boss) => {
                    return boss.metric === metric;
                })[0];
                let message = `Here are the ${
                    Bosses[bossStats.metric]
                } stats for ${displayName}:\n\`\`\`Kills or completions: ${numberWithCommas(
                    bossStats.kills
                )}\nRank: ${numberWithCommas(
                    bossStats.rank
                )}\nEHB: ${bossStats.ehb.toFixed(2)} hours\`\`\``;
                msg.reply(message);
            });
    } catch (e) {
        playerError(e, msg);
    }
}

export function getCommands(msg) {
    try {
        const message = `The Degeneration bot supports the following commands:\n\`\`\`${COMMAND_MESSAGES.join(
            ""
        )}\nThe boss_identifier is typically the name of the boss in lowercase, separated by underscores, e.g. thermonuclear_smoke_devil or chambers_of_xeric. We are working on allowing certain common abbreviations as well (e.g. cox or tob or thermy, etc...).\`\`\``;
        msg.reply(message);
    } catch (e) {
        allCatcher(e, msg);
    }
}

export function getClanRankCalculator(msg) {
    try {
        const attachment = new AttachmentBuilder(
            "public/files/Clan_Rank_Calculator_v2.0.xlsx"
        );
        msg.reply({
            content: "Here is the Clan Rank Calculator:",
            files: [attachment],
        });
    } catch (e) {
        allCatcher(e, msg);
    }
}

export async function getColTopTen(metric, usernames) {
    const batchSize = 30; // tweak this number if api fails (set it lower and wait a couple of mins before trying again)
    let curReq = 0;

    const promises = [];
    const resMap = [];
    while (curReq < usernames.length) {
        const end =
            usernames.length < curReq + batchSize
                ? usernames.length
                : curReq + batchSize;
        const concurrentReq = new Array(batchSize);

        for (let index = curReq; index < end; index++) {
            const promise = axios
                .get(
                    `https://api.collectionlog.net/collectionlog/user/${usernames[index]}`
                )
                .then((res) => {
                    resMap.push(
                        colLogObjectBuilder(metric, usernames, index, res)
                    );
                })
                .catch(() =>
                    console.log(`something went wrong for ${usernames[index]}`)
                );
            concurrentReq.push(promise);
            promises.push(promise);
            console.log(`sending request ${curReq}...`);
            curReq++;
        }
        console.log(`requests ${curReq - batchSize}-${curReq} done.`);
        await Promise.all([waitForMs(5000), Promise.all(concurrentReq)]);
    }
    await Promise.all([promises]);
    return resMap;
}

const waitForMs = (ms) =>
    new Promise((resolve, reject) => setTimeout(() => resolve(), ms));

async function colLogObjectBuilder(metric, usernames, index, res) {
    try {
        if (metric === "log") {
            return {
                username: usernames[index],
                accountType: res.data.collectionLog.accountType,
                totalObtained: res.data.collectionLog.totalObtained,
                totalItems: res.data.collectionLog.totalItems,
                uniqueObtained: res.data.collectionLog.uniqueObtained,
            };
        }
        if (metric === "pets") {
            return {
                username: usernames[index],
                pets: res.data.collectionLog.tabs.Other[
                    "All Pets"
                ].items.filter((i) => {
                    return i.obtained;
                }).length,
            };
        }
    } catch (e) {
        console.log(`Didn't work for ${usernames[index]}, skipping...`);
    }
}
