import * as mysql from "mysql";
import * as dotenv from "dotenv";

/**
 * slope hack
 * Htp9MGP8Tig923ZFY7Qf2zzbMUmYneFRAhSp7vSg4wxV 144279636-144354155
 * CEzN7mqP9xoxn2HdyW6fjEJ73t7qaX9Rp2zyS6hb3iEu ?????????-144285272
 * GeEccGJ9BEzVbVor1njkBCCiqXJbXVeDHaXDCrBDbmuy ?????????-144302941
 * 5WwBYgQG6BdErM2nNNyUmQXfcUnB68b6kesxBywh1J3n ?????????-144312376
 */
async function main(type: string) {
    dotenv.config();
    let db = mysql.createConnection({
        host     : process.env.DB_HOST,
        user     : process.env.DB_USER,
        password : process.env.DB_PASS,
        database : process.env.DB_NAME,
        port     : parseInt(process.env.DB_PORT),
    });
    let collection = JSON.parse(process.env.COLLECTION);
    db.connect();
    for (let collect of collection) {
        console.log(collect);
        let address = collect[0];
        let start = collect[1];
        let end = collect[2];
        let offset = 0;
        while (true) {
            let url = `https://public-api.solscan.io/account/${type}/?account=${address}&offset=${offset}&limit=50`;
            console.log("GET", url);
            let resp = await fetch(url, {
                headers: {
                    token: process.env.SOLSCAN_TOKEN,
                }
            });
            let json = await resp.json();
            let txs = json.data;
            let sql = "INSERT INTO `txs` (`entity`, `sig`, `dataset`, `classification`) VALUES ";
            let filtered = txs.filter(x => x.slot >= start);
            offset += txs.length;
            if (filtered.length === 0) {
                console.log("txs too old, skipping");
                break;
            }
            filtered = txs.filter(x => x.slot <= end);
            if (filtered.length === 0) {
                continue;
            }
            sql += filtered.map((tx) => {
                let sig = tx.tsHash || tx.signature[0];
                return `("${address}", "${sig}", "slope-hack", 1)`;
            }).join(", ");
            await new Promise<void>((resolve) => {
                db.query(sql, (err) => {
                    if (err) throw err;
                    resolve();
                });
            });
            console.log("completed batch", address, txs.length, "txs", offset, "offset");
            if (txs.length < 50) break;
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }
    db.end();
}

(async () => {
    // await main("solTransfers");
    await main("splTransfers");
})();