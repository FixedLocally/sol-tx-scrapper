import * as mysql from "mysql";
import * as dotenv from "dotenv";

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
        db.query("select id, destination, block_time from tx_details where destination != '' and (tx_details.target_active_tx_30d<0 or tx_details.target_passive_tx_30d<0 or tx_details.target_outgoing_tx_proportion<0 or tx_details.new_target<0)", async (err, rows) => {
            if (err) {
                throw err;
            }
            resolve(rows);
        });
    });
    for (let row of rows) {
        let id = row.id;
        let txTime = row.block_time;
        // active/passive tx count
        let activeCounts = await new Promise<any[]>((resolve) => {
            db.query("select active, count(*) from tx_history where address=? and block_time>? and block_time<? group by active", [row.destination, row.block_time - 86400 * 3000, row.block_time], (err, rows) => {
                if (err) {
                    throw err;
                }
                resolve(rows);
            });
        });
        let minTimestamps = await new Promise((resolve) => {
            db.query("select min(block_time) as mbt from tx_history where address=?", [row.destination], (err, rows) => {
                if (err) {
                    throw err;
                }
                resolve(rows[0].mbt);
            });
        });
        let targetTxCounts = [0, 0];
        for (let activeCount of activeCounts) {
            targetTxCounts[activeCount.active] = activeCount["count(*)"];
        }
        console.log(row.destination, activeCounts, minTimestamps, txTime);
        await new Promise<void>((resolve) => {
            db.query("update tx_details set target_active_tx_30d=?, target_passive_tx_30d=?, new_target=? where id=?", [targetTxCounts[1], targetTxCounts[0], txTime - 86400 < minTimestamps, id], (err) => {
                if (err) {
                    throw err;
                }
                console.log("updated", id);
                resolve();
            });
        });
    }
    await new Promise<void>((resolve) => {
        db.query("update tx_details set target_outgoing_tx_proportion=target_active_tx_30d/(target_active_tx_30d + target_passive_tx_30d) where target_active_tx_30d + target_passive_tx_30d > 0", (err) => {
            if (err) {
                throw err;
            }
            console.log("updated", "target_outgoing_tx_proportion");
            resolve();
        });
    });
    db.end();
}

(async () => {
    await main();
})();