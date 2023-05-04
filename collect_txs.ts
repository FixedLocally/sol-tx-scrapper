import {Connection} from "@solana/web3.js";
import * as mysql from "mysql";
import * as dotenv from "dotenv";

/**
 * slope hack
 * Htp9MGP8Tig923ZFY7Qf2zzbMUmYneFRAhSp7vSg4wxV 144279636-144354155
 * CEzN7mqP9xoxn2HdyW6fjEJ73t7qaX9Rp2zyS6hb3iEu ?????????-144285272
 * GeEccGJ9BEzVbVor1njkBCCiqXJbXVeDHaXDCrBDbmuy ?????????-144302941
 * 5WwBYgQG6BdErM2nNNyUmQXfcUnB68b6kesxBywh1J3n ?????????-144312376
 */
async function main() {
    dotenv.config();
    let rpc = new Connection(process.env.RPC_URL, {
        httpHeaders: {
            "Origin": process.env.RPC_ORIGIN,
            "Referrer": process.env.RPC_ORIGIN + "/",
        }
    });
    let db = mysql.createConnection({
        host     : process.env.DB_HOST,
        user     : process.env.DB_USER,
        password : process.env.DB_PASS,
        database : process.env.DB_NAME,
        port     : parseInt(process.env.DB_PORT),
    });
    let collection = JSON.parse(process.env.COLLECTION);
    db.connect();
    let rows = await new Promise<any[]>((resolve) => {
        db.query("select id, sig from txs where id not in (select id from tx_details)", async (err, rows) => {
            if (err) {
                throw err;
            }
            resolve(rows);
        });
    });
    console.log(rows[0]);
    for (let i = 0; i < rows.length; i += 250) {
        let slice = rows.slice(i, i + 250);
        let sigs = slice.map(x => x.sig);
        let ids = slice.map(x => x.id);
        let details = await rpc.getParsedTransactions(sigs);
        for (let detail of details) {
            await new Promise<void>((resolve) => {
                db.query("insert into tx_details (id, details) values (?, ?)", [ids.shift(), JSON.stringify(detail)], (err) => {
                    if (err) {
                        throw err;
                    }
                    console.log("inserted", detail.transaction.signatures[0]);
                    resolve();
                });
            });
        }
    }
    db.end();
}

(async () => {
    main();
})();