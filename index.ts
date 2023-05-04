import { Connection } from "@solana/web3.js";
import * as dotenv from "dotenv";

async function main() {
    let rpc = new Connection("https://mango-mango-d092.mainnet.rpcpool.com/", {
        httpHeaders: {
            "Origin": "https://alpha.mango.markets",
            "Referrer": "https://alpha.mango.markets/"
        }
    });
    dotenv.config();
    /**
     * slope hack
     * Htp9MGP8Tig923ZFY7Qf2zzbMUmYneFRAhSp7vSg4wxV 144279636-144354155
     * CEzN7mqP9xoxn2HdyW6fjEJ73t7qaX9Rp2zyS6hb3iEu ?????????-144285272
     * GeEccGJ9BEzVbVor1njkBCCiqXJbXVeDHaXDCrBDbmuy ?????????-144302941
     * 5WwBYgQG6BdErM2nNNyUmQXfcUnB68b6kesxBywh1J3n ?????????-144312376
     */
}