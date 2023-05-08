import * as mysql from "mysql";
import {ParsedTransactionWithMeta} from "@solana/web3.js";
import * as dotenv from "dotenv";
import * as dateformat from "dateformat";

interface VolumeEntry {
    id: number;
    tokenVolume: Record<string, number>;
    solVolume: number;
    date: string;
}

async function main() {
    dotenv.config();
    // const dateformat = await import("dateformat");
    let db = mysql.createConnection({
        host     : process.env.DB_HOST,
        user     : process.env.DB_USER,
        password : process.env.DB_PASS,
        database : process.env.DB_NAME,
        port     : parseInt(process.env.DB_PORT),
    });
    db.connect();
    let rows = await new Promise<any[]>((resolve) => {
        db.query("select t1.id, details, t2.dataset from tx_details t1, txs t2 where tx_value<0 and t1.id=t2.id", async (err, rows) => {
            if (err) {
                throw err;
            }
            resolve(rows);
        });
    });
    let cgMappingRows = await new Promise<any[]>((resolve) => {
        db.query("select token_address, cg_symbol from cg_mapping", async (err, rows) => {
            if (err) {
                throw err;
            }
            resolve(rows);
        });
    });
    let priceHistory = await new Promise<any[]>((resolve) => {
        db.query("select token_address, date, price from price_history", async (err, rows) => {
            if (err) {
                throw err;
            }
            resolve(rows);
        });
    });
    let cgMapping: Record<string, string> = {};
    for (let row of cgMappingRows) {
        cgMapping[row.token_address] = row.cg_symbol;
    }
    // console.log(cgMapping);
    let missingCgMapping = new Set<string>();
    let volumeEntries: Array<VolumeEntry> = [];
    let tokenValue: Record<string, number> = {}; // mint-date => value
    for (let entry of priceHistory) {
        let key = entry.token_address + "-" + entry.date;
        tokenValue[key] = entry.price;
    }

    for (let row of rows) {
        let id = row.id;
        let details: ParsedTransactionWithMeta = JSON.parse(row.details);
        let preTokenBalances = details.meta.preTokenBalances.sort((a, b) => a.accountIndex - b.accountIndex);
        let postTokenBalances = details.meta.postTokenBalances.sort((a, b) => a.accountIndex - b.accountIndex);
        let poi = 0;
        let pri = 0;

        // merge pre/post token balances
        while (true) {
            let pre = preTokenBalances[pri];
            let post = postTokenBalances[poi];
            if (!pre && !post) break;
            if ((!pre && post) || (pre && post && pre.accountIndex > post.accountIndex)) {
                // post missing, add pre to post
                preTokenBalances.push({...post, uiTokenAmount: {...post.uiTokenAmount, uiAmountString: "0", amount: "0",  uiAmount: 0}});
                preTokenBalances.sort((a, b) => a.accountIndex - b.accountIndex);
                ++poi;
                ++pri;
                continue;
            }
            if ((!post && pre) || (pre && post && pre.accountIndex < post.accountIndex)) {
                // post missing, add post to pre
                postTokenBalances.push({...pre, uiTokenAmount: {...pre.uiTokenAmount, uiAmountString: "0", amount: "0",  uiAmount: 0}});
                postTokenBalances.sort((a, b) => a.accountIndex - b.accountIndex);
                ++poi;
                ++pri;
                continue;
            }
            ++poi;
            ++pri;
        }
        let preBalances = details.meta.preBalances;
        let postBalances = details.meta.postBalances;
        let tokenDiffAbsSum: Record<string, number> = {};
        let tokenDiffSum: Record<string, number> = {};
        let tokenVolume: Record<string, number> = {};
        let mints: Set<string> = new Set();
        let solSum = -details.meta.fee;
        for (let i = 0; i < preTokenBalances.length; ++i) {
            let pre = preTokenBalances[i];
            let post = postTokenBalances[i];
            let mint = pre.mint;
            let preBal = parseFloat(pre.uiTokenAmount.uiAmountString);
            let postBal = parseFloat(post.uiTokenAmount.uiAmountString);
            if (preBal !== postBal) {
                if (row.dataset == "solend-user" || row.dataset == "mango-user" || row.dataset == "drift-user") {
                    mints.add(mint);
                }
                tokenDiffAbsSum[mint] = (tokenDiffAbsSum[mint] || 0) + Math.abs(preBal - postBal);
                tokenDiffSum[mint] = (tokenDiffSum[mint] || 0) + (postBal - preBal);
            }
        }
        for (let i = 0; i < preBalances.length; ++i) {
            solSum += Math.abs(postBalances[i] - preBalances[i]);
        }
        for (let mint of mints) {
            tokenVolume[mint] = (tokenDiffAbsSum[mint] + Math.abs(tokenDiffSum[mint])) / 2;
            missingCgMapping.add(mint);
        }
        solSum /= 2;
        // console.log("id", id);
        // console.log("date", dateformat(new Date(1000 * details.blockTime), "dd-mm-yyyy"));
        // console.log("tokenVolume", tokenVolume);
        // console.log("solSum", solSum);

        volumeEntries.push({
            id,
            tokenVolume,
            solVolume: solSum,
            date: dateformat(new Date(1000 * details.blockTime), "dd-mm-yyyy"),
        });
    }

    for (let cgMapping of cgMappingRows) {
        missingCgMapping.delete(cgMapping.token_address);
    }
    console.log("missingCgMapping", missingCgMapping);
    for (let mint of missingCgMapping) {
        let resp = await _fetch(`https://api.coingecko.com/api/v3/coins/solana/contract/${mint}`);
        let json = await resp.json();
        if (json.error) {
            if (json.error === "coin not found") {
                // "no such token" is useful info too
                json = {"symbol": null};
            } else {
                console.log("error", json.error);
                continue;
            }
        }
        if (json.status?.error_code === 429) {
            throw new Error(`429, try again later, len=${missingCgMapping.size}`);
        }
        let cgSymbol = json.id;
        cgMapping[mint] = cgSymbol;
        await new Promise<void>((resolve) => {
            db.query("insert into cg_mapping (token_address, cg_symbol) VALUES (?, ?)", [mint, cgSymbol], (err) => {
                if (err) {
                    throw err;
                }
                console.log("updated", mint, cgSymbol);
                resolve();
            });
        });
    }

    for (let entry of volumeEntries) {
        let tokenVolume = entry.tokenVolume;
        let solVolume = entry.solVolume;
        let date = entry.date;
        let id = entry.id;
        let txValue = 0;
        for (let mint in tokenVolume) {
            let cgSymbol = cgMapping[mint];
            console.log(mint, cgSymbol);
            if (!cgSymbol) {
                continue;
            }
            let key = `${mint}-${date}`;
            if (tokenValue.hasOwnProperty(key)) {
                // console.log("has", key);
                txValue += tokenVolume[mint] * tokenValue[key];
            } else {
                // console.log("no", key);
                let resp = await _fetch(`https://api.coingecko.com/api/v3/coins/${cgMapping[mint]}/history?date=${date}&localization=false`);
                let json = await resp.json();
                if (json.status?.error_code === 429) {
                    throw new Error(`429, try again later, id=${id}`);
                }
                let price = json.market_data?.current_price.usd || 0;
                txValue += tokenVolume[mint] * price;
                tokenValue[key] = price;
                await new Promise<void>((resolve) => {
                    db.query("insert into price_history (token_address, date, price) VALUES (?, ?, ?)", [mint, date, price], (err) => {
                        if (err) {
                            throw err;
                        }
                        console.log("updated", id);
                        resolve();
                    });
                });
            }
        }
        let key = `solana-${date}`;
        if (tokenValue.hasOwnProperty(key)) {
            txValue += solVolume * tokenValue[key] / 1e9;
        } else {
            let resp = await _fetch(`https://api.coingecko.com/api/v3/coins/solana/history?date=${date}&localization=false`);
            let json = await resp.json();
            if (json.status?.error_code === 429) {
                throw new Error(`429, try again later, id=${id}`);
            }
            let price = json.market_data.current_price.usd;
            txValue += solVolume * price / 1e9;
            tokenValue[key] = price;
            await new Promise<void>((resolve) => {
                db.query("insert into price_history (token_address, date, price) VALUES (?, ?, ?)", ["solana", date, price], (err) => {
                    if (err) {
                        throw err;
                    }
                    console.log("updated", id);
                    resolve();
                });
            });
        }

        // update db
        await new Promise<void>((resolve) => {
            db.query("update tx_details set tx_value=? where id=?", [txValue, id], (err) => {
                if (err) {
                    throw err;
                }
                console.log("updated", id, txValue, tokenVolume);
                resolve();
            });
        });
    }

    db.end();
}

function _fetch(url: string, init?: RequestInit): Promise<Response> {
    console.log("fetch", url);
    return fetch(url, init);
}

(async () => {
    await main();
})();