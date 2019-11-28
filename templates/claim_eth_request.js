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

const submitParamsTransaction = await deployedContractWrapper
  .submitBookedRequestTransactionParams(
      requestId,
      txTimestamp,
      addressesCount,
      addresses,
      amounts,
      publicKeys,
      signatures
  );
await deployedContractWrapper.verboseWaitForTransaction(submitParamsTransaction, 'Submit transaction params for booked request');

let booking = await deployedContractWrapper.bookings(requestId);
console.log('Expected transaction hash: ' + expectedTransactionHash);
console.log('Transaction hash: ' + booking.txHash);

const txBlockHeight = $tx_block_height;
const txPathNodes = $tx_path;
const factoidBlockPathNodes = $fblock_path;
const directoryBlockPathNodes = $dblock_path;
const txPathPositions = $tx_path_positions;
const factoidBlockPathPositions = $fblock_path_positions;
const directoryBlockPathPositions = $dblock_path_positions;
const headerHashesAndMerkleRoots = $header_hashes_and_merkle_roots;

let contractBalance = await deployedContractWrapper.utils.getBalance();
console.log('Contract balance before fulfilling request: ' + contractBalance);

const fulfillRequestTransaction = await deployedContractWrapper
  .fulfillRequest(
      requestId,
      txBlockHeight,
      txPathNodes,
      factoidBlockPathNodes,
      directoryBlockPathNodes,
      txPathPositions,
      factoidBlockPathPositions,
      directoryBlockPathPositions,
      headerHashesAndMerkleRoots
  );
  
await deployedContractWrapper.verboseWaitForTransaction(fulfillRequestTransaction, 'Fulfill request');

let request = await deployedContractWrapper.requests(requestId);
console.log(request);

contractBalance = await deployedContractWrapper.utils.getBalance();
console.log('Contract balance after fulfilling request: ' + contractBalance);
