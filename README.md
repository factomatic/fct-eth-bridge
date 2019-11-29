# FCT-ETH bridge
A Solidity smart contract, based on a reference Python implementation, which allows the buying of FCT tokens with ETH
without an intermediary. To the best of our knowledge, this is the first publicly available demonstration of trustless
interoperability between the Factom and Ethereum blockchains.

**This is a proof of concept implementation, which has NOT undergone any formal securty audit and is NOT suitable for use
in production. The smart contract is live on mainnet and real money is at stake if you use it, so never deposit large
amounts of ETH to the contract!**

The contract is deployed at [0x91e2252ba237fb31c46d3e2f8fd37d23cb82830d](https://etherscan.io/address/0x91e2252ba237fb31c46d3e2f8fd37d23cb82830d).

## Repository organization
* `python/`: contains a reference Python implementation of the smart contract logic in a Jupyter notebook, together with
a helper script for generating the parameters necessary for calling the smart contract
* `js/`: contains NodeJS scripts for calling the smart contract
* `contracts/`: contains the Solidity smart contract
* `templates/`: contains a JS template script for calling the smart contract in order to claim the deposited ETH. The
template is populated by the `python/generate_claim_eth_params.py` helper script

## How does it work
The general workflow is as follows:
* an Ethereum user submits a request to buy some FCT, along with a deposit of ETH to the smart contract 
* another user books this request and has up to 2 hours to fulfill it
* upon fulfilment, the person that has booked the request can claim the ETH deposited as part of this request by
submitting a "Proof-of-Transfer" to the smart contract

The contract keeps a registry of all FCT buy requests. Anyone can submit a request, specifying:
* the amount of FCT that they want to buy
* the amount of ETH that they are willing to pay for the FCT
* the FCT address to which the FCT should be transferred in order to fulfill the request
* an expiration time for the request (deposited funds can be reclaimed after the request expires, in case it hasn't been
  satisfied)

Upon successful submission of a request, the smart contract emits a `RequestIssued` event, which allows external parties
to monitor the contract for incoming FCT buy requests. Any party willing to fulfill the request can do so by sending a
booking transaction to the smart contract. Once the request is booked, the contract emits a `RequestBooked` event and
the user must send the requested amount of FCT to the specified FCT address before the request has expired and at
maximum within 2 hours of the booking. No other party is allowed to book or fulfill the same request within that
timeframe.

### Proof-of-Transfer
The Proof-of-Transfer is the mechanism for proving to the smart contract that the above transaction has indeed happened
in order to claim the deposited ETH. It leverages the anchoring of the Factom blockchain into Ethereum. The Merkle root
of the last 1000 `DirectoryBlock KeyMRs` (MR=Merkle Root) -- a.k.a. the `WindowMR` -- of the Factom blockchain is
recorded into [this Ethereum smart contract](https://etherscan.io/address/0xfac701d9554a008e48b6307fb90457ba3959e8a8).
This is a sliding window implementation, which means that roughly every 10 minutes a new `WindowMR` is recorded into the
contract and it contains the Merkle roots of the previous 1000 `DirectoryBlocks`.

Each `DirectoryBlock` contains a summary of all the transactions that have occurred on the Factom blockchain in the last
block, such as Factoid/Entry Credit trasanctions and administrative/plain entries recorded on-chain. If you are
unfamiliar with the underlying data structures of Factom, we refer you to [this documentation](https://github.com/FactomProject/FactomDocs/blob/master/factomDataStructureDetails.md)
and if you want to learn more about anchoring, [this](https://www.factom.com/company/technical-updates/anchors-away/) is a good starting point.

The `WindowMR` serves as a summary of all the transactions that have occurred on the Factom blockchain in the last 1000
blocks and as such it is an ideal candidate to produce a Proof-of-Transfer. The proof is a reconstruction of the
first `WindowMR`, which contains the Factoid transaction satisfying the request, inside the smart contract. As such, the
inputs to the smart contract are:
* the low-level Factoid tx details, such as inputs, outputs, amounts and
RCDs
* the Merkle authentication path starting from the Factoid tx hash as a leaf all the way up to the relevant `WindowMR`

The smart contract ensures that:
* the transaction satisfies the request (checking the amounts and output addresses)
* the transaction occurred following the issuance of the FCT buy request (to avoid replay attacks of old transactions)
* the provided Merkle authentication path ends in a valid `WindowMR`
* the Ethereum account claiming the funds is the same one that made the booking (to avoid hijacking of a booked request
after it has been fulfilled)

### Gas costs
There are four different transactions necessary in order to complete an end-to-end workflow:
* issuing an FCT buy request
* booking a request
* fulfilling a request

Due to limitation of the EVM (and our non-optimized implementation) the last action requires two transactions.

The associated gas costs are as follows:
* issuing a request: 158,215 gas ([example tx](https://etherscan.io/tx/0xcea925b37fc12124d07618fd2b40fe1b3553df2cc5cf775cfbe2cf28225010d5))
* booking a request: 86,439 gas ([example tx](https://etherscan.io/tx/0xe02398edfffbf7369d4451f6c7f79f4b3b9808ade18709c8a292d709520a9763))
* fulfilling a request:
    * 1st tx: 84,658 gas ([example tx](https://etherscan.io/tx/0x349ebb6ec5bb13c08116a296c9ab2dbd1effeeb8dfdbcce66585a8219e9807b0))
    * 2nd tx: 132,642 gas ([example tx](https://etherscan.io/tx/0x2815c0c4c894e125b5213b5dea0fb6374060e348ff0e26582d1b362221dd7e36))

Note that due to variability in the length of the Merkle authentication paths, the costs for fulfilling requests can
also vary. Nonethless, the above numbers demonstrate that the approach is clearly viable and the gas costs are low
enough to make sense even for small value exchanges.

## Using the contract
When using the contract, keep in mind that this is a proof of concept and deposit only marginal amounts of ETH to the
contract.

### Prerequisites
You need to have `node`, `npm` and `pipenv` installed. The latest stable versions should work fine, and it's very likely
that older versions work as well. This code has been tested on UNIX-like operating systems and very likely DOES NOT work
on Windows. Use MacOS, Ubuntu or another Linux distribution.

You also need access to the private keys of two Ethereum addresses with sufficient balances to make a deposit to the
smart contract and to claim the deposited funds after fullfiling an FCT buy request ($1 worth of ETH per account should
suffice). Finally, you need at least one Factoid address with a sufficient amount of FCT to fullfil the request.

### Procedure
1. `git clone git@github.com:factomatic/fct-eth-bridge.git`
1. `npm install`
1. `cd python && pipenv install && cd ..`
1. `cp config.toml.template config.toml`
1. Edit the `config.toml` file and input the required parameters
1. `node js/buy_fct_request.js`
    * once this transaction is mined, you will see a request ID in the output. Take a note of it as it's needed in the
    next steps.
1. `node js/book_request request_id`, where `request_id` is the number from above
1. Transfer the amount of FCT to the required address and take a note of the Factoid tx ID
1. Wait until the block containing the transaction has been anchored [here](https://etherscan.io/address/0x91e2252ba237fb31c46d3e2f8fd37d23cb82830d).
1. `cd python && python generate_claim_eth_params.py tx_id`
    * this will generate a `js/claim_eth_request.js`
1. `cd ..`
1. `node js/claim_eth_request.js request_id`

## Use cases
The obvious use case of the above mechanism is for trustless exchange of FCT & ETH. However, the same scheme can, in
principle, be used in at least two other applications:
* Buying pFCT with ETH directly
    - since burning of FCT is just a Factoid tx, the same mechanism can be used to prove that a transaction was done,
    which burns FCT to a given address. This would require a change to PegNet, which allows burning to a different FCT
    address.
* Factom as data layer for Ethereum
    - applications using Ethereum need to store data somewhere, as storage on Ethereum itself is prohibitively expensive
    for large amounts of data (and also discouraged to prevent blockchain bloat). Ethereum users can make requests to a
    smart contract similar to the one above for storing data on the Factom blockchain. The actual data to be recorded
    can be communicated off-chain and a deposit can be made to the Ethereum smart contract containing the hash of the
    data + the amount of ETH that the user is willing to pay for recording that data on Factom. Once the data is
    recorded, the entity that recorded it can sumit a Proof-of-Existence using the respective Factom entry and its
    Merkle authentication path.

## Limitations
The approach above has several limitations, worth noting.

### Lack of signature verification
The smart contract works without signature verification. This means that in theory it's possible for someone to book an
existing request and wait, hoping that someone else will accidentally transfer the right amount of FCT to the right
address. They could then take that transaction and claim the funds without having made the transfer themselves. Due to
the configurable and limited amount of time during which a request is valid, we deem it very unlikely that this happens,
especially if unorthodox amounts of FCT are used in the requests (e.g. 143.146 FCT).

A cryptographically more sound approach would be to require the account claiming the funds to produce a signature with
the private key of the FCT address, which was used to make the transaction satisfying the request. However, Factom uses
the ed25519 signature scheme, while Ethereum currently uses ECDSA over the secp256k1 curve. This means that the EVM
precompiles for signature verification cannot be used and doing an ed25519 signature verification inside the smart
contract is prohibitively expensive.

### Centralized anchoring
The anchoring into Ethereum is currently controlled by a single entity. This means that, in theory, the anchors recorded
could be manipulated and non-existing Factoid transactions could be inserted into the `WindowMR`, thus allowing the
claiming of ETH deposited into the contract, without having made the necessary transaction first.

An additional issue with the anchoring is that of availability: it's possible that a user fulfills a buy request, but
the anchoring is delayed too long and the request expires before the anchor is recorded on the Ethereum blockchain. This
means that the person, who has submitted the buy request, would be able to withdraw their funds despite the fact that
they also recieved the FCT.

## Credits
We would like to thank [Sam Barnes](https://github.com/sambarnes/) for answering a number of questions and also for his
[excellent implementation](https://github.com/sambarnes/factom-core/) of Factom core primitives in Python.
