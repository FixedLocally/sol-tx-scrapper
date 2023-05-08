import * as mysql from "mysql";
import * as dotenv from "dotenv";
import {Connection, PublicKey} from "@solana/web3.js";

const SOLEND_PROGRAM_ID = "So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo";
const MANGO_V4_PROGRAM_ID = "4MangoMjqJ2firMokCjjGgoK8d4MXcrgL7XJaL3w6fVg";
const DRIFT_PROGRAM_ID = "4MangoMjqJ2firMokCjjGgoK8d4MXcrgL7XJaL3w6fVg";
const TENSOR_SWAP_ID = "TSWAPaqyCSx2KABk68Shruf4rp7CxcNi8hAsbdwmHbN";
const MAGIC_EDEN_ID = "M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K";
const HADESWAP_ID = "hadeK9DLv9eA7ya5KCTqSvSvRZeJC3JgD5a9Y3CNbvu";
const SEQ_ENFORCER_ID = "GDDMwNyyx8uB6zrqwBFHjLLG3TBYk2F8Az4yrQC5RzMp";

async function main(program: string, dataset: string) {
    dotenv.config();
    let db = mysql.createConnection({
        host     : process.env.DB_HOST,
        user     : process.env.DB_USER,
        password : process.env.DB_PASS,
        database : process.env.DB_NAME,
        port     : parseInt(process.env.DB_PORT),
    });
    let rpc = new Connection(process.env.RPC_URL, {
        httpHeaders: {
            "Origin": process.env.RPC_ORIGIN,
            "Referrer": process.env.RPC_ORIGIN + "/",
        }
    });
    db.connect();

    let count = 0;
    let before;
    while (true) {
        let sigs = await rpc.getSignaturesForAddress(new PublicKey(program), {limit: 500, before});
        let txs = await rpc.getParsedTransactions(sigs.map((sig) => sig.signature), {maxSupportedTransactionVersion: 0});
        for (let tx of txs) {
            // organic solend txs include a huge prio fee
            if (program == SOLEND_PROGRAM_ID && tx.meta.fee < 6000) continue;
            // organic users don't need that
            if (tx.transaction.message.instructions.some(x => x.programId.toBase58() == SEQ_ENFORCER_ID)) continue;
            // too big for a user tx
            if (tx.transaction.message.instructions.length > 7) continue;

            let sigSql = "INSERT INTO `txs` (`entity`, `sig`, `dataset`, `classification`) VALUES (?, ?, ?, ?)";
            await new Promise<void>((resolve) => {
                db.query(sigSql, [tx.transaction.message.accountKeys.filter(x => x.signer)[0].pubkey.toBase58(), tx.transaction.signatures[0], dataset, 0], (err) => {
                    // if (err) throw err;
                    resolve();
                });
            });
            let detailSql = "INSERT INTO tx_details (id, details) VALUES ((select id from txs where sig=?), ?)";
            await new Promise<void>((resolve) => {
                db.query(detailSql, [tx.transaction.signatures[0], JSON.stringify(tx)], (err) => {
                    // if (err) throw err;
                    resolve();
                });
            });
            ++count;
        }
        before = sigs[sigs.length - 1].signature;
        console.log("completed batch", count, "txs", before);
        if (count > 3000) break;
    }
    db.end();
}

(async () => {
    // await main("solTransfers");
    main(SOLEND_PROGRAM_ID, "solend-user");
    main(MANGO_V4_PROGRAM_ID, "mango-user");
    main(DRIFT_PROGRAM_ID, "drift-user");
    main(TENSOR_SWAP_ID, "tensor-user");
    main(MAGIC_EDEN_ID, "magiceden-user");
    main(HADESWAP_ID, "hadeswap-user");
})();