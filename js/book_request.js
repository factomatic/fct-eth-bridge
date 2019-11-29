const fs = require('fs');
const ethers = require('ethers');
const toml = require('toml');
const Bridge = require('../build/Bridge.json');

const args = process.argv.slice(2);
const config = toml.parse(fs.readFileSync('./config.toml', 'utf-8'));
const accountPrivKey = config.ethClaimRequest.ethPrivateKey;
const provider = ethers.getDefaultProvider('homestead');
const wallet = new ethers.Wallet(accountPrivKey, provider);
const contract = new ethers.Contract(config.contractAddress, Bridge.abi, wallet);
const requestId = args[0];

async function bookRequest(contract, requestId) {
    let tx = await contract.bookRequest(requestId, { gasPrice: config.gasPriceInGwei * Math.pow(10, 9) });
    let receipt = await tx.wait();
    return receipt.status;
}

bookRequest(contract, requestId).then((v) => {
        if (v == 0) {
            console.log("Failed to book request.");
        } else {
            console.log(`Request ${requestId} successfully booked.`);
        }
    }
);
