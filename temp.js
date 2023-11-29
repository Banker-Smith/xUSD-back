require("dotenv").config();

const { createWalletClient, http, parseEther } = require('viem');
const { baseGoerli } = require('viem/chains');
const { privateKeyToAccount } = require('viem/accounts');

const account = privateKeyToAccount('0x' + process.env.ACC_PRIV_ADDRESS);

async function transferTokens(toAddress, amount) {
    try {
        // Create Viem wallet client
        const ViemWalletClient = createWalletClient({
            account,
            chain: baseGoerli,
            transport: http(process.env.INFURA_BASEGOERLI),
        });

        // Send transaction
        const hash = await ViemWalletClient.sendTransaction({
            to: toAddress,
            value: parseEther(amount.toString())
        });

        console.log("Token transfer succeeded. Transaction Hash:", hash);
        return hash;
    } catch (error) {
        console.error('Error sending tokens:', error);
        throw error;
    }
}

async function main() {
    try {
        const toAddress = '0xB038D8FA580BBC5a77FB9E103AC813865ad2240E';  // Replace with the actual recipient address
        const amount = 0.1;  // Replace with the actual amount

        const txHash = await transferTokens(toAddress, amount);
        console.log("Transaction Hash:", txHash);
    } catch (error) {
        console.error("An error occurred:", error);
    }
}

main();
