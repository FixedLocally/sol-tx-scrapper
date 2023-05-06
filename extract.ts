import * as mysql from "mysql";
import {ParsedTransactionWithMeta} from "@solana/web3.js";
import * as dotenv from "dotenv";

const MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const SYSTEM_PROGRAM_ID = "11111111111111111111111111111111";
const COMPUTE_BUDGET_PROGRAM_ID = "ComputeBudget111111111111111111111111111111";

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
        db.query("select id, details from tx_details where prio_fee_lamports<0 or has_memo<0 or is_program_invocation<0 or is_simple_transfer<0 or is_single_effective_ix<0", async (err, rows) => {
            if (err) {
                throw err;
            }
            resolve(rows);
        });
    });
    for (let row of rows) {
        let id = row.id;
        let details: ParsedTransactionWithMeta = JSON.parse(row.details);
        // is memo
        let memoIndex = details.transaction.message.accountKeys.findIndex((x: any) => x.pubkey === MEMO_PROGRAM_ID);
        let hasMemo = details.transaction.message.instructions.some((x: any) => x.programIdIndex === memoIndex);
        // prio fee
        let sigCount = details.transaction.signatures.length;
        let prioFee = details.meta.fee - 5000 * sigCount;
        // is program invocation
        let isProgramInvocation = details.meta.logMessages.some((x: any) => x.endsWith(" compute units"));
        // is simple transfer
        let isSimpleTransfer = details.transaction.message.instructions.every((x: any) => {
            // sol-trasnfer
            if (x.programId === SYSTEM_PROGRAM_ID && x.parsed?.type === "transfer") return true;
            // spl-transfer, transnfer/transferChecked
            if (x.programId === TOKEN_PROGRAM_ID && x.parsed?.type.startsWith("transfer")) return true;
            // compute budget (doesn't matter)
            if (x.programId === COMPUTE_BUDGET_PROGRAM_ID) return true;
        });
        // is single effective ix
        let isSingleEffectiveIx = details.transaction.message.instructions.filter((x: any) => x.programId != COMPUTE_BUDGET_PROGRAM_ID).length === 1;
        await new Promise<void>((resolve) => {
            db.query("update tx_details set prio_fee_lamports=?, has_memo=?, is_program_invocation=?, is_simple_transfer=?, is_single_effective_ix=? where id=?", [prioFee, hasMemo, isProgramInvocation, isSimpleTransfer, isSingleEffectiveIx, id], (err) => {
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