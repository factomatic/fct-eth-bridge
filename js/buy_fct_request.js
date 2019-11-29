const fs = require('fs');
const base58 = require('bs58');
const ethers = require('ethers');
const toml = require('toml');
const Bridge = require('../build/Bridge.json');

const config = toml.parse(fs.readFileSync('./config.toml', 'utf-8'));

const rcdHash = "0x" + base58.decode(config.fctBuyRequest.fctAddress).slice(2, -4).toString("hex");
// Convert FCT amount from Factoids to Factoshis
const fctAmount = config.fctBuyRequest.fctAmount * Math.pow(10, 8);
// Convert ETH amount from ether to wei
const weiAmount = config.fctBuyRequest.ethAmount * Math.pow(10, 18)
const contractAddress = config.contractAddress; 
const accountPrivKey = config.fctBuyRequest.ethPrivateKey;
const now = Math.floor(Date.now() / 1000);
const requestDeadline = now + config.fctBuyRequest.durationMinutes * 60;

const provider = ethers.getDefaultProvider('homestead');
const wallet = new ethers.Wallet(accountPrivKey, provider);
const contract = new ethers.Contract(contractAddress, Bridge.abi, wallet);

async function issueFctBuyRequest(fctAddress, requestAmount, requestDeadline) {
    let tx = await contract.issueRequest(
        fctAddress, requestAmount, requestDeadline,
        { value: weiAmount, gasPrice: config.gasPriceInGwei * Math.pow(10, 9) }
    );
    let receipt = await tx.wait();
    let requestEvent = receipt.events.pop();
    // Return the ID of the request
    return requestEvent.args[0];
};

issueFctBuyRequest(rcdHash, fctAmount, requestDeadline)
    .then((v) => console.log('Request ID is: ' + v));
