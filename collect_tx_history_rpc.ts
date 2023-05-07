import * as dotenv from "dotenv";
import * as mysql from "mysql";
import {Connection, PublicKey} from "@solana/web3.js";

async function main(addressPattern: string) {
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
    let rows = await new Promise<any[]>((resolve) => {
        db.query("select addr from uniq_addresses where addr like ?", [addressPattern], async (err, rows) => {
            if (err) {
                throw err;
            }
            resolve(rows.map((row) => row.addr));
        });
    });
    let pendingAddresses = new Set<string>();
    for (let row of rows) {
        pendingAddresses.add(row);
    }
    let doneRows = await new Promise<any[]>((resolve) => {
        db.query("select distinct address from tx_history", async (err, rows) => {
            if (err) {
                throw err;
            }
            resolve(rows);
        });
    });
    for (let row of doneRows) {
        pendingAddresses.delete(row.address);
    }
    console.log(pendingAddresses.size);

    let completed = 0;
    let sql = "INSERT INTO `tx_history` (`address`, `block_time`, `sig`, `active`) VALUES (?, ?, ?, ?)";
    for (let address of pendingAddresses) {
        let sigs = await rpc.getSignaturesForAddress(new PublicKey(address), {limit: 500});
        let txs = await rpc.getParsedTransactions(sigs.map(x => x.signature), {maxSupportedTransactionVersion: 0});
        try {
            let rows = txs.map(x => [address, x.blockTime, x.transaction.signatures[0], x.transaction.message.accountKeys.filter(y => y.signer).map(y => y.pubkey.toBase58()).indexOf(address) >= 0]);
            for (let row of rows) {
                await new Promise<void>((resolve) => {
                    db.query(sql, row, (err) => {
                        // don't care about errors
                        resolve();
                    });
                });
            }
            ++completed;
            console.log("completed", completed, "of", pendingAddresses.size, rows.length, "txs");
        } catch (_) {}
    }
    db.end();
}

(async () => {
    await main(process.argv[2] || "%");
})();