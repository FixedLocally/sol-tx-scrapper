import * as mysql from "mysql";
import {ParsedTransactionWithMeta} from "@solana/web3.js";
import * as dotenv from "dotenv";

const MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";

async function main() {
    dotenv.config();
    let db = mysql.createConnection({
        host     : process.env.DB_HOST,
        user     : process.env.DB_USER,
        password : process.env.DB_PASS,
        database : process.env.DB_NAME,
        port     : parseInt(process.env.DB_PORT),
    });
    db.connect();
    let rows = await new Promise<any[]>((resolve) => {
        db.query("select id, details from tx_details where prio_fee_lamports<0 or has_memo<0", async (err, rows) => {
            if (err) {
                throw err;
            }
            resolve(rows);
        });
    });
    for (let row of rows) {
        let id = row.id;
        let details: ParsedTransactionWithMeta = JSON.parse(row.details);
        let memoIndex = details.transaction.message.accountKeys.findIndex((x: any) => x.pubkey === MEMO_PROGRAM_ID);
        let hasMemo = details.transaction.message.instructions.some((x: any) => x.programIdIndex === memoIndex);
        let sigCount = details.transaction.signatures.length;
        let prioFee = details.meta.fee - 5000 * sigCount;
        await new Promise<void>((resolve) => {
            db.query("update tx_details set prio_fee_lamports=?, has_memo=? where id=?", [prioFee, hasMemo, id], (err) => {
                if (err) {
                    throw err;
                }
                console.log("updated", id);
                resolve();
            });
        });
    }
    db.end();
}

(async () => {
    await main();
})();