import * as mysql from "mysql";
import {ParsedTransactionWithMeta} from "@solana/web3.js";
import * as dotenv from "dotenv";

const MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const ATOKEN_PROGRAM_ID = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
const SYSTEM_PROGRAM_ID = "11111111111111111111111111111111";
const COMPUTE_BUDGET_PROGRAM_ID = "ComputeBudget111111111111111111111111111111";

function extractTarget(details) {
    let transfers = 0;
    let signer = details.transaction.message.accountKeys.filter(x => x.signer)[0].pubkey;
    let isSimpleTransfer = details.transaction.message.instructions.every((x: any) => {
        // sol-trasnfer
        if (x.programId === SYSTEM_PROGRAM_ID && x.parsed?.type === "transfer") {
            ++transfers;
            return true;
        }
        // spl-transfer, transfer/transferChecked
        if (x.programId === TOKEN_PROGRAM_ID) {
            if (x.parsed?.type.startsWith("transfer")) {
                ++transfers;
            }
            return true;
        }
        // ata ixs
        if (x.programId === ATOKEN_PROGRAM_ID) return true;
        // empty/util ix
        if (x.accounts && x.accounts.length <= 1) return true;
        // compute budget (doesn't matter)
        if (x.programId === COMPUTE_BUDGET_PROGRAM_ID || x.programId == MEMO_PROGRAM_ID) return true;
    });
    if (!isSimpleTransfer || transfers !== 1) {
        console.log("not simple transfer");
        return [signer, ""];
    }
    for (let ix of details.transaction.message.instructions) {
        // sol-trasnfer
        if (ix.programId === SYSTEM_PROGRAM_ID && ix.parsed?.type === "transfer") {
            return [ix.parsed.info.source, ix.parsed.info.destination];
        }
        // spl-transfer, transfer/transferChecked
        if (ix.programId === TOKEN_PROGRAM_ID && ix.parsed?.type.startsWith("transfer")) {
            let dest = ix.parsed.info.destination;
            let dIdx = details.transaction.message.accountKeys.findIndex(x => x.pubkey === dest);
            let src = ix.parsed.info.source;
            let sIdx = details.transaction.message.accountKeys.findIndex(x => x.pubkey === src);
            let target = details.meta.postTokenBalances.filter(x => x.accountIndex === dIdx)[0].owner;
            let source = details.meta.preTokenBalances.filter(x => x.accountIndex === sIdx)[0].owner;
            return [source, target];
            // return ix;
        }
    }
}

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
        db.query("select id, details from tx_details where prio_fee_lamports<0 or has_memo<0 or is_program_invocation<0 or is_simple_transfer<0 or is_single_effective_ix<0 or source=''", async (err, rows) => {
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
            if (x.programId === COMPUTE_BUDGET_PROGRAM_ID || x.programId == MEMO_PROGRAM_ID) return true;
        });
        // is single effective ix
        let isSingleEffectiveIx = details.transaction.message.instructions.filter((x: any) => x.programId != COMPUTE_BUDGET_PROGRAM_ID).length === 1;
        // source and destination
        let [source, destination] = extractTarget(details);
        await new Promise<void>((resolve) => {
            db.query("update tx_details set prio_fee_lamports=?, has_memo=?, is_program_invocation=?, is_simple_transfer=?, is_single_effective_ix=?, source=?, destination=? where id=?", [prioFee, hasMemo, isProgramInvocation, isSimpleTransfer, isSingleEffectiveIx, source, destination, id], (err) => {
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