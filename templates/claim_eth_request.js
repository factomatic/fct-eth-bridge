const fs = require('fs');
const ethers = require('ethers');
const toml = require('toml');
const Bridge = require('../build/Bridge.json');

const args = process.argv.slice(2);
const config = toml.parse(fs.readFileSync('./config.toml', 'utf-8'));
const contractAddress = config.contractAddress; 
const accountPrivKey = config.fctBuyRequest.ethPrivateKey;
const provider = ethers.getDefaultProvider('homestead');
const wallet = new ethers.Wallet(accountPrivKey, provider);
const contract = new ethers.Contract(contractAddress, Bridge.abi, wallet);

const requestId = args[0];
const txTimestamp = '$tx_timestamp';
const addressesCount = $addresses_count;
const addresses = $addresses;
const amounts = $amounts;
const publicKeys = $public_keys;
const signatures = $signatures;
const expectedTransactionHash = '$expected_tx_hash';
const txBlockHeight = $tx_block_height;
const txPathNodes = $tx_path;
const factoidBlockPathNodes = $fblock_path;
const directoryBlockPathNodes = $dblock_path;
const txPathPositions = $tx_path_positions;
const factoidBlockPathPositions = $fblock_path_positions;
const directoryBlockPathPositions = $dblock_path_positions;
const headerHashesAndMerkleRoots = $header_hashes_and_merkle_roots;

async function claimEth() {
    console.log('Waiting for 1st transaction to be mined...')
    const submitParamsTransaction = await contract
      .submitBookedRequestTransactionParams(
          requestId,
          txTimestamp,
          addressesCount,
          addresses,
          amounts,
          publicKeys,
          signatures,
          { gasPrice: config.gasPriceInGwei * Math.pow(10, 9) }
      );
    await submitParamsTransaction.wait();

    let booking = await contract.bookings(requestId);
    console.log('Expected transaction hash: ' + expectedTransactionHash);
    console.log('Transaction hash: ' + booking.txHash);

    console.log('Waiting for 2nd transaction to be mined...')
    const fulfillRequestTransaction = await contract
      .fulfillRequest(
          requestId,
          txBlockHeight,
          txPathNodes,
          factoidBlockPathNodes,
          directoryBlockPathNodes,
          txPathPositions,
          factoidBlockPathPositions,
          directoryBlockPathPositions,
          headerHashesAndMerkleRoots,
          { gasPrice: config.gasPriceInGwei * Math.pow(10, 9) }
      );
    await fulfillRequestTransaction.wait();

    let request = await contract.requests(requestId);
    return request;
}

claimEth().then((request) => console.log(request));
