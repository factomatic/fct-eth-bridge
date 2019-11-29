import hashlib
import itertools as it
from string import Template
import sys

from factom import Factomd
from factom.exceptions import InvalidParams
from factom_core.blocks import DirectoryBlock, FactoidBlock

import utils


factomd = Factomd(host="https://api.factomd.net")


def find_factoid_tx_in_block(tx_id, block):
    for _, transactions in block.body.transactions.items():
        for tx in transactions:
            if tx.tx_id.hex() == tx_id:
                return tx
    raise RuntimeError("{} not found in block".format(tx_id))


def compute_merkle_path_and_pos(tree, leaf):
    path = utils.compute_merkle_path(tree[0].index(leaf), tree)
    path, pos = list(zip(*map(lambda x: ("0x{}".format(x[0].hex()), x[1]), path)))
    return list(path), list(pos)


def fill_and_write_template(template_path, tx_id):
    with open(template_path) as f:
        template = Template(f.read())

    try:
        tx = factomd.transaction(tx_id)
        fb = factomd.factoid_block_by_keymr(tx["includedintransactionblock"])
    except (InvalidParams, KeyError):
        print("Transaction with the given ID not found!")
        sys.exit(1)

    tx_height = tx["includedindirectoryblockheight"]
    factoid_block = FactoidBlock.unmarshal(bytes.fromhex(fb["rawdata"]))
    fb_leaves = utils.factoid_block_body_leaves(factoid_block)
    fb_body_mt = utils.build_merkle_tree([fb_leaves])
    fb_body_mr = utils.compute_merkle_root(fb_leaves)
    db = factomd.directory_block_by_height(tx_height)
    db_entries = db["dblock"]["dbentries"]
    leaves = []
    for db_entry in db_entries:
        leaves.append(bytes.fromhex(db_entry["chainid"]))
        leaves.append(bytes.fromhex(db_entry["keymr"]))
    db_mt = utils.build_merkle_tree([leaves])

    directory_block = DirectoryBlock.unmarshal(bytes.fromhex(db["rawdata"]))
    anchors = factomd.anchors(directory_block.keymr)
    # Convert the transaction to a factom_core.block_elements.FactoidTransaction
    # object
    tx = find_factoid_tx_in_block(tx_id, factoid_block)

    assert len(tx.outputs) == 1, "Transaction must have a single output"

    params = {}
    params["tx_timestamp"] = str("0x{}".format(tx.timestamp.to_bytes(6, "big").hex()))
    params["addresses_count"] = [len(tx.inputs), len(tx.outputs), len(tx.ec_purchases)]
    params["addresses"] = list("0x{}".format(v["fct_address"].hex())
                               for v in it.chain(tx.inputs, tx.outputs, tx.ec_purchases))
    params["amounts"] = list(v["value"] for v in
                             it.chain(tx.inputs, tx.outputs, tx.ec_purchases))
    params["public_keys"] = list("0x{}".format(v.public_key.hex()) for v in tx.rcds)
    signatures = []
    for rcd in tx.rcds:
        signature = rcd.signature
        signatures.append("0x{}".format(signature[:32].hex()))
        signatures.append("0x{}".format(signature[32:].hex()))
    params["signatures"] = signatures
    params["expected_tx_hash"] = "0x{}".format(tx.hash.hex())
    params["tx_block_height"] = tx_height
    path, pos = compute_merkle_path_and_pos(fb_body_mt, tx.hash)
    params["tx_path"] = path
    params["tx_path_positions"] = pos
    path, pos = compute_merkle_path_and_pos(db_mt, factoid_block.keymr)
    params["fblock_path"] = path
    params["fblock_path_positions"] = pos
    path, pos = zip(*utils.build_merkle_path_from_anchors(anchors))
    params["dblock_path"] = list(map(lambda v: "0x{}".format(v.hex()), path))
    params["dblock_path_positions"] = list(pos)
    params["header_hashes_and_merkle_roots"] = [
        "0x{}".format(hashlib.sha256(factoid_block.header.marshal()).hexdigest()),
        "0x{}".format(factoid_block.body.merkle_root.hex()),
        "0x{}".format(hashlib.sha256(directory_block.header.marshal()).hexdigest()),
        "0x{}".format(directory_block.body.merkle_root.hex()),
    ]

    with open("../js/claim_eth_request.js", "w") as f:
        print(template.substitute(**params), file=f)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python generate_claim_eth_params.py factoid_tx_id")
        sys.exit(1)

    fill_and_write_template("../templates/claim_eth_request.js", sys.argv[1])
